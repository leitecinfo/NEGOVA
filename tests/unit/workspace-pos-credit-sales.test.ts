import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  registerRestaurantOrderPayment,
} from "@/lib/restaurant/restaurant-service";
import {
  getCashSessionSummary,
} from "@/lib/cash/cash-service";
import {
  getCustomerReceivables,
  getAccountsReceivableKPIs,
} from "@/lib/customers/customers-service";
import { ProcessOrderPaymentInput } from "@/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const USER_A = "22222222-aaaa-4aaa-aaaa-222222222222";
const REG_A = "33333333-aaaa-4aaa-aaaa-333333333333";
const SESSION_A = "44444444-aaaa-4aaa-aaaa-444444444444";

const CUSTOMER_NO_CREDIT = "cust-no-credit-01";
const CUSTOMER_WITH_CREDIT = "cust-with-credit-02";

let inMemoryOrders: any[] = [];
let inMemoryOrderItems: any[] = [];
let inMemorySaleDocs: any[] = [];
let inMemoryCashRegisters: any[] = [];
let inMemoryCashSessions: any[] = [];
let inMemoryCashMovements: any[] = [];
let inMemoryTables: any[] = [];
let inMemoryCustomers: any[] = [];
let inMemoryReceivables: any[] = [];
let inMemoryCustomerPayments: any[] = [];

const mockSupabase = {
  from: (tableName: string) => {
    if (tableName === "restaurant_tables") {
      return {
        select: (_cols: string = "*") => {
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
            order: () => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "restaurant_orders") {
      return {
        select: (_cols: string = "*") => {
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
                data: item,
                error: item ? null : { message: "Order not found" },
              });
            },
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        update: (payload: any) => {
          return {
            eq: (f1: string, v1: any) => ({
              eq: (f2: string, v2: any) => {
                const idx = inMemoryOrders.findIndex((o) => o[f1] === v1 && o[f2] === v2);
                if (idx !== -1) {
                  inMemoryOrders[idx] = { ...inMemoryOrders[idx], ...payload, updated_at: new Date().toISOString() };
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
        select: (_cols: string = "*") => {
          let list = [...inMemorySaleDocs];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val || r["restaurant_order_id"] === val);
              return chain;
            },
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const doc = {
            id: payload.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

    if (tableName === "customers") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCustomers];
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
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            limit: () => chain,
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => ({
            eq: (f2: string, v2: any) => {
              const idx = inMemoryCustomers.findIndex((c) => c[f1] === v1 && c[f2] === v2);
              if (idx !== -1) {
                inMemoryCustomers[idx] = { ...inMemoryCustomers[idx], ...payload, updated_at: new Date().toISOString() };
              }
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };
    }

    if (tableName === "accounts_receivable") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryReceivables];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            neq: (col: string, val: any) => {
              list = list.filter((r) => r[col] !== val);
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const rec = {
            id: payload.id || `ar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          inMemoryReceivables.push(rec);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: rec, error: null }),
            }),
          };
        },
        update: (payload: any) => ({
          eq: (f1: string, v1: any) => {
            const idx = inMemoryReceivables.findIndex((r) => r[f1] === v1);
            if (idx !== -1) {
              inMemoryReceivables[idx] = { ...inMemoryReceivables[idx], ...payload };
            }
            return Promise.resolve({ error: null });
          },
        }),
      };
    }

    if (tableName === "customer_payments") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCustomerPayments];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "cash_sessions") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCashSessions];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            maybeSingle: () => Promise.resolve({ data: list[0] || null, error: null }),
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "cash_registers") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCashRegisters];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            single: () => Promise.resolve({ data: list[0] || null, error: null }),
          };
          return chain;
        },
      };
    }

    if (tableName === "cash_movements") {
      return {
        select: (_cols: string = "*") => {
          let list = [...inMemoryCashMovements];
          const chain: any = {
            eq: (col: string, val: any) => {
              list = list.filter((r) => r[col] === val);
              return chain;
            },
            order: () => chain,
            then: (resolve: any) => resolve({ data: list, error: null }),
          };
          return chain;
        },
        insert: (payload: any) => {
          const row = {
            id: payload.id || `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          single: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: any) => resolve({ data: [], error: null }),
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
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      businessId,
      documentNumber: "DOC-2026-0001",
      documentType: data.documentType,
      customerName: data.customerName,
      subtotal: data.items.reduce((acc: number, it: any) => acc + (it.total || 0), 0),
      discountTotal: data.discountTotal || 0,
      total: data.total !== undefined ? data.total : data.items.reduce((acc: number, it: any) => acc + (it.total || 0), 0),
      paymentMethod: data.paymentMethod,
      status: data.status || "paid",
      notes: data.notes,
      restaurant_order_id: data.restaurantOrderId,
      createdAt: new Date().toISOString(),
    };
    inMemorySaleDocs.push(doc);
    return { success: true, document: doc };
  }),
}));

describe("[POS-003] Implementar ventas a crédito en POS", () => {
  beforeEach(() => {
    inMemoryOrders = [];
    inMemoryOrderItems = [];
    inMemorySaleDocs = [];
    inMemoryCashRegisters = [];
    inMemoryCashSessions = [];
    inMemoryCashMovements = [];
    inMemoryTables = [];
    inMemoryCustomers = [];
    inMemoryReceivables = [];
    inMemoryCustomerPayments = [];

    // 1. Caja y Sesión Activa con Base Inicial de $200.000
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

    // 2. Cliente Sin Crédito Habilitado (credit_limit = 0)
    inMemoryCustomers.push({
      id: CUSTOMER_NO_CREDIT,
      business_id: BUSINESS_A,
      full_name: "Juan Perez (Sin Credito)",
      phone: "3001112233",
      credit_limit: 0,
      credit_used: 0,
      status: "active",
      created_at: new Date().toISOString(),
    });

    // 3. Cliente Con Crédito Habilitado (Límite: $150.000, Usado: $30.000, Disponible: $120.000)
    inMemoryCustomers.push({
      id: CUSTOMER_WITH_CREDIT,
      business_id: BUSINESS_A,
      full_name: "Empresa Aliada SAS",
      phone: "3109998877",
      credit_limit: 150000,
      credit_used: 30000,
      status: "active",
      created_at: new Date().toISOString(),
    });
  });

  it("Criterio 1: Al seleccionar 'A crédito' con cliente sin crédito habilitado genera error", async () => {
    const orderId = "order-test-01";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 101,
      status: "delivered",
      payment_status: "pending",
      order_type: "takeout",
      channel_origin: "in_person",
      customer_id: CUSTOMER_NO_CREDIT,
      customer_name: "Juan Perez (Sin Credito)",
      subtotal: 45000,
      delivery_fee: 0,
      tax_total: 0,
      total: 45000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "credit",
      customerId: CUSTOMER_NO_CREDIT,
    };

    const result = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    // Debe ser rechazado
    expect(result.success).toBe(false);
    expect(result.error).toContain("no tiene cupo de crédito autorizado");

    // No se debió crear cuenta por cobrar
    expect(inMemoryReceivables.length).toBe(0);

    // El estado del pedido sigue pendiente
    const orderInDb = inMemoryOrders.find((o) => o.id === orderId);
    expect(orderInDb.payment_status).toBe("pending");
  });

  it("Criterio 2: Al superar el límite de crédito disponible genera error con el saldo detallado", async () => {
    const orderId = "order-test-02";
    // Venta por $130.000 cuando el cliente solo tiene $120.000 disponible ($150.000 - $30.000)
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 102,
      status: "delivered",
      payment_status: "pending",
      order_type: "dine_in",
      channel_origin: "in_person",
      customer_id: CUSTOMER_WITH_CREDIT,
      customer_name: "Empresa Aliada SAS",
      subtotal: 130000,
      delivery_fee: 0,
      tax_total: 0,
      total: 130000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "credit",
      customerId: CUSTOMER_WITH_CREDIT,
    };

    const result = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cupo de crédito insuficiente");
    expect(result.error).toContain("120.000"); // Saldo disponible
    expect(result.error).toContain("130.000"); // Solicitado

    // El cupo usado no debió alterarse
    const custInDb = inMemoryCustomers.find((c) => c.id === CUSTOMER_WITH_CREDIT);
    expect(custInDb.credit_used).toBe(30000);
    expect(inMemoryReceivables.length).toBe(0);
  });

  it("Venta a crédito exitosa: La venta queda con payment_status: credit y crea accounts_receivable", async () => {
    const orderId = "order-test-03";
    // Venta válida por $50.000 (Dentro del cupo disponible de $120.000)
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 103,
      status: "delivered",
      payment_status: "pending",
      order_type: "takeout",
      channel_origin: "in_person",
      customer_id: CUSTOMER_WITH_CREDIT,
      customer_name: "Empresa Aliada SAS",
      subtotal: 50000,
      delivery_fee: 0,
      tax_total: 0,
      total: 50000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "credit",
      customerId: CUSTOMER_WITH_CREDIT,
      creditDueDays: 30,
    };

    const result = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);

    expect(result.success).toBe(true);

    // Criterio: La venta queda con payment_status: credit
    const orderInDb = inMemoryOrders.find((o) => o.id === orderId);
    expect(orderInDb.payment_status).toBe("credit");
    expect(orderInDb.customer_id).toBe(CUSTOMER_WITH_CREDIT);

    // Criterio: Al confirmar: crear accounts_receivable, incrementar credit_used
    expect(inMemoryReceivables.length).toBe(1);
    const ar = inMemoryReceivables[0];
    expect(ar.customer_id).toBe(CUSTOMER_WITH_CREDIT);
    expect(ar.amount).toBe(50000);
    expect(ar.balance).toBe(50000);
    expect(ar.paid_amount).toBe(0);
    expect(ar.status).toBe("pending");
    expect(ar.order_id).toBe(orderId);

    // Incrementar credit_used ($30.000 iniciales + $50.000 nueva venta = $80.000)
    const custInDb = inMemoryCustomers.find((c) => c.id === CUSTOMER_WITH_CREDIT);
    expect(custInDb.credit_used).toBe(80000);
  });

  it("Criterio 3: La venta a crédito NO suma al efectivo del turno", async () => {
    // 1. Verificar estado de caja previo (Base $200.000)
    const summaryBefore = await getCashSessionSummary(BUSINESS_A, SESSION_A);
    expect(summaryBefore.initialAmount).toBe(200000);
    expect(summaryBefore.totalSalesCash).toBe(0);
    expect(summaryBefore.expectedCashInDrawer).toBe(200000);

    // 2. Realizar venta a crédito por $60.000
    const orderId = "order-test-04";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 104,
      status: "delivered",
      payment_status: "pending",
      order_type: "takeout",
      channel_origin: "in_person",
      customer_id: CUSTOMER_WITH_CREDIT,
      subtotal: 60000,
      delivery_fee: 0,
      tax_total: 0,
      total: 60000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const paymentInput: ProcessOrderPaymentInput = {
      paymentMethod: "credit",
      customerId: CUSTOMER_WITH_CREDIT,
    };

    const result = await registerRestaurantOrderPayment(BUSINESS_A, orderId, paymentInput, USER_A);
    expect(result.success).toBe(true);

    // 3. Validar movimientos de caja: No debe registrarse movimiento de efectivo en caja
    const cashMovements = inMemoryCashMovements.filter((m) => m.movement_type === "sale_cash");
    expect(cashMovements.length).toBe(0);

    // 4. Validar el efectivo esperado del turno de caja: Debe mantenerse idéntico en $200.000
    const summaryAfter = await getCashSessionSummary(BUSINESS_A, SESSION_A);
    expect(summaryAfter.totalSalesCash).toBe(0);
    expect(summaryAfter.expectedCashInDrawer).toBe(200000);
  });

  it("Criterio 4: La cuenta por cobrar aparece en la cartera del cliente", async () => {
    const orderId = "order-test-05";
    inMemoryOrders.push({
      id: orderId,
      business_id: BUSINESS_A,
      order_number: 105,
      status: "delivered",
      payment_status: "pending",
      order_type: "takeout",
      channel_origin: "in_person",
      customer_id: CUSTOMER_WITH_CREDIT,
      subtotal: 75000,
      delivery_fee: 0,
      tax_total: 0,
      total: 75000,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await registerRestaurantOrderPayment(
      BUSINESS_A,
      orderId,
      { paymentMethod: "credit", customerId: CUSTOMER_WITH_CREDIT },
      USER_A
    );
    expect(res.success).toBe(true);

    // Consultar cartera del cliente
    const portfolio = await getCustomerReceivables(BUSINESS_A, CUSTOMER_WITH_CREDIT);
    expect(portfolio.receivables.length).toBe(1);
    expect(portfolio.receivables[0].amount).toBe(75000);
    expect(portfolio.receivables[0].balance).toBe(75000);
    expect(portfolio.receivables[0].status).toBe("pending");
    const totalBalance = portfolio.receivables.reduce((sum, r) => sum + r.balance, 0);
    expect(totalBalance).toBe(75000);

    // Consultar KPIs generales de cartera del comercio
    const kpis = await getAccountsReceivableKPIs(BUSINESS_A);
    expect(kpis.totalReceivable).toBe(75000);
    expect(kpis.agingBuckets.current).toBe(75000);
  });

  it("Regla de Oro: Prohibición absoluta de alertas nativas en todos los archivos del POS y pagos", () => {
    const filesToCheck = [
      path.join(process.cwd(), "src/components/payments/order-payment-modal.tsx"),
      path.join(process.cwd(), "src/components/pos/order-destination-modal.tsx"),
      path.join(process.cwd(), "src/components/pos/pos-screen-client.tsx"),
      path.join(process.cwd(), "src/lib/restaurant/restaurant-service.ts"),
      path.join(process.cwd(), "src/app/workspace/[businessId]/pedidos/actions.ts"),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\b/);
        expect(content).not.toMatch(/\bwindow\.confirm\b/);
        expect(content).not.toMatch(/\bwindow\.prompt\b/);
        expect(content).not.toMatch(/\bAlert\.alert\b/);
      }
    }
  });
});
