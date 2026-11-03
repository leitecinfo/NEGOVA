import {
  ExpenseItem,
  ExpenseType,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilterParams,
  ExpenseKPIs,
  ExpenseCategoryBreakdown,
  ExpensePaymentMethodBreakdown,
  PRODUCTION_CATEGORIES,
  OPERATIONAL_CATEGORIES,
  INCOME_CATEGORIES,
  FinancialReport,
  UnifiedMovement,
  CreateMovementInput,
  MovementKPIs,
  MovementFlow,
} from "./types";

export async function getDbClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

/**
 * Determina si una categoría corresponde a gastos de producción.
 */
export function isProductionCategory(category: string): boolean {
  if (!category) return false;
  const normalized = category.trim().toLowerCase();
  return PRODUCTION_CATEGORIES.some(
    (c) => c.toLowerCase() === normalized
  );
}

/**
 * Infiere el tipo de gasto (operational vs production) según la categoría o especificación explícita.
 */
export function inferExpenseType(category: string, explicitType?: ExpenseType): ExpenseType {
  if (explicitType === "production" || explicitType === "operational") {
    return explicitType;
  }
  return isProductionCategory(category) ? "production" : "operational";
}

/**
 * [GAS-001 & GAS-002] Registra un gasto operativo o de producción.
 * Si es un gasto de producción vinculado a un producto y con updateProductCost = true,
 * actualiza automáticamente el costo unitario del producto/materia prima en el inventario.
 */
export async function createExpense(
  businessId: string,
  input: CreateExpenseInput,
  userId?: string | null
): Promise<{ success: boolean; error?: string; expense?: ExpenseItem }> {
  if (!businessId) {
    return { success: false, error: "Identificador de comercio requerido." };
  }

  const cleanConcept = input.concept?.trim();
  if (!cleanConcept) {
    return { success: false, error: "El concepto o nombre del gasto es obligatorio." };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "El importe del gasto debe ser un monto positivo mayor a $0." };
  }

  const cleanCategory = input.category?.trim() || "Otros Operativos";
  const expenseType = inferExpenseType(cleanCategory, input.expenseType);
  const expenseDate = input.expenseDate ? new Date(input.expenseDate).toISOString() : new Date().toISOString();
  const paymentMethod = input.paymentMethod?.trim() || "efectivo";

  const supabase = await getDbClient();

  let resolvedUnitCost: number | null = null;
  const quantity = input.quantity !== undefined && input.quantity !== null && Number(input.quantity) > 0
    ? Number(input.quantity)
    : null;

  if (input.unitCost !== undefined && input.unitCost !== null && Number(input.unitCost) > 0) {
    resolvedUnitCost = Number(input.unitCost);
  } else if (quantity && quantity > 0) {
    resolvedUnitCost = Number((amount / quantity).toFixed(2));
  }

  // Si es gasto de producción vinculado a un producto y se solicita actualizar costo
  if (
    expenseType === "production" &&
    input.productId &&
    input.updateProductCost &&
    resolvedUnitCost !== null &&
    resolvedUnitCost > 0
  ) {
    try {
      // 1. Obtener producto para preservar metadata
      const { data: prodData } = await supabase
        .from("products")
        .select("id, cost, metadata")
        .eq("id", input.productId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (prodData) {
        const currentMeta =
          prodData.metadata && typeof prodData.metadata === "object" ? prodData.metadata : {};

        const updatedMeta = {
          ...currentMeta,
          cost: resolvedUnitCost,
          last_cost_update: new Date().toISOString(),
          last_cost_source: "production_expense",
        };

        await supabase
          .from("products")
          .update({
            cost: resolvedUnitCost,
            metadata: updatedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.productId)
          .eq("business_id", businessId);
      }
    } catch (costErr) {
      console.warn("[createExpense] Aviso actualizando costo de producto:", costErr);
    }
  }

  const { data: newRow, error: insertError } = await supabase
    .from("expenses")
    .insert({
      business_id: businessId,
      concept: cleanConcept,
      amount,
      category: cleanCategory,
      expense_type: expenseType,
      description: input.description?.trim() || null,
      expense_date: expenseDate,
      payment_method: paymentMethod,
      receipt_number: input.receiptNumber?.trim() || null,
      supplier_id: input.supplierId || null,
      product_id: input.productId || null,
      unit_cost: resolvedUnitCost,
      quantity,
      update_product_cost: Boolean(input.updateProductCost),
      status: "completed",
      notes: input.notes?.trim() || null,
      created_by: userId || null,
    })
    .select()
    .single();

  if (insertError || !newRow) {
    console.error("[createExpense] Error al insertar gasto:", insertError);
    return {
      success: false,
      error: insertError?.message || "No se pudo registrar el gasto en el sistema.",
    };
  }

  // [GAS-003] Integración de Gastos con Caja y Turno Activo:
  // Al registrar un gasto con método de pago "Efectivo" y caja abierta:
  // Crear cash_movements tipo 'expense' vinculado al turno activo para reducir el saldo de efectivo.
  const isCashPayment =
    paymentMethod.toLowerCase() === "efectivo" ||
    paymentMethod.toLowerCase() === "cash";

  if (isCashPayment) {
    try {
      let targetSessionId = input.cashSessionId || null;

      if (!targetSessionId) {
        let sessionQuery = supabase
          .from("cash_sessions")
          .select("id, status")
          .eq("business_id", businessId)
          .eq("status", "open");

        if (input.cashRegisterId) {
          sessionQuery = sessionQuery.eq("register_id", input.cashRegisterId);
        }

        const { data: openSession } = await sessionQuery
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openSession) {
          targetSessionId = openSession.id;
        }
      }

      if (targetSessionId) {
        const { error: cashMovErr } = await supabase
          .from("cash_movements")
          .insert({
            session_id: targetSessionId,
            business_id: businessId,
            movement_type: "expense",
            amount,
            reference_id: newRow.id,
            reference_type: "expense",
            notes: `Gasto: ${cleanConcept} (${cleanCategory})`,
            created_by: userId || null,
            created_at: newRow.created_at || new Date().toISOString(),
          });

        if (cashMovErr) {
          console.warn("[createExpense] Aviso al registrar cash_movement:", cashMovErr.message);
        }
      }
    } catch (cashErr) {
      console.warn("[createExpense] Excepción vinculando gasto con caja:", cashErr);
    }
  }

  // Opcional: resolver nombres de proveedor y producto
  let supplierName: string | null = null;
  let productName: string | null = null;

  if (newRow.supplier_id) {
    const { data: sData } = await supabase
      .from("suppliers")
      .select("name")
      .eq("id", newRow.supplier_id)
      .maybeSingle();
    supplierName = sData?.name || null;
  }

  if (newRow.product_id) {
    const { data: pData } = await supabase
      .from("products")
      .select("name")
      .eq("id", newRow.product_id)
      .maybeSingle();
    productName = pData?.name || null;
  }

  const expense: ExpenseItem = {
    id: newRow.id,
    businessId: newRow.business_id,
    concept: newRow.concept,
    amount: Number(newRow.amount),
    category: newRow.category,
    expenseType: newRow.expense_type as ExpenseType,
    description: newRow.description,
    expenseDate: newRow.expense_date,
    paymentMethod: newRow.payment_method,
    receiptNumber: newRow.receipt_number,
    supplierId: newRow.supplier_id,
    supplierName,
    productId: newRow.product_id,
    productName,
    unitCost: newRow.unit_cost ? Number(newRow.unit_cost) : null,
    quantity: newRow.quantity ? Number(newRow.quantity) : null,
    updateProductCost: Boolean(newRow.update_product_cost),
    status: newRow.status,
    notes: newRow.notes,
    createdBy: newRow.created_by,
    createdAt: newRow.created_at,
    updatedAt: newRow.updated_at,
  };

  return { success: true, expense };
}

/**
 * Consulta y filtra los gastos de un comercio.
 */
export async function getExpensesList(
  params: ExpenseFilterParams
): Promise<ExpenseItem[]> {
  const supabase = await getDbClient();

  let query = supabase
    .from("expenses")
    .select(`
      *,
      suppliers:supplier_id(name),
      products:product_id(name)
    `)
    .eq("business_id", params.businessId)
    .neq("status", "cancelled");

  if (params.expenseType && params.expenseType !== "all") {
    query = query.eq("expense_type", params.expenseType);
  }

  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }

  if (params.paymentMethod && params.paymentMethod !== "all") {
    query = query.eq("payment_method", params.paymentMethod);
  }

  if (params.supplierId && params.supplierId !== "all") {
    query = query.eq("supplier_id", params.supplierId);
  }

  if (params.startDate) {
    query = query.gte("expense_date", params.startDate);
  }

  if (params.endDate) {
    query = query.lte("expense_date", params.endDate);
  }

  const { data, error } = await query.order("expense_date", { ascending: false });

  if (error || !data) {
    console.error("[getExpensesList] Error:", error);
    return [];
  }

  let items: ExpenseItem[] = data.map((row: any) => ({
    id: row.id,
    businessId: row.business_id,
    concept: row.concept,
    amount: Number(row.amount || 0),
    category: row.category || "Otros Operativos",
    expenseType: (row.expense_type as ExpenseType) || "operational",
    description: row.description,
    expenseDate: row.expense_date,
    paymentMethod: row.payment_method || "efectivo",
    receiptNumber: row.receipt_number,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name || null,
    productId: row.product_id,
    productName: row.products?.name || null,
    unitCost: row.unit_cost ? Number(row.unit_cost) : null,
    quantity: row.quantity ? Number(row.quantity) : null,
    updateProductCost: Boolean(row.update_product_cost),
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  if (params.search?.trim()) {
    const s = params.search.trim().toLowerCase();
    items = items.filter(
      (item) =>
        item.concept.toLowerCase().includes(s) ||
        (item.description && item.description.toLowerCase().includes(s)) ||
        (item.notes && item.notes.toLowerCase().includes(s)) ||
        (item.category && item.category.toLowerCase().includes(s)) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(s)) ||
        (item.productName && item.productName.toLowerCase().includes(s)) ||
        (item.receiptNumber && item.receiptNumber.toLowerCase().includes(s))
    );
  }

  return items;
}

/**
 * [GAS-002] Calcula los KPIs de gastos operativos vs de producción,
 * y los contrasta contra los ingresos por ventas del período para determinar márgenes.
 */
export async function getExpenseKPIs(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<ExpenseKPIs> {
  const supabase = await getDbClient();

  // 1. Obtener gastos no cancelados del período
  let expenseQuery = supabase
    .from("expenses")
    .select("id, amount, category, expense_type, payment_method, expense_date")
    .eq("business_id", businessId)
    .neq("status", "cancelled");

  if (startDate) {
    expenseQuery = expenseQuery.gte("expense_date", startDate);
  }
  if (endDate) {
    expenseQuery = expenseQuery.lte("expense_date", endDate);
  }

  const { data: expensesData } = await expenseQuery;
  const expenses = expensesData || [];

  let operationalExpenses = 0;
  let productionExpenses = 0;

  const categoryMap = new Map<string, { type: ExpenseType; amount: number; count: number }>();
  const paymentMethodMap = new Map<string, { amount: number; count: number }>();

  for (const exp of expenses) {
    const amt = Number(exp.amount || 0);
    const type: ExpenseType = exp.expense_type === "production" ? "production" : "operational";

    if (type === "production") {
      productionExpenses += amt;
    } else {
      operationalExpenses += amt;
    }

    // Agrupación por categoría
    const cat = exp.category || "Otros Operativos";
    const existingCat = categoryMap.get(cat) || { type, amount: 0, count: 0 };
    existingCat.amount += amt;
    existingCat.count += 1;
    categoryMap.set(cat, existingCat);

    // Agrupación por medio de pago
    const pm = exp.payment_method || "efectivo";
    const existingPm = paymentMethodMap.get(pm) || { amount: 0, count: 0 };
    existingPm.amount += amt;
    existingPm.count += 1;
    paymentMethodMap.set(pm, existingPm);
  }

  const totalExpenses = Number((operationalExpenses + productionExpenses).toFixed(2));
  operationalExpenses = Number(operationalExpenses.toFixed(2));
  productionExpenses = Number(productionExpenses.toFixed(2));

  // 2. Obtener total de ventas del período desde comprobantes de venta válidos
  let salesQuery = supabase
    .from("business_sale_documents")
    .select("total, discount_total, notes, status, issued_at")
    .eq("business_id", businessId)
    .in("status", ["paid", "completed"]);

  if (startDate) {
    salesQuery = salesQuery.gte("issued_at", startDate);
  }
  if (endDate) {
    salesQuery = salesQuery.lte("issued_at", endDate);
  }

  const { data: salesData } = await salesQuery;
  let totalSales = (salesData || []).reduce((acc: number, s: any) => acc + Number(s.total || 0), 0);
  let totalTips = 0;
  let totalDiscounts = 0;

  const parseTipFromNotes = (notes?: string | null) => {
    if (!notes) return 0;
    const m = String(notes).match(/Propina:\s*\+\$?([\d.,]+)/i);
    return m ? Number(m[1].replace(/[.,]/g, "")) || 0 : 0;
  };
  const parseDiscountFromNotes = (notes?: string | null, colVal?: number) => {
    if (colVal && colVal > 0) return Number(colVal);
    if (!notes) return 0;
    const m = String(notes).match(/Descuento:\s*-\$?([\d.,]+)/i);
    return m ? Number(m[1].replace(/[.,]/g, "")) || 0 : 0;
  };

  for (const s of salesData || []) {
    totalTips += parseTipFromNotes(s.notes);
    totalDiscounts += parseDiscountFromNotes(s.notes, Number(s.discount_total || 0));
  }

  // Fallback si no hay comprobantes emitidos pero sí pedidos entregados
  if (totalSales === 0) {
    let ordersQuery = supabase
      .from("restaurant_orders")
      .select("total, notes, status, created_at")
      .eq("business_id", businessId)
      .neq("status", "cancelled");

    if (startDate) {
      ordersQuery = ordersQuery.gte("created_at", startDate);
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte("created_at", endDate);
    }

    const { data: ordersData } = await ordersQuery;
    totalSales = (ordersData || []).reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);
    for (const o of ordersData || []) {
      totalTips += parseTipFromNotes(o.notes);
      totalDiscounts += parseDiscountFromNotes(o.notes);
    }
  }

  totalSales = Number(totalSales.toFixed(2));
  totalTips = Number(totalTips.toFixed(2));
  totalDiscounts = Number(totalDiscounts.toFixed(2));

  // 3. Cálculo de márgenes
  const grossMarginAmount = Number((totalSales - productionExpenses).toFixed(2));
  const grossMarginPercentage =
    totalSales > 0 ? Number(((grossMarginAmount / totalSales) * 100).toFixed(1)) : 0;

  const netMarginAmount = Number((totalSales - totalExpenses).toFixed(2));
  const netMarginPercentage =
    totalSales > 0 ? Number(((netMarginAmount / totalSales) * 100).toFixed(1)) : 0;

  // Desgloses porcentuales
  const categoryBreakdown: ExpenseCategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, val]) => ({
      category,
      expenseType: val.type,
      amount: Number(val.amount.toFixed(2)),
      percentage: totalExpenses > 0 ? Number(((val.amount / totalExpenses) * 100).toFixed(1)) : 0,
      count: val.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  const paymentMethodBreakdown: ExpensePaymentMethodBreakdown[] = Array.from(
    paymentMethodMap.entries()
  )
    .map(([method, val]) => ({
      method,
      amount: Number(val.amount.toFixed(2)),
      percentage: totalExpenses > 0 ? Number(((val.amount / totalExpenses) * 100).toFixed(1)) : 0,
      count: val.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalExpenses,
    operationalExpenses,
    productionExpenses,
    totalSales,
    totalTips,
    totalDiscounts,
    grossMarginAmount,
    grossMarginPercentage,
    netMarginAmount,
    netMarginPercentage,
    expensesCount: expenses.length,
    categoryBreakdown,
    paymentMethodBreakdown,
  };
}

/**
 * Modifica un gasto existente.
 */
export async function updateExpense(
  businessId: string,
  expenseId: string,
  input: UpdateExpenseInput
): Promise<{ success: boolean; error?: string; expense?: ExpenseItem }> {
  const supabase = await getDbClient();

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.concept !== undefined) updatePayload.concept = input.concept.trim();
  if (input.amount !== undefined) {
    const amt = Number(input.amount);
    if (amt <= 0) return { success: false, error: "El importe debe ser mayor a 0." };
    updatePayload.amount = amt;
  }
  if (input.category !== undefined) {
    updatePayload.category = input.category.trim();
    if (input.expenseType === undefined) {
      updatePayload.expense_type = inferExpenseType(updatePayload.category);
    }
  }
  if (input.expenseType !== undefined) updatePayload.expense_type = input.expenseType;
  if (input.description !== undefined) updatePayload.description = input.description.trim() || null;
  if (input.expenseDate !== undefined) updatePayload.expense_date = new Date(input.expenseDate).toISOString();
  if (input.paymentMethod !== undefined) updatePayload.payment_method = input.paymentMethod;
  if (input.receiptNumber !== undefined) updatePayload.receipt_number = input.receiptNumber.trim() || null;
  if (input.notes !== undefined) updatePayload.notes = input.notes.trim() || null;

  const { data: updated, error } = await supabase
    .from("expenses")
    .update(updatePayload)
    .eq("id", expenseId)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message || "No se pudo actualizar el gasto." };
  }

  return {
    success: true,
    expense: {
      id: updated.id,
      businessId: updated.business_id,
      concept: updated.concept,
      amount: Number(updated.amount),
      category: updated.category,
      expenseType: updated.expense_type as ExpenseType,
      description: updated.description,
      expenseDate: updated.expense_date,
      paymentMethod: updated.payment_method,
      receiptNumber: updated.receipt_number,
      supplierId: updated.supplier_id,
      productId: updated.product_id,
      unitCost: updated.unit_cost ? Number(updated.unit_cost) : null,
      quantity: updated.quantity ? Number(updated.quantity) : null,
      updateProductCost: Boolean(updated.update_product_cost),
      status: updated.status,
      notes: updated.notes,
      createdBy: updated.created_by,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  };
}

/**
 * Anula lógicamente un gasto marcándolo como 'cancelled'.
 * [GAS-003] Si estaba vinculado a un movimiento de caja en efectivo, lo revierte para restaurar el saldo.
 */
export async function deleteExpense(
  businessId: string,
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getDbClient();

  const { error } = await supabase
    .from("expenses")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", expenseId)
    .eq("business_id", businessId);

  if (error) {
    return { success: false, error: error.message || "Error al anular el gasto." };
  }

  // [GAS-003] Revertir movimiento de caja si existía
  try {
    await supabase
      .from("cash_movements")
      .delete()
      .eq("business_id", businessId)
      .eq("reference_id", expenseId)
      .eq("reference_type", "expense");
  } catch (movErr) {
    console.warn("[deleteExpense] Aviso al revertir cash_movement:", movErr);
  }

  return { success: true };
}

/**
 * [GAS-003] Genera el reporte financiero consolidado del negocio en un período dado.
 * Calcula:
 * Ingresos (Ventas cobradas) - Gastos (Operativos + Producción) = Resultado Neto (Utilidad / Pérdida).
 */
export async function getFinancialReport(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<FinancialReport> {
  const kpis = await getExpenseKPIs(businessId, startDate, endDate);

  const netIncome = Number((kpis.totalSales - kpis.totalExpenses).toFixed(2));
  const profitMarginPercentage =
    kpis.totalSales > 0 ? Number(((netIncome / kpis.totalSales) * 100).toFixed(1)) : 0;

  return {
    businessId,
    startDate,
    endDate,
    income: {
      totalSales: kpis.totalSales,
      salesCount: kpis.expensesCount > 0 ? 1 : 0,
      totalTips: kpis.totalTips || 0,
      totalDiscounts: kpis.totalDiscounts || 0,
    },
    expenses: {
      totalExpenses: kpis.totalExpenses,
      operationalExpenses: kpis.operationalExpenses,
      productionExpenses: kpis.productionExpenses,
      expensesCount: kpis.expensesCount,
    },
    netIncome,
    grossMarginAmount: kpis.grossMarginAmount,
    grossMarginPercentage: kpis.grossMarginPercentage,
    netMarginPercentage: profitMarginPercentage,
    isProfitable: netIncome >= 0,
  };
}

/**
 * Determina si una categoría corresponde a un flujo de ingreso.
 */
export function isIncomeCategory(category: string): boolean {
  if (!category) return false;
  const normalized = category.trim().toLowerCase();
  return (
    INCOME_CATEGORIES.some((c) => c.toLowerCase() === normalized) ||
    normalized.includes("ingreso") ||
    normalized.includes("aporte") ||
    normalized.includes("rendimiento")
  );
}

/**
 * Extrae el nombre del tercero o proveedor codificado en las notas.
 */
export function extractThirdPartyFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[Tercero:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

/**
 * Consulta unificada de movimientos de Ingresos y Egresos.
 */
export async function getUnifiedMovements(
  businessId: string,
  filters?: {
    flow?: "all" | "income" | "expense";
    category?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }
): Promise<UnifiedMovement[]> {
  const supabase = await getDbClient();

  // 1. Consultar gastos / egresos e ingresos manuales en expenses
  let expQuery = supabase
    .from("expenses")
    .select(`
      *,
      suppliers:supplier_id(name),
      products:product_id(name)
    `)
    .eq("business_id", businessId)
    .neq("status", "cancelled");

  if (filters?.startDate) {
    expQuery = expQuery.gte("expense_date", filters.startDate);
  }
  if (filters?.endDate) {
    expQuery = expQuery.lte("expense_date", filters.endDate);
  }

  const { data: expRows, error: expErr } = await expQuery.order("expense_date", { ascending: false });
  if (expErr) {
    console.error("[getUnifiedMovements] Error querying expenses:", expErr);
  }

  // 2. Consultar movimientos de caja para obtener trazabilidad de caja (nombre de la caja)
  const { data: cashMovRows } = await supabase
    .from("cash_movements")
    .select(`
      id,
      session_id,
      movement_type,
      amount,
      reference_id,
      reference_type,
      notes,
      created_at,
      cash_sessions(
        id,
        cash_registers(name)
      )
    `)
    .eq("business_id", businessId);

  // Mapear reference_id -> nombre de caja
  const cashRegMap = new Map<string, string>();
  for (const cm of cashMovRows || []) {
    if (cm.reference_id) {
      const regName = (cm.cash_sessions as any)?.cash_registers?.name || "Caja Principal";
      cashRegMap.set(cm.reference_id, regName);
    }
  }

  const movements: UnifiedMovement[] = [];

  for (const row of expRows || []) {
    const isIncome =
      isIncomeCategory(row.category) ||
      (row.notes && row.notes.startsWith("[INGRESO]")) ||
      (row.description && row.description.includes("[INGRESO]"));

    const flow: MovementFlow = isIncome ? "income" : "expense";
    const paymentMethodLower = (row.payment_method || "efectivo").toLowerCase();
    const isCash = paymentMethodLower === "efectivo" || paymentMethodLower === "cash";

    const regName = cashRegMap.get(row.id) || (isCash ? "Caja Principal" : null);

    let cajaBadge: string;
    if (isCash) {
      cajaBadge = flow === "income"
        ? `Ingresó a ${regName || "Caja Principal"}`
        : `Salió de ${regName || "Caja Principal"}`;
    } else if (paymentMethodLower.includes("transfer")) {
      cajaBadge = "Transferencia Bancaria";
    } else if (paymentMethodLower.includes("tarjet") || paymentMethodLower.includes("card")) {
      cajaBadge = "Tarjeta Débito / Crédito";
    } else {
      cajaBadge = row.payment_method || "Otro Canal";
    }

    const thirdParty =
      row.suppliers?.name ||
      extractThirdPartyFromNotes(row.notes) ||
      null;

    movements.push({
      id: row.id,
      businessId: row.business_id,
      flow,
      concept: row.concept,
      amount: Number(row.amount || 0),
      category: row.category || (isIncome ? "Otros Ingresos" : "Otros Operativos"),
      expenseType: isIncome ? undefined : (row.expense_type as ExpenseType) || "operational",
      incomeType: isIncome && row.notes ? row.notes.match(/\[Tipo:\s*([^\]]+)\]/i)?.[1]?.trim() : undefined,
      description: row.description,
      date: row.expense_date,
      paymentMethod: row.payment_method || "efectivo",
      receiptNumber: row.receipt_number,
      thirdPartyName: thirdParty,
      supplierId: row.supplier_id,
      productId: row.product_id,
      productName: row.products?.name || null,
      cashRegisterName: regName,
      cajaBadge,
      status: row.status,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    });
  }

  // 3. Incluir aportes manuales directos en caja (movement_type = 'entry') que no provengan de un expense
  for (const cm of cashMovRows || []) {
    if (cm.movement_type === "entry" && cm.reference_type !== "expense") {
      const regName = (cm.cash_sessions as any)?.cash_registers?.name || "Caja Principal";
      movements.push({
        id: cm.id,
        businessId,
        flow: "income",
        concept: cm.notes || "Aporte manual a caja",
        amount: Number(cm.amount || 0),
        category: "Aportes de Capital",
        date: cm.created_at,
        paymentMethod: "Efectivo",
        cashRegisterName: regName,
        cajaBadge: `Ingresó a ${regName}`,
        status: "completed",
        notes: cm.notes,
        createdAt: cm.created_at,
      });
    } else if (cm.movement_type === "withdrawal" && cm.reference_type !== "expense") {
      const regName = (cm.cash_sessions as any)?.cash_registers?.name || "Caja Principal";
      movements.push({
        id: cm.id,
        businessId,
        flow: "expense",
        concept: cm.notes || "Retiro de efectivo de caja",
        amount: Number(cm.amount || 0),
        category: "Retiros de Caja",
        expenseType: "operational",
        date: cm.created_at,
        paymentMethod: "Efectivo",
        cashRegisterName: regName,
        cajaBadge: `Salió de ${regName}`,
        status: "completed",
        notes: cm.notes,
        createdAt: cm.created_at,
      });
    }
  }

  // 4. Aplicar filtros en memoria
  let filtered = movements;

  if (filters?.flow && filters.flow !== "all") {
    filtered = filtered.filter((m) => m.flow === filters.flow);
  }

  if (filters?.category && filters.category !== "all") {
    filtered = filtered.filter((m) => m.category.toLowerCase() === filters.category?.toLowerCase());
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.concept.toLowerCase().includes(q) ||
        (m.thirdPartyName && m.thirdPartyName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q)) ||
        (m.receiptNumber && m.receiptNumber.toLowerCase().includes(q)) ||
        (m.notes && m.notes.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }

  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Registra un nuevo movimiento unificado (Ingreso o Egreso).
 */
export async function createUnifiedMovement(
  businessId: string,
  input: CreateMovementInput,
  userId?: string | null
): Promise<{ success: boolean; error?: string; movement?: UnifiedMovement }> {
  if (!businessId) {
    return { success: false, error: "Identificador de negocio requerido." };
  }

  const cleanConcept = input.concept?.trim();
  if (!cleanConcept) {
    return { success: false, error: "El concepto del movimiento es obligatorio." };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "El monto debe ser un valor positivo mayor a 0." };
  }

  const isIncome = input.flow === "income";
  const defaultCategory = isIncome ? "Otros Ingresos" : "Otros Operativos";
  const cleanCategory = input.category?.trim() || defaultCategory;
  const paymentMethod = input.paymentMethod?.trim() || "efectivo";
  const movementDate = input.date ? new Date(input.date).toISOString() : new Date().toISOString();

  const supabase = await getDbClient();

  const notesWithThirdParty = [
    isIncome ? "[INGRESO]" : null,
    input.incomeType ? `[Tipo: ${input.incomeType}]` : null,
    input.thirdPartyName?.trim() ? `[Tercero: ${input.thirdPartyName.trim()}]` : null,
    input.notes?.trim() || null,
  ]
    .filter(Boolean)
    .join(" ");

  let { data: newRow, error: insertError } = await supabase
    .from("expenses")
    .insert({
      business_id: businessId,
      concept: cleanConcept,
      amount,
      category: cleanCategory,
      expense_type: isIncome ? "operational" : (input.expenseType || "operational"),
      description: input.description?.trim() || null,
      expense_date: movementDate,
      payment_method: paymentMethod,
      receipt_number: input.receiptNumber?.trim() || null,
      supplier_id: input.supplierId || null,
      product_id: input.productId || null,
      unit_cost: input.unitCost ? Number(input.unitCost) : null,
      quantity: input.quantity ? Number(input.quantity) : null,
      update_product_cost: Boolean(input.updateProductCost),
      status: "completed",
      notes: notesWithThirdParty || null,
      created_by: userId || null,
    })
    .select()
    .single();

  if (insertError && (insertError.message?.includes("expense_type") || (insertError as any).details?.includes("expense_type"))) {
    const fallbackRes = await supabase
      .from("expenses")
      .insert({
        business_id: businessId,
        concept: cleanConcept,
        amount,
        category: cleanCategory,
        description: input.description?.trim() || null,
        expense_date: movementDate,
        payment_method: paymentMethod,
        receipt_number: input.receiptNumber?.trim() || null,
        supplier_id: input.supplierId || null,
        product_id: input.productId || null,
        unit_cost: input.unitCost ? Number(input.unitCost) : null,
        quantity: input.quantity ? Number(input.quantity) : null,
        update_product_cost: Boolean(input.updateProductCost),
        status: "completed",
        notes: `[TipoGasto: ${input.expenseType || "operational"}] ${notesWithThirdParty || ""}`.trim() || null,
        created_by: userId || null,
      })
      .select()
      .single();

    newRow = fallbackRes.data;
    insertError = fallbackRes.error;
  }

  if (insertError || !newRow) {
    console.error("[createUnifiedMovement] Error inserting:", insertError);
    return {
      success: false,
      error: insertError?.message || "No se pudo registrar el movimiento.",
    };
  }

  // Integración de caja si fue en efectivo y se solicitó afectar caja
  const isCash =
    paymentMethod.toLowerCase() === "efectivo" ||
    paymentMethod.toLowerCase() === "cash";

  let cashRegisterName: string | null = null;

  if (isCash && input.deductFromCashRegister !== false) {
    try {
      let targetSessionId = input.cashSessionId || null;

      if (!targetSessionId) {
        let sessionQuery = supabase
          .from("cash_sessions")
          .select("id, status, cash_registers(name)")
          .eq("business_id", businessId)
          .eq("status", "open");

        if (input.cashRegisterId) {
          sessionQuery = sessionQuery.eq("register_id", input.cashRegisterId);
        }

        const { data: openSession } = await sessionQuery
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openSession) {
          targetSessionId = openSession.id;
          cashRegisterName = (openSession as any)?.cash_registers?.name || "Caja Principal";
        }
      }

      if (targetSessionId) {
        const movementType = isIncome ? "entry" : "expense";
        const { error: cashMovErr } = await supabase
          .from("cash_movements")
          .insert({
            session_id: targetSessionId,
            business_id: businessId,
            movement_type: movementType,
            amount,
            reference_id: newRow.id,
            reference_type: "expense",
            notes: `${isIncome ? "Ingreso" : "Gasto"}: ${cleanConcept} (${cleanCategory})`,
            created_by: userId || null,
            created_at: newRow.created_at || new Date().toISOString(),
          });

        if (cashMovErr) {
          console.warn("[createUnifiedMovement] Cash movement warning:", cashMovErr.message);
        }
      }
    } catch (cashErr) {
      console.warn("[createUnifiedMovement] Cash link exception:", cashErr);
    }
  }

  let cajaBadge: string;
  if (isCash) {
    cajaBadge = isIncome
      ? `Ingresó a ${cashRegisterName || "Caja Principal"}`
      : `Salió de ${cashRegisterName || "Caja Principal"}`;
  } else if (paymentMethod.toLowerCase().includes("transfer")) {
    cajaBadge = "Transferencia Bancaria";
  } else if (paymentMethod.toLowerCase().includes("tarjet") || paymentMethod.toLowerCase().includes("card")) {
    cajaBadge = "Tarjeta Débito / Crédito";
  } else {
    cajaBadge = paymentMethod;
  }

  const movement: UnifiedMovement = {
    id: newRow.id,
    businessId: newRow.business_id,
    flow: isIncome ? "income" : "expense",
    concept: newRow.concept,
    amount: Number(newRow.amount),
    category: newRow.category,
    expenseType: isIncome ? undefined : (newRow.expense_type as ExpenseType),
    incomeType: input.incomeType,
    description: newRow.description,
    date: newRow.expense_date,
    paymentMethod: newRow.payment_method,
    receiptNumber: newRow.receipt_number,
    thirdPartyName: input.thirdPartyName || null,
    supplierId: newRow.supplier_id,
    cashRegisterName,
    cajaBadge,
    status: newRow.status,
    notes: newRow.notes,
    createdBy: newRow.created_by,
    createdAt: newRow.created_at,
  };

  return { success: true, movement };
}

/**
 * Anula un movimiento de ingreso o egreso.
 */
export async function cancelUnifiedMovement(
  businessId: string,
  movementId: string
): Promise<{ success: boolean; error?: string }> {
  return await deleteExpense(businessId, movementId);
}
