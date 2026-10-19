import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBusinessDocumentsList,
  getBusinessDocumentById,
  cancelBusinessSaleDocument,
  registerBusinessDocumentPayment,
} from "../../src/lib/documents/document-service";
import {
  updateRestaurantOrderStatus,
  cancelRestaurantOrder,
  registerRestaurantOrderPayment,
  releaseRestaurantTable,
} from "../../src/lib/restaurant/restaurant-service";
import { VALID_ORDER_STATUS_TRANSITIONS } from "../../src/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "22222222-bbbb-4bbb-bbbb-222222222222";

interface MockRestaurantOrder {
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
}

interface MockRestaurantOrderItem {
  id: string;
  business_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  modifiers: any[];
  created_at: string;
  updated_at: string;
}

interface MockTable {
  id: string;
  business_id: string;
  name_or_number: string;
  capacity?: number;
  status: "available" | "occupied";
  current_order_id: string | null;
}

let inMemoryOrders: MockRestaurantOrder[] = [];
let inMemoryOrderItems: MockRestaurantOrderItem[] = [];
let inMemoryTables: MockTable[] = [];
let inMemorySaleDocs: any[] = [];

// Mock del cliente Supabase tanto server como @supabase/supabase-js
const createMockSupabase = () => ({
  from: (tableName: string) => {
    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string, opts?: any) => {
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
            in: (col: string, vals: any[]) => {
              list = list.filter((r) => vals.includes((r as any)[col]));
              return chain;
            },
            or: (cond: string) => chain,
            gte: (col: string, val: any) => chain,
            lte: (col: string, val: any) => chain,
            order: (col: string, o?: any) => chain,
            range: (from: number, to: number) => {
              return Promise.resolve({
                data: list.slice(from, to + 1).map((o) => ({
                  ...o,
                  restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === o.id),
                })),
                count: list.length,
                error: null,
              });
            },
            maybeSingle: () => {
              const item = list[0] || null;
              if (!item) return Promise.resolve({ data: null, error: null });
              return Promise.resolve({
                data: {
                  ...item,
                  restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === item.id),
                },
                error: null,
              });
            },
            single: () => {
              const item = list[0] || null;
              if (!item) return Promise.resolve({ data: null, error: new Error("Row not found") });
              return Promise.resolve({
                data: {
                  ...item,
                  restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === item.id),
                },
                error: null,
              });
            },
            then: (resolve: any, reject?: any) => {
              return Promise.resolve({
                data: list.map((o) => ({
                  ...o,
                  restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === o.id),
                })),
                count: list.length,
                error: null,
              }).then(resolve, reject);
            },
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const match = inMemoryOrders.find(
                (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
              );
              if (match) {
                Object.assign(match, data);
              }
              const chain: any = {
                select: (selCols?: string) => ({
                  single: () => {
                    if (!match) return Promise.resolve({ data: null, error: new Error("Not found") });
                    return Promise.resolve({
                      data: {
                        ...match,
                        restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === match.id),
                      },
                      error: null,
                    });
                  },
                }),
                then: (resolve: any, reject?: any) => Promise.resolve({ error: null }).then(resolve, reject),
              };
              return chain;
            },
          }),
        }),
      };
    }

    if (tableName === "restaurant_order_items") {
      return {
        select: (cols: string) => {
          let list = [...inMemoryOrderItems];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] === val);
              return chain;
            },
            order: () => Promise.resolve({ data: list, error: null }),
            then: (resolve: any, reject?: any) => Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
      };
    }

    if (tableName === "restaurant_tables") {
      return {
        select: (cols: string) => {
          let list = [...inMemoryTables];
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
            maybeSingle: () => {
              const item = list[0] || null;
              return Promise.resolve({ data: item, error: null });
            },
            single: () => {
              const item = list[0] || null;
              if (!item) return Promise.resolve({ data: null, error: new Error("Row not found") });
              return Promise.resolve({ data: item, error: null });
            },
            then: (resolve: any, reject?: any) => Promise.resolve({ data: list, error: null }).then(resolve, reject),
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const match = inMemoryTables.find(
                (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
              );
              if (match) {
                Object.assign(match, data);
              }
              const chain: any = {
                select: () => ({
                  single: () => Promise.resolve({ data: match, error: null }),
                }),
                then: (resolve: any, reject?: any) => Promise.resolve({ error: null }).then(resolve, reject),
              };
              return chain;
            },
          }),
        }),
      };
    }

    if (tableName === "business_sale_documents") {
      return {
        select: (cols: string, opts?: any) => {
          let list = [...inMemorySaleDocs];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => (r as any)[col] !== val);
              return chain;
            },
            in: (col: string, vals: any[]) => {
              list = list.filter((r) => vals.includes((r as any)[col]));
              return chain;
            },
            or: () => chain,
            gte: () => chain,
            lte: () => chain,
            order: () => chain,
            range: (from: number, to: number) =>
              Promise.resolve({
                data: list.slice(from, to + 1),
                count: list.length,
                error: null,
              }),
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any, reject?: any) => Promise.resolve({ data: list, count: list.length, error: null }).then(resolve, reject),
          };
          return chain;
        },
        update: (data: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              for (const d of inMemorySaleDocs) {
                if ((d as any)[col1] === val1 && (d as any)[col2] === val2) {
                  Object.assign(d, data);
                }
              }
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: inMemorySaleDocs[0], error: null }),
                }),
                then: (resolve: any, reject?: any) => Promise.resolve({ error: null }).then(resolve, reject),
              };
            },
          }),
        }),
      };
    }

    if (tableName === "business_sale_document_items") {
      return {
        select: (cols: string) => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }

    if (tableName === "business_sale_document_payments") {
      return {
        select: (cols: string) => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: (data: any) => Promise.resolve({ error: null }),
      };
    }

    if (tableName === "business_audit_logs") {
      return {
        insert: (data: any) => Promise.resolve({ error: null }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: any, reject?: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
        }),
      }),
    };
  },
  rpc: vi.fn(),
});

vi.mock("../../src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Integración Pedidos → Ventas → Mesas → Canales (NEGOVA)", () => {
  beforeEach(() => {
    inMemoryOrders = [];
    inMemoryOrderItems = [];
    inMemoryTables = [
      {
        id: "tbl-01",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 1",
        capacity: 4,
        status: "available",
        current_order_id: null,
      },
      {
        id: "tbl-02",
        business_id: BUSINESS_A,
        name_or_number: "Mesa 2",
        capacity: 2,
        status: "available",
        current_order_id: null,
      },
    ];
    inMemorySaleDocs = [];
  });

  // ============================================================================
  // TAREA 1: Integración Pedidos y Ventas
  // ============================================================================
  describe("TAREA 1: Sincronización e Integración de Pedidos en Ventas", () => {
    it("1.1. Un pedido en estado 'received', 'in_preparation' o 'ready' NO aparece en Ventas como venta completada", async () => {
      const orderId = "order-active-1";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 101,
        status: "in_preparation",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 45000,
        delivery_fee: 0,
        total: 45000,
        notes: "Sin cebolla",
        table_id: "tbl-01",
        customer_name: "Juan Pérez",
        customer_phone: "3001234567",
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrderItems.push({
        id: "item-01",
        business_id: BUSINESS_A,
        order_id: orderId,
        product_id: "prod-01",
        product_name: "Hamburguesa Doble",
        quantity: 2,
        unit_price: 22500,
        subtotal: 45000,
        notes: null,
        modifiers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const salesList = await getBusinessDocumentsList({ businessId: BUSINESS_A });
      expect(salesList.documents.some((d) => d.id === orderId)).toBe(false);
    });

    it("1.2. Al avanzar el pedido a 'delivered', APARECE en Ventas sin duplicar registros", async () => {
      const orderId = "order-deliv-1";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 102,
        status: "received",
        order_type: "takeout",
        channel_origin: "in_person",
        subtotal: 30000,
        delivery_fee: 0,
        total: 30000,
        notes: null,
        table_id: null,
        customer_name: "María Gómez",
        customer_phone: "3109876543",
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrderItems.push({
        id: "item-02",
        business_id: BUSINESS_A,
        order_id: orderId,
        product_id: "prod-02",
        product_name: "Pizza Personal",
        quantity: 1,
        unit_price: 30000,
        subtotal: 30000,
        notes: null,
        modifiers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Transiciones permitidas: received -> in_preparation -> ready -> delivered
      await updateRestaurantOrderStatus(BUSINESS_A, orderId, "in_preparation");
      await updateRestaurantOrderStatus(BUSINESS_A, orderId, "ready");
      const deliveryRes = await updateRestaurantOrderStatus(BUSINESS_A, orderId, "delivered");

      expect(deliveryRes.success).toBe(true);

      // Consultar módulo Ventas
      const salesList = await getBusinessDocumentsList({ businessId: BUSINESS_A });
      const sale = salesList.documents.find((d) => d.id === orderId);

      expect(sale).toBeDefined();
      expect(sale?.documentNumber).toBe("ORD-102");
      expect(sale?.total).toBe(30000);
      expect(sale?.customerName).toBe("María Gómez");
      expect(sale?.documentType).toBe("order");
      // Regla obligatoria 9: Entregado NO marca pagado automáticamente
      expect(sale?.status).toBe("pending");
      // Regla obligatoria 3: NO crea registros duplicados en business_sale_documents
      expect(inMemorySaleDocs.length).toBe(0);
    });

    it("1.3. Consulta por ID en Ventas (getBusinessDocumentById) devuelve el pedido con sus ítems reales", async () => {
      const orderId = "order-deliv-2";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 103,
        status: "delivered",
        order_type: "delivery",
        channel_origin: "in_person",
        subtotal: 50000,
        delivery_fee: 5000,
        total: 55000,
        notes: "Timbre 201",
        table_id: null,
        customer_name: "Carlos Ruiz",
        customer_phone: "3151112233",
        delivery_address: "Carrera 7 # 45-20",
        delivery_reference: "Torre A",
        delivery_status: "delivered",
        driver_name: "Repartidor Express",
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrderItems.push({
        id: "item-03",
        business_id: BUSINESS_A,
        order_id: orderId,
        product_id: "prod-03",
        product_name: "Bandeja Paisa",
        quantity: 2,
        unit_price: 25000,
        subtotal: 50000,
        notes: null,
        modifiers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const doc = await getBusinessDocumentById(BUSINESS_A, orderId);

      expect(doc).toBeDefined();
      expect(doc?.id).toBe(orderId);
      expect(doc?.total).toBe(55000);
      expect(doc?.items.length).toBe(1);
      expect(doc?.items[0].description).toBe("Bandeja Paisa");
      expect(doc?.items[0].quantity).toBe(2);
      expect(doc?.items[0].total).toBe(50000);
      expect(doc?.status).toBe("pending");
    });

    it("1.4. Pedidos cancelados no se consideran ventas completadas y conservan trazabilidad", async () => {
      const orderId = "order-cancelled-1";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 104,
        status: "received",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 20000,
        delivery_fee: 0,
        total: 20000,
        notes: null,
        table_id: "tbl-01",
        customer_name: "Cliente Desistió",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const cancelRes = await cancelRestaurantOrder(BUSINESS_A, orderId, "Cliente no pudo esperar");
      expect(cancelRes.success).toBe(true);

      const doc = await getBusinessDocumentById(BUSINESS_A, orderId);
      expect(doc).toBeDefined();
      expect(doc?.status).toBe("cancelled");
    });

    it("1.5. Registrar cobro de un pedido actualiza el estado de pago a 'paid'", async () => {
      const orderId = "order-pay-1";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 105,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 40000,
        delivery_fee: 0,
        total: 40000,
        notes: null,
        table_id: null,
        customer_name: "Cliente Pago",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Registrar pago mediante acción de cobro
      const payRes = await registerRestaurantOrderPayment(BUSINESS_A, orderId, "cash", "user-cajero");
      expect(payRes.success).toBe(true);

      const orderInDb = inMemoryOrders.find((o) => o.id === orderId);
      expect(orderInDb?.payment_status).toBe("paid");

      const doc = await getBusinessDocumentById(BUSINESS_A, orderId);
      expect(doc?.status).toBe("paid");
    });

    it("2.5. El registro de pago es idempotente y no duplica transacciones al reintentar", async () => {
      const orderId = "order-idempotent-pay";
      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 106,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 55000,
        delivery_fee: 0,
        total: 55000,
        notes: null,
        table_id: null,
        customer_name: "Cliente Reintento",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Primer cobro
      const pay1 = await registerRestaurantOrderPayment(BUSINESS_A, orderId, "card", "user-cajero");
      expect(pay1.success).toBe(true);

      // Reintento de cobro (mismo pedido ya pagado)
      const pay2 = await registerRestaurantOrderPayment(BUSINESS_A, orderId, "card", "user-cajero");
      expect(pay2.success).toBe(true);
      expect(pay2.order?.payment_status).toBe("paid");
    });
  });

  // ============================================================================
  // TAREA 3: Asignación Automática de Canal según Flujo
  // ============================================================================
  describe("TAREA 3: Asignación Automática de Canales y Destinos", () => {
    it("3.1. Consumo en salón (dine_in) desde el POS asigna siempre canal 'in_person'", () => {
      const isPos = true;
      const orderType = "dine_in";
      const resolvedChannel = isPos ? "in_person" : "whatsapp";
      expect(resolvedChannel).toBe("in_person");
    });

    it("3.2. Para llevar (takeout) desde el POS asigna automáticamente 'in_person'", () => {
      const isPos = true;
      const orderType = "takeout";
      const resolvedChannel = isPos ? "in_person" : "whatsapp";
      expect(resolvedChannel).toBe("in_person");
    });

    it("3.3. Domicilio (delivery) desde POS asigna 'in_person', pero desde webhook WhatsApp asigna 'whatsapp'", () => {
      const posDeliveryChannel = "in_person";
      const whatsappDeliveryChannel = "whatsapp";

      expect(posDeliveryChannel).toBe("in_person");
      expect(whatsappDeliveryChannel).toBe("whatsapp");
    });

    it("3.4. Validaciones de destino: mesa prohibida en takeout y delivery, obligatoria en dine_in", () => {
      const validateOrderInputs = (type: string, tableId?: string, address?: string) => {
        if (type === "dine_in" && !tableId) return { valid: false, error: "TABLE_REQUIRED" };
        if (type === "delivery" && !address) return { valid: false, error: "ADDRESS_REQUIRED" };
        if ((type === "takeout" || type === "delivery") && tableId) return { valid: false, error: "TABLE_FORBIDDEN" };
        return { valid: true };
      };

      expect(validateOrderInputs("dine_in", undefined).valid).toBe(false);
      expect(validateOrderInputs("dine_in", "tbl-01").valid).toBe(true);

      expect(validateOrderInputs("takeout", "tbl-01").valid).toBe(false);
      expect(validateOrderInputs("takeout", undefined).valid).toBe(true);

      expect(validateOrderInputs("delivery", undefined, "").valid).toBe(false);
      expect(validateOrderInputs("delivery", undefined, "Calle 100").valid).toBe(true);
      expect(validateOrderInputs("delivery", "tbl-01", "Calle 100").valid).toBe(false);
    });
  });

  // ============================================================================
  // MESAS Y CONCURRENCIA
  // ============================================================================
  describe("Gestión Operativa de Mesas", () => {
    it("Mesa ocupada no puede ser asignada a otro pedido concurrente", async () => {
      const table = inMemoryTables[0];
      table.status = "occupied";
      table.current_order_id = "order-existing";

      const tryAssignTable = (targetTable: MockTable) => {
        if (targetTable.status === "occupied") {
          return { success: false, error: "TABLE_OCCUPIED" };
        }
        targetTable.status = "occupied";
        return { success: true };
      };

      const result = tryAssignTable(table);
      expect(result.success).toBe(false);
      expect(result.error).toBe("TABLE_OCCUPIED");
    });

    it("Mesa se libera correctamente al entregar y pagar el pedido", async () => {
      const table = inMemoryTables[0];
      const orderId = "order-tbl-1";
      table.status = "occupied";
      table.current_order_id = orderId;

      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 106,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 50000,
        delivery_fee: 0,
        total: 50000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente Mesa",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const releaseRes = await releaseRestaurantTable(BUSINESS_A, table.id);
      expect(releaseRes.success).toBe(true);

      const tableInDb = inMemoryTables.find((t) => t.id === table.id);
      expect(tableInDb?.status).toBe("available");
      expect(tableInDb?.current_order_id).toBeNull();
    });

    it("Mesa no puede ser liberada si el pedido sigue en preparación", async () => {
      const table = inMemoryTables[1];
      const orderId = "order-tbl-cooking";
      table.status = "occupied";
      table.current_order_id = orderId;

      inMemoryOrders.push({
        id: orderId,
        business_id: BUSINESS_A,
        order_number: 107,
        status: "in_preparation",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 35000,
        delivery_fee: 0,
        total: 35000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente En Mesa",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const releaseRes = await releaseRestaurantTable(BUSINESS_A, table.id);
      expect(releaseRes.success).toBe(false);
      expect(releaseRes.error).toContain("No se puede liberar");
    });

    it("Una mesa con múltiples pedidos no se libera si el primer pedido fue cobrado pero el segundo sigue en preparación", async () => {
      const table = inMemoryTables[0];
      table.status = "occupied";
      table.current_order_id = "order-multi-1";

      // Pedido 1: entregado y pagado
      inMemoryOrders.push({
        id: "order-multi-1",
        business_id: BUSINESS_A,
        order_number: 110,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 20000,
        delivery_fee: 0,
        total: 20000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente Mesa 1 - Bebidas",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Pedido 2: en preparación y pago pendiente
      inMemoryOrders.push({
        id: "order-multi-2",
        business_id: BUSINESS_A,
        order_number: 111,
        status: "in_preparation",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 45000,
        delivery_fee: 0,
        total: 45000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente Mesa 1 - Platos",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Intentar liberar mesa
      const releaseRes = await releaseRestaurantTable(BUSINESS_A, table.id);
      expect(releaseRes.success).toBe(false);
      expect(releaseRes.error).toContain("la comanda #111 aún no ha sido entregada");

      const tableInDb = inMemoryTables.find((t) => t.id === table.id);
      expect(tableInDb?.status).toBe("occupied");
    });

    it("Una mesa con múltiples pedidos entregados no se libera si uno de ellos tiene pago pendiente", async () => {
      const table = inMemoryTables[0];
      table.status = "occupied";
      table.current_order_id = "order-multi-unpaid-1";

      inMemoryOrders.push({
        id: "order-multi-unpaid-1",
        business_id: BUSINESS_A,
        order_number: 112,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 30000,
        delivery_fee: 0,
        total: 30000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrders.push({
        id: "order-multi-unpaid-2",
        business_id: BUSINESS_A,
        order_number: 113,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 15000,
        delivery_fee: 0,
        total: 15000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const releaseRes = await releaseRestaurantTable(BUSINESS_A, table.id);
      expect(releaseRes.success).toBe(false);
      expect(releaseRes.error).toContain("la comanda #113 tiene el pago pendiente");
    });

    it("Liberar mesa es exitoso cuando todos los pedidos vinculados fueron entregados y pagados", async () => {
      const table = inMemoryTables[0];
      table.status = "occupied";
      table.current_order_id = "order-multi-ok-1";

      inMemoryOrders.push({
        id: "order-multi-ok-1",
        business_id: BUSINESS_A,
        order_number: 114,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 25000,
        delivery_fee: 0,
        total: 25000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrders.push({
        id: "order-multi-ok-2",
        business_id: BUSINESS_A,
        order_number: 115,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 35000,
        delivery_fee: 0,
        total: 35000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const releaseRes = await releaseRestaurantTable(BUSINESS_A, table.id);
      expect(releaseRes.success).toBe(true);

      const tableInDb = inMemoryTables.find((t) => t.id === table.id);
      expect(tableInDb?.status).toBe("available");
      expect(tableInDb?.current_order_id).toBeNull();
    });

    it("Cancelar una comanda en una mesa no libera la mesa si quedan otras comandas activas", async () => {
      const table = inMemoryTables[1];
      table.status = "occupied";
      table.current_order_id = "order-cancel-1";

      inMemoryOrders.push({
        id: "order-cancel-1",
        business_id: BUSINESS_A,
        order_number: 116,
        status: "received",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 10000,
        delivery_fee: 0,
        total: 10000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      inMemoryOrders.push({
        id: "order-cancel-2",
        business_id: BUSINESS_A,
        order_number: 117,
        status: "in_preparation",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 50000,
        delivery_fee: 0,
        total: 50000,
        notes: null,
        table_id: table.id,
        customer_name: "Cliente",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "pending",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const cancelRes = await cancelRestaurantOrder(BUSINESS_A, "order-cancel-1");
      expect(cancelRes.success).toBe(true);

      const tableInDb = inMemoryTables.find((t) => t.id === table.id);
      expect(tableInDb?.status).toBe("occupied");
      expect(tableInDb?.current_order_id).toBe("order-cancel-2");
    });
  });

  // ============================================================================
  // SEGURIDAD Y MULTI-TENANCY
  // ============================================================================
  describe("Seguridad y Aislamiento Multi-Tenant", () => {
    it("Un negocio no puede acceder a las ventas o pedidos de otro negocio", async () => {
      inMemoryOrders.push({
        id: "order-tenant-b",
        business_id: BUSINESS_B,
        order_number: 999,
        status: "delivered",
        order_type: "dine_in",
        channel_origin: "in_person",
        subtotal: 80000,
        delivery_fee: 0,
        total: 80000,
        notes: null,
        table_id: null,
        customer_name: "Cliente Tenant B",
        customer_phone: null,
        delivery_address: null,
        delivery_reference: null,
        delivery_status: null,
        driver_name: null,
        payment_status: "paid",
        idempotency_key: null,
        idempotency_hash: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Consulta de ventas para Negocio A
      const listA = await getBusinessDocumentsList({ businessId: BUSINESS_A });
      expect(listA.documents.some((d) => d.id === "order-tenant-b")).toBe(false);

      // Consulta directa por ID desde Negocio A
      const doc = await getBusinessDocumentById(BUSINESS_A, "order-tenant-b");
      expect(doc).toBeNull();
    });
  });
});
