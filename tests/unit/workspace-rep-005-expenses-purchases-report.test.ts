import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getLocalDateString,
  getExpensesAndPurchasesReportData,
} from "@/lib/reports/reports-service";
import { generateExpensesAndPurchasesPdf } from "@/lib/reports/expenses-purchases-report-pdf";
import { generateExpensesAndPurchasesCsv } from "@/lib/reports/expenses-purchases-report-csv";
import {
  ExpensesAndPurchasesFilterParams,
  ExpensesAndPurchasesReportData,
} from "@/lib/reports/types";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[REP-005] Reportes de Gastos y Compras", () => {
  const businessId = "biz-expenses-test-123";
  const timezone = "America/Bogota";

  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterdayDate, timezone);

  // Proveedores simulados
  const mockSuppliers = [
    {
      id: "sup-1",
      business_id: businessId,
      name: "Distribuidora Avícola del Valle",
      tax_id: "900.111.222-1",
      contact_name: "Carlos Gómez",
      phone: "3101234567",
      email: "avicola@test.com",
    },
    {
      id: "sup-2",
      business_id: businessId,
      name: "Lácteos y Quesos Santa Rosa",
      tax_id: "900.333.444-2",
      contact_name: "María Restrepo",
      phone: "3127654321",
      email: "lacteos@test.com",
    },
    {
      id: "sup-3",
      business_id: businessId,
      name: "Servicios Públicos de Energía",
      tax_id: "800.555.666-3",
      contact_name: "Atención Corporativa",
      phone: "0180001234",
      email: "energia@test.com",
    },
  ];

  // Gastos operativos y de producción
  const mockExpenses = [
    // 1. Gasto completado de HOY - Servicios Públicos
    {
      id: "exp-1",
      business_id: businessId,
      concept: "Pago de Recibo de Energía Eléctrica",
      amount: 450000,
      category: "Servicios Públicos",
      expense_type: "operational",
      description: "Consumo local principal",
      expense_date: `${todayStr}T10:00:00Z`,
      payment_method: "transfer",
      receipt_number: "REC-ENERGIA-101",
      supplier_id: "sup-3",
      status: "completed",
      notes: "Pagado con PSE",
      created_by: "user-1",
      created_at: `${todayStr}T10:00:00Z`,
    },
    // 2. Gasto completado de HOY - Mantenimiento
    {
      id: "exp-2",
      business_id: businessId,
      concept: "Mantenimiento Preventivo de Freidoras",
      amount: 150000,
      category: "Mantenimiento",
      expense_type: "operational",
      description: "Limpieza y calibración de termostatos",
      expense_date: `${todayStr}T14:30:00Z`,
      payment_method: "efectivo",
      receipt_number: "REC-MANT-05",
      supplier_id: null,
      status: "completed",
      notes: "Técnico independiente",
      created_by: "user-1",
      created_at: `${todayStr}T14:30:00Z`,
    },
    // 3. Gasto completado de AYER - Materia Prima / Producción
    {
      id: "exp-3",
      business_id: businessId,
      concept: "Compra Menor de Empaques y Desechables",
      amount: 80000,
      category: "Empaques y Desechables",
      expense_type: "production",
      description: "Cajas para hamburguesas y servilletas",
      expense_date: `${yesterdayStr}T11:00:00Z`,
      payment_method: "efectivo",
      receipt_number: "REC-EMP-88",
      supplier_id: null,
      status: "completed",
      notes: null,
      created_by: "user-2",
      created_at: `${yesterdayStr}T11:00:00Z`,
    },
    // 4. Gasto ANULADO de HOY (no debe sumarse a los totales activos)
    {
      id: "exp-cancelled-1",
      business_id: businessId,
      concept: "Gasto Duplicado por Error",
      amount: 300000,
      category: "Mantenimiento",
      expense_type: "operational",
      description: "Digitación errónea",
      expense_date: `${todayStr}T15:00:00Z`,
      payment_method: "efectivo",
      receipt_number: "REC-ERR-99",
      supplier_id: null,
      status: "cancelled",
      notes: "Anulado por el administrador",
      created_by: "user-1",
      created_at: `${todayStr}T15:00:00Z`,
    },
  ];

  // Compras a proveedores
  const mockPurchases = [
    // 1. Compra confirmada de HOY - Avícola del Valle
    {
      id: "pur-1",
      business_id: businessId,
      purchase_number: "COMP-00001",
      supplier_id: "sup-1",
      invoice_number: "FAC-AV-9874",
      purchase_date: `${todayStr}T09:00:00Z`,
      subtotal: 1000000,
      tax_amount: 190000,
      total: 1190000,
      payment_type: "credit",
      payment_method: "transfer",
      status: "confirmed",
      notes: "Entrega refrigerada matutina",
      created_by: "user-1",
      created_at: `${todayStr}T09:00:00Z`,
    },
    // 2. Compra confirmada de AYER - Lácteos Santa Rosa
    {
      id: "pur-2",
      business_id: businessId,
      purchase_number: "COMP-00002",
      supplier_id: "sup-2",
      invoice_number: "FAC-SR-1234",
      purchase_date: `${yesterdayStr}T10:00:00Z`,
      subtotal: 500000,
      tax_amount: 95000,
      total: 595000,
      payment_type: "cash",
      payment_method: "cash",
      status: "confirmed",
      notes: "Queso mozzarella y crema",
      created_by: "user-2",
      created_at: `${yesterdayStr}T10:00:00Z`,
    },
    // 3. Compra ANULADA (no debe sumarse a total de compras confirmadas)
    {
      id: "pur-cancelled-1",
      business_id: businessId,
      purchase_number: "COMP-00003-CANC",
      supplier_id: "sup-1",
      invoice_number: "FAC-ERR-00",
      purchase_date: `${todayStr}T12:00:00Z`,
      subtotal: 800000,
      tax_amount: 152000,
      total: 952000,
      payment_type: "credit",
      payment_method: "transfer",
      status: "cancelled",
      notes: "Pedido rechazado por avería en transporte",
      created_by: "user-1",
      created_at: `${todayStr}T12:00:00Z`,
    },
  ];

  // Ítems de compra
  const mockPurchaseItems = [
    {
      id: "item-1",
      purchase_id: "pur-1",
      business_id: businessId,
      product_id: "prod-pechuga",
      item_name: "Pechuga de Pollo Deshuesada",
      quantity: 50,
      unit_cost: 15000,
      total_cost: 750000,
    },
    {
      id: "item-2",
      purchase_id: "pur-1",
      business_id: businessId,
      product_id: "prod-alitas",
      item_name: "Alitas de Pollo Marinadas",
      quantity: 25,
      unit_cost: 10000,
      total_cost: 250000,
    },
    {
      id: "item-3",
      purchase_id: "pur-2",
      business_id: businessId,
      product_id: "prod-queso",
      item_name: "Queso Mozzarella Bloque 2.5kg",
      quantity: 10,
      unit_cost: 50000,
      total_cost: 500000,
    },
  ];

  // Cuentas por pagar
  const mockAccountsPayable = [
    {
      id: "ap-1",
      business_id: businessId,
      purchase_id: "pur-1",
      supplier_id: "sup-1",
      total_amount: 1190000,
      paid_amount: 0,
      balance: 1190000,
      due_date: `${todayStr}T23:59:59Z`,
      status: "pending",
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: businessId,
                name: "Restaurante y Parrilla Don Negova",
                commercial_name: "Don Negova Parrilla",
              },
              error: null,
            }),
          };
        }
        if (table === "expenses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockExpenses,
              error: null,
            }),
          };
        }
        if (table === "purchases") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockPurchases,
              error: null,
            }),
          };
        }
        if (table === "purchase_items") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockPurchaseItems,
              error: null,
            }),
          };
        }
        if (table === "suppliers") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockSuppliers,
              error: null,
            }),
          };
        }
        if (table === "accounts_payable") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockAccountsPayable,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    };

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it("1. Criterio de Aceptación: Los montos de gastos coinciden con los registros del módulo de gastos (excluyendo anulados)", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "today",
      status: "all",
    };

    const result = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    // En HOY tenemos exp-1 ($450.000) y exp-2 ($150.000). Total activo = $600.000
    // exp-cancelled-1 ($300.000) está anulado, por lo que figura en la tabla pero NO suma en totalExpenses
    expect(result.expenses.summary.totalExpenses).toBe(600000);
    expect(result.expenses.summary.transactionsCount).toBe(3); // 2 activos + 1 anulado

    const cancelledItem = result.expenses.rows.find((r) => r.id === "exp-cancelled-1");
    expect(cancelledItem).toBeDefined();
    expect(cancelledItem?.status).toBe("cancelled");
    expect(cancelledItem?.statusLabel).toBe("Anulado");
  });

  it("2. Criterio de Aceptación: Las compras reflejan las órdenes de compra confirmadas", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "last_7_days",
      status: "all",
    };

    const result = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    // Compras confirmadas: pur-1 ($1.190.000) + pur-2 ($595.000) = $1.785.000
    // pur-cancelled-1 ($952.000) está anulada y no debe sumarse
    expect(result.purchases.summary.totalPurchases).toBe(1785000);
    expect(result.purchases.summary.confirmedPurchasesCount).toBe(2);

    const confirmedList = result.purchases.rows.filter((p) => p.status === "confirmed");
    expect(confirmedList).toHaveLength(2);
    expect(confirmedList.map((p) => p.purchaseNumber)).toEqual(["COMP-00001", "COMP-00002"]);
  });

  it("3. Criterio de Aceptación: El gráfico de distribución por categoría suma exactamente 100%", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "last_7_days",
      status: "all",
    };

    const result = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    const distribution = result.expenses.categoryDistribution;
    expect(distribution.length).toBeGreaterThan(0);

    // Suma de porcentajes de todas las categorías
    const sumPercentage = distribution.reduce((sum, c) => sum + c.percentage, 0);

    // Debe sumar exactamente 100.0%
    expect(Math.round(sumPercentage * 10) / 10).toBe(100);

    // Cada categoría tiene cantidad, monto y color asignado
    for (const item of distribution) {
      expect(item.amount).toBeGreaterThan(0);
      expect(item.percentage).toBeGreaterThan(0);
      expect(item.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("4. Criterio de Aceptación: El PDF de compras incluye detalle de productos comprados", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "today",
      status: "all",
    };

    const reportData = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    // Verificar que los datos de compras tengan sus productos vinculados
    const pur1 = reportData.purchases.rows.find((p) => p.purchaseNumber === "COMP-00001");
    expect(pur1).toBeDefined();
    expect(pur1?.items.length).toBe(2);
    expect(pur1?.items.map((i) => i.productName)).toContain("Pechuga de Pollo Deshuesada");
    expect(pur1?.items.map((i) => i.productName)).toContain("Alitas de Pollo Marinadas");

    // Generar PDF formal con vista de compras
    const pdfResult = generateExpensesAndPurchasesPdf({
      businessName: reportData.businessName,
      reportData,
      view: "compras",
    });

    expect(pdfResult.buffer).toBeInstanceOf(Buffer);
    expect(pdfResult.buffer.length).toBeGreaterThan(1500);

    // Firma válida de PDF
    const pdfHeader = pdfResult.buffer.slice(0, 5).toString("utf-8");
    expect(pdfHeader).toBe("%PDF-");
  });

  it("5. Calcula correctamente promedio diario y categoría principal de gastos", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "today",
      status: "all",
    };

    const result = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    // En 1 día (today), totalExpenses = $600.000 -> promedio diario = $600.000
    expect(result.expenses.summary.dailyAverage).toBe(600000);

    // Categoría principal en HOY: Servicios Públicos ($450.000) representa el 75% de $600.000
    expect(result.expenses.summary.mainCategory).toBeDefined();
    expect(result.expenses.summary.mainCategory?.category).toBe("Servicios Públicos");
    expect(result.expenses.summary.mainCategory?.amount).toBe(450000);
    expect(result.expenses.summary.mainCategory?.percentage).toBe(75);
  });

  it("6. El gráfico de barras agrupa gastos por mes de los últimos 6 meses", async () => {
    const result = await getExpensesAndPurchasesReportData(businessId, { preset: "this_month" }, timezone);

    const monthlyBars = result.expenses.last6MonthsMonthly;
    expect(monthlyBars).toHaveLength(6);

    // El último mes corresponde al mes actual
    const currentMonthKey = todayStr.slice(0, 7);
    const lastBar = monthlyBars[monthlyBars.length - 1];
    expect(lastBar.monthKey).toBe(currentMonthKey);
    expect(lastBar.totalAmount).toBeGreaterThan(0);
  });

  it("7. Top 5 Proveedores identifica montos, compras y porcentajes", async () => {
    const result = await getExpensesAndPurchasesReportData(businessId, { preset: "last_7_days" }, timezone);

    const topSuppliers = result.purchases.topSuppliers;
    expect(topSuppliers.length).toBeLessThanOrEqual(5);
    expect(topSuppliers.length).toBeGreaterThanOrEqual(1);

    // Proveedor #1 debe ser Avícola del Valle ($1.190.000)
    const top1 = topSuppliers[0];
    expect(top1.supplierName).toBe("Distribuidora Avícola del Valle");
    expect(top1.totalAmount).toBe(1190000);
    expect(top1.purchasesCount).toBe(1);
    expect(top1.percentage).toBeGreaterThan(50);
  });

  it("8. Cuentas por pagar pendientes se calculan correctamente desde accounts_payable", async () => {
    const result = await getExpensesAndPurchasesReportData(businessId, { preset: "last_7_days" }, timezone);

    expect(result.purchases.summary.pendingAccountsPayableAmount).toBe(1190000);
    expect(result.purchases.summary.pendingAccountsPayableCount).toBe(1);
  });

  it("9. Exportación Excel (CSV) contiene BOM UTF-8 y todas las columnas sin truncar", () => {
    const mockReportData: ExpensesAndPurchasesReportData = {
      expenses: {
        rows: [
          {
            id: "e-1",
            expenseDate: `${todayStr}T10:00:00Z`,
            formattedDate: "31/10/2026, 10:00 a. m.",
            category: "Servicios Públicos",
            concept: "Energía",
            description: "Local principal",
            amount: 450000,
            paymentMethod: "transfer",
            paymentMethodLabel: "Transferencia",
            supplierId: "sup-3",
            supplierName: "Servicios Públicos de Energía",
            receiptNumber: "REC-101",
            expenseType: "operational",
            status: "completed",
            statusLabel: "Completado",
          },
        ],
        summary: {
          totalExpenses: 450000,
          dailyAverage: 450000,
          mainCategory: { category: "Servicios Públicos", amount: 450000, percentage: 100 },
          transactionsCount: 1,
        },
        categoryDistribution: [
          { category: "Servicios Públicos", amount: 450000, percentage: 100, count: 1, color: "#ED500A" },
        ],
        last6MonthsMonthly: [],
      },
      purchases: {
        rows: [
          {
            id: "p-1",
            purchaseNumber: "COMP-00001",
            invoiceNumber: "FAC-9874",
            purchaseDate: `${todayStr}T09:00:00Z`,
            formattedDate: "31/10/2026, 09:00 a. m.",
            supplierId: "sup-1",
            supplierName: "Distribuidora Avícola del Valle",
            supplierTaxId: "900.111.222-1",
            subtotal: 1000000,
            taxAmount: 190000,
            total: 1190000,
            paymentType: "credit",
            paymentMethod: "transfer",
            status: "confirmed",
            statusLabel: "Confirmada",
            items: [
              {
                id: "it-1",
                productName: "Pechuga de Pollo",
                quantity: 50,
                unitCost: 15000,
                totalCost: 750000,
              },
            ],
            itemsSummary: "Pechuga de Pollo (50)",
            itemsCount: 1,
          },
        ],
        summary: {
          totalPurchases: 1190000,
          confirmedPurchasesCount: 1,
          pendingAccountsPayableAmount: 1190000,
          pendingAccountsPayableCount: 1,
        },
        topSuppliers: [],
      },
      filterParams: {},
      dateRange: { preset: "today" },
      availableCategories: ["all", "Servicios Públicos"],
      availableSuppliers: [{ id: "all", name: "Todos" }],
      businessName: "Don Negova Parrilla",
    };

    const csvResult = generateExpensesAndPurchasesCsv(mockReportData, "ambos");

    // Verificar BOM UTF-8
    expect(csvResult.content.charCodeAt(0)).toBe(0xfeff);

    // Encabezados de gastos
    expect(csvResult.content).toContain("Categoría");
    expect(csvResult.content).toContain("Concepto");
    expect(csvResult.content).toContain("Monto (COP)");
    expect(csvResult.content).toContain("Servicios Públicos");
    expect(csvResult.content).toContain("TOTAL GASTOS");

    // Encabezados de compras
    expect(csvResult.content).toContain("# Compra");
    expect(csvResult.content).toContain("# Factura Proveedor");
    expect(csvResult.content).toContain("Productos e Insumos Comprados");
    expect(csvResult.content).toContain("Total Neto (COP)");
    expect(csvResult.content).toContain("Pechuga de Pollo");
    expect(csvResult.content).toContain("TOTAL COMPRAS CONFIRMADAS");
  });

  it("10. Filtro por proveedor acota gastos y compras al proveedor seleccionado", async () => {
    const filters: ExpensesAndPurchasesFilterParams = {
      preset: "last_7_days",
      supplierId: "sup-1", // Solo Avícola del Valle
      status: "all",
    };

    const result = await getExpensesAndPurchasesReportData(businessId, filters, timezone);

    // En gastos, no hay gastos de sup-1
    expect(result.expenses.rows).toHaveLength(0);

    // En compras, solo compras de sup-1
    expect(result.purchases.rows.length).toBeGreaterThan(0);
    for (const pur of result.purchases.rows) {
      expect(pur.supplierId).toBe("sup-1");
    }
  });

  it("11. Regla Global: Prohibido uso de alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const filesToCheck = [
      "src/lib/reports/types.ts",
      "src/lib/reports/reports-service.ts",
      "src/lib/reports/expenses-purchases-report-pdf.ts",
      "src/lib/reports/expenses-purchases-report-csv.ts",
      "src/app/workspace/[businessId]/reportes/gastos/actions.ts",
      "src/app/workspace/[businessId]/reportes/gastos/expenses-report-client.tsx",
      "src/app/workspace/[businessId]/reportes/gastos/page.tsx",
    ];

    const forbiddenPatterns = [
      "window.alert",
      "window.confirm",
      "window.prompt",
      "Alert.alert",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toContain(pattern);
      }
    }
  });
});

