import { PlatformFinancialSummary, PlatformExpense, FinancialFilterParams } from "./types";
import { getSubscriptionsList } from "@/lib/subscriptions/subscriptions-service";

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

const EXPENSE_CATEGORY_LABELS: Record<PlatformExpense["category"], string> = {
  infra: "Infraestructura & Base de Datos",
  api_services: "APIs & Servicios Externos",
  domain_hosting: "Dominio & Alojamiento Web",
  commissions: "Comisiones Bancarias / Pasarela",
  operations: "Operaciones & Soporte Técnico",
  other: "Otros Costos Operativos",
};

function getFilterDates(params?: FinancialFilterParams) {
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (params?.period === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (params?.period === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (params?.period === "this_year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (params?.period === "custom") {
    if (params.startDate) start = new Date(params.startDate);
    if (params.endDate) {
      end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
    }
  }

  return { start, end };
}

export async function getPlatformFinancialSummary(
  params?: FinancialFilterParams
): Promise<PlatformFinancialSummary> {
  const admin = await getSupabaseAdminClient();
  const { start, end } = getFilterDates(params);

  // 1. Obtener Suscripciones (MRR y ARR son globales, independientes del periodo histórico)
  const subsResult = await getSubscriptionsList({ pageSize: 1 });
  const mrrCOP = subsResult.kpis.monthlyEstimatedRevenue || 0;
  const arrCOP = mrrCOP * 12;

  // 2. Facturas pagadas (Ingresos)
  let invoiceQuery = admin.from("platform_invoices").select("id, invoice_number, business_name, plan_name, amount, paid_at, issued_at").eq("status", "paid");
  
  if (start) invoiceQuery = invoiceQuery.gte("paid_at", start.toISOString());
  if (end) invoiceQuery = invoiceQuery.lte("paid_at", end.toISOString());

  const { data: invoicesData, error: invoiceErr } = await invoiceQuery;

  // 3. Egresos
  let expenseQuery = admin.from("platform_expenses").select("*");

  if (start) expenseQuery = expenseQuery.gte("expense_date", start.toISOString());
  if (end) expenseQuery = expenseQuery.lte("expense_date", end.toISOString());

  const { data: expensesData, error: expenseErr } = await expenseQuery;

  const invoices = invoicesData || [];
  const dbExpenses = expensesData || [];

  const expenses: PlatformExpense[] = dbExpenses.map(row => ({
    id: row.id,
    category: row.category as any,
    categoryLabel: EXPENSE_CATEGORY_LABELS[row.category as PlatformExpense["category"]] || "Otros Egresos",
    concept: row.concept,
    amount: Number(row.amount),
    currency: "COP",
    date: row.expense_date,
    receiptReference: row.reference,
    notes: row.notes,
  }));

  // 4. Calcular Totales
  const totalRevenueCollectedCOP = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalExpensesPaidCOP = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netCashFlowCOP = totalRevenueCollectedCOP - totalExpensesPaidCOP;

  // 5. Consolidar Movimientos
  const movements: PlatformFinancialSummary["recentMovements"] = [];

  invoices.forEach((inv) => {
    movements.push({
      id: inv.id,
      type: "income",
      concept: `Recaudo Suscripción Plan ${inv.plan_name}`,
      entityName: inv.business_name,
      amount: Number(inv.amount),
      date: inv.paid_at || inv.issued_at,
      reference: inv.invoice_number,
    });
  });

  expenses.forEach((exp) => {
    movements.push({
      id: exp.id,
      type: "expense",
      concept: exp.concept,
      entityName: exp.categoryLabel,
      amount: exp.amount,
      date: exp.date,
      reference: exp.receiptReference || undefined,
    });
  });

  // Ordenar por fecha descendente
  movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    mrrCOP,
    arrCOP,
    activeSubscriptionsCount: subsResult.kpis.active || 0,
    trialSubscriptionsCount: subsResult.kpis.trial || 0,
    totalRevenueCollectedCOP,
    totalExpensesPaidCOP,
    netCashFlowCOP,
    recentMovements: movements,
    expenses: expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

export async function registerPlatformExpense(data: {
  category: PlatformExpense["category"];
  concept: string;
  amount: number;
  date?: string;
  receiptReference?: string;
  notes?: string;
  adminUserId?: string;
}): Promise<{ success: boolean; expense?: PlatformExpense; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data: insertedData, error } = await admin.from("platform_expenses").insert({
      category: data.category,
      concept: data.concept.trim(),
      amount: Math.max(0, Math.round(data.amount)),
      expense_date: data.date || new Date().toISOString(),
      reference: data.receiptReference?.trim() || null,
      created_by: data.adminUserId || null,
    }).select().single();

    if (error) throw error;

    // Auditoría (Plataforma: business_id = null)
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: null,
      userId: data.adminUserId || null,
      action: "create",
      entityType: "platform_expense",
      entityId: insertedData.id,
      metadata: { original_action: "register_platform_expense", concept: insertedData.concept, amount: insertedData.amount, category: insertedData.category },
    });

    const newExpense: PlatformExpense = {
      id: insertedData.id,
      category: insertedData.category as any,
      categoryLabel: EXPENSE_CATEGORY_LABELS[insertedData.category as PlatformExpense["category"]] || "Otros Egresos",
      concept: insertedData.concept,
      amount: Number(insertedData.amount),
      currency: "COP",
      date: insertedData.expense_date,
      receiptReference: insertedData.reference,
    };

    return { success: true, expense: newExpense };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al registrar el egreso" };
  }
}

export async function updatePlatformExpense(
  id: string,
  data: Partial<PlatformExpense>,
  adminUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const updates: any = { updated_at: new Date().toISOString() };
    
    if (data.category) updates.category = data.category;
    if (data.concept !== undefined) updates.concept = data.concept.trim();
    if (data.amount !== undefined) updates.amount = Math.max(0, Math.round(data.amount));
    if (data.date) updates.expense_date = data.date;
    if (data.receiptReference !== undefined) updates.reference = data.receiptReference?.trim() || null;

    const { error } = await admin.from("platform_expenses").update(updates).eq("id", id);
    if (error) throw error;

    // Auditoría (Plataforma: business_id = null)
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: null,
      userId: adminUserId || null,
      action: "update",
      entityType: "platform_expense",
      entityId: id,
      metadata: { original_action: "update_platform_expense", updates },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al editar el egreso" };
  }
}

export async function deletePlatformExpense(
  id: string,
  adminUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const { error } = await admin.from("platform_expenses").delete().eq("id", id);
    if (error) throw error;

    // Auditoría (Plataforma: business_id = null)
    const { logAuditAction } = await import("@/lib/audit/audit-service");
    await logAuditAction({
      businessId: null,
      userId: adminUserId || null,
      action: "delete",
      entityType: "platform_expense",
      entityId: id,
      metadata: { original_action: "delete_platform_expense", id },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al eliminar el egreso" };
  }
}
