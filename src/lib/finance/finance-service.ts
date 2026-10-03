/**
 * DEUDA TÉCNICA DOCUMENTADA:
 * Actualmente la colección de egresos de plataforma se persiste en JSON dentro de `platform_settings` (key: "platform:expenses").
 * En una etapa posterior, se migrará a una tabla SQL relacional dedicada `public.platform_expenses`.
 * Toda lectura y mutación de gastos de NEGOVA está centralizada exclusivamente en este servicio.
 */

import { PlatformFinancialSummary, PlatformExpense } from "./types";
import { getBillingList } from "@/lib/billing/billing-service";
import { getSubscriptionsList } from "@/lib/subscriptions/subscriptions-service";

const SETTINGS_KEY = "platform:expenses";

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

let cachedExpenses: PlatformExpense[] = [];

const EXPENSE_CATEGORY_LABELS: Record<PlatformExpense["category"], string> = {
  infra: "Infraestructura & Base de Datos",
  api_services: "APIs & Servicios Externos",
  domain_hosting: "Dominio & Alojamiento Web",
  commissions: "Comisiones Bancarias / Pasarela",
  operations: "Operaciones & Soporte Técnico",
  other: "Otros Costos Operativos",
};

async function getAllExpenses(): Promise<PlatformExpense[]> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (!error && data && Array.isArray(data.value)) {
      cachedExpenses = data.value as PlatformExpense[];
      return cachedExpenses;
    }
  } catch (err) {
    console.error("Error al consultar gastos de plataforma:", err);
  }

  return cachedExpenses;
}

async function saveAllExpenses(expenses: PlatformExpense[]): Promise<boolean> {
  cachedExpenses = expenses;
  try {
    const admin = await getSupabaseAdminClient();
    const { error } = await admin.from("platform_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: expenses,
        description: "Registro de egresos y costos operativos de la plataforma SaaS NEGOVA",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    return !error;
  } catch (err) {
    console.error("Error al persistir gastos de plataforma:", err);
    return false;
  }
}

export async function getPlatformFinancialSummary(): Promise<PlatformFinancialSummary> {
  const [billingResult, subsResult, expenses] = await Promise.all([
    getBillingList({ pageSize: 100 }),
    getSubscriptionsList({ pageSize: 100 }),
    getAllExpenses(),
  ]);

  // 1. Ingresos Recurrentes Normalizados (SaaS)
  const mrrCOP = subsResult.kpis.monthlyEstimatedRevenue;
  const arrCOP = mrrCOP * 12;

  // 2. Flujo de Caja Real (Dinero efectivamente cobrado vs Dinero efectivamente gastado)
  const totalRevenueCollectedCOP = billingResult.stats.totalPaidCOP;
  const totalExpensesPaidCOP = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashFlowCOP = totalRevenueCollectedCOP - totalExpensesPaidCOP;

  // 3. Movimientos de caja consolidados
  const movements: PlatformFinancialSummary["recentMovements"] = [];

  billingResult.invoices
    .filter((inv) => inv.status === "paid" && inv.amount > 0)
    .forEach((inv) => {
      movements.push({
        id: inv.id,
        type: "income",
        concept: `Recaudo Suscripción Plan ${inv.planName}`,
        entityName: inv.businessName,
        amount: inv.amount,
        date: inv.paidAt || inv.issuedAt,
        reference: inv.invoiceNumber,
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

  movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    mrrCOP,
    arrCOP,
    activeSubscriptionsCount: subsResult.kpis.active,
    trialSubscriptionsCount: subsResult.kpis.trial,
    totalRevenueCollectedCOP,
    totalExpensesPaidCOP,
    netCashFlowCOP,
    recentMovements: movements.slice(0, 15),
    expenses,
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
    const all = await getAllExpenses();
    const newExpense: PlatformExpense = {
      id: "exp-" + crypto.randomUUID().slice(0, 8),
      category: data.category,
      categoryLabel: EXPENSE_CATEGORY_LABELS[data.category] || "Otros Egresos",
      concept: data.concept.trim(),
      amount: Math.max(0, Math.round(data.amount)),
      currency: "COP",
      date: data.date || new Date().toISOString(),
      receiptReference: data.receiptReference?.trim() || null,
      notes: data.notes?.trim() || null,
    };

    all.unshift(newExpense);
    await saveAllExpenses(all);

    // Auditoría
    try {
      const admin = await getSupabaseAdminClient();
      await admin.from("audit_logs").insert({
        action: "register_platform_expense",
        entity_type: "platform_expense",
        entity_id: newExpense.id,
        user_id: data.adminUserId || null,
        metadata: { concept: newExpense.concept, amount: newExpense.amount, category: newExpense.category },
      });
    } catch {}

    return { success: true, expense: newExpense };
  } catch (err: any) {
    return { success: false, error: err.message || "Error al registrar el egreso" };
  }
}
