import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerRestaurantOrderPayment } from "../../src/lib/restaurant/restaurant-service";
import {
  openCashSession,
  getActiveCashSession,
  recordCashMovement,
} from "../../src/lib/cash/cash-service";
import { ProcessOrderPaymentInput } from "../../src/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const USER_A = "22222222-aaaa-4aaa-aaaa-222222222222";
const REG_A = "33333333-aaaa-4aaa-aaaa-333333333333";
const SESSION_A = "44444444-aaaa-4aaa-aaaa-444444444444";

let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];
let inMemorySaleDocs: any[] = [];
let inMemoryCashRegisters: any[] = [];
let inMemoryCashSessions: any[] = [];
let inMemoryCashMovements: any[] = [];
let inMemoryTables: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "restaurant_tables") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryTables];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            maybeSingle: () => {
              console.log("MAYBESINGLE LIST:", list);
              return Promise.resolve({ data: list[0] || null, error: null });
            },
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "restaurant_orders") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryOrders];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
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
              return Promise.resolve({
                data: item
                  ? {
                      ...item,
                      restaurant_order_items: inMemoryOrderItems.filter((it) => it.order_id === item.id),
                    }
                  : null,
                error: item ? null : { message: "Not found" },
              });
            },
          };
          return chain;
        },
        update: (payload: any) => {
          return {
            eq: (f1: string, v1: any) => ({
              eq: (f2: string, v2: any) => {
                const idx = inMemoryOrders.findIndex((o) => o[f1] === v1 && o[f2] === v2);
                if (idx !== -1) {
                  inMemoryOrders[idx] = { ...inMemoryOrders[idx], ...payload };
                }
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };
    }

    if (tableName === "business_sale_documents") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemorySaleDocs];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val || r["restaurant_order_id"] === val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            limit: (n: number) => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const doc = {
            id: payload.id || `55555555-${Date.now().toString().slice(-4)}-4aaa-aaaa-555555555555`,
            ...payload,
            document_number: payload.document_number || `DOC-2026-000${inMemorySaleDocs.length + 1}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemorySaleDocs.push(doc);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: doc, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "cash_registers") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryCashRegisters];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            limit: (n: number) => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: payload.id || REG_A,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryCashRegisters.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "cash_sessions") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryCashSessions];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            limit: (n: number) => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: payload.id || SESSION_A,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryCashSessions.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    if (tableName === "cash_movements") {
      return {
        select: (cols: string = "*") => {
          let list = [...inMemoryCashMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: (col: string, opts?: any) => chain,
            limit: (n: number) => chain,
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: payload.id || `66666666-${Date.now().toString().slice(-4)}-4aaa-aaaa-666666666666`,
            ...payload,
            created_at: new Date().toISOString(),
          };
          inMemoryCashMovements.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
      };
    }

    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/supabase/client", () => ({
  getDbClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/documents/document-service", () => ({
  getBusinessDocumentConfig: vi.fn(async () => ({
    prefix: "FAC",
    nextNumber: 1,
    tradeName: "Restaurante Central",
  })),
  createBusinessSaleDocument: vi.fn(async (businessId: string, data: any) => {
    const doc = {
      id: `55555555-${Date.now().toString().slice(-4)}-4aaa-aaaa-555555555555`,
      businessId,
      documentNumber: "DOC-2026-0001",
      documentType: data.documentType,
      customerName: data.customerName,
      subtotal: data.items.reduce((acc: number, it: any) => acc + (it.total || 0), 0),
      discountTotal: data.discountTotal || 0,
      total: data.total !== undefined ? data.total : data.items.reduce((acc: number, it: any) => acc + (it.total || 0), 0),
      paymentMethod: data.paymentMethod,
      status: "paid",
      notes: data.notes,
      restaurant_order_id: data.restaurantOrderId,
      createdAt: new Date().toISOString(),
    };
    inMemorySaleDocs.push(doc);
    return { success: true, document: doc };
  }),
}));

describe("[POS-002] Pagos múltiples, divisiones, propinas y descuentos", () => {
  beforeEach(() => {
    inMemoryOrders = [];
    inMemoryOrderItems = [];
    inMemorySaleDocs = [];
    inMemoryCashRegisters = [];
    inMemoryCashSessions = [];
    inMemoryCashMovements = [];
    inMemoryTables = [];

    // Crear Caja Principal y Sesión activa por defecto
    inMemoryCashRegisters.push({
      id: REG_A,
      business_id: BUSINESS_A,
      name: "Caja Principal",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    inMemoryCashSessions.push({
      id: SESSION_A,
      register_id: REG_A,
      business_id: BUSINESS_A,
      opened_by: USER_A,
      opened_at: new Date().toISOString(),
      initial_amount: 200000,
      status: "open",
      created_at: new Date().toISOString(),
    });
  });

  it("Criterio 1: Se puede dividir un pago entre efectivo y tarjeta", async () => {
    const orderId = "11111111-1111-4111-a111-111111111111";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 101,
      status: "delivered",
      payment_status: "pending",
      order_type: "dine_in",
      channel_origin: "in_person",
      subtotal: 20000,
      delivery_fee: 0,
      tax_total: 0,
      total: 20000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentInput: ProcessOrderPaymentInput = {
      isSplit: true,
      splitPayments: [
        { method: "cash", amount: 15000 },
        { method: "card", amount: 5000 },
      ],
    };

    const res = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(res.success).toBe(true);
    expect(res.order?.payment_status).toBe("paid");
    expect(res.order?.notes).toContain("Pago dividido: cash: $15000 + card: $5000");
  });

  it("Criterio 2: El cambio se calcula sobre el método en efectivo", async () => {
    const orderId = "22222222-2222-4222-a222-222222222222";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 102,
      status: "delivered",
      payment_status: "pending",
      order_type: "takeout",
      channel_origin: "in_person",
      subtotal: 20000,
      delivery_fee: 0,
      tax_total: 0,
      total: 20000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Cliente divide: $15.000 en efectivo y $5.000 con transferencia
    // Pero entrega billete de $20.000 para la porción en efectivo ($5.000 de cambio)
    const paymentInput: ProcessOrderPaymentInput = {
      isSplit: true,
      splitPayments: [
        { method: "cash", amount: 15000, receivedAmount: 20000, change: 5000 },
        { method: "transfer", amount: 5000 },
      ],
      cashChange: 5000,
    };

    const res = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(res.success).toBe(true);
    expect(res.order?.notes).toContain("Cambio efectivo: $5000");
  });

  it("Criterio 3: La propina se registra separada del monto de la venta", async () => {
    const orderId = "33333333-3333-4333-a333-333333333333";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 103,
      status: "delivered",
      payment_status: "pending",
      order_type: "dine_in",
      channel_origin: "in_person",
      subtotal: 30000,
      delivery_fee: 0,
      tax_total: 0,
      total: 30000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 10% de propina sobre $30.000 = $3.000
    // Total recaudado = $33.000, pero venta neta = $30.000
    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "card",
      tip: {
        amount: 3000,
        percentage: 10,
      },
    };

    const res = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(res.success).toBe(true);
    expect(res.order?.total).toBe(30000); // Monto de la venta permanece en $30.000
    expect(res.order?.notes).toContain("Propina: +$3000");
    expect(res.document?.total).toBe(30000);
  });

  it("Criterio 4: El descuento reduce el total antes del pago", async () => {
    const orderId = "44444444-4444-4444-a444-444444444444";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 104,
      status: "delivered",
      payment_status: "pending",
      order_type: "dine_in",
      channel_origin: "in_person",
      subtotal: 40000,
      delivery_fee: 0,
      tax_total: 0,
      total: 40000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Descuento del 10% ($4.000) por "Cliente frecuente"
    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "cash",
      discount: {
        type: "percentage",
        value: 10,
        amount: 4000,
        reason: "Cliente frecuente",
      },
    };

    const res = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(res.success).toBe(true);
    // Total reducido de $40.000 a $36.000
    expect(res.order?.total).toBe(36000);
    expect(res.order?.notes).toContain("Descuento: -$4000 (Cliente frecuente)");
    expect(res.document?.total).toBe(36000);
    expect(res.document?.discountTotal).toBe(4000);
  });

  it("Criterio 5: Cada método de pago genera su propio cash_movements", async () => {
    const orderId = "55555555-5555-4555-a555-555555555555";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 105,
      status: "delivered",
      payment_status: "pending",
      order_type: "dine_in",
      channel_origin: "in_person",
      subtotal: 50000,
      delivery_fee: 0,
      tax_total: 0,
      total: 50000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Pago dividido: $30.000 en efectivo + $20.000 en tarjeta
    const paymentInput: ProcessOrderPaymentInput = {
      isSplit: true,
      splitPayments: [
        { method: "cash", amount: 30000 },
        { method: "card", amount: 20000 },
      ],
    };

    const res = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);
    expect(res.success).toBe(true);

    // Verificar que se hayan generado 2 movimientos de caja
    expect(inMemoryCashMovements.length).toBe(2);

    const cashMov = inMemoryCashMovements.find((m) => m.movement_type === "sale_cash");
    expect(cashMov).toBeDefined();
    expect(cashMov.amount).toBe(30000);
    expect(cashMov.session_id).toBe(SESSION_A);
    expect(cashMov.reference_id).toBe(orderId);

    const cardMov = inMemoryCashMovements.find((m) => m.movement_type === "sale_card");
    expect(cardMov).toBeDefined();
    expect(cardMov.amount).toBe(20000);
    expect(cardMov.session_id).toBe(SESSION_A);
    expect(cardMov.reference_id).toBe(orderId);
  });

  it("Regla de oro: Prohibición absoluta de alertas nativas en el módulo de pagos y POS", () => {
    const posFiles = [
      "src/components/payments/order-payment-modal.tsx",
      "src/components/pos/open-cash-shift-modal.tsx",
      "src/components/pos/order-success-modal.tsx",
      "src/components/pos/pos-screen-client.tsx",
    ];

    for (const relativePath of posFiles) {
      const fullPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
        expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
        expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
        expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
      }
    }
  });
});
