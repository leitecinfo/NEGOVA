import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";

// ============================================================================
// BASE DE DATOS EN MEMORIA PARA PRUEBAS DE ANULACIÓN CON AUDITORÍA [POS-005]
// ============================================================================
const mockDb: Record<string, any[]> = {
  businesses: [],
  business_users: [],
  employees: [],
  locations: [],
  products: [],
  inventory_stock: [],
  inventory_movements: [],
  recipes: [],
  recipe_ingredients: [],
  customers: [],
  accounts_receivable: [],
  cash_registers: [],
  cash_sessions: [],
  cash_movements: [],
  business_sale_documents: [],
  restaurant_orders: [],
  restaurant_order_items: [],
  audit_logs: [],
};

function resetMockDb() {
  for (const key of Object.keys(mockDb)) {
    mockDb[key] = [];
  }
}

function createQueryBuilder(table: string) {
  const filters: Array<(row: any) => boolean> = [];
  let pendingUpdate: Record<string, any> | null = null;
  let pendingDelete = false;
  let orderCol: string | null = null;
  let orderAsc = true;
  let limitCount: number | null = null;

  const applyFilters = () => {
    let rows = [...(mockDb[table] || [])].filter((r) => filters.every((fn) => fn(r)));
    if (orderCol) {
      const col = orderCol;
      rows.sort((a, b) => {
        const va = a[col] ?? "";
        const vb = b[col] ?? "";
        if (va < vb) return orderAsc ? -1 : 1;
        if (va > vb) return orderAsc ? 1 : -1;
        return 0;
      });
    }
    if (limitCount !== null) {
      rows = rows.slice(0, limitCount);
    }
    return rows;
  };

  const executeMutationIfNeeded = () => {
    if (pendingUpdate) {
      const matched = applyFilters();
      for (const row of matched) {
        Object.assign(row, pendingUpdate);
      }
      return matched;
    }
    if (pendingDelete) {
      const matched = applyFilters();
      const matchedIds = new Set(matched.map((r) => r.id));
      mockDb[table] = (mockDb[table] || []).filter((r) => !matchedIds.has(r.id));
      return matched;
    }
    return applyFilters();
  };

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    neq: (col: string, val: any) => {
      filters.push((r) => r[col] !== val);
      return builder;
    },
    in: (col: string, vals: any[]) => {
      filters.push((r) => vals.includes(r[col]));
      return builder;
    },
    not: (col: string, op: string, val: any) => {
      if (op === "is") {
        filters.push((r) => r[col] !== val && r[col] !== undefined);
      } else {
        filters.push((r) => r[col] !== val);
      }
      return builder;
    },
    gte: (col: string, val: any) => {
      filters.push((r) => String(r[col] ?? "") >= String(val));
      return builder;
    },
    lte: (col: string, val: any) => {
      filters.push((r) => String(r[col] ?? "") <= String(val));
      return builder;
    },
    like: (col: string, pattern: string) => {
      const prefix = pattern.replace(/%/g, "");
      filters.push((r) => String(r[col] ?? "").includes(prefix));
      return builder;
    },
    ilike: (col: string, pattern: string) => {
      const prefix = pattern.replace(/%/g, "").toLowerCase();
      filters.push((r) => String(r[col] ?? "").toLowerCase().includes(prefix));
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return builder;
    },
    limit: (n: number) => {
      limitCount = n;
      return builder;
    },
    range: () => builder,
    insert: (payload: any | any[]) => {
      const items = Array.isArray(payload) ? payload : [payload];
      const inserted = items.map((item) => {
        const row = {
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        mockDb[table].push(row);
        return row;
      });
      return {
        select: () => ({
          single: async () => ({ data: inserted[0], error: null }),
          maybeSingle: async () => ({ data: inserted[0], error: null }),
        }),
        then: (resolve: any) => resolve({ data: inserted, error: null }),
      };
    },
    update: (payload: Record<string, any>) => {
      pendingUpdate = payload;
      return builder;
    },
    delete: () => {
      pendingDelete = true;
      return builder;
    },
    single: async () => {
      const rows = executeMutationIfNeeded();
      return {
        data: rows[0] ?? null,
        error: rows[0] ? null : { message: "No rows found" },
      };
    },
    maybeSingle: async () => {
      const rows = executeMutationIfNeeded();
      return { data: rows[0] ?? null, error: null };
    },
    then: (resolve: any) => {
      const rows = executeMutationIfNeeded();
      return resolve({ data: rows, count: rows.length, error: null });
    },
  };

  return builder;
}

const mockSupabaseClient = {
  from: (table: string) => createQueryBuilder(table),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockSupabaseClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabaseClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const BUSINESS_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const LOCATION_ID = "loc-0001-0000-0000-000000000001";

vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(async (businessId: string) => ({
    success: true,
    context: {
      userId: USER_ID,
      businessId,
      businessName: "Restaurante NEGOVA",
      roleCode: "owner",
      isOwner: true,
    },
  })),
}));

import {
  createBusinessSaleDocument,
  cancelBusinessSaleDocument,
  getBusinessDocumentById,
  getWorkspaceDashboardData,
} from "@/lib/documents/document-service";
import {
  openCashSession,
  getCashSessionSummary,
} from "@/lib/cash/cash-service";
import { getFinancialReport } from "@/lib/expenses/expenses-service";
import { hashPin } from "@/lib/security/pin-service";
import { cancelSaleAction } from "@/app/workspace/[businessId]/ventas/actions";

describe("[POS-005] Completar anulaciones con auditoría", () => {
  beforeEach(() => {
    resetMockDb();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";

    mockDb.locations.push({
      id: LOCATION_ID,
      business_id: BUSINESS_ID,
      name: "Bodega Principal",
      is_default: true,
      is_active: true,
    });
  });

  it("Criterio 1: Al anular una venta de 5 unidades, el stock se incrementa en 5 y registra movimiento de entrada", async () => {
    const productId = "prod-gaseosa-001";
    mockDb.products.push({
      id: productId,
      business_id: BUSINESS_ID,
      name: "Gaseosa Artesanal 400ml",
      price: 6000,
      stock: 10,
      metadata: { stock_quantity: 10 },
    });

    mockDb.inventory_stock.push({
      id: "stk-gaseosa-001",
      business_id: BUSINESS_ID,
      product_id: productId,
      location_id: LOCATION_ID,
      quantity: 10,
      cost: 3000,
    });

    // Crear venta de 5 unidades
    const saleRes = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Cliente Mostrador",
      paymentMethod: "cash",
      status: "paid",
      items: [
        {
          id: productId,
          description: "Gaseosa Artesanal 400ml",
          quantity: 5,
          unitPrice: 6000,
          discount: 0,
          total: 30000,
        },
      ],
    });
    expect(saleRes.success).toBe(true);
    const docId = saleRes.document!.id;

    // Anular la venta de 5 unidades
    const cancelRes = await cancelBusinessSaleDocument(BUSINESS_ID, docId, {
      userId: USER_ID,
      reason: "Cliente devolvió las 5 unidades sin abrir",
    });

    expect(cancelRes.success).toBe(true);
    expect(cancelRes.document?.status).toBe("cancelled");

    // Verificar que el stock en inventory_stock se incrementó en 5 (de 10 a 15)
    const updatedStock = mockDb.inventory_stock.find((s) => s.product_id === productId);
    expect(updatedStock?.quantity).toBe(15);

    // Verificar que metadata.stock_quantity también se incrementó en 5 (de 10 a 15)
    const updatedProd = mockDb.products.find((p) => p.id === productId);
    expect(updatedProd?.metadata?.stock_quantity).toBe(15);

    // Verificar que se registró movimiento de inventario trazable
    const movement = mockDb.inventory_movements.find(
      (m) => m.product_id === productId && m.reference_id === docId
    );
    expect(movement).toBeDefined();
    expect(movement?.movement_type).toBe("entry");
    expect(movement?.quantity).toBe(5);
    expect(movement?.reference_type).toBe("sale_cancellation");
  });

  it("Regla de negocio: Al anular una venta de un producto con receta activa, los ingredientes obligatorios se devuelven al inventario", async () => {
    const burgerId = "prod-burger-especial";
    const carneId = "ing-carne-res";
    const panId = "ing-pan-brioche";

    mockDb.products.push(
      {
        id: burgerId,
        business_id: BUSINESS_ID,
        name: "Hamburguesa Doble",
        price: 28000,
        metadata: {},
      },
      {
        id: carneId,
        business_id: BUSINESS_ID,
        name: "Carne de Res (g)",
        price: 0,
        metadata: { stock_quantity: 1000 },
      },
      {
        id: panId,
        business_id: BUSINESS_ID,
        name: "Pan Brioche (und)",
        price: 0,
        metadata: { stock_quantity: 20 },
      }
    );

    mockDb.inventory_stock.push(
      {
        id: "stk-carne",
        business_id: BUSINESS_ID,
        product_id: carneId,
        location_id: LOCATION_ID,
        quantity: 1000,
        cost: 25,
      },
      {
        id: "stk-pan",
        business_id: BUSINESS_ID,
        product_id: panId,
        location_id: LOCATION_ID,
        quantity: 20,
        cost: 1200,
      }
    );

    // Receta: 1 porción de Hamburguesa Doble usa 200g de Carne y 1 Pan Brioche
    const recipeId = "rec-burger-001";
    mockDb.recipes.push({
      id: recipeId,
      business_id: BUSINESS_ID,
      product_id: burgerId,
      name: "Receta Hamburguesa Doble",
      portions: 1,
      location_id: LOCATION_ID,
      status: "active",
    });

    mockDb.recipe_ingredients.push(
      {
        id: "ri-1",
        recipe_id: recipeId,
        product_id: carneId,
        quantity: 200,
        unit: "g",
        is_optional: false,
      },
      {
        id: "ri-2",
        recipe_id: recipeId,
        product_id: panId,
        quantity: 1,
        unit: "und",
        is_optional: false,
      }
    );

    // Venta de 3 Hamburguesas Dobles
    const saleRes = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Mesa 5",
      paymentMethod: "cash",
      status: "paid",
      items: [
        {
          id: burgerId,
          description: "Hamburguesa Doble",
          quantity: 3,
          unitPrice: 28000,
          discount: 0,
          total: 84000,
        },
      ],
    });
    expect(saleRes.success).toBe(true);

    // Anular la venta: deben devolverse 3 * 200 = 600g de carne y 3 * 1 = 3 panes
    const cancelRes = await cancelBusinessSaleDocument(BUSINESS_ID, saleRes.document!.id, {
      userId: USER_ID,
      reason: "Error en toma de comanda de mesa 5",
    });
    expect(cancelRes.success).toBe(true);

    const carneStock = mockDb.inventory_stock.find((s) => s.product_id === carneId);
    const panStock = mockDb.inventory_stock.find((s) => s.product_id === panId);
    expect(carneStock?.quantity).toBe(1600); // 1000 + 600
    expect(panStock?.quantity).toBe(23); // 20 + 3
  });

  it("Regla de negocio: Al anular una venta en efectivo, se revierten los movimientos de caja del turno activo", async () => {
    const registerId = "22222222-2222-4222-8222-222222222222";
    mockDb.cash_registers.push({
      id: registerId,
      business_id: BUSINESS_ID,
      name: "Caja Principal",
      is_active: true,
    });

    const openedSession = await openCashSession(
      BUSINESS_ID,
      { registerId, initialAmount: 200000 },
      USER_ID
    );
    expect(openedSession.status).toBe("open");
    const sessionId = openedSession.id;

    // Venta en efectivo por $45.000
    const saleRes = await createBusinessSaleDocument(
      BUSINESS_ID,
      {
        customerName: "Cliente Efectivo",
        paymentMethod: "cash",
        status: "paid",
        items: [{ description: "Menú Ejecutivo", quantity: 3, unitPrice: 15000, total: 45000 }],
      },
      { userId: USER_ID }
    );
    expect(saleRes.success).toBe(true);

    // Antes de anular: saldo esperado en caja = 200.000 + 45.000 = 245.000
    const summaryBefore = await getCashSessionSummary(BUSINESS_ID, sessionId);
    expect(summaryBefore?.totalSalesCash).toBe(45000);
    expect(summaryBefore?.expectedCashInDrawer).toBe(245000);

    // Anular la venta
    const cancelRes = await cancelBusinessSaleDocument(BUSINESS_ID, saleRes.document!.id, {
      userId: USER_ID,
      reason: "Anulación de cobro en efectivo por error",
    });
    expect(cancelRes.success).toBe(true);

    // Después de anular: el movimiento de caja fue revertido y el saldo vuelve a $200.000
    const summaryAfter = await getCashSessionSummary(BUSINESS_ID, sessionId);
    expect(summaryAfter?.totalSalesCash).toBe(0);
    expect(summaryAfter?.expectedCashInDrawer).toBe(200000);
  });

  it("Regla de negocio: Si la venta era a crédito, al anularla se reduce credit_used del cliente y se cancela la cuenta por cobrar", async () => {
    const customerId = "cust-credito-001";
    mockDb.customers.push({
      id: customerId,
      business_id: BUSINESS_ID,
      full_name: "Empresa Aliada SAS",
      credit_limit: 500000,
      credit_used: 120000,
    });

    const saleRes = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Empresa Aliada SAS",
      customerId,
      paymentMethod: "credit",
      status: "pending",
      items: [{ description: "Catering Corporativo", quantity: 4, unitPrice: 30000, total: 120000 }],
    });
    expect(saleRes.success).toBe(true);
    const docId = saleRes.document!.id;

    mockDb.accounts_receivable.push({
      id: "ar-001",
      business_id: BUSINESS_ID,
      customer_id: customerId,
      order_id: docId,
      sale_document_id: docId,
      amount: 120000,
      paid_amount: 0,
      balance: 120000,
      status: "pending",
    });

    // Anular venta a crédito
    const cancelRes = await cancelBusinessSaleDocument(BUSINESS_ID, docId, {
      userId: USER_ID,
      reason: "Cancelación de pedido corporativo a crédito",
    });
    expect(cancelRes.success).toBe(true);

    // Verificar que credit_used del cliente se redujo de $120.000 a $0
    const updatedCustomer = mockDb.customers.find((c) => c.id === customerId);
    expect(updatedCustomer?.credit_used).toBe(0);

    // Verificar que la cuenta por cobrar quedó cancelada y con balance 0
    const updatedAr = mockDb.accounts_receivable.find((ar) => ar.id === "ar-001");
    expect(updatedAr?.status).toBe("cancelled");
    expect(updatedAr?.balance).toBe(0);
  });

  it("Criterio 2: El audit_logs registra quién anuló, cuándo y el motivo (validando PIN y motivo mínimo 3 caracteres)", async () => {
    // Configurar PIN de supervisor en el negocio
    mockDb.business_users.push({
      id: "bu-owner-1",
      business_id: BUSINESS_ID,
      user_id: USER_ID,
      status: "active",
      security_pin_hash: hashPin("4567"),
      users: { id: USER_ID, full_name: "Ana Supervisora", email: "ana@negova.co" },
      roles: { code: "owner", name: "Propietario" },
    });

    const saleRes = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Cliente Auditoría",
      paymentMethod: "cash",
      status: "paid",
      items: [{ description: "Producto Test", quantity: 1, unitPrice: 20000, total: 20000 }],
    });
    const docId = saleRes.document!.id;

    // 1. Motivo menor a 3 caracteres -> debe fallar
    const shortReasonRes = await cancelSaleAction(BUSINESS_ID, docId, "ab", "4567");
    expect(shortReasonRes.success).toBe(false);
    expect(shortReasonRes.error).toContain("al menos 3 caracteres");

    // 2. PIN incorrecto -> debe fallar
    const badPinRes = await cancelSaleAction(BUSINESS_ID, docId, "Motivo válido de prueba", "0000");
    expect(badPinRes.success).toBe(false);

    // 3. Motivo válido y PIN correcto -> éxito y registro en audit_logs
    const validCancelRes = await cancelSaleAction(
      BUSINESS_ID,
      docId,
      "Producto facturado por equivocación",
      "4567"
    );
    expect(validCancelRes.success).toBe(true);
    expect(validCancelRes.authorizerName).toBe("Ana Supervisora");

    // Verificar registro en audit_logs con quién anuló, cuándo y el motivo
    const cancelAuditLogs = mockDb.audit_logs.filter(
      (log) => log.entity_id === docId && (log.action === "sale.cancelled" || log.action === "sale.cancel")
    );
    expect(cancelAuditLogs.length).toBeGreaterThanOrEqual(1);

    const mainLog = cancelAuditLogs[0];
    expect(mainLog.business_id).toBe(BUSINESS_ID);
    expect(mainLog.user_id).toBe(USER_ID);
    expect(mainLog.created_at).toBeDefined();
    expect(JSON.stringify(mainLog.details)).toContain("Producto facturado por equivocación");
  });

  it("Criterios 3 y 4: La venta anulada conserva su registro con estado 'cancelled' y se excluye de los reportes de ventas", async () => {
    const sale1 = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Venta Válida",
      paymentMethod: "cash",
      status: "paid",
      items: [{ description: "Plato Fuerte", quantity: 2, unitPrice: 25000, total: 50000 }],
    });
    const sale2 = await createBusinessSaleDocument(BUSINESS_ID, {
      customerName: "Venta Anulada",
      paymentMethod: "cash",
      status: "paid",
      items: [{ description: "Bebida Premium", quantity: 5, unitPrice: 10000, total: 50000 }],
    });

    // Anular sale2
    const cancelRes = await cancelBusinessSaleDocument(BUSINESS_ID, sale2.document!.id, {
      userId: USER_ID,
      reason: "Pedido cancelado por el cliente",
    });
    expect(cancelRes.success).toBe(true);

    // Criterio 3: El registro NO se elimina y permanece con estado 'cancelled'
    const cancelledDocInDb = await getBusinessDocumentById(BUSINESS_ID, sale2.document!.id);
    expect(cancelledDocInDb).not.toBeNull();
    expect(cancelledDocInDb?.status).toBe("cancelled");

    // Criterio 4: Los reportes de ventas (Dashboard y Reporte Financiero) excluyen la venta anulada
    const dashboardMetrics = await getWorkspaceDashboardData(BUSINESS_ID, "America/Bogota");
    expect(dashboardMetrics.todaySalesTotal).toBe(50000);
    expect(dashboardMetrics.todaySalesCount).toBe(1);
    expect(dashboardMetrics.allTimeSalesTotal).toBe(50000);

    const financialReport = await getFinancialReport(BUSINESS_ID);
    expect(financialReport.income.totalSales).toBe(50000);

    // Y sale1 sigue activa
    expect(sale1.document?.status).toBe("paid");
  });
});
