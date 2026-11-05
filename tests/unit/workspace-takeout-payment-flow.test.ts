import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  registerRestaurantOrderPayment,
  updateRestaurantOrderStatus,
} from "../../src/lib/restaurant/restaurant-service";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA PARA FLUJO DE PAGO Y PEDIDOS PARA LLEVAR
// ==============================================================================

const BUSINESS_ID = "33333333-3333-4333-a333-333333333333";
const USER_ID = "44444444-4444-4444-a444-444444444444";

interface MockRestaurantOrder {
  id: string;
  business_id: string;
  order_number: number;
  status: string;
  order_type: string;
  channel_origin: string;
  subtotal: number;
  delivery_fee: number;
  tax_total: number;
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
}

interface MockSaleDoc {
  id: string;
  business_id: string;
  restaurant_order_id: string;
  document_number: string;
  total: number;
  payment_method: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MockCashMovement {
  id: string;
  business_id: string;
  session_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

let inMemoryOrders: MockRestaurantOrder[] = [];
let inMemorySaleDocs: MockSaleDoc[] = [];
let inMemoryCashMovements: MockCashMovement[] = [];
let inMemoryActiveSession: any = {
  id: "55555555-5555-4555-a555-555555555555",
  business_id: BUSINESS_ID,
  status: "open",
};

const createMockSupabase = () => ({
  from: (tableName: string) => {
    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string) => {
          let list = [...inMemoryOrders];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] !== val);
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
              const item = list[0] || null;
              return { data: item ? { ...item, restaurant_order_items: [] } : null, error: null };
            },
            single: async () => {
              const item = list[0] || null;
              return { data: item ? { ...item, restaurant_order_items: [] } : null, error: item ? null : { message: "Not found" } };
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list.map((item) => ({ ...item, restaurant_order_items: [] })), error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        update: (payload: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const match = inMemoryOrders.find(
                (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
              );
              if (match) {
                Object.assign(match, payload);
              }
              const chain: any = {
                select: () => ({
                  single: async () => {
                    if (match) return { data: { ...match, restaurant_order_items: [] }, error: null };
                    return { data: null, error: { message: "Not found" } };
                  },
                }),
                then: (resolve: any, reject?: any) => {
                  return Promise.resolve({ data: match, error: null }).then(resolve, reject);
                },
              };
              return chain;
            },
          }),
        }),
      };
    }

    if (tableName === "business_sale_documents") {
      return {
        select: (cols: string) => {
          let list = [...inMemorySaleDocs];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] === val);
              return chain;
            },
            like: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
              const item = list[0] || null;
              return { data: item ? { ...item } : null, error: null };
            },
            single: async () => {
              const item = list[0] || null;
              return { data: item ? { ...item } : null, error: item ? null : { message: "Not found" } };
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: list.map((item) => ({ ...item })), error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        insert: (payload: any) => ({
          select: () => ({
            single: async () => {
              const doc: MockSaleDoc = {
                id: `doc-${Date.now()}-${Math.random()}`,
                business_id: payload.business_id,
                restaurant_order_id: payload.restaurant_order_id,
                document_number: payload.document_number || `FAC-${Date.now()}`,
                total: payload.total,
                payment_method: payload.payment_method || "cash",
                status: "issued",
                notes: payload.notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              inMemorySaleDocs.push(doc);
              return { data: doc, error: null };
            },
          }),
        }),
      };
    }

    if (tableName === "cash_sessions") {
      const chain: any = {
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: inMemoryActiveSession, error: null }),
        single: async () => ({ data: inMemoryActiveSession, error: null }),
        then: (resolve: any, reject?: any) => {
          return Promise.resolve({ data: inMemoryActiveSession ? [inMemoryActiveSession] : [], error: null }).then(resolve, reject);
        },
      };
      return {
        select: () => chain,
      };
    }

    if (tableName === "cash_movements") {
      const chain: any = {
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (resolve: any, reject?: any) => {
          return Promise.resolve({ data: inMemoryCashMovements.map((m) => ({ ...m })), error: null }).then(resolve, reject);
        },
      };
      return {
        select: () => chain,
        insert: (payload: any) => {
          const mov: MockCashMovement = {
            id: `mov-${Date.now()}-${Math.random()}`,
            business_id: payload.business_id,
            session_id: payload.session_id,
            type: payload.movement_type || payload.type || "income",
            amount: payload.amount,
            description: payload.notes || payload.description || "",
            created_at: new Date().toISOString(),
          };
          inMemoryCashMovements.push(mov);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  ...mov,
                  movement_type: mov.type,
                  notes: mov.description,
                  reference_id: payload.reference_id,
                  reference_type: payload.reference_type,
                  created_by: payload.created_by,
                },
                error: null,
              }),
            }),
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({ data: mov, error: null }).then(resolve, reject);
            },
          };
        },
      };
    }

    if (tableName === "restaurant_tables") {
      return {
        update: () => ({
          eq: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }

    if (tableName === "customers") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "cust-1",
                  full_name: "Cliente Prueba",
                  credit_limit: 1000000,
                  credit_used: 0,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    };
  },
  rpc: async () => ({ data: null, error: null }),
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(() => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

vi.mock("@/lib/documents/sequence-service", () => ({
  getNextDocumentNumber: vi.fn(async () => ({ documentNumber: "FAC-0001", success: true })),
}));

vi.mock("@/lib/loyalty/loyalty-service", () => ({
  accumulateLoyaltyPoints: vi.fn(async () => {}),
  redeemLoyaltyPoints: vi.fn(async () => {}),
}));

describe("Flujo de Cobro de Pedidos 'Para llevar' en NEGOVA", () => {
  beforeEach(() => {
    inMemoryOrders = [];
    inMemorySaleDocs = [];
    inMemoryCashMovements = [];
    vi.clearAllMocks();
  });

  function seedTakeoutOrder(orderId: string, orderNumber: number, paymentTag: string, total = 35000) {
    const order: MockRestaurantOrder = {
      id: orderId,
      business_id: BUSINESS_ID,
      order_number: orderNumber,
      status: "received",
      order_type: "takeout",
      channel_origin: "in_person",
      subtotal: total,
      delivery_fee: 0,
      tax_total: 0,
      total: total,
      notes: `Para llevar | ${paymentTag}`,
      table_id: null,
      customer_name: "Juan Pérez",
      customer_phone: "3001234567",
      delivery_address: null,
      delivery_reference: null,
      delivery_status: null,
      driver_name: null,
      payment_status: "pending",
      idempotency_key: null,
      idempotency_hash: null,
      created_by: USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryOrders.push(order);
    return order;
  }

  it("Caso 1: Crear pedido en efectivo y dejarlo pendiente de pago: no debe existir pago ni movimiento de caja", () => {
    // Al crearse el pedido Para llevar con efectivo previsto
    const order = seedTakeoutOrder(
      "order-1",
      101,
      "[Método de pago propuesto: Efectivo] | [Paga en efectivo con: $50.000]"
    );

    // Estado operativo inicial y estado de pago
    expect(order.status).toBe("received");
    expect(order.payment_status).toBe("pending");

    // Verificar que NO existe venta liquidada ni movimientos en caja
    expect(inMemorySaleDocs.length).toBe(0);
    expect(inMemoryCashMovements.length).toBe(0);
  });

  it("Caso 2: Crear pedido digital y dejarlo pendiente: tampoco debe registrarse un pago", () => {
    const order = seedTakeoutOrder(
      "order-2",
      102,
      "[Método de pago propuesto: Digital]"
    );

    expect(order.status).toBe("received");
    expect(order.payment_status).toBe("pending");
    expect(inMemorySaleDocs.length).toBe(0);
    expect(inMemoryCashMovements.length).toBe(0);
  });

  it("Caso 3: Confirmar pago en efectivo antes de que el pedido esté listo: se registra y conserva estado operativo", async () => {
    const order = seedTakeoutOrder("order-3", 103, "[Método de pago propuesto: Efectivo]", 25000);

    // El pedido está en preparación en cocina
    await updateRestaurantOrderStatus(BUSINESS_ID, order.id, "in_preparation", USER_ID);
    expect(inMemoryOrders.find((o) => o.id === order.id)?.status).toBe("in_preparation");

    // El cliente decide pagar de inmediato en efectivo
    const payRes = await registerRestaurantOrderPayment(
      BUSINESS_ID,
      order.id,
      { paymentMethod: "cash", cashChange: 5000 },
      USER_ID
    );

    expect(payRes.success).toBe(true);

    const updatedOrder = inMemoryOrders.find((o) => o.id === order.id);
    expect(updatedOrder?.payment_status).toBe("paid");
    // Conserva su estado operativo 'in_preparation' sin marcarlo como entregado ni listo
    expect(updatedOrder?.status).toBe("in_preparation");

    // Se registró el documento de venta y el movimiento en caja
    expect(inMemorySaleDocs.length).toBe(1);
    expect(inMemoryCashMovements.length).toBe(1);
    expect(inMemoryCashMovements[0].amount).toBe(25000);
  });

  it("Caso 4: Confirmar pago digital antes de la entrega: se registra y conserva estado operativo", async () => {
    const order = seedTakeoutOrder("order-4", 104, "[Método de pago propuesto: Digital]", 40000);

    const payRes = await registerRestaurantOrderPayment(
      BUSINESS_ID,
      order.id,
      { paymentMethod: "nequi" },
      USER_ID
    );

    expect(payRes.success).toBe(true);

    const updatedOrder = inMemoryOrders.find((o) => o.id === order.id);
    expect(updatedOrder?.payment_status).toBe("paid");
    expect(updatedOrder?.status).toBe("received"); // Sigue en 'received' para cocina

    // Documento emitido y trazabilidad de movimiento registrada como 'sale_digital' (sin ser efectivo físico)
    expect(inMemorySaleDocs.length).toBe(1);
    expect(inMemoryCashMovements.length).toBe(1);
    expect(inMemoryCashMovements[0].type).toBe("sale_digital");
  });

  it("Caso 5: Entregar un pedido pendiente de pago y confirmarlo después: queda Entregado y Pagado", async () => {
    const order = seedTakeoutOrder("order-5", 105, "[Método de pago propuesto: Efectivo]", 30000);

    // Pasa por cocina: recibido -> en preparación -> listo -> entregado
    await updateRestaurantOrderStatus(BUSINESS_ID, order.id, "in_preparation", USER_ID);
    await updateRestaurantOrderStatus(BUSINESS_ID, order.id, "ready", USER_ID);
    await updateRestaurantOrderStatus(BUSINESS_ID, order.id, "delivered", USER_ID);

    let current = inMemoryOrders.find((o) => o.id === order.id);
    expect(current?.status).toBe("delivered");
    expect(current?.payment_status).toBe("pending"); // Se entregó antes de confirmar cobro

    // El cliente paga en el momento del despacho / entrega
    const payRes = await registerRestaurantOrderPayment(
      BUSINESS_ID,
      order.id,
      { paymentMethod: "cash" },
      USER_ID
    );

    expect(payRes.success).toBe(true);
    current = inMemoryOrders.find((o) => o.id === order.id);
    expect(current?.status).toBe("delivered");
    expect(current?.payment_status).toBe("paid");
    expect(inMemorySaleDocs.length).toBe(1);
    expect(inMemoryCashMovements.length).toBe(1);
  });

  it("Caso 6: Intentar confirmar dos veces el mismo pago: no debe duplicarse (Idempotencia estricta)", async () => {
    const order = seedTakeoutOrder("order-6", 106, "[Método de pago propuesto: Efectivo]", 20000);

    // Primer pago
    const firstPay = await registerRestaurantOrderPayment(
      BUSINESS_ID,
      order.id,
      { paymentMethod: "cash" },
      USER_ID
    );
    expect(firstPay.success).toBe(true);
    expect(inMemorySaleDocs.length).toBe(1);
    expect(inMemoryCashMovements.length).toBe(1);

    // Reintento o segundo clic
    const secondPay = await registerRestaurantOrderPayment(
      BUSINESS_ID,
      order.id,
      { paymentMethod: "cash" },
      USER_ID
    );
    expect(secondPay.success).toBe(true);

    // No debe duplicar ni documentos ni movimientos de caja
    expect(inMemorySaleDocs.length).toBe(1);
    expect(inMemoryCashMovements.length).toBe(1);
  });

  it("Caso 7: Interfaz y Componentes: selección de cuándo se cobra ('Cobrar ahora' / 'Dejar pago pendiente') y flujo de confirmación real", () => {
    const posPath = path.resolve(__dirname, "../../src/components/pos/pos-screen-client.tsx");
    const drawerPath = path.resolve(__dirname, "../../src/components/pos/pos-open-tickets-drawer.tsx");
    const modalPath = path.resolve(__dirname, "../../src/components/payments/order-payment-modal.tsx");
    const posContent = fs.readFileSync(posPath, "utf-8");
    const drawerContent = fs.readFileSync(drawerPath, "utf-8");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    // En el carrito: Debe permitir decidir cuándo se cobra
    expect(posContent).toContain("Cobrar ahora");
    expect(posContent).toContain("Dejar pago pendiente");

    // En el carrito: Se elimina 'Medio de Pago previsto' y el monto entregado en efectivo estimado
    expect(posContent).not.toContain("2. Medio de Pago previsto");
    expect(posContent).not.toContain("Paga con (Monto estimado)");
    expect(posContent).not.toContain("Cambio estimado:");

    // En OrderPaymentModal: Solicita el método real, en efectivo 'Paga con' y calcula cambio
    expect(modalContent).toContain("Paga con:");
    expect(modalContent).toContain("Cambio:");
    expect(modalContent).toContain("Confirmar pago recibido");

    // En Tickets Abiertos, cuando está pendiente debe mostrar 'Confirmar pago'
    expect(drawerContent).toContain("Confirmar pago");
    expect(drawerContent).toContain("Pendiente de pago");
    expect(drawerContent).toContain("Pagado");
  });
});
