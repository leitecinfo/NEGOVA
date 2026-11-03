import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  LocationTypeSchema,
  CreateLocationInputSchema,
  UpsertStockInputSchema,
  CreateMovementInputSchema,
} from "../../src/lib/inventory/types";
import {
  getBusinessLocations,
  ensureDefaultLocation,
  createLocation,
  getInventoryStock,
  upsertInventoryStock,
  recordInventoryMovement,
  migrateProductStockToNormalized,
} from "../../src/lib/inventory/inventory-service";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222";

let inMemoryLocations: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];
let inMemoryProducts: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "locations") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryLocations];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => {
              list.sort((a, b) => {
                if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
                if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
                return 0;
              });
              return chain;
            },
            limit: (n: number) => {
              list = list.slice(0, n);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => {
              if (list[0]) return Promise.resolve({ data: list[0], error: null });
              return Promise.resolve({ data: null, error: new Error("Row not found") });
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (data: any) => {
          const row = {
            id: data.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...data,
          };
          inMemoryLocations.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "inventory_stock") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryStock];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        upsert: (data: any) => {
          const existingIndex = inMemoryStock.findIndex(
            (s) => s.product_id === data.product_id && s.location_id === data.location_id
          );
          let row: any;
          if (existingIndex >= 0) {
            inMemoryStock[existingIndex] = {
              ...inMemoryStock[existingIndex],
              ...data,
              updated_at: new Date().toISOString(),
            };
            row = inMemoryStock[existingIndex];
          } else {
            row = {
              id: data.id || crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ...data,
            };
            inMemoryStock.push(row);
          }
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "inventory_movements") {
      return {
        insert: (data: any) => {
          const row = {
            id: data.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...data,
          };
          inMemoryMovements.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "products") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryProducts];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => {
              if (list[0]) return Promise.resolve({ data: list[0], error: null });
              return Promise.resolve({ data: null, error: new Error("Row not found") });
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = inMemoryProducts.findIndex(
                (p) => p[col1] === val1 && p[col2] === val2
              );
              if (idx >= 0) {
                inMemoryProducts[idx] = {
                  ...inMemoryProducts[idx],
                  ...data,
                };
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      };
    }

    throw new Error(`Table not mocked: ${tableName}`);
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("INV-001: Esquema normalizado de inventario por ubicación", () => {
  beforeEach(() => {
    inMemoryLocations = [];
    inMemoryStock = [];
    inMemoryMovements = [];
    inMemoryProducts = [];
    vi.clearAllMocks();
  });

  describe("1. Validación de esquemas y tipos Zod", () => {
    it("valida tipos de ubicación permitidos ('point_of_sale', 'warehouse', 'branch')", () => {
      expect(LocationTypeSchema.safeParse("point_of_sale").success).toBe(true);
      expect(LocationTypeSchema.safeParse("warehouse").success).toBe(true);
      expect(LocationTypeSchema.safeParse("branch").success).toBe(true);
      expect(LocationTypeSchema.safeParse("invalid_type").success).toBe(false);
    });

    it("valida la creación de ubicaciones con datos válidos", () => {
      const valid = CreateLocationInputSchema.safeParse({
        name: "Cocina Principal",
        type: "point_of_sale",
        address: "Calle 10 # 4-20",
        isVisibleInMenu: true,
        isActive: true,
      });
      expect(valid.success).toBe(true);
    });

    it("rechaza la creación de ubicaciones con nombre vacío", () => {
      const invalid = CreateLocationInputSchema.safeParse({
        name: "   ",
        type: "warehouse",
      });
      expect(invalid.success).toBe(false);
    });

    it("valida los tipos de movimiento permitidos", () => {
      const validTypes = [
        "entry",
        "exit",
        "adjustment",
        "transfer_in",
        "transfer_out",
        "sale",
        "spoilage",
      ];
      validTypes.forEach((t) => {
        const res = CreateMovementInputSchema.safeParse({
          productId: "11111111-1111-4111-8111-111111111111",
          locationId: "22222222-2222-4222-8222-222222222222",
          movementType: t,
          quantity: 10,
        });
        expect(res.success).toBe(true);
      });

      const invalid = CreateMovementInputSchema.safeParse({
        productId: "11111111-1111-4111-8111-111111111111",
        locationId: "22222222-2222-4222-8222-222222222222",
        movementType: "unknown_movement",
        quantity: 10,
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("2. Gestión de ubicaciones y ubicación por defecto", () => {
    it("crea automáticamente la ubicación 'point_of_sale' si el negocio no tiene ninguna", async () => {
      const loc = await ensureDefaultLocation(BUSINESS_A);
      expect(loc).toBeDefined();
      expect(loc.businessId).toBe(BUSINESS_A);
      expect(loc.type).toBe("point_of_sale");
      expect(loc.name).toBe("Punto Principal");
      expect(loc.isActive).toBe(true);

      // Si se llama de nuevo, es idempotente y devuelve la misma ubicación existente
      const secondCall = await ensureDefaultLocation(BUSINESS_A);
      expect(secondCall.id).toBe(loc.id);
      expect(inMemoryLocations.filter((l) => l.business_id === BUSINESS_A).length).toBe(1);
    });

    it("permite registrar nuevas ubicaciones como bodegas y sucursales", async () => {
      const newLoc = await createLocation(BUSINESS_A, {
        name: "Bodega Central",
        type: "warehouse",
        address: "Av. Principal # 15-30",
        isVisibleInMenu: false,
        isActive: true,
      });

      expect(newLoc.id).toBeDefined();
      expect(newLoc.type).toBe("warehouse");
      expect(newLoc.name).toBe("Bodega Central");

      const all = await getBusinessLocations(BUSINESS_A);
      expect(all.length).toBe(1);
      expect(all[0].name).toBe("Bodega Central");
    });

    it("mantiene aislamiento estricto multi-tenant de ubicaciones", async () => {
      await createLocation(BUSINESS_A, { name: "Local Negocio A", type: "point_of_sale" });
      await createLocation(BUSINESS_B, { name: "Local Negocio B", type: "point_of_sale" });

      const locsA = await getBusinessLocations(BUSINESS_A);
      const locsB = await getBusinessLocations(BUSINESS_B);

      expect(locsA.length).toBe(1);
      expect(locsA[0].name).toBe("Local Negocio A");

      expect(locsB.length).toBe(1);
      expect(locsB[0].name).toBe("Local Negocio B");
    });
  });

  describe("3. Existencias (inventory_stock) y Movimientos (inventory_movements)", () => {
    it("registra y actualiza existencias de forma idempotente por producto y ubicación", async () => {
      const loc = await ensureDefaultLocation(BUSINESS_A);
      const productId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

      const stock1 = await upsertInventoryStock(BUSINESS_A, {
        productId,
        locationId: loc.id,
        quantity: 25,
        minStock: 5,
        cost: 12000,
      });

      expect(stock1.quantity).toBe(25);
      expect(stock1.minStock).toBe(5);
      expect(stock1.cost).toBe(12000);

      // Actualizar cantidad
      const stock2 = await upsertInventoryStock(BUSINESS_A, {
        productId,
        locationId: loc.id,
        quantity: 30,
      });

      expect(stock2.quantity).toBe(30);
      expect(inMemoryStock.length).toBe(1);
    });

    it("registra movimientos de inventario con tipo, costo y referencia", async () => {
      const loc = await ensureDefaultLocation(BUSINESS_A);
      const productId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

      inMemoryProducts.push({
        id: productId,
        business_id: BUSINESS_A,
        name: "Producto Test",
        metadata: { track_stock: true, stock_quantity: 0 },
      });

      const mov = await recordInventoryMovement(
        BUSINESS_A,
        {
          productId,
          locationId: loc.id,
          movementType: "entry",
          quantity: 50,
          unitCost: 15000,
          totalCost: 750000,
          notes: "Compra a proveedor inicial",
          referenceType: "purchase",
        },
        "usr_owner_1"
      );

      expect(mov.id).toBeDefined();
      expect(mov.movementType).toBe("entry");
      expect(mov.quantity).toBe(50);
      expect(mov.unitCost).toBe(15000);
      expect(mov.totalCost).toBe(750000);
      expect(mov.createdBy).toBe("usr_owner_1");
    });
  });

  describe("4. Migración de datos desde metadata.track_stock (Criterios de Aceptación)", () => {
    it("migra los productos con track_stock = true creando registros en inventory_stock", async () => {
      // Configurar productos en el negocio A
      inMemoryProducts = [
        {
          id: "p1111111-1111-4111-8111-111111111111",
          business_id: BUSINESS_A,
          name: "Hamburguesa Clásica",
          status: "active",
          metadata: {
            track_stock: true,
            stock_quantity: 42,
            min_stock: 10,
          },
        },
        {
          id: "p2222222-2222-4222-8222-222222222222",
          business_id: BUSINESS_A,
          name: "Gaseosa Cola",
          status: "active",
          metadata: {
            track_stock: "true",
            stock_quantity: "100",
            min_stock: "20",
          },
        },
        {
          id: "p3333333-3333-4333-8333-333333333333",
          business_id: BUSINESS_A,
          name: "Servicio de Domicilio",
          status: "active",
          metadata: {
            track_stock: false,
            stock_quantity: 0,
          },
        },
      ];

      const migrationResult = await migrateProductStockToNormalized(BUSINESS_A);

      // Deben migrarse exactamente 2 productos con control de existencias
      expect(migrationResult.migratedCount).toBe(2);

      const stockA = await getInventoryStock(BUSINESS_A);
      expect(stockA.length).toBe(2);

      const p1Stock = stockA.find((s) => s.productId === "p1111111-1111-4111-8111-111111111111");
      expect(p1Stock).toBeDefined();
      expect(p1Stock?.quantity).toBe(42);
      expect(p1Stock?.minStock).toBe(10);

      const p2Stock = stockA.find((s) => s.productId === "p2222222-2222-4222-8222-222222222222");
      expect(p2Stock).toBeDefined();
      expect(p2Stock?.quantity).toBe(100);
      expect(p2Stock?.minStock).toBe(20);

      // Criterio de aceptación crítico: metadata no se elimina (backward compatibility)
      const p1 = inMemoryProducts.find((p) => p.id === "p1111111-1111-4111-8111-111111111111");
      expect(p1.metadata.stock_quantity).toBe(42);
      expect(p1.metadata.track_stock).toBe(true);
    });
  });

  describe("5. Validación estática del archivo de migración SQL", () => {
    it("el archivo de migración contiene todas las tablas, restricciones, RLS y triggers requeridos", () => {
      const migrationPath = join(
        process.cwd(),
        "supabase/migrations/20261029180000_inventory_locations_and_stock_schema.sql"
      );
      const sqlContent = readFileSync(migrationPath, "utf-8");

      // Tablas requeridas
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.locations");
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.inventory_stock");
      expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.inventory_movements");

      // Restricción única en inventory_stock (product_id, location_id)
      expect(sqlContent).toContain("UNIQUE(product_id, location_id)");

      // Claves foráneas y tipos esperados
      expect(sqlContent).toContain("REFERENCES public.businesses(id)");
      expect(sqlContent).toContain("REFERENCES public.products(id)");
      expect(sqlContent).toContain("REFERENCES public.locations(id)");

      // RLS habilitado
      expect(sqlContent).toContain("ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;");
      expect(sqlContent).toContain("ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;");
      expect(sqlContent).toContain("ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;");

      // Políticas RLS con filtro por business_id
      expect(sqlContent).toContain("tenant_locations_read");
      expect(sqlContent).toContain("tenant_inventory_stock_read");
      expect(sqlContent).toContain("tenant_inventory_movements_read");
      expect(sqlContent).toContain("WHERE bu.business_id = locations.business_id");
      expect(sqlContent).toContain("WHERE bu.business_id = inventory_stock.business_id");
      expect(sqlContent).toContain("WHERE bu.business_id = inventory_movements.business_id");

      // Trigger para creación automática de ubicación inicial
      expect(sqlContent).toContain("CREATE OR REPLACE FUNCTION public.handle_new_business_default_location()");
      expect(sqlContent).toContain("CREATE TRIGGER trg_business_default_location");

      // Migración de datos idempotente
      expect(sqlContent).toContain("WHERE NOT EXISTS");
      expect(sqlContent).toContain("ON CONFLICT (product_id, location_id) DO NOTHING");
    });
  });
});
