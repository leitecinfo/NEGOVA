import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateRestaurantOrderStatus,
  cancelRestaurantOrder,
  syncTableOccupancyAfterOrderChange,
  getRestaurantTables,
} from "../../src/lib/restaurant/restaurant-service";
import { updateRestaurantOrderStatusAction } from "../../src/app/workspace/[businessId]/pedidos/actions";
import { revalidatePath } from "next/cache";

// ==============================================================================
// CONFIGURACIÓN DE ENTORNO Y SIMULACIÓN TRANSACCIONAL EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111"; // Negocio A (Restaurante)
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222"; // Negocio B (Tenant aislado)

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
  order_type: "dine_in" | "takeout" | "delivery";
  created_at: string;
  items?: { quantity: number }[];
}

let inMemoryTables: MockDbTable[] = [];
let inMemoryOrders: MockDbOrder[] = [];

// Mock de permisos de workspace
let mockAuthPermissions: Record<string, boolean> = {
  "orders.view": true,
  "orders.update": true,
  "orders.manage": true,
  "orders.cancel": true,
  "tables.view": true,
  "tables.update": true,
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

// Mock del cliente Supabase con soporte completo para restaurant_tables y restaurant_orders
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
            order: (col: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
              filtered.sort((a, b) => {
                const valA = (a as any)[col];
                const valB = (b as any)[col];
                return ascending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
              });
              return chain;
            },
            maybeSingle: () => {
              const match = filtered[0];
              return Promise.resolve({ data: match || null, error: null });
            },
            single: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: new Error("Mesa no encontrada") });
              return Promise.resolve({ data: match, error: null });
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: filtered, error: null }).then(resolve, reject),
          };
          return chain;
        },
        update: (fields: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = inMemoryTables.findIndex(
                (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
              );
              if (idx !== -1) {
                inMemoryTables[idx] = {
                  ...inMemoryTables[idx],
                  ...fields,
                };
              }
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    }

    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string) => {
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
            order: () => chain,
            range: () => chain,
            maybeSingle: () => {
              const match = filtered[0];
              return Promise.resolve({
                data: match
                  ? { ...match, restaurant_order_items: match.items || [] }
                  : null,
                error: null,
              });
            },
            single: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: new Error("Pedido no encontrado") });
              return Promise.resolve({
                data: { ...match, restaurant_order_items: match.items || [] },
                error: null,
              });
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({
                data: filtered.map((row) => ({
                  ...row,
                  restaurant_order_items: row.items || [],
                })),
                error: null,
              }).then(resolve, reject),
          };
          return chain;
        },
        update: (fields: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              select: () => ({
                single: async () => {
                  const idx = inMemoryOrders.findIndex(
                    (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
                  );
                  if (idx === -1) {
                    return { data: null, error: new Error("Pedido no encontrado") };
                  }
                  inMemoryOrders[idx] = {
                    ...inMemoryOrders[idx],
                    ...fields,
                  };
                  return { data: inMemoryOrders[idx], error: null };
                },
              }),
              then: (resolve: any, reject?: any) => {
                const idx = inMemoryOrders.findIndex(
                  (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
                );
                if (idx !== -1) {
                  inMemoryOrders[idx] = {
                    ...inMemoryOrders[idx],
                    ...fields,
                  };
                }
                return Promise.resolve({ error: null }).then(resolve, reject);
              },
            }),
          }),
        }),
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
// CASOS DE PRUEBA: LIBERACIÓN AUTOMÁTICA DE MESAS AL ENTREGAR PEDIDOS
// ==============================================================================

describe("NEGOVA — Liberación Automática de Mesas al Entregar Pedidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthPermissions = {
      "orders.view": true,
      "orders.update": true,
      "orders.manage": true,
      "orders.cancel": true,
      "tables.view": true,
      "tables.update": true,
    };

    inMemoryTables = [
      {
        id: "tbl-01",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 1",
        capacity: 4,
        status: "occupied",
        current_order_id: "ord-101",
        sort_order: 1,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "tbl-02",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 2",
        capacity: 6,
        status: "occupied",
        current_order_id: "ord-201",
        sort_order: 2,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "tbl-03",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 3",
        capacity: 2,
        status: "available",
        current_order_id: null,
        sort_order: 3,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    inMemoryOrders = [
      // Pedido único en Mesa 1 (en estado 'ready')
      {
        id: "ord-101",
        business_id: BUSINESS_A,
        order_number: 101,
        table_id: "tbl-01",
        status: "ready",
        payment_status: "pending",
        total: 45000,
        customer_name: "Carlos Gómez",
        order_type: "dine_in",
        created_at: new Date(Date.now() - 1800000).toISOString(),
        items: [{ quantity: 2 }],
      },
      // Dos pedidos en Mesa 2: ord-201 (ready) y ord-202 (in_preparation)
      {
        id: "ord-201",
        business_id: BUSINESS_A,
        order_number: 201,
        table_id: "tbl-02",
        status: "ready",
        payment_status: "pending",
        total: 30000,
        customer_name: "Familia Pérez (Platos)",
        order_type: "dine_in",
        created_at: new Date(Date.now() - 1500000).toISOString(),
        items: [{ quantity: 3 }],
      },
      {
        id: "ord-202",
        business_id: BUSINESS_A,
        order_number: 202,
        table_id: "tbl-02",
        status: "in_preparation",
        payment_status: "pending",
        total: 18000,
        customer_name: "Familia Pérez (Bebidas/Postre)",
        order_type: "dine_in",
        created_at: new Date(Date.now() - 900000).toISOString(),
        items: [{ quantity: 2 }],
      },
      // Pedido para llevar (takeout) sin mesa
      {
        id: "ord-301",
        business_id: BUSINESS_A,
        order_number: 301,
        table_id: null,
        status: "ready",
        payment_status: "pending",
        total: 25000,
        customer_name: "Cliente Para Llevar",
        order_type: "takeout",
        created_at: new Date(Date.now() - 600000).toISOString(),
        items: [{ quantity: 1 }],
      },
    ];
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 1: PEDIDO DE UNA MESA LIBERA LA MESA AUTOMÁTICAMENTE
  // --------------------------------------------------------------------------
  it("libera automáticamente la mesa cuando el pedido pasa a estado 'delivered' si no tiene otras comandas activas", async () => {
    // Mesa 1 está inicialmente ocupada por ord-101
    const tableBefore = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(tableBefore?.status).toBe("occupied");
    expect(tableBefore?.current_order_id).toBe("ord-101");

    // Transicionar ord-101 a 'delivered'
    const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-101", "delivered");
    expect(res.success).toBe(true);
    expect(res.order?.status).toBe("delivered");

    // Verificar que la mesa 1 ahora está automáticamente liberada (available y current_order_id = null)
    const tableAfter = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(tableAfter?.status).toBe("available");
    expect(tableAfter?.current_order_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 2: DOS PEDIDOS EN LA MISMA MESA (SEGUNDA COMANDA ACTIVA)
  // --------------------------------------------------------------------------
  it("mantiene la mesa ocupada si tiene otra comanda activa y enlaza el siguiente pedido activo", async () => {
    // Mesa 2 tiene ord-201 (ready) y ord-202 (in_preparation)
    const tableBefore = inMemoryTables.find((t) => t.id === "tbl-02");
    expect(tableBefore?.status).toBe("occupied");

    // Entregar ord-201
    const res1 = await updateRestaurantOrderStatus(BUSINESS_A, "ord-201", "delivered");
    expect(res1.success).toBe(true);

    // La mesa 2 DEBE continuar ocupada porque ord-202 aún está en preparación
    const tableMid = inMemoryTables.find((t) => t.id === "tbl-02");
    expect(tableMid?.status).toBe("occupied");
    // Debe enlazar ord-202 como el current_order_id activo
    expect(tableMid?.current_order_id).toBe("ord-202");

    // Ahora transicionar ord-202 (in_preparation -> ready -> delivered)
    await updateRestaurantOrderStatus(BUSINESS_A, "ord-202", "ready");
    const res2 = await updateRestaurantOrderStatus(BUSINESS_A, "ord-202", "delivered");
    expect(res2.success).toBe(true);

    // Al entregarse la última comanda activa, la mesa 2 ahora SÍ se libera automáticamente
    const tableAfter = inMemoryTables.find((t) => t.id === "tbl-02");
    expect(tableAfter?.status).toBe("available");
    expect(tableAfter?.current_order_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 3: PEDIDOS SIN MESA (TAKEOUT / DELIVERY) NO AFECTAN MESAS
  // --------------------------------------------------------------------------
  it("entrega pedidos para llevar sin modificar ni alterar ninguna mesa", async () => {
    const tablesBefore = JSON.parse(JSON.stringify(inMemoryTables));

    // Entregar pedido para llevar (ord-301)
    const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-301", "delivered");
    expect(res.success).toBe(true);
    expect(res.order?.status).toBe("delivered");

    // Ninguna mesa debió ser afectada
    expect(inMemoryTables.find((t) => t.id === "tbl-01")?.status).toBe(tablesBefore[0].status);
    expect(inMemoryTables.find((t) => t.id === "tbl-02")?.status).toBe(tablesBefore[1].status);
    expect(inMemoryTables.find((t) => t.id === "tbl-03")?.status).toBe(tablesBefore[2].status);
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 4: NO CONFUNDIR ENTREGA CON PAGO (INDEPENDENCIA FINANCIERA)
  // --------------------------------------------------------------------------
  it("la liberación automática no altera el payment_status ('pending') ni genera pagos automáticos", async () => {
    const orderBefore = inMemoryOrders.find((o) => o.id === "ord-101");
    expect(orderBefore?.payment_status).toBe("pending");

    // Entregar ord-101
    await updateRestaurantOrderStatus(BUSINESS_A, "ord-101", "delivered");

    // La mesa se liberó
    const tableAfter = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(tableAfter?.status).toBe("available");

    // El pedido CONSERVA su payment_status en 'pending' intacto
    const orderAfter = inMemoryOrders.find((o) => o.id === "ord-101");
    expect(orderAfter?.payment_status).toBe("pending");
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 5: IDEMPOTENCIA ANTE LLAMADAS DUPLICADAS
  // --------------------------------------------------------------------------
  it("repetir la transición a 'delivered' es idempotente y no genera inconsistencias", async () => {
    // Primera entrega
    const res1 = await updateRestaurantOrderStatus(BUSINESS_A, "ord-101", "delivered");
    expect(res1.success).toBe(true);

    const tableFirst = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(tableFirst?.status).toBe("available");
    expect(tableFirst?.current_order_id).toBeNull();

    // Segunda entrega (idempotente)
    const res2 = await updateRestaurantOrderStatus(BUSINESS_A, "ord-101", "delivered");
    expect(res2.success).toBe(true);

    const tableSecond = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(tableSecond?.status).toBe("available");
    expect(tableSecond?.current_order_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 6: CANCELAR UN PEDIDO TAMBIÉN LIBERA LA MESA CORRECTAMENTE
  // --------------------------------------------------------------------------
  it("cancelar un pedido libera la mesa si no quedan más comandas activas", async () => {
    const res = await cancelRestaurantOrder(BUSINESS_A, "ord-101", "Cliente desistió");
    expect(res.success).toBe(true);

    const order = inMemoryOrders.find((o) => o.id === "ord-101");
    expect(order?.status).toBe("cancelled");

    const table = inMemoryTables.find((t) => t.id === "tbl-01");
    expect(table?.status).toBe("available");
    expect(table?.current_order_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ESCENARIO 7: SERVER ACTION REVALIDA TODAS LAS RUTAS CRÍTICAS (MESAS, PEDIDOS, POS)
  // --------------------------------------------------------------------------
  it("updateRestaurantOrderStatusAction revalida la ruta /workspace/[businessId]/mesas", async () => {
    const res = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-101", "delivered");
    expect(res.success).toBe(true);

    expect(revalidatePath).toHaveBeenCalledWith(`/workspace/${BUSINESS_A}/mesas`);
    expect(revalidatePath).toHaveBeenCalledWith(`/workspace/${BUSINESS_A}/pedidos`);
    expect(revalidatePath).toHaveBeenCalledWith(`/workspace/${BUSINESS_A}/pedidos/ord-101`);
    expect(revalidatePath).toHaveBeenCalledWith(`/workspace/${BUSINESS_A}/pos`);
    expect(revalidatePath).toHaveBeenCalledWith(`/workspace/${BUSINESS_A}/ventas`);
  });
});
