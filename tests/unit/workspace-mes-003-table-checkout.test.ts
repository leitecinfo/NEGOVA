import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  closeTableOrderWithPayment,
  getTableSalesAndTipsReport,
  extractOrderFinancialBreakdown,
} from "@/lib/restaurant/restaurant-service";
import { PRESET_TABLE_DISCOUNTS, PRESET_TIP_PERCENTAGES } from "@/lib/restaurant/types";

// ==============================================================================
// SIMULACIÓN MULTI-TENANT EN MEMORIA (Supabase genérico con filtros encadenables)
// ==============================================================================

const BUSINESS_A = "11111111-aaaa-4aaa-aaaa-111111111111";
const BUSINESS_B = "99999999-bbbb-4bbb-bbbb-999999999999";
const USER_A = "22222222-aaaa-4aaa-aaaa-222222222222";
const REG_A = "33333333-aaaa-4aaa-aaaa-333333333333";
const SESSION_A = "44444444-aaaa-4aaa-aaaa-444444444444";
const TABLE_1 = "aaaaaaaa-0001-4aaa-aaaa-000000000001";
const TABLE_2 = "aaaaaaaa-0002-4aaa-aaaa-000000000002";
const ORDER_1 = "bbbbbbbb-0001-4bbb-bbbb-000000000001";
const ORDER_2 = "bbbbbbbb-0002-4bbb-bbbb-000000000002";

const db: Record<string, any[]> = {};

function resetDb() {
  for (const k of Object.keys(db)) delete db[k];
  db.restaurant_tables = [];
  db.restaurant_rooms = [];
  db.restaurant_orders = [];
  db.restaurant_order_items = [];
  db.business_sale_documents = [];
  db.cash_registers = [];
  db.cash_sessions = [];
  db.cash_movements = [];
  db.customers = [];
  db.accounts_receivable = [];
}

function createBuilder(table: string) {
  const filters: Array<(r: any) => boolean> = [];
  let op: "select" | "update" | "insert" | "delete" = "select";
  let payload: any = null;
  let withItems = false;

  const rows = () => (db[table] = db[table] || []);
  const matched = () => rows().filter((r) => filters.every((f) => f(r)));
  const decorate = (r: any) =>
    withItems && table === "restaurant_orders"
      ? { ...r, restaurant_order_items: db.restaurant_order_items.filter((i) => i.order_id === r.id) }
      : r;

  const exec = () => {
    if (op === "insert") {
      const list = Array.isArray(payload) ? payload : [payload];
      const created = list.map((p) => ({
        id: p.id || `gen-${Math.random().toString(36).slice(2, 10)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...p,
      }));
      rows().push(...created);
      return { data: created, error: null };
    }
    if (op === "update") {
      const m = matched();
      m.forEach((r) => Object.assign(r, payload));
      return { data: m, error: null };
    }
    if (op === "delete") {
      const m = matched();
      db[table] = rows().filter((r) => !m.includes(r));
      return { data: m, error: null };
    }
    return { data: matched().map(decorate), error: null };
  };

  const b: any = {
    select: (cols?: string) => {
      if (cols && cols.includes("restaurant_order_items")) withItems = true;
      return b;
    },
    insert: (p: any) => {
      op = "insert";
      payload = p;
      return b;
    },
    update: (p: any) => {
      op = "update";
      payload = p;
      return b;
    },
    delete: () => {
      op = "delete";
      return b;
    },
    eq: (c: string, v: any) => (filters.push((r) => r[c] === v), b),
    neq: (c: string, v: any) => (filters.push((r) => r[c] !== v), b),
    in: (c: string, vs: any[]) => (filters.push((r) => vs.includes(r[c])), b),
    gte: (c: string, v: any) => (filters.push((r) => r[c] >= v), b),
    lte: (c: string, v: any) => (filters.push((r) => r[c] <= v), b),
    ilike: (c: string, v: any) =>
      (filters.push((r) => String(r[c] || "").toLowerCase() === String(v).toLowerCase()), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => {
      const res = exec();
      return { data: res.data[0] || null, error: null };
    },
    single: async () => {
      const res = exec();
      return res.data[0]
        ? { data: res.data[0], error: null }
        : { data: null, error: { message: "Not found" } };
    },
    then: (resolve: any, reject?: any) => Promise.resolve(exec()).then(resolve, reject),
  };
  return b;
}

const mockSupabase = { from: (t: string) => createBuilder(t), rpc: async () => ({ data: null, error: null }) };

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSupabase) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => mockSupabase) }));
vi.mock("@/lib/audit/audit-service", () => ({ logAuditAction: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/documents/document-service", () => ({
  createBusinessSaleDocument: vi.fn(async (businessId: string, data: any) => {
    const doc = {
      id: `doc-${Math.random().toString(36).slice(2, 8)}`,
      business_id: businessId,
      restaurant_order_id: data.restaurantOrderId,
      document_number: `DOC-2026-${String(db.business_sale_documents.length + 1).padStart(4, "0")}`,
      total: data.total,
      discount_total: data.discountTotal || 0,
      payment_method: data.paymentMethod,
      status: data.status || "paid",
      notes: data.notes,
      issued_at: new Date().toISOString(),
    };
    db.business_sale_documents.push(doc);
    return { success: true, document: { ...doc, documentNumber: doc.document_number, total: doc.total } };
  }),
}));

function seedTableWithOrder(opts: {
  businessId?: string;
  tableId: string;
  orderId: string;
  orderNumber: number;
  subtotal: number;
  name: string;
}) {
  const businessId = opts.businessId || BUSINESS_A;
  db.restaurant_tables.push({
    id: opts.tableId,
    business_id: businessId,
    name_or_number: opts.name,
    capacity: 4,
    status: "occupied",
    current_order_id: opts.orderId,
    sort_order: 0,
  });
  db.restaurant_orders.push({
    id: opts.orderId,
    business_id: businessId,
    order_number: opts.orderNumber,
    status: "ready",
    order_type: "dine_in",
    channel_origin: "in_person",
    subtotal: opts.subtotal,
    delivery_fee: 0,
    tax_total: 0,
    total: opts.subtotal,
    notes: null,
    table_id: opts.tableId,
    payment_status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  db.restaurant_order_items.push({
    id: `item-${opts.orderId}`,
    business_id: businessId,
    order_id: opts.orderId,
    product_name: "Bandeja Paisa",
    quantity: 2,
    unit_price: opts.subtotal / 2,
    subtotal: opts.subtotal,
    modifiers: [],
  });
}

describe("[MES-003] Cobro de mesa con propinas, descuentos preestablecidos y pago mixto", () => {
  beforeEach(() => {
    resetDb();
    db.cash_registers.push({ id: REG_A, business_id: BUSINESS_A, name: "Caja Principal", is_active: true });
    db.cash_sessions.push({
      id: SESSION_A,
      register_id: REG_A,
      business_id: BUSINESS_A,
      opened_by: USER_A,
      opened_at: new Date().toISOString(),
      initial_amount: 100000,
      status: "open",
    });
  });

  it("Configuración: existen descuentos preestablecidos (Adulto Mayor 10%, Estudiante 15%) y propinas 5/10/15%", () => {
    const senior = PRESET_TABLE_DISCOUNTS.find((d) => d.id === "senior_10");
    const student = PRESET_TABLE_DISCOUNTS.find((d) => d.id === "student_15");
    expect(senior?.percentage).toBe(10);
    expect(senior?.label).toContain("Adulto Mayor");
    expect(student?.percentage).toBe(15);
    expect(student?.label).toContain("Estudiante");
    expect([...PRESET_TIP_PERCENTAGES]).toEqual([5, 10, 15]);
  });

  it("Criterio 1: Se cobra una mesa con 10% de descuento + 15% de propina + pago mixto", async () => {
    seedTableWithOrder({ tableId: TABLE_1, orderId: ORDER_1, orderNumber: 201, subtotal: 100000, name: "Mesa 1" });

    // Subtotal 100.000 → Descuento 10% (Adulto Mayor) = 10.000 → Venta neta 90.000
    // Propina 15% sobre 90.000 = 13.500 → Total a pagar 103.500
    // Pago mixto: 50.000 efectivo + 53.500 tarjeta
    const res = await closeTableOrderWithPayment(
      BUSINESS_A,
      TABLE_1,
      {
        paymentMethod: "cash",
        isSplit: true,
        splitPayments: [
          { method: "cash", amount: 50000 },
          { method: "card", amount: 53500 },
        ],
        discount: { type: "percentage", value: 10, presetId: "senior_10" },
        tip: { percentage: 15 },
      },
      USER_A
    );

    expect(res.success).toBe(true);
    expect(res.summary).toEqual({
      subtotal: 100000,
      discountAmount: 10000,
      netSaleTotal: 90000,
      tipAmount: 13500,
      totalCollected: 103500,
    });

    // Cada método del pago mixto genera su propio movimiento de caja
    const movements = db.cash_movements.filter((m) => m.reference_id === ORDER_1);
    expect(movements).toHaveLength(2);
    expect(movements.find((m) => m.movement_type === "sale_cash")?.amount).toBe(50000);
    expect(movements.find((m) => m.movement_type === "sale_card")?.amount).toBe(53500);

    const order = db.restaurant_orders.find((o) => o.id === ORDER_1);
    expect(order.notes).toContain("Descuento: -$10000 (Adulto Mayor 10%)");
    expect(order.notes).toContain("Propina: +$13500 (15%)");
    expect(order.notes).toContain("Pago dividido: cash: $50000 + card: $53500");
  });

  it("Criterio 2: Al confirmar pago la mesa queda libre y el pedido queda 'delivered' + 'paid'", async () => {
    seedTableWithOrder({ tableId: TABLE_1, orderId: ORDER_1, orderNumber: 202, subtotal: 60000, name: "Mesa 1" });

    const res = await closeTableOrderWithPayment(BUSINESS_A, TABLE_1, { paymentMethod: "card" }, USER_A);
    expect(res.success).toBe(true);

    const order = db.restaurant_orders.find((o) => o.id === ORDER_1);
    expect(order.status).toBe("delivered");
    expect(order.payment_status).toBe("paid");

    const table = db.restaurant_tables.find((t) => t.id === TABLE_1);
    expect(table.status).toBe("available");
    expect(table.current_order_id).toBeNull();
    expect(res.table?.status).toBe("available");
  });

  it("Criterio 3: La propina se registra separada de la venta neta en los reportes", async () => {
    seedTableWithOrder({ tableId: TABLE_1, orderId: ORDER_1, orderNumber: 203, subtotal: 100000, name: "Mesa 1" });
    seedTableWithOrder({ tableId: TABLE_2, orderId: ORDER_2, orderNumber: 204, subtotal: 40000, name: "Mesa 2" });

    await closeTableOrderWithPayment(
      BUSINESS_A,
      TABLE_1,
      {
        isSplit: true,
        splitPayments: [
          { method: "cash", amount: 50000 },
          { method: "card", amount: 53500 },
        ],
        discount: { type: "percentage", value: 10, presetId: "senior_10" },
        tip: { percentage: 15 },
      },
      USER_A
    );
    await closeTableOrderWithPayment(BUSINESS_A, TABLE_2, { paymentMethod: "cash" }, USER_A);

    const report = await getTableSalesAndTipsReport(BUSINESS_A);
    expect(report.ordersCount).toBe(2);
    // Venta neta: 90.000 + 40.000 (la propina NO se suma a ventas)
    expect(report.totalNetSales).toBe(130000);
    expect(report.totalTips).toBe(13500);
    expect(report.totalDiscounts).toBe(10000);
    expect(report.totalCollected).toBe(143500);
    expect(report.ordersWithTipCount).toBe(1);

    // El documento de venta registra la venta neta, no la propina
    const doc = db.business_sale_documents.find((d) => d.restaurant_order_id === ORDER_1);
    expect(doc.total).toBe(90000);
    expect(doc.discount_total).toBe(10000);

    const bd = extractOrderFinancialBreakdown(db.restaurant_orders.find((o) => o.id === ORDER_1));
    expect(bd.tipAmount).toBe(13500);
    expect(bd.tipPercentage).toBe(15);
    expect(bd.discountReason).toBe("Adulto Mayor 10%");
    expect(bd.isSplit).toBe(true);
  });

  it("Validaciones: rechaza mesa sin orden activa y mesas de otro comercio (aislamiento multi-tenant)", async () => {
    db.restaurant_tables.push({
      id: TABLE_2,
      business_id: BUSINESS_A,
      name_or_number: "Mesa Libre",
      status: "available",
      current_order_id: null,
    });
    const noOrder = await closeTableOrderWithPayment(BUSINESS_A, TABLE_2, { paymentMethod: "cash" }, USER_A);
    expect(noOrder.success).toBe(false);
    expect(noOrder.error).toMatch(/no tiene una orden activa/i);

    seedTableWithOrder({
      businessId: BUSINESS_B,
      tableId: TABLE_1,
      orderId: ORDER_1,
      orderNumber: 300,
      subtotal: 50000,
      name: "Mesa Ajena",
    });
    const foreign = await closeTableOrderWithPayment(BUSINESS_A, TABLE_1, { paymentMethod: "cash" }, USER_A);
    expect(foreign.success).toBe(false);
    expect(db.restaurant_orders.find((o) => o.id === ORDER_1).payment_status).toBe("pending");
  });

  it("Regla de código: Cero alertas nativas en los archivos de MES-003", () => {
    const files = [
      "src/components/mesas/close-table-order-modal.tsx",
      "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx",
      "src/app/workspace/[businessId]/mesas/actions.ts",
      "src/components/payments/order-payment-modal.tsx",
      "src/lib/restaurant/restaurant-service.ts",
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
      expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
      expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
      expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
    }
  });
});

