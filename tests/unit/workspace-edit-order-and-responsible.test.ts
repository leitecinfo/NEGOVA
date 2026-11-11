import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateRestaurantOrderDetails,
  cancelRestaurantOrder,
  getRestaurantTablesWithOrders,
} from "../../src/lib/restaurant/restaurant-service";

const BUSINESS_ID = "11111111-aaaa-4aaa-aaaa-111111111111";
const USER_ID = "user-waiter-456";

interface MockOrderItem {
  id: string;
  order_id: string;
  business_id: string;
  product_id?: string | null;
  product_name: string;
  name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
  modifiers?: any[];
}

interface MockOrder {
  id: string;
  business_id: string;
  order_number: number;
  order_type: string;
  table_id: string | null;
  status: string;
  payment_status: string;
  subtotal: number;
  total: number;
  delivery_fee: number;
  customer_name: string | null;
  notes: string | null;
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  assigned_staff_role: string | null;
  driver_name: string | null;
  created_at: string;
  updated_at: string;
}

interface MockTable {
  id: string;
  business_id: string;
  name_or_number: string;
  status: "available" | "occupied";
  current_order_id: string | null;
  capacity?: number;
  sort_order?: number;
}

let inMemoryOrders: MockOrder[] = [];
let inMemoryItems: MockOrderItem[] = [];
let inMemoryTables: MockTable[] = [];

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
        update: (fields: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = inMemoryTables.findIndex(
                (t) => (t as any)[col1] === val1 && (t as any)[col2] === val2
              );
              if (idx !== -1) {
                inMemoryTables[idx] = { ...inMemoryTables[idx], ...fields };
              }
              const res = { data: inMemoryTables[idx] || null, error: null };
              return {
                ...res,
                then: (resolve: any, reject?: any) => Promise.resolve(res).then(resolve, reject),
              };
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
            in: (col: string, vals: string[]) => {
              filtered = filtered.filter((o) => vals.includes((o as any)[col]));
              return chain;
            },
            maybeSingle: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: null });
              const items = inMemoryItems.filter((it) => it.order_id === match.id);
              return Promise.resolve({
                data: {
                  ...match,
                  restaurant_order_items: items.map((it) => ({
                    ...it,
                    name: it.product_name,
                  })),
                },
                error: null,
              });
            },
            single: () => {
              const match = filtered[0];
              if (!match) return Promise.resolve({ data: null, error: new Error("Row not found") });
              const items = inMemoryItems.filter((it) => it.order_id === match.id);
              return Promise.resolve({
                data: {
                  ...match,
                  restaurant_order_items: items.map((it) => ({
                    ...it,
                    name: it.product_name,
                  })),
                },
                error: null,
              });
            },
            then: (resolve: any, reject?: any) => {
              const data = filtered.map((row) => ({
                ...row,
                restaurant_order_items: inMemoryItems
                  .filter((it) => it.order_id === row.id)
                  .map((it) => ({
                    ...it,
                    name: it.product_name,
                  })),
              }));
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        update: (fields: any) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              const idx = inMemoryOrders.findIndex(
                (o) => (o as any)[col1] === val1 && (o as any)[col2] === val2
              );
              if (idx !== -1) {
                inMemoryOrders[idx] = { ...inMemoryOrders[idx], ...fields };
              }
              const res = { data: inMemoryOrders[idx] || null, error: null };
              return {
                ...res,
                select: () => ({
                  single: () => Promise.resolve(res),
                }),
                then: (resolve: any, reject?: any) => Promise.resolve(res).then(resolve, reject),
              };
            },
          }),
        }),
      };
    }

    if (tableName === "restaurant_order_items") {
      return {
        select: (cols: string) => {
          let filtered = [...inMemoryItems];
          const chain: any = {
            eq: (col: string, val: any) => {
              filtered = filtered.filter((it) => (it as any)[col] === val);
              return chain;
            },
            then: (resolve: any, reject?: any) =>
              Promise.resolve({ data: filtered, error: null }).then(resolve, reject),
          };
          return chain;
        },
        delete: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => {
              inMemoryItems = inMemoryItems.filter(
                (it) => !((it as any)[col1] === val1 && (it as any)[col2] === val2)
              );
              return Promise.resolve({ error: null });
            },
          }),
        }),
        insert: (dataToInsert: any) => {
          const items = Array.isArray(dataToInsert) ? dataToInsert : [dataToInsert];
          for (const it of items) {
            inMemoryItems.push({
              id: it.id || `item-${Date.now()}-${Math.random()}`,
              order_id: it.order_id,
              business_id: it.business_id,
              product_id: it.product_id || null,
              product_name: it.product_name,
              name: it.product_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              subtotal: it.subtotal,
              notes: it.notes || null,
              modifiers: it.modifiers || [],
            });
          }
          return Promise.resolve({ data: items, error: null });
        },
      };
    }

    if (tableName === "restaurant_rooms") {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => createMockSupabase()),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createMockSupabase()),
}));

describe("Módulo de Edición de Pedidos No Entregados y Sincronización de Responsable", () => {
  beforeEach(() => {
    inMemoryOrders = [
      {
        id: "order-101",
        business_id: BUSINESS_ID,
        order_number: 3,
        order_type: "dine_in",
        table_id: "table-1",
        status: "in_preparation",
        payment_status: "paid", // Pagado con $25,000
        subtotal: 25000,
        total: 25000,
        delivery_fee: 0,
        customer_name: "Cliente General",
        notes: null,
        assigned_staff_id: "staff-waiter-1",
        assigned_staff_name: "Juan Carlos Gómez Díaz",
        assigned_staff_role: "Mesero",
        driver_name: "Juan Carlos Gómez Díaz",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "order-102",
        business_id: BUSINESS_ID,
        order_number: 4,
        order_type: "takeout",
        table_id: null,
        status: "received",
        payment_status: "pending", // Pendiente
        subtotal: 18000,
        total: 18000,
        delivery_fee: 0,
        customer_name: "Carlos Mario",
        notes: null,
        assigned_staff_id: null,
        assigned_staff_name: null,
        assigned_staff_role: null,
        driver_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    inMemoryItems = [
      {
        id: "item-1",
        order_id: "order-101",
        business_id: BUSINESS_ID,
        product_id: "prod-salchipapa",
        product_name: "Salchipapa Costeña Especial",
        quantity: 1,
        unit_price: 25000,
        subtotal: 25000,
        notes: null,
        modifiers: [],
      },
      {
        id: "item-2",
        order_id: "order-102",
        business_id: BUSINESS_ID,
        product_id: "prod-burger",
        product_name: "Hamburguesa Doble Carne",
        quantity: 1,
        unit_price: 18000,
        subtotal: 18000,
        notes: null,
        modifiers: [],
      },
    ];

    inMemoryTables = [
      {
        id: "table-1",
        business_id: BUSINESS_ID,
        name_or_number: "Mesa 1",
        status: "occupied",
        current_order_id: "order-101",
        capacity: 4,
      },
    ];
  });

  it("1. Debe bloquear la edición de pedidos ya entregados o cancelados", async () => {
    inMemoryOrders[0].status = "delivered";
    const res = await updateRestaurantOrderDetails(
      BUSINESS_ID,
      "order-101",
      { items: [] },
      USER_ID
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("entregado");
  });

  it("2. Debe permitir agregar un producto a un pedido pagado y cambiar el estado de pago a parcial con saldo pendiente", async () => {
    // Pedido pagado originalmente en 25.000. Se agrega Gaseosa por 5.000 -> nuevo total 30.000.
    const res = await updateRestaurantOrderDetails(
      BUSINESS_ID,
      "order-101",
      {
        items: [
          {
            productName: "Salchipapa Costeña Especial",
            quantity: 1,
            unitPrice: 25000,
            subtotal: 25000,
          },
          {
            productName: "Gaseosa 400ml",
            quantity: 1,
            unitPrice: 5000,
            subtotal: 5000,
          },
        ],
      },
      USER_ID
    );

    expect(res.success).toBe(true);
    expect(res.order?.total).toBe(30000);
    // Como estaba pagado en 25k y ahora vale 30k, queda en abono parcial
    expect(res.order?.payment_status).toBe("partial");
    expect(res.priceDifference).toBe(5000);
    expect(res.paymentNotice).toContain("diferencia por cobrar de +$5.000");
  });

  it("3. Debe permitir quitar un producto de un pedido pagado, mantener el pago y generar aviso de devolución de dinero", async () => {
    // Inicial: orden con total 35.000 (pagada)
    inMemoryOrders[0].total = 35000;
    inMemoryOrders[0].subtotal = 35000;
    inMemoryOrders[0].payment_status = "paid";

    // Se edita dejando solo un ítem de 20.000 -> Devolución de 15.000.
    const res = await updateRestaurantOrderDetails(
      BUSINESS_ID,
      "order-101",
      {
        items: [
          {
            productName: "Salchipapa Sencilla",
            quantity: 1,
            unitPrice: 20000,
            subtotal: 20000,
          },
        ],
      },
      USER_ID
    );

    expect(res.success).toBe(true);
    expect(res.order?.total).toBe(20000);
    expect(res.order?.payment_status).toBe("paid");
    expect(res.priceDifference).toBe(-15000);
    expect(res.refundNotice).toContain("Devolver $ 15.000 al cliente");
  });

  it("4. Debe permitir cambiar o asignar el responsable y sincronizarlo", async () => {
    const res = await updateRestaurantOrderDetails(
      BUSINESS_ID,
      "order-102",
      {
        assignedStaffId: "staff-waiter-2",
        assignedStaffName: "Andrés Felipe Marín",
        assignedStaffRole: "Mesero de Salón",
      },
      USER_ID
    );

    expect(res.success).toBe(true);
    expect(res.order?.assigned_staff_name).toBe("Andrés Felipe Marín");
    expect(res.order?.assigned_staff_role).toBe("Mesero de Salón");
    expect(res.order?.driver_name).toBe("Andrés Felipe Marín");
  });

  it("5. Debe sincronizar el responsable real en las Mesas con orden activa en vez de etiqueta genérica 'Mesero'", async () => {
    const tables = await getRestaurantTablesWithOrders(BUSINESS_ID);
    const mesa1 = tables.find((t) => t.id === "table-1");

    expect(mesa1).toBeDefined();
    expect(mesa1?.activeOrder).toBeDefined();
    // Verifica que el nombre del mesero sea el asignado en la orden ("Juan Carlos Gómez Díaz")
    expect(mesa1?.activeOrder?.assigned_staff_name).toBe("Juan Carlos Gómez Díaz");
    expect(mesa1?.activeOrder?.assigned_staff_role).toBe("Mesero");
  });

  it("6. Al cancelar un pedido que ya fue pagado, debe calcular e informar la devolución al cliente", async () => {
    const res = await cancelRestaurantOrder(
      BUSINESS_ID,
      "order-101",
      "Cliente canceló su orden",
      USER_ID
    );

    expect(res.success).toBe(true);
    expect(res.wasPaid).toBe(true);
    expect(res.refundNotice).toContain("Recuerda devolver el dinero al cliente");
  });
});
