import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockCustomerRow {
  id: string;
  business_id: string;
  full_name: string;
  phone: string | null;
  normalized_phone: string | null;
  email: string | null;
  tax_id: string | null;
  notes: string | null;
  status: "active" | "inactive";
  credit_limit: number;
  credit_used: number;
  created_at: string;
  updated_at: string;
}

interface MockReceivableRow {
  id: string;
  business_id: string;
  customer_id: string;
  order_id: string | null;
  amount: number;
  paid_amount: number;
  balance: number;
  due_date: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  created_at: string;
}

interface MockCustomerPaymentRow {
  id: string;
  business_id: string;
  customer_id: string;
  receivable_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const mockDb = {
  customers: [] as MockCustomerRow[],
  accounts_receivable: [] as MockReceivableRow[],
  customer_payments: [] as MockCustomerPaymentRow[],
  customer_addresses: [] as any[],
};

function createMockSupabase() {
  return {
    from(table: keyof typeof mockDb) {
      let filters: Array<(row: any) => boolean> = [];
      let updatePayload: Record<string, any> | null = null;
      let insertPayload: Record<string, any> | null = null;

      const applyFilters = (rows: any[]) =>
        rows.filter((r) => filters.every((fn) => fn(r)));

      const builder: any = {
        select(_cols?: string, _opts?: any) {
          return builder;
        },
        eq(field: string, value: any) {
          filters.push((row) => row[field] === value);
          return builder;
        },
        neq(field: string, value: any) {
          filters.push((row) => row[field] !== value);
          return builder;
        },
        gt(field: string, value: any) {
          filters.push((row) => Number(row[field]) > Number(value));
          return builder;
        },
        in(field: string, values: any[]) {
          filters.push((row) => values.includes(row[field]));
          return builder;
        },
        or(_expr: string) {
          return builder;
        },
        order(_field: string, _opts?: any) {
          return builder;
        },
        range(from: number, to: number) {
          const rows = applyFilters(mockDb[table]);
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            count: rows.length,
            error: null,
          });
        },
        update(payload: Record<string, any>) {
          updatePayload = payload;
          return builder;
        },
        insert(payload: Record<string, any>) {
          insertPayload = payload;
          return builder;
        },
        maybeSingle() {
          if (updatePayload) {
            const rows = applyFilters(mockDb[table]);
            rows.forEach((r) => Object.assign(r, updatePayload));
            return Promise.resolve({ data: rows[0] ?? null, error: null });
          }
          const rows = applyFilters(mockDb[table]);
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        single() {
          if (insertPayload) {
            const newRow = {
              id: `${table}-${mockDb[table].length + 1}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...insertPayload,
            };
            (mockDb[table] as any[]).push(newRow);
            return Promise.resolve({ data: newRow, error: null });
          }
          if (updatePayload) {
            const rows = applyFilters(mockDb[table]);
            rows.forEach((r) => Object.assign(r, updatePayload));
            return Promise.resolve({ data: rows[0] ?? null, error: null });
          }
          const rows = applyFilters(mockDb[table]);
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: any, reject: any) {
          try {
            const rows = applyFilters(mockDb[table]);
            if (updatePayload) {
              rows.forEach((r) => Object.assign(r, updatePayload));
            }
            return Promise.resolve({
              data: rows,
              count: rows.length,
              error: null,
            }).then(resolve, reject);
          } catch (err) {
            return Promise.reject(err).then(resolve, reject);
          }
        },
      };

      return builder;
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => createMockSupabase(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => createMockSupabase(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createMockSupabase(),
}));

import {
  setCustomerCreditLimit,
  createCreditSaleReceivable,
  registerCustomerPayment,
  getCustomerReceivables,
  listBusinessCustomers,
  getAccountsReceivableKPIs,
  canConfigureCustomerCredit,
} from "@/lib/customers/customers-service";

describe("CLI-002: Crédito a clientes y cuentas por cobrar", () => {
  const businessId = "biz-test-001";
  const customerId = "cust-test-001";

  beforeEach(() => {
    mockDb.customers = [
      {
        id: customerId,
        business_id: businessId,
        full_name: "Andrés Ramírez",
        phone: "3001234567",
        normalized_phone: "3001234567",
        email: "andres@example.com",
        tax_id: "1020304050",
        notes: null,
        status: "active",
        credit_limit: 0,
        credit_used: 0,
        created_at: "2026-10-01T10:00:00.000Z",
        updated_at: "2026-10-01T10:00:00.000Z",
      },
    ];
    mockDb.accounts_receivable = [];
    mockDb.customer_payments = [];
    mockDb.customer_addresses = [];
  });

  it("solo permite que el owner o admin configure el límite de crédito (credit_limit)", async () => {
    expect(canConfigureCustomerCredit("cashier", false)).toBe(false);
    expect(canConfigureCustomerCredit("waiter", false)).toBe(false);
    expect(canConfigureCustomerCredit("owner", true)).toBe(true);
    expect(canConfigureCustomerCredit("business_admin", false)).toBe(true);

    // Intento de cajero -> rechazado
    const denied = await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "cashier",
      isOwner: false,
    });
    expect(denied.success).toBe(false);
    expect(denied.error).toContain("Solo el dueño o administrador");
    expect(mockDb.customers[0].credit_limit).toBe(0);

    // Configuración por owner de $500.000 -> exitoso
    const granted = await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "owner",
      isOwner: true,
    });
    expect(granted.success).toBe(true);
    expect(granted.customer?.creditLimit).toBe(500000);
    expect(granted.customer?.creditAvailable).toBe(500000);
    expect(mockDb.customers[0].credit_limit).toBe(500000);
  });

  it("rechaza una venta a crédito de $600.000 cuando el saldo disponible es de $500.000", async () => {
    await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "owner",
      isOwner: true,
    });

    const result = await createCreditSaleReceivable(
      businessId,
      {
        customerId,
        amount: 600000,
      },
      "user-owner-1"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cupo de crédito insuficiente");
    expect(mockDb.accounts_receivable.length).toBe(0);
    expect(mockDb.customers[0].credit_used).toBe(0);
  });

  it("incrementa credit_used al registrar venta a crédito y reduce el saldo y credit_used al abonar $200.000", async () => {
    // 1. Configurar cupo de $500.000
    await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "owner",
      isOwner: true,
    });

    // 2. Registrar venta a crédito por $450.000
    const saleRes = await createCreditSaleReceivable(
      businessId,
      {
        customerId,
        orderId: "ord-credit-101",
        amount: 450000,
        dueDate: "2026-12-31T00:00:00.000Z",
      },
      "user-owner-1"
    );

    expect(saleRes.success).toBe(true);
    expect(saleRes.receivable?.amount).toBe(450000);
    expect(saleRes.receivable?.balance).toBe(450000);
    expect(saleRes.receivable?.status).toBe("pending");
    expect(mockDb.customers[0].credit_used).toBe(450000);

    // 3. Registrar abono de $200.000
    const receivableId = saleRes.receivable!.id;
    const paymentRes = await registerCustomerPayment(
      businessId,
      {
        customerId,
        receivableId,
        amount: 200000,
        paymentMethod: "cash",
        notes: "Primer abono en efectivo",
      },
      "user-cashier-1"
    );

    expect(paymentRes.success).toBe(true);
    expect(paymentRes.receivable?.paidAmount).toBe(200000);
    expect(paymentRes.receivable?.balance).toBe(250000);
    expect(paymentRes.receivable?.status).toBe("partial");
    expect(mockDb.customers[0].credit_used).toBe(250000);
  });

  it("marca automáticamente las cuentas vencidas (due_date < ahora) y filtra por pestañas", async () => {
    await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "owner",
      isOwner: true,
    });

    // Crear cuenta con fecha de vencimiento en el pasado (hace 15 días)
    const pastDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    await createCreditSaleReceivable(businessId, {
      customerId,
      amount: 300000,
      dueDate: pastDate,
    });

    // Forzar status 'pending' inicial para verificar que getCustomerReceivables / listBusinessCustomers la marque 'overdue'
    mockDb.accounts_receivable[0].status = "pending";

    const { receivables } = await getCustomerReceivables(businessId, customerId);
    expect(receivables.length).toBe(1);
    expect(receivables[0].status).toBe("overdue");
    expect(receivables[0].isOverdue).toBe(true);

    // Verificar pestañas de listBusinessCustomers
    const withCreditList = await listBusinessCustomers({
      businessId,
      creditTab: "with_credit",
    });
    expect(withCreditList.customers.length).toBe(1);

    const receivableList = await listBusinessCustomers({
      businessId,
      creditTab: "receivable",
    });
    expect(receivableList.customers.length).toBe(1);

    const overdueList = await listBusinessCustomers({
      businessId,
      creditTab: "overdue",
    });
    expect(overdueList.customers.length).toBe(1);
    expect(overdueList.customers[0].hasOverdueReceivables).toBe(true);
    expect(overdueList.customers[0].overdueAmount).toBe(300000);
  });

  it("calcula correctamente los KPIs de cartera (pagado vs por cobrar y antigüedad)", async () => {
    await setCustomerCreditLimit(businessId, customerId, 500000, {
      roleCode: "owner",
      isOwner: true,
    });

    // Cuenta 1: Al día (vence en 10 días) por $200.000 con abono de $50.000 -> saldo $150.000
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const c1 = await createCreditSaleReceivable(businessId, {
      customerId,
      amount: 200000,
      dueDate: futureDate,
    });
    await registerCustomerPayment(businessId, {
      customerId,
      receivableId: c1.receivable!.id,
      amount: 50000,
      paymentMethod: "transfer",
    });

    // Cuenta 2: Vencida hace 20 días (bucket 1-30 días) por $100.000
    const past20Days = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    await createCreditSaleReceivable(businessId, {
      customerId,
      amount: 100000,
      dueDate: past20Days,
    });

    const kpis = await getAccountsReceivableKPIs(businessId);
    expect(kpis.totalCreditGranted).toBe(500000);
    expect(kpis.totalCollected).toBe(50000);
    expect(kpis.totalReceivable).toBe(250000); // 150.000 + 100.000
    expect(kpis.overdueBalance).toBe(100000);
    expect(kpis.agingBuckets.current).toBe(150000);
    expect(kpis.agingBuckets.days1to30).toBe(100000);
    expect(kpis.agingBuckets.days31to60).toBe(0);
    expect(kpis.agingBuckets.daysOver60).toBe(0);
  });
});
