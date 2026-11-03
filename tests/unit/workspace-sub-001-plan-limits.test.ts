import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Mock verifyWorkspaceAction & permissions
const mockVerifyWorkspaceAction = vi.fn();
const mockVerifyUserPermission = vi.fn();

vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: (...args: any[]) => mockVerifyWorkspaceAction(...args),
  requireWorkspaceSession: vi.fn(async () => ({
    user: { id: "user-123" },
    businessId: "11111111-1111-4111-8111-111111111111",
    isOwner: true,
    roleCode: "owner",
  })),
}));

vi.mock("@/lib/auth/authorization", () => ({
  verifyUserPermission: (...args: any[]) => mockVerifyUserPermission(...args),
}));

// Mock audit service
vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  checkPlanLimit,
  assertPlanLimit,
  getBusinessPlanOverview,
  normalizePlanCode,
  PLAN_RESOURCE_LIMITS,
} from "@/lib/subscriptions/plan-limits-service";
import { createWorkspaceUserAction } from "@/app/workspace/[businessId]/usuarios/actions";
import { createLocation } from "@/lib/inventory/inventory-service";
import { createCashRegister } from "@/lib/cash/cash-service";
import { createRecipe } from "@/lib/recipes/recipe-service";
import { createSaleAction } from "@/app/workspace/[businessId]/ventas/actions";
import { createCustomer } from "@/lib/customers/customers-service";

describe("[SUB-001] Implementar límites de plan en servidor para todos los recursos", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWorkspaceAction.mockResolvedValue({
      success: true,
      context: { businessId, userId: "user-123" },
    });
    mockVerifyUserPermission.mockResolvedValue({
      userId: "user-123",
      businessId,
    });
  });

  describe("1. Matriz de límites canónicos por plan", () => {
    it("valida la configuración de límites del plan STARTER / INICIO", () => {
      const limits = PLAN_RESOURCE_LIMITS.starter;
      expect(limits.products).toBe(50);
      expect(limits.employees).toBe(3);
      expect(limits.locations).toBe(1);
      expect(limits.registers).toBe(1);
      expect(limits.recipes).toBe(20);
      expect(limits.sales).toBe(300);
      expect(limits.customers).toBe(100);
    });

    it("valida la configuración de límites del plan PROFESSIONAL / CRECE", () => {
      const limits = PLAN_RESOURCE_LIMITS.professional;
      expect(limits.products).toBe(500);
      expect(limits.employees).toBe(15);
      expect(limits.locations).toBe(3);
      expect(limits.registers).toBe(5);
      expect(limits.recipes).toBe(200);
    });

    it("valida que ENTERPRISE / NEGOCIO tiene límites ilimitados (-1)", () => {
      const limits = PLAN_RESOURCE_LIMITS.enterprise;
      expect(limits.products).toBe(-1);
      expect(limits.employees).toBe(-1);
      expect(limits.locations).toBe(-1);
      expect(limits.registers).toBe(-1);
      expect(limits.recipes).toBe(-1);
      expect(limits.sales).toBe(-1);
      expect(limits.customers).toBe(-1);
    });

    it("normaliza códigos de plan canónicos e internacionales", () => {
      expect(normalizePlanCode("STARTER").code).toBe("starter");
      expect(normalizePlanCode("inicio").code).toBe("starter");
      expect(normalizePlanCode("PROFESSIONAL").code).toBe("professional");
      expect(normalizePlanCode("crece").code).toBe("professional");
      expect(normalizePlanCode("ENTERPRISE").code).toBe("enterprise");
      expect(normalizePlanCode("negocio").code).toBe("enterprise");
      expect(normalizePlanCode(null).code).toBe("starter");
    });
  });

  describe("2. Criterio de Aceptación 1: Un negocio en STARTER no puede crear el empleado #4 (límite 3)", () => {
    it("permite crear empleado si el negocio tiene 2 empleados (dentro del límite 3)", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "business_users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const check = await checkPlanLimit(businessId, "employees");
      expect(check.allowed).toBe(true);
      expect(check.currentCount).toBe(2);
      expect(check.maxLimit).toBe(3);
    });

    it("bloquea la creación del empleado #4 cuando ya hay 3 empleados activos en plan STARTER", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "business_users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const check = await checkPlanLimit(businessId, "employees");
      expect(check.allowed).toBe(false);
      expect(check.currentCount).toBe(3);
      expect(check.maxLimit).toBe(3);
      expect(check.error).toContain("Has alcanzado el límite de empleados en tu plan (Starter). Límite: 3");

      // Verificar en la server action createWorkspaceUserAction
      const actionRes = await createWorkspaceUserAction(businessId, {
        email: "nuevo@empleado.com",
        fullName: "Nuevo Empleado",
        roleCode: "auxiliar",
      });

      expect(actionRes.success).toBe(false);
      expect(actionRes.error).toContain("Has alcanzado el límite de empleados en tu plan (Starter). Límite: 3");
    });
  });

  describe("3. Criterio de Aceptación 2: Mensaje de error descriptivo con recurso y límite", () => {
    it("genera un mensaje claro indicando qué recurso se limitó y el tope del plan", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "locations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const check = await checkPlanLimit(businessId, "locations");
      expect(check.allowed).toBe(false);
      expect(check.error).toBe(
        "Has alcanzado el límite de ubicaciones/sucursales en tu plan (Starter). Límite: 1. Mejora tu plan para continuar."
      );
    });

    it("lanza excepción con assertPlanLimit cuando se excede la cuota de cajas registradoras", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "cash_registers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        createCashRegister(businessId, { name: "Caja Secundaria", isActive: true })
      ).rejects.toThrow(/Has alcanzado el límite de cajas registradoras en tu plan \(Starter\)\. Límite: 1/);
    });

    it("lanza excepción al intentar crear una receta si se alcanzó el límite de recetas (20 en Starter)", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "recipes") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ count: 20, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        createRecipe(businessId, {
          productId: "p-1",
          name: "Receta Hamburguesa",
          portionYield: 1,
          ingredients: [],
        })
      ).rejects.toThrow(/Has alcanzado el límite de recetas en tu plan \(Starter\)\. Límite: 20/);
    });
  });

  describe("4. Criterio de Aceptación 3: ENTERPRISE no tiene restricciones numéricas", () => {
    it("permite crear recursos sin límite numérico en plan ENTERPRISE", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "enterprise", plans: { code: "enterprise", name: "Enterprise" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "products") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ count: 99999, error: null }),
              }),
            }),
          };
        }
        if (table === "business_users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 500, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const productCheck = await checkPlanLimit(businessId, "products");
      expect(productCheck.allowed).toBe(true);
      expect(productCheck.isUnlimited).toBe(true);
      expect(productCheck.maxLimit).toBe(-1);

      const empCheck = await checkPlanLimit(businessId, "employees");
      expect(empCheck.allowed).toBe(true);
      expect(empCheck.isUnlimited).toBe(true);
      expect(empCheck.maxLimit).toBe(-1);
    });
  });

  describe("5. Validación en Server Actions de Ventas y Clientes", () => {
    it("bloquea createSaleAction si se excede la cuota de ventas del mes", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "business_sale_documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ count: 300, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await createSaleAction(businessId, {
        customerName: "Juan Pérez",
        items: [{ description: "Café", quantity: 1, unitPrice: 5000 }],
        paymentMethod: "cash",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Has alcanzado el límite de documentos de venta del mes");
    });

    it("bloquea createCustomer si se excede la cuota de clientes", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "customers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ count: 100, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await createCustomer(businessId, {
        fullName: "Cliente Nuevo",
        phone: "3001234567",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Has alcanzado el límite de clientes");
    });
  });

  describe("6. Resumen de Capacidad del Negocio (getBusinessPlanOverview)", () => {
    it("devuelve los porcentajes y métricas de uso de todos los recursos del plan", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { plan_id: "starter", plans: { code: "starter", name: "Starter" } },
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        const resolvedCount = table === "products" ? 25 : table === "employees" ? 2 : 1;

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: resolvedCount, error: null }),
              neq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 50, error: null }),
                then: (resolve: any) => resolve({ count: resolvedCount, error: null }),
              }),
            }),
          }),
        };
      });

      const overview = await getBusinessPlanOverview(businessId);
      expect(overview.planCode).toBe("starter");
      expect(overview.resources.products.limit).toBe(50);
      expect(overview.resources.employees.limit).toBe(3);
      expect(overview.resources.locations.limit).toBe(1);
      expect(overview.resources.registers.limit).toBe(1);
      expect(overview.resources.recipes.limit).toBe(20);
    });
  });
});
