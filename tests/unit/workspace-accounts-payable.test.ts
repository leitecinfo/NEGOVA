import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  createPurchase,
  getAccountsPayable,
  getAccountsPayableKPIs,
  registerAccountPayablePayment,
  getAccountPayableDetails,
  cancelPurchase,
} from "../../src/lib/purchases/purchases-service";
import {
  CreatePurchaseInput,
  RegisterPaymentInput,
} from "../../src/lib/purchases/types";

// ==============================================================================
// BASE DE DATOS EN MEMORIA MULTI-TENANT
// ==============================================================================

const TEST_BUSINESS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_BUSINESS_ID = "22222222-2222-4222-a222-222222222222";

const SUPPLIER_1_ID = "33333333-3333-4333-a333-333333333333";
const SUPPLIER_2_ID = "44444444-4444-4444-a444-444444444444";
const OTHER_SUPPLIER_ID = "55555555-5555-4555-a555-555555555555";

const LOCATION_ID = "66666666-6666-4666-a666-666666666666";
const PRODUCT_1_ID = "77777777-7777-4777-a777-777777777777";
const USER_ID = "88888888-8888-4888-a888-888888888888";

let inMemorySuppliers: any[] = [];
let inMemoryPurchases: any[] = [];
let inMemoryPurchaseItems: any[] = [];
let inMemoryAccountsPayable: any[] = [];
let inMemoryPayments: any[] = [];
let inMemorySequences: any[] = [];
let inMemoryLocations: any[] = [];
let inMemoryProducts: any[] = [];
let inMemoryStock: any[] = [];
let inMemoryMovements: any[] = [];

// Mock Supabase Client & Server
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/inventory/inventory-service", () => ({
  recordInventoryMovement: vi.fn(async () => ({ id: "mov-test" })),
  upsertInventoryStock: vi.fn(async () => ({ id: "stock-test" })),
}));

const mockSupabaseClient = {
  from: (table: string) => {
    return {
      select: (cols: string = "*") => {
        let currentList = (
          table === "suppliers"
            ? inMemorySuppliers
            : table === "purchases"
            ? inMemoryPurchases.map((p) => ({
                ...p,
                suppliers: inMemorySuppliers.find((s) => s.id === p.supplier_id) || null,
                purchase_items: inMemoryPurchaseItems.filter((i) => i.purchase_id === p.id),
                accounts_payable: inMemoryAccountsPayable.filter((a) => a.purchase_id === p.id),
              }))
            : table === "accounts_payable"
            ? inMemoryAccountsPayable.map((a) => ({
                ...a,
                suppliers: inMemorySuppliers.find((s) => s.id === a.supplier_id) || null,
                purchases: inMemoryPurchases.find((p) => p.id === a.purchase_id) || null,
                account_payable_payments: inMemoryPayments.filter((pay) => pay.account_payable_id === a.id),
              }))
            : table === "account_payable_payments"
            ? inMemoryPayments
            : table === "locations"
            ? inMemoryLocations
            : table === "products"
            ? inMemoryProducts
            : table === "inventory_stock"
            ? inMemoryStock
            : []
        );

        const createChain = (list: any[]) => {
          let filtered = [...list];

          const chain: any = {
            data: filtered,
            error: null,
            eq: (col: string, val: any) => {
              filtered = filtered.filter((item: any) => item[col] === val);
              return createChain(filtered);
            },
            neq: (col: string, val: any) => {
              filtered = filtered.filter((item: any) => item[col] !== val);
              return createChain(filtered);
            },
            in: (col: string, values: any[]) => {
              filtered = filtered.filter((item: any) => values.includes(item[col]));
              return createChain(filtered);
            },
            order: (orderCol: string, orderOpts?: any) => {
              const asc = orderOpts?.ascending ?? true;
              filtered.sort((a, b) => {
                if (a[orderCol] < b[orderCol]) return asc ? -1 : 1;
                if (a[orderCol] > b[orderCol]) return asc ? 1 : -1;
                return 0;
              });
              return createChain(filtered);
            },
            limit: (n: number) => createChain(filtered.slice(0, n)),
            maybeSingle: async () => ({
              data: filtered[0] || null,
              error: null,
            }),
            single: async () => ({
              data: filtered[0] || null,
              error: filtered[0] ? null : { message: "Registro no encontrado" },
            }),
          };

          chain.then = (resolve: any, reject?: any) => {
            return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
          };

          return chain;
        };

        return createChain(currentList);
      },

      insert: (recordOrList: any) => {
        const records = Array.isArray(recordOrList) ? recordOrList : [recordOrList];
        const insertedList = records.map((r: any) => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));

        if (table === "purchases") {
          inMemoryPurchases.push(...insertedList);
        } else if (table === "purchase_items") {
          inMemoryPurchaseItems.push(...insertedList);
        } else if (table === "accounts_payable") {
          inMemoryAccountsPayable.push(...insertedList);
        } else if (table === "account_payable_payments") {
          inMemoryPayments.push(...insertedList);
        }

        return {
          select: () => ({
            single: async () => ({
              data: insertedList[0],
              error: null,
            }),
          }),
        };
      },

      update: (updates: any) => ({
        eq: (col1: string, val1: any) => {
          const updateFn = (col2?: string, val2?: any) => {
            const list =
              table === "purchases"
                ? inMemoryPurchases
                : table === "accounts_payable"
                ? inMemoryAccountsPayable
                : [];

            const idx = list.findIndex(
              (item: any) =>
                item[col1] === val1 && (!col2 || item[col2] === val2)
            );

            let resData: any = null;
            let resError: any = { message: "No row updated" };
            if (idx !== -1) {
              list[idx] = {
                ...list[idx],
                ...updates,
                updated_at: new Date().toISOString(),
              };
              resData = list[idx];
              resError = null;
            }

            return {
              data: resData,
              error: resError,
              select: () => ({
                single: async () => ({ data: resData, error: resError }),
              }),
              then: (resolve: any, reject?: any) =>
                Promise.resolve({ data: resData, error: resError }).then(resolve, reject),
            };
          };

          return {
            eq: (col2: string, val2: any) => updateFn(col2, val2),
            in: async (colIn: string, values: any[]) => {
              if (table === "accounts_payable") {
                inMemoryAccountsPayable.forEach((item) => {
                  if (item[col1] === val1 && values.includes(item[colIn])) {
                    Object.assign(item, updates);
                  }
                });
              }
              return { data: null, error: null };
            },
            select: () => updateFn().select(),
            then: (resolve: any, reject?: any) => updateFn().then(resolve, reject),
          };
        },
      }),
    };
  },
  rpc: (funcName: string, args: any) => {
    if (funcName === "get_next_purchase_number") {
      let seq = inMemorySequences.find((s) => s.business_id === args.p_business_id);
      if (!seq) {
        seq = { business_id: args.p_business_id, current_number: 1 };
        inMemorySequences.push(seq);
      } else {
        seq.current_number += 1;
      }
      const code = `COMP-${seq.current_number.toString().padStart(5, "0")}`;
      return Promise.resolve({ data: code, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

describe("[PROV-003] Cuentas por Pagar y Pagos a Proveedor", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    inMemorySuppliers = [
      {
        id: SUPPLIER_1_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Distribuidora Lácteos del Campo",
        contact_name: "Carlos Gómez",
        phone: "+57 300 1234567",
        tax_id: "900.123.456-1",
        payment_terms_days: 15,
        status: "active",
      },
      {
        id: SUPPLIER_2_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Tostadora Café Andino",
        contact_name: "María Restrepo",
        phone: "+57 310 9876543",
        tax_id: "901.789.012-3",
        payment_terms_days: 30,
        status: "active",
      },
      {
        id: OTHER_SUPPLIER_ID,
        business_id: OTHER_BUSINESS_ID,
        name: "Proveedor de Otro Negocio",
        status: "active",
      },
    ];

    inMemoryLocations = [
      {
        id: LOCATION_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Bodega Principal",
        type: "warehouse",
        is_active: true,
      },
    ];

    inMemoryProducts = [
      {
        id: PRODUCT_1_ID,
        business_id: TEST_BUSINESS_ID,
        name: "Leche Entera 1L",
        metadata: { track_stock: true, stock_quantity: 10, cost: 3500 },
      },
    ];

    inMemoryPurchases = [];
    inMemoryPurchaseItems = [];
    inMemoryAccountsPayable = [];
    inMemoryPayments = [];
    inMemorySequences = [];
  });

  // --------------------------------------------------------------------------
  // Criterio 1: Compra a crédito genera automáticamente una cuenta por pagar
  // --------------------------------------------------------------------------
  describe("Criterio 1: Generación automática de Cuenta por Pagar al comprar a crédito", () => {
    it("crea automáticamente una cuenta por pagar cuando paymentType es 'credit'", async () => {
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_1_ID,
        invoiceNumber: "FAC-9001",
        purchaseDate: "2026-10-25T10:00:00Z",
        paymentType: "credit",
        paymentMethod: "transfer",
        notes: "Compra de leche a crédito a 15 días",
        items: [
          {
            productId: PRODUCT_1_ID,
            itemName: "Leche Entera 1L",
            quantity: 50,
            unitCost: 3500, // Subtotal: 175,000
            locationId: LOCATION_ID,
            isInventoryItem: true,
          },
        ],
      };

      const result = await createPurchase(TEST_BUSINESS_ID, input, USER_ID);

      expect(result.id).toBeDefined();
      expect(result.paymentType).toBe("credit");
      expect(result.total).toBe(175000);

      // Verificar que se haya insertado en accounts_payable
      expect(inMemoryAccountsPayable).toHaveLength(1);
      const ap = inMemoryAccountsPayable[0];
      expect(ap.business_id).toBe(TEST_BUSINESS_ID);
      expect(ap.purchase_id).toBe(result.id);
      expect(ap.supplier_id).toBe(SUPPLIER_1_ID);
      expect(ap.total_amount).toBe(175000);
      expect(ap.balance).toBe(175000);
      expect(ap.paid_amount).toBe(0);
      expect(ap.status).toBe("pending");

      // La fecha de vencimiento debe ser calculada con los días del proveedor (15 días después del 25 oct)
      const expectedDueDate = new Date("2026-10-25T10:00:00Z");
      expectedDueDate.setDate(expectedDueDate.getDate() + 15);
      expect(new Date(ap.due_date).getDate()).toBe(expectedDueDate.getDate());
    });

    it("no crea cuenta por pagar cuando la compra es de contado ('cash')", async () => {
      const input: CreatePurchaseInput = {
        supplierId: SUPPLIER_1_ID,
        invoiceNumber: "FAC-CASH-1",
        paymentType: "cash",
        paymentMethod: "cash",
        items: [
          {
            itemName: "Vasos desechables",
            quantity: 10,
            unitCost: 2000,
            isInventoryItem: false,
          },
        ],
      };

      await createPurchase(TEST_BUSINESS_ID, input, USER_ID);
      expect(inMemoryAccountsPayable).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 2: Registro de pago parcial reduce el saldo correctamente
  // --------------------------------------------------------------------------
  describe("Criterio 2: Pago parcial y reducción de saldo", () => {
    it("al abonar 75,000 de una deuda de 175,000, el saldo se reduce a 100,000 y el estado pasa a 'partial'", async () => {
      // 1. Crear cuenta por pagar inicial de 175,000
      const apId = "11111111-aaaa-4111-a111-111111111111";
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);

      inMemoryAccountsPayable.push({
        id: apId,
        business_id: TEST_BUSINESS_ID,
        purchase_id: "pur-1",
        supplier_id: SUPPLIER_1_ID,
        amount: 175000,
        total_amount: 175000,
        paid_amount: 0,
        balance: 175000,
        due_date: futureDate.toISOString(),
        status: "pending",
        created_at: new Date().toISOString(),
      });

      // 2. Registrar abono parcial de 75,000
      const paymentInput: RegisterPaymentInput = {
        accountPayableId: apId,
        amount: 75000,
        paymentMethod: "transfer",
        reference: "Transf. Bancolombia #88129",
        notes: "Primer abono acordado",
      };

      const { payment, updatedAccount } = await registerAccountPayablePayment(
        TEST_BUSINESS_ID,
        paymentInput,
        USER_ID
      );

      // Verificación del pago creado
      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(75000);
      expect(payment.paymentMethod).toBe("transfer");
      expect(payment.reference).toBe("Transf. Bancolombia #88129");
      expect(payment.createdBy).toBe(USER_ID);

      // Verificación de la cuenta actualizada
      expect(updatedAccount.paidAmount).toBe(75000);
      expect(updatedAccount.balance).toBe(100000);
      expect(updatedAccount.status).toBe("partial");

      // Verificación en base de datos en memoria
      const inDb = inMemoryAccountsPayable.find((a) => a.id === apId);
      expect(inDb.paid_amount).toBe(75000);
      expect(inDb.balance).toBe(100000);
      expect(inDb.status).toBe("partial");
      expect(inMemoryPayments).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 3: Al pagar el total, la cuenta pasa a estado 'paid'
  // --------------------------------------------------------------------------
  describe("Criterio 3: Liquidación total de la deuda", () => {
    it("al pagar el saldo remanente exacto (100,000), el balance queda en 0 y el estado pasa a 'paid'", async () => {
      const apId = "22222222-bbbb-4222-a222-222222222222";
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      // Cuenta que ya tiene 75,000 abonados y saldo de 100,000
      inMemoryAccountsPayable.push({
        id: apId,
        business_id: TEST_BUSINESS_ID,
        purchase_id: "pur-2",
        supplier_id: SUPPLIER_1_ID,
        amount: 175000,
        total_amount: 175000,
        paid_amount: 75000,
        balance: 100000,
        due_date: futureDate.toISOString(),
        status: "partial",
        created_at: new Date().toISOString(),
      });

      const { payment, updatedAccount } = await registerAccountPayablePayment(
        TEST_BUSINESS_ID,
        {
          accountPayableId: apId,
          amount: 100000,
          paymentMethod: "cash",
          notes: "Finiquito de saldo",
        },
        USER_ID
      );

      expect(payment.amount).toBe(100000);
      expect(updatedAccount.paidAmount).toBe(175000);
      expect(updatedAccount.balance).toBe(0);
      expect(updatedAccount.status).toBe("paid");

      // Verificar persistencia en memoria
      const inDb = inMemoryAccountsPayable.find((a) => a.id === apId);
      expect(inDb.balance).toBe(0);
      expect(inDb.status).toBe("paid");
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 4: Rechazo de sobrepago
  // --------------------------------------------------------------------------
  describe("Criterio 4: Rechazo si el pago supera el saldo pendiente", () => {
    it("arroja error y no altera saldos si intentan pagar 60,000 cuando el saldo es 50,000", async () => {
      const apId = "33333333-cccc-4333-a333-333333333333";
      inMemoryAccountsPayable.push({
        id: apId,
        business_id: TEST_BUSINESS_ID,
        purchase_id: "pur-3",
        supplier_id: SUPPLIER_2_ID,
        amount: 50000,
        total_amount: 50000,
        paid_amount: 0,
        balance: 50000,
        due_date: new Date().toISOString(),
        status: "pending",
      });

      await expect(
        registerAccountPayablePayment(
          TEST_BUSINESS_ID,
          {
            accountPayableId: apId,
            amount: 60000,
            paymentMethod: "cash",
          },
          USER_ID
        )
      ).rejects.toThrow(/no puede superar el saldo pendiente actual/i);

      // El saldo debe permanecer inalterado
      const inDb = inMemoryAccountsPayable.find((a) => a.id === apId);
      expect(inDb.balance).toBe(50000);
      expect(inMemoryPayments).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 5: Cuentas vencidas se marcan automáticamente como 'overdue'
  // --------------------------------------------------------------------------
  describe("Criterio 5: Detección y marcado automático de cuentas vencidas", () => {
    it("marca como 'overdue' y calcula isOverdue: true cuando due_date es anterior a la fecha actual y tiene saldo", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // Vencida hace 5 días

      inMemoryAccountsPayable.push({
        id: "ap-overdue-1",
        business_id: TEST_BUSINESS_ID,
        purchase_id: "pur-overdue",
        supplier_id: SUPPLIER_1_ID,
        amount: 80000,
        total_amount: 80000,
        paid_amount: 0,
        balance: 80000,
        due_date: pastDate.toISOString(),
        status: "pending", // Originalmente estaba pending
      });

      const list = await getAccountsPayable(TEST_BUSINESS_ID);

      expect(list).toHaveLength(1);
      const acc = list[0];
      expect(acc.status).toBe("overdue");
      expect(acc.isOverdue).toBe(true);
      expect(acc.daysUntilDue).toBeLessThan(0);

      // En la base de datos se debe haber actualizado el estado a 'overdue'
      const inDb = inMemoryAccountsPayable.find((a) => a.id === "ap-overdue-1");
      expect(inDb.status).toBe("overdue");
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 6: Aislamiento Multi-Tenant estricto
  // --------------------------------------------------------------------------
  describe("Criterio 6: Aislamiento Multi-Tenant", () => {
    it("un usuario de negocio A no puede consultar ni abonar a cuentas de negocio B", async () => {
      const apOtherId = "99999999-9999-4999-a999-999999999999";
      inMemoryAccountsPayable.push({
        id: apOtherId,
        business_id: OTHER_BUSINESS_ID,
        amount: 200000,
        total_amount: 200000,
        paid_amount: 0,
        balance: 200000,
        due_date: new Date().toISOString(),
        status: "pending",
      });

      // 1. Al consultar negocio A, no debe aparecer la cuenta de negocio B
      const listA = await getAccountsPayable(TEST_BUSINESS_ID);
      expect(listA.some((a) => a.id === apOtherId)).toBe(false);

      // 2. Al intentar abonar con businessId A sobre la cuenta de B, debe ser denegado
      await expect(
        registerAccountPayablePayment(
          TEST_BUSINESS_ID,
          {
            accountPayableId: apOtherId,
            amount: 50000,
            paymentMethod: "cash",
          },
          USER_ID
        )
      ).rejects.toThrow(/no existe o no pertenece a este comercio/i);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 7: Cálculo de Indicadores Ejecutivos (KPIs)
  // --------------------------------------------------------------------------
  describe("Criterio 7: Métricas de Cuentas por Pagar (KPIs)", () => {
    it("calcula correctamente totalPorPagar, vencido y próximo a vencer", async () => {
      const now = new Date();

      // 1. Cuenta Vencida: 50,000
      const past = new Date(now);
      past.setDate(past.getDate() - 3);
      inMemoryAccountsPayable.push({
        id: "kpi-ap-1",
        business_id: TEST_BUSINESS_ID,
        amount: 50000,
        total_amount: 50000,
        paid_amount: 0,
        balance: 50000,
        due_date: past.toISOString(),
        status: "overdue",
      });

      // 2. Cuenta Próxima a Vencer (en 3 días): 30,000
      const upcoming = new Date(now);
      upcoming.setDate(upcoming.getDate() + 3);
      inMemoryAccountsPayable.push({
        id: "kpi-ap-2",
        business_id: TEST_BUSINESS_ID,
        amount: 30000,
        total_amount: 30000,
        paid_amount: 0,
        balance: 30000,
        due_date: upcoming.toISOString(),
        status: "pending",
      });

      // 3. Cuenta a Largo Plazo (en 25 días): 20,000
      const farFuture = new Date(now);
      farFuture.setDate(farFuture.getDate() + 25);
      inMemoryAccountsPayable.push({
        id: "kpi-ap-3",
        business_id: TEST_BUSINESS_ID,
        amount: 20000,
        total_amount: 20000,
        paid_amount: 0,
        balance: 20000,
        due_date: farFuture.toISOString(),
        status: "pending",
      });

      // 4. Cuenta de otro negocio (no debe sumarse)
      inMemoryAccountsPayable.push({
        id: "kpi-ap-other",
        business_id: OTHER_BUSINESS_ID,
        amount: 100000,
        total_amount: 100000,
        paid_amount: 0,
        balance: 100000,
        due_date: past.toISOString(),
        status: "overdue",
      });

      const kpis = await getAccountsPayableKPIs(TEST_BUSINESS_ID);

      // Total Balance: 50,000 + 30,000 + 20,000 = 100,000
      expect(kpis.totalBalance).toBe(100000);
      // Vencido: 50,000
      expect(kpis.overdueBalance).toBe(50000);
      // Próximo a vencer (en 3 días): 30,000
      expect(kpis.upcomingBalance).toBe(30000);
      // Cantidades
      expect(kpis.pendingAccountsCount).toBe(3);
      expect(kpis.overdueAccountsCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 8: Filtros de consulta y búsqueda
  // --------------------------------------------------------------------------
  describe("Criterio 8: Filtros de Cuentas por Pagar", () => {
    it("filtra por estado 'partial' y 'paid'", async () => {
      inMemoryAccountsPayable = [
        {
          id: "f-1",
          business_id: TEST_BUSINESS_ID,
          amount: 100000,
          total_amount: 100000,
          paid_amount: 40000,
          balance: 60000,
          due_date: new Date(Date.now() + 86400000).toISOString(),
          status: "partial",
        },
        {
          id: "f-2",
          business_id: TEST_BUSINESS_ID,
          amount: 80000,
          total_amount: 80000,
          paid_amount: 80000,
          balance: 0,
          due_date: new Date(Date.now() + 86400000).toISOString(),
          status: "paid",
        },
      ];

      const partials = await getAccountsPayable(TEST_BUSINESS_ID, { status: "partial" });
      expect(partials).toHaveLength(1);
      expect(partials[0].id).toBe("f-1");

      const paids = await getAccountsPayable(TEST_BUSINESS_ID, { status: "paid" });
      expect(paids).toHaveLength(1);
      expect(paids[0].id).toBe("f-2");
    });
  });

  // --------------------------------------------------------------------------
  // Criterio 9: Historial de abonos en getAccountPayableDetails
  // --------------------------------------------------------------------------
  describe("Criterio 9: Detalle completo de abonos", () => {
    it("retorna los abonos ordenados cronológicamente", async () => {
      const apId = "ap-details-test";
      inMemoryAccountsPayable.push({
        id: apId,
        business_id: TEST_BUSINESS_ID,
        supplier_id: SUPPLIER_1_ID,
        amount: 200000,
        total_amount: 200000,
        paid_amount: 100000,
        balance: 100000,
        due_date: new Date().toISOString(),
        status: "partial",
      });

      inMemoryPayments.push(
        {
          id: "pay-1",
          business_id: TEST_BUSINESS_ID,
          account_payable_id: apId,
          amount: 40000,
          payment_method: "cash",
          payment_date: "2026-10-20T10:00:00Z",
        },
        {
          id: "pay-2",
          business_id: TEST_BUSINESS_ID,
          account_payable_id: apId,
          amount: 60000,
          payment_method: "transfer",
          payment_date: "2026-10-25T15:00:00Z",
        }
      );

      const details = await getAccountPayableDetails(TEST_BUSINESS_ID, apId);

      expect(details.id).toBe(apId);
      expect(details.payments).toHaveLength(2);
      // El más reciente primero: pay-2 (25 oct)
      expect(details.payments![0].id).toBe("pay-2");
      expect(details.payments![1].id).toBe("pay-1");
    });
  });
});
