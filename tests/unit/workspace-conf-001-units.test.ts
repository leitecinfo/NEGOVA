import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock Supabase
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Mock workspace auth
const mockVerifyWorkspaceAction = vi.fn();
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: (...args: any[]) => mockVerifyWorkspaceAction(...args),
  requireWorkspaceSession: vi.fn(async () => ({
    user: { id: "user-123" },
    businessId: "11111111-1111-4111-8111-111111111111",
    isOwner: true,
    roleCode: "owner",
    permissions: ["business_settings.view", "business_settings.update"],
  })),
}));

import {
  seedDefaultMeasurementUnits,
  getMeasurementUnits,
  createMeasurementUnit,
  updateMeasurementUnit,
  checkUnitUsage,
  deleteMeasurementUnit,
  convertMeasurementQuantity,
} from "@/lib/units/units-service";
import {
  getMeasurementUnitsAction,
  createMeasurementUnitAction,
  updateMeasurementUnitAction,
  deleteMeasurementUnitAction,
  checkUnitUsageAction,
} from "@/app/workspace/[businessId]/configuracion/unidades/actions";
import { MeasurementUnit } from "@/lib/units/types";

describe("[CONF-001] Configuración de Unidades de Medida y Conversiones", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWorkspaceAction.mockResolvedValue({
      success: true,
      context: { businessId },
      session: { userId: "user-123", businessId },
    });
  });

  describe("1. Auto-semilla de unidades base al crear/iniciar un negocio", () => {
    it("genera las 4 unidades base (kg, lt, m, un) y derivadas del sistema si el comercio no tiene unidades", async () => {
      const insertedRows: any[] = [];

      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockImplementation((fields, opts) => {
              if (opts?.count === "exact" && opts?.head) {
                return {
                  eq: vi.fn().mockResolvedValue({ count: 0 }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
                  }),
                }),
              };
            }),
            insert: vi.fn().mockImplementation((payload) => {
              const row = { id: `unit-${insertedRows.length + 1}`, ...payload };
              insertedRows.push(row);
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: row, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      });

      await seedDefaultMeasurementUnits(businessId);

      // Debe haber generado las 4 magnitudes base (kg, lt, m, un) y las 4 derivadas (g, ml, cm, porc)
      expect(insertedRows.length).toBe(8);

      const baseUnits = insertedRows.filter((r) => r.is_base);
      expect(baseUnits.length).toBe(4);
      expect(baseUnits.map((u) => u.abbreviation).sort()).toEqual(["kg", "lt", "m", "un"]);
      baseUnits.forEach((bu) => {
        expect(bu.conversion_factor).toBe(1.0);
        expect(bu.is_system).toBe(true);
      });

      const derivedUnits = insertedRows.filter((r) => !r.is_base);
      expect(derivedUnits.length).toBe(4);
      expect(derivedUnits.map((u) => u.abbreviation).sort()).toEqual(["cm", "g", "ml", "porc"]);
    });
  });

  describe("2. Creación de unidad personalizada con factor de conversión (ej. 'lb' = 0.4536 kg)", () => {
    it("crea la unidad 'lb' de tipo peso con factor de conversión 0.4536 respecto a kg", async () => {
      const kgBaseUnitId = "base-kg-id";

      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((field, val) => {
                if (field === "business_id") {
                  return {
                    eq: vi.fn().mockImplementation((f2, val2) => {
                      if (f2 === "abbreviation") {
                        // Simula que 'lb' no existe aún
                        return { maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
                      }
                      if (f2 === "type") {
                        return {
                          eq: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: { id: kgBaseUnitId, abbreviation: "kg", name: "Kilogramo" },
                            }),
                          }),
                        };
                      }
                      return { maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
                    }),
                  };
                }
                return {};
              }),
            }),
            insert: vi.fn().mockImplementation((payload) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "new-lb-id",
                    ...payload,
                    base_unit: { name: "Kilogramo", abbreviation: "kg" },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            })),
          };
        }
        return {};
      });

      const unit = await createMeasurementUnit(businessId, {
        name: "Libra",
        abbreviation: "lb",
        type: "weight",
        conversionFactor: 0.4536,
      });

      expect(unit).toBeDefined();
      expect(unit.name).toBe("Libra");
      expect(unit.abbreviation).toBe("lb");
      expect(unit.type).toBe("weight");
      expect(unit.conversionFactor).toBe(0.4536);
      expect(unit.baseUnitId).toBe(kgBaseUnitId);
      expect(unit.isBase).toBe(false);
      expect(unit.isSystem).toBe(false);
    });

    it("previene la creación de unidades con abreviaciones duplicadas en el mismo negocio", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing-id" } }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        createMeasurementUnit(businessId, {
          name: "Libra Duplicada",
          abbreviation: "lb",
          type: "weight",
          conversionFactor: 0.4536,
        })
      ).rejects.toThrow(/Ya existe una unidad con la abreviación/i);
    });
  });

  describe("3. Conversión matemática de magnitudes", () => {
    const kgUnit: MeasurementUnit = {
      id: "u-kg",
      businessId,
      name: "Kilogramo",
      abbreviation: "kg",
      type: "weight",
      isBase: true,
      conversionFactor: 1.0,
      isSystem: true,
      createdAt: "",
      updatedAt: "",
    };

    const gUnit: MeasurementUnit = {
      id: "u-g",
      businessId,
      name: "Gramo",
      abbreviation: "g",
      type: "weight",
      isBase: false,
      conversionFactor: 0.001,
      baseUnitId: "u-kg",
      isSystem: true,
      createdAt: "",
      updatedAt: "",
    };

    const lbUnit: MeasurementUnit = {
      id: "u-lb",
      businessId,
      name: "Libra",
      abbreviation: "lb",
      type: "weight",
      isBase: false,
      conversionFactor: 0.4536,
      baseUnitId: "u-kg",
      isSystem: false,
      createdAt: "",
      updatedAt: "",
    };

    const ltUnit: MeasurementUnit = {
      id: "u-lt",
      businessId,
      name: "Litro",
      abbreviation: "lt",
      type: "volume",
      isBase: true,
      conversionFactor: 1.0,
      isSystem: true,
      createdAt: "",
      updatedAt: "",
    };

    it("convierte 1 lb a kilogramos con precisión decimal", () => {
      const result = convertMeasurementQuantity(lbUnit, kgUnit, 1);
      expect(result).toBe(0.4536);
    });

    it("convierte 2 kg a gramos", () => {
      const result = convertMeasurementQuantity(kgUnit, gUnit, 2);
      expect(result).toBe(2000);
    });

    it("convierte 500 g a kilogramos", () => {
      const result = convertMeasurementQuantity(gUnit, kgUnit, 500);
      expect(result).toBe(0.5);
    });

    it("convierte 10 lb a gramos", () => {
      // 10 lb * 0.4536 = 4.536 kg / 0.001 = 4536 g
      const result = convertMeasurementQuantity(lbUnit, gUnit, 10);
      expect(result).toBe(4536);
    });

    it("lanza un error al intentar convertir magnitudes incompatibles (peso vs volumen)", () => {
      expect(() => convertMeasurementQuantity(kgUnit, ltUnit, 1)).toThrow(
        /No se puede convertir entre tipos incompatibles/i
      );
    });
  });

  describe("4. Reglas de integridad y prevención de eliminación", () => {
    it("no permite eliminar unidades base del sistema", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "u-kg",
                      name: "Kilogramo",
                      abbreviation: "kg",
                      is_base: true,
                      is_system: true,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(deleteMeasurementUnit(businessId, "u-kg")).rejects.toThrow(
        /Las unidades base predeterminadas del sistema no pueden ser eliminadas/i
      );
    });

    it("no permite eliminar una unidad que está en uso en ingredientes de recetas", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "u-lb",
                      name: "Libra",
                      abbreviation: "lb",
                      is_base: false,
                      is_system: false,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "recipe_ingredients") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "ri-1",
                    unit: "lb",
                    recipe: { name: "Hamburguesa Doble", business_id: businessId },
                  },
                ],
              }),
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(deleteMeasurementUnit(businessId, "u-lb")).rejects.toThrow(
        /No se puede eliminar la unidad «Libra \(lb\)» porque está en uso en 1 ingrediente\(s\) en recetas/i
      );
    });

    it("no permite eliminar una unidad que está en uso en el catálogo de productos", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "u-lb",
                      name: "Libra",
                      abbreviation: "lb",
                      is_base: false,
                      is_system: false,
                    },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "recipe_ingredients") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockResolvedValue({
                  data: [{ id: "prod-1", name: "Carne Molida Especial" }],
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(deleteMeasurementUnit(businessId, "u-lb")).rejects.toThrow(
        /No se puede eliminar la unidad «Libra \(lb\)» porque está en uso en 1 producto\(s\) en catálogo/i
      );
    });

    it("elimina exitosamente una unidad personalizada que no está en uso", async () => {
      const deleteFn = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "measurement_units") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "u-unused",
                      name: "Onza Especial",
                      abbreviation: "ozesp",
                      is_base: false,
                      is_system: false,
                    },
                  }),
                }),
              }),
            }),
            delete: deleteFn,
          };
        }
        if (table === "recipe_ingredients") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await deleteMeasurementUnit(businessId, "u-unused");
      expect(res.success).toBe(true);
      expect(res.message).toContain("fue eliminada exitosamente");
    });
  });

  describe("5. Server Actions y Autorización", () => {
    it("valida autorización en deleteMeasurementUnitAction y rechaza si no está autorizado", async () => {
      mockVerifyWorkspaceAction.mockResolvedValueOnce({
        success: false,
        error: "Acceso denegado: permiso business_settings.update requerido",
      });

      const res = await deleteMeasurementUnitAction(businessId, "u-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Acceso denegado");
    });

    it("verifica el estado de uso mediante checkUnitUsageAction", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "recipe_ingredients") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                ilike: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await checkUnitUsageAction(businessId, "g");
      expect(res.success).toBe(true);
      expect(res.inUse).toBe(false);
      expect(res.count).toBe(0);
    });
  });

  describe("6. Regla Global: Prohibición de Alertas Nativas", () => {
    it("verifica que no se use window.alert, window.confirm, window.prompt ni Alert.alert en la configuración de unidades", () => {
      const unitsDir = path.resolve(
        __dirname,
        "../../src/app/workspace/[businessId]/configuracion/unidades"
      );
      const files = fs.readdirSync(unitsDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

      for (const file of files) {
        const content = fs.readFileSync(path.join(unitsDir, file), "utf-8");
        expect(content).not.toMatch(/window\.alert\s*\(/);
        expect(content).not.toMatch(/window\.confirm\s*\(/);
        expect(content).not.toMatch(/window\.prompt\s*\(/);
        expect(content).not.toMatch(/Alert\.alert\s*\(/);
      }
    });
  });
});
