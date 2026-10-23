import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VALID_ORDER_STATUS_TRANSITIONS,
  type RestaurantOrderWithDetails,
} from "../../src/lib/restaurant/types";
import {
  getRestaurantOrdersList,
  getRestaurantOrdersSummary,
  getRestaurantOrderWithDetails,
  updateRestaurantOrderStatus,
  cancelRestaurantOrder,
} from "../../src/lib/restaurant/restaurant-service";
import {
  getRestaurantOrdersListAction,
  getRestaurantOrdersSummaryAction,
  updateRestaurantOrderStatusAction,
  cancelRestaurantOrderAction,
} from "../../src/app/workspace/[businessId]/pedidos/actions";

// ==============================================================================
// CONFIGURACIÓN DE ENTORNO Y SIMULACIÓN TRANSACCIONAL EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111"; // Negocio A
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222"; // Negocio B (Tenant aislado)

interface MockDbOrder {
  id: string;
  business_id: string;
  order_number: number;
  status: string;
  order_type: string;
  channel_origin: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_reference: string | null;
  delivery_status: string | null;
  driver_name: string | null;
  payment_status: string;
  idempotency_key: string | null;
  idempotency_hash: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: any[];
}

let inMemoryOrders: MockDbOrder[] = [];
let inMemoryTables: { id: string; business_id: string; name_or_number: string }[] = [];

// Mock de autenticación y permisos de workspace
let mockAuthPermissions: Record<string, boolean> = {
  "orders.view": true,
  "orders.update": true,
  "orders.cancel": true,
};

let mockAuthContext = {
  businessId: BUSINESS_A,
  userId: "user-test-admin",
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
            order: () => chain,
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: filtered, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string, opts?: { count?: string }) => {
          let filtered = [...inMemoryOrders];

          const builder: any = {
            eq: (col: string, val: any) => {
              filtered = filtered.filter((o) => (o as any)[col] === val);
              return builder;
            },
            or: (orCondition: string) => {
              const parts = orCondition.split(",");
              filtered = filtered.filter((o) => {
                return parts.some((p) => {
                  if (p.startsWith("order_number.eq.")) {
                    const num = Number(p.replace("order_number.eq.", ""));
                    return o.order_number === num;
                  }
                  if (p.includes(".ilike.")) {
                    const term = p.split(".ilike.%")[1]?.replace(/%/g, "").toLowerCase() || "";
                    return (o.customer_name || "").toLowerCase().includes(term);
                  }
                  return false;
                });
              });
              return builder;
            },
            ilike: (col: string, val: string) => {
              const term = val.replace(/%/g, "").toLowerCase();
              filtered = filtered.filter((o) =>
                String((o as any)[col] || "").toLowerCase().includes(term)
              );
              return builder;
            },
            gte: (col: string, val: string) => {
              filtered = filtered.filter((o) => (o as any)[col] >= val);
              return builder;
            },
            lte: (col: string, val: string) => {
              filtered = filtered.filter((o) => (o as any)[col] <= val);
              return builder;
            },
            order: (col: string, { ascending }: { ascending: boolean }) => {
              filtered.sort((a, b) => {
                const valA = (a as any)[col];
                const valB = (b as any)[col];
                return ascending
                  ? String(valA).localeCompare(String(valB))
                  : String(valB).localeCompare(String(valA));
              });
              return builder;
            },
            range: (from: number, to: number) => {
              const totalCount = filtered.length;
              const pageSlice = filtered.slice(from, to + 1).map((row) => ({
                ...row,
                restaurant_order_items: row.items || [],
              }));
              return Promise.resolve({
                data: pageSlice,
                count: totalCount,
                error: null,
              });
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
            single: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: new Error("Row not found") });
              return Promise.resolve({
                data: {
                  ...match,
                  restaurant_order_items: match.items || [],
                },
                error: null,
              });
            },
            then: (resolve: any, reject?: any) => {
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
          return builder;
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
                    return { data: null, error: new Error("Registro no encontrado") };
                  }
                  inMemoryOrders[idx] = {
                    ...inMemoryOrders[idx],
                    ...fields,
                  };
                  return { data: inMemoryOrders[idx], error: null };
                },
              }),
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
// CASOS DE PRUEBA: MÓDULO PEDIDOS NEGOVA
// ==============================================================================

describe("NEGOVA — Módulo Pedidos (Auditoría, Ciclo Operativo, Filtros y Seguridad)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthPermissions = {
      "orders.view": true,
      "orders.update": true,
      "orders.cancel": true,
    };

    inMemoryTables = [
      { id: "tbl-01", business_id: BUSINESS_A, name_or_number: "Mesa 4" },
      { id: "tbl-02", business_id: BUSINESS_A, name_or_number: "Terraza 1" },
      { id: "tbl-99", business_id: BUSINESS_B, name_or_number: "Mesa Foránea" },
    ];

    inMemoryOrders = [
      {
        id: "ord-001",
        business_id: BUSINESS_A,
        order_number: 101,
        status: "received",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 35000,
        delivery_fee: 0,
        total: 35000,
        notes: "Sin cebolla en la hamburguesa",
        table_id: "tbl-01",
        customer_name: "Andrés Silva",
        customer_phone: "3001234567",
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: "idem-001",
        idempotency_hash: "hash-001",
        created_by: "user-1",
        created_at: "2026-10-15T12:00:00.000Z",
        updated_at: "2026-10-15T12:00:00.000Z",
        items: [
          {
            id: "line-001",
            order_id: "ord-001",
            product_name: "Hamburguesa Doble",
            quantity: 2,
            unit_price: 15000,
            subtotal: 30000,
            notes: "Bien cocida",
            modifiers: [{ group: "Salsas", name: "Tártara", extra_price: 2500 }],
          },
        ],
      },
      {
        id: "ord-002",
        business_id: BUSINESS_A,
        order_number: 102,
        status: "in_preparation",
        order_type: "takeout",
        channel_origin: "whatsapp",
        subtotal: 20000,
        delivery_fee: 0,
        total: 20000,
        notes: "Cliente recoge a las 2pm",
        table_id: null,
        customer_name: "Carlos Botero",
        customer_phone: "3119876543",
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: "idem-002",
        idempotency_hash: "hash-002",
        created_by: "user-1",
        created_at: "2026-10-15T13:00:00.000Z",
        updated_at: "2026-10-15T13:10:00.000Z",
        items: [
          {
            id: "line-002",
            order_id: "ord-002",
            product_name: "Pizza Personal",
            quantity: 1,
            unit_price: 20000,
            subtotal: 20000,
            notes: null,
            modifiers: [],
          },
        ],
      },
      {
        id: "ord-003",
        business_id: BUSINESS_A,
        order_number: 103,
        status: "ready",
        order_type: "delivery",
        channel_origin: "whatsapp",
        subtotal: 45000,
        delivery_fee: 5000,
        total: 50000,
        notes: "Tocar timbre 201",
        table_id: null,
        customer_name: "Mariana Gómez",
        customer_phone: "3205554433",
        delivery_address: "Calle 45 # 12-34",
        delivery_reference: "Torre B Apto 201",
        delivery_status: "assigned",
        driver_name: "Repartidor Juan",
        payment_status: "pending",
        idempotency_key: "idem-003",
        idempotency_hash: "hash-003",
        created_by: "user-1",
        created_at: "2026-10-15T14:00:00.000Z",
        updated_at: "2026-10-15T14:20:00.000Z",
        items: [],
      },
      {
        id: "ord-004",
        business_id: BUSINESS_A,
        order_number: 104,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 15000,
        delivery_fee: 0,
        total: 15000,
        notes: null,
        table_id: "tbl-02",
        customer_name: "David Ruiz",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: "idem-004",
        idempotency_hash: "hash-004",
        created_by: "user-1",
        created_at: "2026-10-14T10:00:00.000Z",
        updated_at: "2026-10-14T10:45:00.000Z",
        items: [],
      },
      // Pedido de otro tenant (Business B) para probar aislamiento multi-tenant estricto
      {
        id: "ord-999",
        business_id: BUSINESS_B,
        order_number: 999,
        status: "received",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 80000,
        delivery_fee: 0,
        total: 80000,
        notes: "Confidencial de Business B",
        table_id: "tbl-99",
        customer_name: "Cliente Invasor",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: "idem-999",
        idempotency_hash: "hash-999",
        created_by: "user-99",
        created_at: "2026-10-15T15:00:00.000Z",
        updated_at: "2026-10-15T15:00:00.000Z",
        items: [],
      },
    ];
  });

  // ============================================================================
  // 1. VISUALIZACIÓN DE PEDIDOS DEL NEGOCIO ACTIVO Y AISLAMIENTO MULTI-TENANT
  // ============================================================================
  describe("1 & 2. Aislamiento Multi-tenant y Consulta de Pedidos", () => {
    it("debe retornar únicamente los pedidos que pertenecen al negocio activo (BUSINESS_A)", async () => {
      const res = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        page: 1,
        pageSize: 10,
      });

      expect(res.orders.length).toBe(4);
      expect(res.orders.every((o) => o.business_id === BUSINESS_A)).toBe(true);
      expect(res.orders.some((o) => o.id === "ord-999")).toBe(false);
      expect(res.totalCount).toBe(4);
    });

    it("un negocio B solo ve sus propios pedidos y no los de negocio A", async () => {
      const res = await getRestaurantOrdersList({
        businessId: BUSINESS_B,
        page: 1,
        pageSize: 10,
      });

      expect(res.orders.length).toBe(1);
      expect(res.orders[0].id).toBe("ord-999");
      expect(res.orders[0].business_id).toBe(BUSINESS_B);
    });

    it("rechaza la actualización de un pedido si se intenta modificar desde otro negocio", async () => {
      // Intentar actualizar el pedido ord-001 (de Business A) pasándole businessId de Business B
      const updateAttempt = await updateRestaurantOrderStatus(
        BUSINESS_B,
        "ord-001",
        "in_preparation"
      );

      expect(updateAttempt.success).toBe(false);
      expect(updateAttempt.error).toContain("no pertenece a este comercio");
    });
  });

  // ============================================================================
  // 3. BÚSQUEDA Y FILTROS COMBINADOS
  // ============================================================================
  describe("3. Búsqueda y Filtros Combinados", () => {
    it("permite buscar pedidos por número de comanda (#102 o 102)", async () => {
      const res = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        search: "#102",
      });

      expect(res.orders.length).toBe(1);
      expect(res.orders[0].order_number).toBe(102);
    });

    it("permite buscar pedidos por nombre de cliente", async () => {
      const res = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        search: "Carlos",
      });

      expect(res.orders.length).toBe(1);
      expect(res.orders[0].customer_name).toBe("Carlos Botero");
    });

    it("filtra por estado operativo y estado de pago simultáneamente", async () => {
      const res = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        status: "in_preparation",
        paymentStatus: "paid",
      });

      expect(res.orders.length).toBe(1);
      expect(res.orders[0].id).toBe("ord-002");
      expect(res.orders[0].status).toBe("in_preparation");
      expect(res.orders[0].payment_status).toBe("paid");
    });

    it("filtra por destino (takeout, delivery, dine_in) y canal de origen (whatsapp, in_person)", async () => {
      const resDelivery = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        orderType: "delivery",
        channelOrigin: "whatsapp",
      });

      expect(resDelivery.orders.length).toBe(1);
      expect(resDelivery.orders[0].id).toBe("ord-003");
      expect(resDelivery.orders[0].order_type).toBe("delivery");
      expect(resDelivery.orders[0].channel_origin).toBe("whatsapp");
    });

    it("filtra por rango de fechas (created_at)", async () => {
      const resDate = await getRestaurantOrdersList({
        businessId: BUSINESS_A,
        startDate: "2026-10-15",
        endDate: "2026-10-15",
      });

      expect(resDate.orders.length).toBe(3);
      expect(resDate.orders.some((o) => o.id === "ord-004")).toBe(false); // ord-004 es del 2026-10-14
    });

    it("calcula correctamente el resumen consolidado de KPIs (getRestaurantOrdersSummary)", async () => {
      const summary = await getRestaurantOrdersSummary(BUSINESS_A);

      expect(summary.total).toBe(4);
      expect(summary.received).toBe(1);
      expect(summary.inPreparation).toBe(1);
      expect(summary.ready).toBe(1);
      expect(summary.delivered).toBe(1);
      expect(summary.cancelled).toBe(0);
    });
  });

  // ============================================================================
  // 4. DETALLE DE PEDIDO, ARTÍCULOS Y VALORES HISTÓRICOS
  // ============================================================================
  describe("4. Detalle del Pedido y Valores Históricos", () => {
    it("obtiene el detalle con productos, notas, complementos y nombre de mesa asociado", async () => {
      const order = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-001");

      expect(order).not.toBeNull();
      expect(order?.id).toBe("ord-001");
      expect(order?.tableName).toBe("Mesa 4");
      expect(order?.items.length).toBe(1);
      expect(order?.items[0].product_name).toBe("Hamburguesa Doble");
      expect(order?.items[0].modifiers[0].name).toBe("Tártara");
      expect(order?.items[0].unit_price).toBe(15000);
      expect(order?.itemsCount).toBe(2);
      expect(order?.notes).toBe("Sin cebolla en la hamburguesa");
    });

    it("asigna null neutro y coherente cuando un pedido no tiene mesa o es para llevar", async () => {
      const order = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-002");

      expect(order).not.toBeNull();
      expect(order?.tableName).toBeNull();
      expect(order?.order_type).toBe("takeout");
    });
  });

  // ============================================================================
  // 5. TRANSICIONES VÁLIDAS E INVÁLIDAS DE ESTADO OPERATIVO
  // ============================================================================
  describe("5. Transiciones de Estado Operativo (Máquina de Estados)", () => {
    it("define las transiciones permitidas según el ciclo de vida operacional", () => {
      expect(VALID_ORDER_STATUS_TRANSITIONS.received).toEqual([
        "in_preparation",
        "ready",
        "cancelled",
      ]);
      expect(VALID_ORDER_STATUS_TRANSITIONS.in_preparation).toEqual([
        "received",
        "ready",
        "cancelled",
      ]);
      expect(VALID_ORDER_STATUS_TRANSITIONS.ready).toEqual([
        "in_preparation",
        "delivered",
        "cancelled",
      ]);
      expect(VALID_ORDER_STATUS_TRANSITIONS.delivered).toEqual(["ready"]);
      expect(VALID_ORDER_STATUS_TRANSITIONS.cancelled).toEqual([]);
    });

    it("permite la transición válida: received -> in_preparation", async () => {
      const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-001", "in_preparation");

      expect(res.success).toBe(true);
      expect(res.order?.status).toBe("in_preparation");
    });

    it("permite la transición válida: in_preparation -> ready", async () => {
      const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-002", "ready");

      expect(res.success).toBe(true);
      expect(res.order?.status).toBe("ready");
    });

    it("permite la transición válida: ready -> delivered", async () => {
      const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-003", "delivered");

      expect(res.success).toBe(true);
      expect(res.order?.status).toBe("delivered");
    });

    it("rechaza transiciones inválidas: delivered no puede volver a in_preparation o received", async () => {
      const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-004", "received");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Transición no permitida");
      // Confirmar que el estado sigue siendo delivered
      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-004");
      expect(check?.status).toBe("delivered");
    });

    it("rechaza intentar reabrir un pedido cancelado", async () => {
      // Cancelar ord-001
      const cancelRes = await cancelRestaurantOrder(BUSINESS_A, "ord-001");
      expect(cancelRes.success).toBe(true);

      // Intentar pasarlo a ready
      const reopenRes = await updateRestaurantOrderStatus(BUSINESS_A, "ord-001", "ready");
      expect(reopenRes.success).toBe(false);
      expect(reopenRes.error).toContain("Transición no permitida");
    });

    it("responde exitosamente de manera idempotente si ya tiene el estado solicitado", async () => {
      const res = await updateRestaurantOrderStatus(BUSINESS_A, "ord-002", "in_preparation");

      expect(res.success).toBe(true);
      expect(res.order?.status).toBe("in_preparation");
    });
  });

  // ============================================================================
  // 6. INDEPENDENCIA DEL ESTADO DE PAGO (PAGOS DESACOPLADOS DE ESTADO OPERATIVO)
  // ============================================================================
  describe("6. Independencia del Estado de Pago", () => {
    it("avanzar el estado de preparación a 'ready' o 'delivered' no cambia payment_status", async () => {
      const orderBefore = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-003");
      expect(orderBefore?.payment_status).toBe("pending");
      expect(orderBefore?.status).toBe("ready");

      // Actualizar a delivered
      const updateRes = await updateRestaurantOrderStatus(BUSINESS_A, "ord-003", "delivered");
      expect(updateRes.success).toBe(true);

      const orderAfter = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-003");
      expect(orderAfter?.status).toBe("delivered");
      expect(orderAfter?.payment_status).toBe("pending"); // Se conserva estrictamente pendiente de pago
    });
  });

  // ============================================================================
  // 7. CANCELACIÓN SEGURA (SOFT CANCEL SIN BORRADO FÍSICO)
  // ============================================================================
  describe("7. Cancelación Segura de Pedidos", () => {
    it("cancela un pedido en preparación marcándolo como cancelled sin eliminar la fila ni sus ítems", async () => {
      const res = await cancelRestaurantOrder(BUSINESS_A, "ord-002", "Cliente canceló por tiempo");

      expect(res.success).toBe(true);

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-002");
      expect(check).not.toBeNull();
      expect(check?.status).toBe("cancelled");
      expect(check?.items.length).toBe(1); // Sus artículos siguen existiendo para auditoría
    });

    it("no permite cancelar un pedido que ya fue entregado", async () => {
      const res = await cancelRestaurantOrder(BUSINESS_A, "ord-004", "Devolución tardía");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Transición no permitida");

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-004");
      expect(check?.status).toBe("delivered");
    });
  });

  // ============================================================================
  // 8. ACCIONES DE SERVIDOR Y AUTORIZACIÓN RBAC
  // ============================================================================
  describe("8. Acciones de Servidor y Control de Acceso (RBAC)", () => {
    it("getRestaurantOrdersListAction valida el permiso 'orders.view'", async () => {
      mockAuthPermissions["orders.view"] = false;

      const res = await getRestaurantOrdersListAction(BUSINESS_A, { page: 1 });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("updateRestaurantOrderStatusAction valida el permiso 'orders.update'", async () => {
      mockAuthPermissions["orders.update"] = false;
      mockAuthPermissions["orders.manage"] = false;

      const res = await updateRestaurantOrderStatusAction(
        BUSINESS_A,
        "ord-001",
        "in_preparation"
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("cancelRestaurantOrderAction valida el permiso 'orders.cancel'", async () => {
      mockAuthPermissions["orders.cancel"] = false;

      const res = await cancelRestaurantOrderAction(BUSINESS_A, "ord-001", "Cancelación");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");
    });

    it("ejecuta exitosamente las Server Actions cuando el usuario posee los permisos correspondientes", async () => {
      mockAuthPermissions = {
        "orders.view": true,
        "orders.update": true,
        "orders.cancel": true,
      };

      const resList = await getRestaurantOrdersListAction(BUSINESS_A, { page: 1 });
      expect(resList.success).toBe(true);
      expect(resList.data?.orders.length).toBe(4);

      const resUpdate = await updateRestaurantOrderStatusAction(
        BUSINESS_A,
        "ord-001",
        "in_preparation"
      );
      expect(resUpdate.success).toBe(true);

      const resSummary = await getRestaurantOrdersSummaryAction(BUSINESS_A);
      expect(resSummary.success).toBe(true);
      expect(resSummary.data?.total).toBe(4);
    });
  });

  // ============================================================================
  // 9. REGLAS Y VALIDACIONES DE DRAG & DROP EN TABLERO KANBAN
  // ============================================================================
  describe("9. Reglas Operativas y Drag & Drop del Tablero Kanban", () => {
    beforeEach(() => {
      mockAuthPermissions = {
        "orders.view": true,
        "orders.update": true,
        "orders.cancel": true,
      };
    });

    it("permite transiciones válidas de arrastre en secuencia operativa", async () => {
      // 1. received -> in_preparation
      expect(VALID_ORDER_STATUS_TRANSITIONS["received"]).toContain("in_preparation");
      const res1 = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "in_preparation");
      expect(res1.success).toBe(true);

      // 2. in_preparation -> ready
      expect(VALID_ORDER_STATUS_TRANSITIONS["in_preparation"]).toContain("ready");
      const res2 = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "ready");
      expect(res2.success).toBe(true);

      // 3. ready -> delivered
      expect(VALID_ORDER_STATUS_TRANSITIONS["ready"]).toContain("delivered");
      const res3 = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "delivered");
      expect(res3.success).toBe(true);

      const finalOrder = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-001");
      expect(finalOrder?.status).toBe("delivered");
    });

    it("bloquea saltos de etapa no permitidos (ej. de received directamente a delivered)", async () => {
      expect(VALID_ORDER_STATUS_TRANSITIONS["received"]).not.toContain("delivered");

      const res = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "delivered");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Transición no permitida");

      // La orden permanece en su estado original (rollback asegurado)
      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-001");
      expect(check?.status).toBe("received");
    });

    it("permite que pedidos entregados vuelvan a listos pero no directamente a la cocina o recibidos", async () => {
      expect(VALID_ORDER_STATUS_TRANSITIONS["delivered"]).toEqual(["ready"]);

      const resBack = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-004", "in_preparation");
      expect(resBack.success).toBe(false);
      expect(resBack.error).toContain("Transición no permitida");

      // Transición válida: delivered -> ready
      const resReady = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-004", "ready");
      expect(resReady.success).toBe(true);
      expect(resReady.order?.status).toBe("ready");

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-004");
      expect(check?.status).toBe("ready");
    });

    it("no permite que un pedido cancelado sea reactivado mediante arrastre", async () => {
      // Cancelamos ord-003 primero para simular comanda anulada
      await cancelRestaurantOrder(BUSINESS_A, "ord-003", "Cancelado de prueba");
      expect(VALID_ORDER_STATUS_TRANSITIONS["cancelled"]).toHaveLength(0);

      const res = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-003", "received");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Transición no permitida");

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-003");
      expect(check?.status).toBe("cancelled");
    });

    it("al arrastrar a entregado, conserva estrictamente el estado de pago pendiente", async () => {
      // ord-001 inicia en 'received' con 'pending'
      const resPrep = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "in_preparation");
      expect(resPrep.success).toBe(true);

      const resReady = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "ready");
      expect(resReady.success).toBe(true);

      const resDeliver = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "delivered");
      expect(resDeliver.success).toBe(true);

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-001");
      expect(check?.status).toBe("delivered");
      expect(check?.payment_status).toBe("pending"); // Nunca convierte a pagado automáticamente
    });

    it("evita que un usuario sin permisos actualice el estado por drag and drop", async () => {
      mockAuthPermissions["orders.update"] = false;
      mockAuthPermissions["orders.manage"] = false;

      const res = await updateRestaurantOrderStatusAction(BUSINESS_A, "ord-001", "in_preparation");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Permiso insuficiente");

      const check = await getRestaurantOrderWithDetails(BUSINESS_A, "ord-001");
      expect(check?.status).toBe("received");
    });
  });
});
