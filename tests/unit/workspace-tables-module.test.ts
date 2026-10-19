import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRestaurantTables,
  getRestaurantTablesWithOrders,
  getRestaurantTablesSummary,
  createRestaurantTable,
  updateRestaurantTable,
  deleteRestaurantTable,
  releaseRestaurantTable,
} from "../../src/lib/restaurant/restaurant-service";
import {
  getRestaurantTablesWithOrdersAction,
  createRestaurantTableAction,
  updateRestaurantTableAction,
  deleteRestaurantTableAction,
  releaseRestaurantTableAction,
} from "../../src/app/workspace/[businessId]/mesas/actions";

// ==============================================================================
// CONFIGURACIÓN DE ENTORNO Y SIMULACIÓN TRANSACCIONAL EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111"; // Negocio A (Restaurante)
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222"; // Negocio B (Otro tenant)

interface MockDbTable {
  id: string;
  business_id: string;
  name_or_number: string;
  capacity: number;
  status: "available" | "occupied";
  current_order_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MockDbOrder {
  id: string;
  business_id: string;
  order_number: number;
  table_id: string | null;
  status: string;
  payment_status: string;
  total: number;
  customer_name: string | null;
  created_at: string;
  items?: { quantity: number }[];
}

let inMemoryTables: MockDbTable[] = [];
let inMemoryOrders: MockDbOrder[] = [];

// Mock de permisos de workspace
let mockAuthPermissions: Record<string, boolean> = {
  "tables.view": true,
  "tables.create": true,
  "tables.update": true,
  "tables.delete": true,
  "orders.view": true,
  "orders.update": true,
  "orders.manage": true,
};

let mockAuthContext = {
  businessId: BUSINESS_A,
  userId: "user-admin-123",
  roleCode: "owner",
  roleName: "Propietario",
};

vi.mock("../../src/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(async (businessId: string, permission: string) => {
    if (businessId !== BUSINESS_A) {
      return { success: false, error: "No tienes autorización para acceder a este negocio." };
    }
    if (mockAuthPermissions[permission] === false) {
      return { success: false, error: `Permiso insuficiente: ${permission}` };
    }
    return {
      success: true,
      context: mockAuthContext,
    };
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock del cliente Supabase
const createMockSupabase = () => ({
  from: (tableName: string) => {
    if (tableName === "restaurant_tables") {
      return {
        select: (cols: string) => {
          let filtered = [...inMemoryTables];
          const chain: any = {
            eq: (col: string, val: any) => {
              filtered = filtered.filter((t) => (t as any)[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              filtered = filtered.filter((t) => (t as any)[col] !== val);
              return chain;
            },
            ilike: (col: string, val: string) => {
              const term = val.toLowerCase();
              filtered = filtered.filter((t) =>
                (t as any)[col]?.toLowerCase() === term
              );
              return chain;
            },
            order: (col: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
              filtered.sort((a, b) => {
                const valA = (a as any)[col];
                const valB = (b as any)[col];
                return ascending
                  ? String(valA).localeCompare(String(valB))
                  : String(valB).localeCompare(String(valA));
              });
              return chain;
            },
            maybeSingle: () => {
              const match = filtered[0];
              return Promise.resolve({ data: match || null, error: null });
            },
            single: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: new Error("Row not found") });
              return Promise.resolve({ data: match, error: null });
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: filtered, error: null }).then(resolve, reject),
          };
          return chain;
        },
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              const newRow: MockDbTable = {
                id: `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                ...row,
              };
              inMemoryTables.push(newRow);
              return { data: newRow, error: null };
            },
          }),
        }),
        update: (fields: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              select: () => ({
                single: async () => {
                  const idx = inMemoryTables.findIndex(
                    (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
                  );
                  if (idx === -1) {
                    return { data: null, error: new Error("Registro no encontrado") };
                  }
                  inMemoryTables[idx] = {
                    ...inMemoryTables[idx],
                    ...fields,
                  };
                  return { data: inMemoryTables[idx], error: null };
                },
              }),
              then: (resolve: any, reject?: any) => {
                const idx = inMemoryTables.findIndex(
                  (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
                );
                if (idx !== -1) {
                  inMemoryTables[idx] = {
                    ...inMemoryTables[idx],
                    ...fields,
                  };
                }
                return Promise.resolve({ error: null }).then(resolve, reject);
              },
            }),
          }),
        }),
        delete: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const prevLen = inMemoryTables.length;
              inMemoryTables = inMemoryTables.filter(
                (t) => !((t as any)[col1] === val1 && (t as any)[col2] === val2)
              );
              return Promise.resolve({
                error: null,
                count: prevLen - inMemoryTables.length,
              });
            },
          }),
        }),
      };
    }

    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string, opts?: { count?: string; head?: boolean }) => {
          let filtered = [...inMemoryOrders];

          const chain: any = {
            eq: (col: string, val: any) => {
              filtered = filtered.filter((o) => (o as any)[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              filtered = filtered.filter((o) => (o as any)[col] !== val);
              return chain;
            },
            in: (col: string, vals: string[]) => {
              filtered = filtered.filter((o) => vals.includes((o as any)[col]));
              return chain;
            },
            maybeSingle: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: null });
              return Promise.resolve({
                data: {
                  ...match,
                  restaurant_order_items: match.items || [],
                },
                error: null,
              });
            },
            then: (resolve: any, reject?: any) => {
              if (opts?.head) {
                return Promise.resolve({
                  data: null,
                  count: filtered.length,
                  error: null,
                }).then(resolve, reject);
              }
              return Promise.resolve({
                data: filtered.map((row) => ({
                  ...row,
                  restaurant_order_items: row.items || [],
                })),
                count: filtered.length,
                error: null,
              }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    }

    return {};
  },
});

vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

// ==============================================================================
// SUITE DE PRUEBAS DEL MÓDULO MESAS
// ==============================================================================

describe("NEGOVA — Módulo Mesas (Auditoría, Disponibilidad, Cuentas Activas y Seguridad)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthPermissions = {
      "tables.view": true,
      "tables.create": true,
      "tables.update": true,
      "tables.delete": true,
      "orders.view": true,
      "orders.update": true,
      "orders.manage": true,
    };

    inMemoryTables = [
      {
        id: "tbl-01",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 1",
        capacity: 4,
        status: "available",
        current_order_id: null,
        sort_order: 1,
        created_at: "2026-10-15T10:00:00.000Z",
        updated_at: "2026-10-15T10:00:00.000Z",
      },
      {
        id: "tbl-02",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 2",
        capacity: 2,
        status: "occupied",
        current_order_id: "ord-101",
        sort_order: 2,
        created_at: "2026-10-15T10:00:00.000Z",
        updated_at: "2026-10-15T11:00:00.000Z",
      },
      {
        id: "tbl-03",
        business_id: BUSINESS_A,
        name_or_number: "Terraza 1",
        capacity: 6,
        status: "available",
        current_order_id: null,
        sort_order: 3,
        created_at: "2026-10-15T10:00:00.000Z",
        updated_at: "2026-10-15T10:00:00.000Z",
      },
      // Mesa de otro negocio (Business B) para probar aislamiento multi-tenant
      {
        id: "tbl-foranea",
        business_id: BUSINESS_B,
        name_or_number: "Mesa Tenant B",
        capacity: 4,
        status: "available",
        current_order_id: null,
        sort_order: 1,
        created_at: "2026-10-15T10:00:00.000Z",
        updated_at: "2026-10-15T10:00:00.000Z",
      },
    ];

    inMemoryOrders = [
      {
        id: "ord-101",
        business_id: BUSINESS_A,
        order_number: 101,
        table_id: "tbl-02",
        status: "in_preparation",
        payment_status: "pending",
        total: 48000,
        customer_name: "Familia Morales",
        created_at: "2026-10-15T11:00:00.000Z",
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
      {
        id: "ord-hist-old",
        business_id: BUSINESS_A,
        order_number: 99,
        table_id: "tbl-01", // Mesa 1 tiene pedido histórico pasado
        status: "delivered",
        payment_status: "paid",
        total: 25000,
        customer_name: "Cliente Pasado",
        created_at: "2026-10-14T15:00:00.000Z",
        items: [{ quantity: 1 }],
      },
    ];
  });

  // ============================================================================
  // 1. LISTADO Y AISLAMIENTO MULTI-TENANT
  // ============================================================================
  describe("1 & 2. Listado de Mesas y Aislamiento Multi-Tenant", () => {
    it("debe retornar únicamente las mesas pertenecientes al negocio activo", async () => {
      const tables = await getRestaurantTables(BUSINESS_A);

      expect(tables.length).toBe(3);
      expect(tables.every((t) => t.business_id === BUSINESS_A)).toBe(true);
      expect(tables.some((t) => t.id === "tbl-foranea")).toBe(false);
    });

    it("el negocio B solo ve sus propias mesas", async () => {
      const tables = await getRestaurantTables(BUSINESS_B);

      expect(tables.length).toBe(1);
      expect(tables[0].id).toBe("tbl-foranea");
      expect(tables[0].business_id).toBe(BUSINESS_B);
    });

    it("consulta mesas con datos del pedido activo asociado (getRestaurantTablesWithOrders)", async () => {
      const tablesWithOrders = await getRestaurantTablesWithOrders(BUSINESS_A);

      expect(tablesWithOrders.length).toBe(3);

      const table2 = tablesWithOrders.find((t) => t.id === "tbl-02");
      expect(table2).toBeDefined();
      expect(table2?.status).toBe("occupied");
      expect(table2?.activeOrder).not.toBeNull();
      expect(table2?.activeOrder?.order_number).toBe(101);
      expect(table2?.activeOrder?.customer_name).toBe("Familia Morales");
      expect(table2?.activeOrder?.total).toBe(48000);
      expect(table2?.activeOrder?.items_count).toBe(3);

      const table1 = tablesWithOrders.find((t) => t.id === "tbl-01");
      expect(table1?.status).toBe("available");
      expect(table1?.activeOrder).toBeNull();
    });

    it("calcula correctamente el resumen consolidado de KPIs (getRestaurantTablesSummary)", async () => {
      const summary = await getRestaurantTablesSummary(BUSINESS_A);

      expect(summary.total).toBe(3);
      expect(summary.available).toBe(2);
      expect(summary.occupied).toBe(1);
      expect(summary.occupancyRate).toBe(33); // 1 de 3 = 33%
    });
  });

  // ============================================================================
  // 3. CREACIÓN Y EDICIÓN DE MESAS
  // ============================================================================
  describe("3. Creación y Edición de Mesas", () => {
    it("crea una nueva mesa con nombre, capacidad y orden visual", async () => {
      const res = await createRestaurantTable(BUSINESS_A, {
        name_or_number: "Mesa 4",
        capacity: 4,
        sort_order: 4,
      });

      expect(res.success).toBe(true);
      expect(res.table?.name_or_number).toBe("Mesa 4");
      expect(res.table?.status).toBe("available");
      expect(res.table?.business_id).toBe(BUSINESS_A);

      const tables = await getRestaurantTables(BUSINESS_A);
      expect(tables.length).toBe(4);
    });

    it("rechaza la creación de una mesa sin nombre o número", async () => {
      const res = await createRestaurantTable(BUSINESS_A, {
        name_or_number: "   ",
        capacity: 4,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("El nombre o número de la mesa es requerido");
    });

    it("rechaza crear una mesa con nombre duplicado en el mismo negocio", async () => {
      const res = await createRestaurantTable(BUSINESS_A, {
        name_or_number: "mesa 1", // Ya existe "Mesa 1"
        capacity: 4,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Ya existe una mesa con el nombre");
    });

    it("actualiza datos administrativos de una mesa (capacidad, nombre, orden)", async () => {
      const res = await updateRestaurantTable(BUSINESS_A, "tbl-01", {
        name_or_number: "Mesa VIP",
        capacity: 8,
        sort_order: 10,
      });

      expect(res.success).toBe(true);
      expect(res.table?.name_or_number).toBe("Mesa VIP");
      expect(res.table?.capacity).toBe(8);
      expect(res.table?.sort_order).toBe(10);
    });

    it("rechaza actualizar una mesa de otro comercio", async () => {
      const res = await updateRestaurantTable(BUSINESS_B, "tbl-01", {
        name_or_number: "Hack Mesa",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("no pertenece a este comercio");
    });
  });

  // ============================================================================
  // 4. ELIMINACIÓN SEGURA Y PRESERVACIÓN DE HISTORIAL
  // ============================================================================
  describe("4. Eliminación Segura y Preservación de Historial", () => {
    it("no permite eliminar una mesa que se encuentra actualmente ocupada", async () => {
      const res = await deleteRestaurantTable(BUSINESS_A, "tbl-02");

      expect(res.success).toBe(false);
      expect(res.error).toContain("se encuentra actualmente ocupada");
    });

    it("no permite eliminar físicamente una mesa que posee pedidos históricos asociados", async () => {
      // tbl-01 tiene el pedido histórico ord-hist-old
      const res = await deleteRestaurantTable(BUSINESS_A, "tbl-01");

      expect(res.success).toBe(false);
      expect(res.error).toContain("cuenta con 1 comanda(s) históricas asociadas");

      // Confirmar que sigue existiendo
      const tables = await getRestaurantTables(BUSINESS_A);
      expect(tables.some((t) => t.id === "tbl-01")).toBe(true);
    });

    it("permite eliminar físicamente una mesa libre que carece de historial", async () => {
      // tbl-03 (Terraza 1) no tiene pedidos
      const res = await deleteRestaurantTable(BUSINESS_A, "tbl-03");

      expect(res.success).toBe(true);

      const tables = await getRestaurantTables(BUSINESS_A);
      expect(tables.some((t) => t.id === "tbl-03")).toBe(false);
    });
  });

  // ============================================================================
  // 5. LIBERACIÓN DE MESAS Y REGLAS DE CIERRE DE CUENTA
  // ============================================================================
  describe("5. Liberación de Mesas y Reglas de Cierre de Cuenta", () => {
    it("no permite liberar una mesa si el pedido activo aún está en preparación (no entregado)", async () => {
      const res = await releaseRestaurantTable(BUSINESS_A, "tbl-02");

      expect(res.success).toBe(false);
      expect(res.error).toContain("aún no ha sido entregada");

      // Confirmar que la mesa sigue ocupada
      const tables = await getRestaurantTables(BUSINESS_A);
      const tbl = tables.find((t) => t.id === "tbl-02");
      expect(tbl?.status).toBe("occupied");
    });

    it("no permite liberar una mesa si el pedido fue entregado pero tiene el pago pendiente", async () => {
      // Simular pedido entregado pero no pagado
      const order = inMemoryOrders.find((o) => o.id === "ord-101");
      if (order) {
        order.status = "delivered";
        order.payment_status = "pending";
      }

      const res = await releaseRestaurantTable(BUSINESS_A, "tbl-02");

      expect(res.success).toBe(false);
      expect(res.error).toContain("tiene el pago pendiente");

      const tables = await getRestaurantTables(BUSINESS_A);
      const tbl = tables.find((t) => t.id === "tbl-02");
      expect(tbl?.status).toBe("occupied");
    });

    it("permite liberar la mesa exitosamente cuando el pedido está completado y pagado", async () => {
      // Simular pedido completado y pagado
      const order = inMemoryOrders.find((o) => o.id === "ord-101");
      if (order) {
        order.status = "delivered";
        order.payment_status = "paid";
      }

      const res = await releaseRestaurantTable(BUSINESS_A, "tbl-02");

      expect(res.success).toBe(true);

      const tables = await getRestaurantTables(BUSINESS_A);
      const tbl = tables.find((t) => t.id === "tbl-02");
      expect(tbl?.status).toBe("available");
      expect(tbl?.current_order_id).toBeNull();
    });

    it("permite liberar la mesa si el pedido asociado fue cancelado", async () => {
      // Simular pedido cancelado
      const order = inMemoryOrders.find((o) => o.id === "ord-101");
      if (order) {
        order.status = "cancelled";
      }

      const res = await releaseRestaurantTable(BUSINESS_A, "tbl-02");

      expect(res.success).toBe(true);

      const tables = await getRestaurantTables(BUSINESS_A);
      const tbl = tables.find((t) => t.id === "tbl-02");
      expect(tbl?.status).toBe("available");
      expect(tbl?.current_order_id).toBeNull();
    });

    it("responder con éxito de manera idempotente si la mesa ya está disponible", async () => {
      const res = await releaseRestaurantTable(BUSINESS_A, "tbl-01");
      expect(res.success).toBe(true);
    });
  });

  // ============================================================================
  // 6. SERVER ACTIONS Y VERIFICACIÓN DE PERMISOS (RBAC)
  // ============================================================================
  describe("6. Server Actions y Control de Acceso (RBAC)", () => {
    it("getRestaurantTablesWithOrdersAction valida autorización", async () => {
      mockAuthPermissions["tables.view"] = false;
      mockAuthPermissions["orders.view"] = false;

      const res = await getRestaurantTablesWithOrdersAction(BUSINESS_A);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("createRestaurantTableAction valida permiso 'tables.create'", async () => {
      mockAuthPermissions["tables.create"] = false;
      mockAuthPermissions["tables.manage"] = false;
      mockAuthPermissions["orders.manage"] = false;

      const res = await createRestaurantTableAction(BUSINESS_A, {
        name_or_number: "Mesa 99",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("updateRestaurantTableAction valida permiso 'tables.update'", async () => {
      mockAuthPermissions["tables.update"] = false;
      mockAuthPermissions["tables.manage"] = false;
      mockAuthPermissions["orders.manage"] = false;

      const res = await updateRestaurantTableAction(BUSINESS_A, "tbl-01", {
        name_or_number: "Mesa Renombrada",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("deleteRestaurantTableAction valida permiso 'tables.delete'", async () => {
      mockAuthPermissions["tables.delete"] = false;
      mockAuthPermissions["tables.manage"] = false;
      mockAuthPermissions["orders.manage"] = false;

      const res = await deleteRestaurantTableAction(BUSINESS_A, "tbl-03");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("releaseRestaurantTableAction valida permisos de actualización", async () => {
      mockAuthPermissions["tables.update"] = false;
      mockAuthPermissions["orders.update"] = false;
      mockAuthPermissions["tables.manage"] = false;

      const res = await releaseRestaurantTableAction(BUSINESS_A, "tbl-02");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("ejecuta exitosamente las Server Actions cuando el usuario tiene permisos", async () => {
      mockAuthPermissions = {
        "tables.view": true,
        "tables.create": true,
        "tables.update": true,
        "tables.delete": true,
        "orders.view": true,
        "orders.update": true,
        "orders.manage": true,
      };

      const resList = await getRestaurantTablesWithOrdersAction(BUSINESS_A);
      expect(resList.success).toBe(true);
      expect(resList.data?.tables.length).toBe(3);
      expect(resList.data?.summary.total).toBe(3);

      const resCreate = await createRestaurantTableAction(BUSINESS_A, {
        name_or_number: "Mesa Acción",
      });
      expect(resCreate.success).toBe(true);
    });
  });
});
