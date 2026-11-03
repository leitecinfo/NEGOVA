"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { revalidatePath } from "next/cache";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilterParams,
  ExpenseItem,
  ExpenseKPIs,
  FinancialReport,
  UnifiedMovement,
  CreateMovementInput,
  MovementKPIs,
} from "@/lib/expenses/types";
import {
  createExpense,
  getExpensesList,
  getExpenseKPIs,
  getFinancialReport,
  updateExpense,
  deleteExpense,
  getDbClient,
  getUnifiedMovements,
  createUnifiedMovement,
  cancelUnifiedMovement,
} from "@/lib/expenses/expenses-service";
import { getActiveCashSession } from "@/lib/cash/cash-service";

/**
 * Consulta los gastos del comercio aplicando filtros.
 * Permiso requerido: expenses.view
 */
export async function getExpensesAction(
  businessId: string,
  filters?: Partial<ExpenseFilterParams>
): Promise<{ success: boolean; error?: string; data: ExpenseItem[] }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver gastos.",
      data: [],
    };
  }

  try {
    const list = await getExpensesList({
      businessId,
      ...filters,
    });
    return { success: true, data: list };
  } catch (err: any) {
    console.error("[getExpensesAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al consultar gastos.",
      data: [],
    };
  }
}

/**
 * Consulta los KPIs consolidados y márgenes de ganancia.
 * Permiso requerido: expenses.view
 */
export async function getExpenseKPIsAction(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; error?: string; data?: ExpenseKPIs }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver métricas de gastos.",
    };
  }

  try {
    const kpis = await getExpenseKPIs(businessId, startDate, endDate);
    return { success: true, data: kpis };
  } catch (err: any) {
    console.error("[getExpenseKPIsAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al calcular indicadores de gastos.",
    };
  }
}

/**
 * Registra un nuevo gasto operativo o de producción.
 * Permiso requerido: expenses.create
 */
export async function createExpenseAction(
  businessId: string,
  input: CreateExpenseInput
): Promise<{ success: boolean; error?: string; data?: ExpenseItem }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.create");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para registrar gastos.",
    };
  }

  try {
    const result = await createExpense(businessId, input, auth.context.userId);
    if (result.success) {
      revalidatePath(`/workspace/${businessId}/gastos`);
      revalidatePath(`/workspace/${businessId}/productos`);
      revalidatePath(`/workspace/${businessId}/cajas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return {
      success: result.success,
      error: result.error,
      data: result.expense,
    };
  } catch (err: any) {
    console.error("[createExpenseAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al registrar el gasto.",
    };
  }
}

/**
 * Modifica un gasto existente.
 * Permiso requerido: expenses.update
 */
export async function updateExpenseAction(
  businessId: string,
  expenseId: string,
  input: UpdateExpenseInput
): Promise<{ success: boolean; error?: string; data?: ExpenseItem }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.update");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para editar gastos.",
    };
  }

  try {
    const result = await updateExpense(businessId, expenseId, input);
    if (result.success) {
      revalidatePath(`/workspace/${businessId}/gastos`);
    }
    return {
      success: result.success,
      error: result.error,
      data: result.expense,
    };
  } catch (err: any) {
    console.error("[updateExpenseAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al actualizar el gasto.",
    };
  }
}

/**
 * Anula o elimina un gasto.
 * Permiso requerido: expenses.delete
 */
export async function deleteExpenseAction(
  businessId: string,
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.delete");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para eliminar gastos.",
    };
  }

  try {
    const result = await deleteExpense(businessId, expenseId);
    if (result.success) {
      revalidatePath(`/workspace/${businessId}/gastos`);
      revalidatePath(`/workspace/${businessId}/cajas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return result;
  } catch (err: any) {
    console.error("[deleteExpenseAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al anular el gasto.",
    };
  }
}

/**
 * Consulta proveedores y productos para vincular en el modal de nuevo gasto.
 */
export async function getSuppliersAndProductsForExpensesAction(businessId: string) {
  const auth = await verifyWorkspaceAction(businessId, "expenses.view");
  if (!auth.success || !auth.context) {
    return { success: false, suppliers: [], products: [] };
  }

  try {
    const supabase = await getDbClient();

    const [suppRes, prodRes] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("business_id", businessId)
        .order("name", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, cost, product_type")
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    return {
      success: true,
      suppliers: suppRes.data || [],
      products: prodRes.data || [],
    };
  } catch {
    return { success: false, suppliers: [], products: [] };
  }
}

/**
 * [GAS-003] Consulta el reporte financiero consolidado del comercio (Ingresos - Gastos = Resultado).
 * Permiso requerido: expenses.view
 */
export async function getFinancialReportAction(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; error?: string; data?: FinancialReport }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver reportes financieros.",
    };
  }

  try {
    const report = await getFinancialReport(businessId, startDate, endDate);
    return { success: true, data: report };
  } catch (err: any) {
    console.error("[getFinancialReportAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al generar reporte financiero.",
    };
  }
}

/**
 * Consulta la lista unificada de movimientos (Ingresos y Egresos).
 * Permiso requerido: expenses.view
 */
export async function getUnifiedMovementsAction(
  businessId: string,
  filters?: {
    flow?: "all" | "income" | "expense";
    category?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }
): Promise<{ success: boolean; error?: string; data: UnifiedMovement[] }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.view");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para ver movimientos.",
      data: [],
    };
  }

  try {
    const list = await getUnifiedMovements(businessId, filters);
    return { success: true, data: list };
  } catch (err: any) {
    console.error("[getUnifiedMovementsAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al consultar movimientos unificados.",
      data: [],
    };
  }
}

/**
 * Registra un nuevo movimiento unificado (Ingreso o Egreso).
 * Permiso requerido: expenses.create
 */
export async function createUnifiedMovementAction(
  businessId: string,
  input: CreateMovementInput
): Promise<{ success: boolean; error?: string; data?: UnifiedMovement }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.create");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para registrar movimientos.",
    };
  }

  try {
    const result = await createUnifiedMovement(businessId, input, auth.context.userId);
    if (result.success) {
      revalidatePath(`/workspace/${businessId}/gastos`);
      revalidatePath(`/workspace/${businessId}/cajas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return {
      success: result.success,
      error: result.error,
      data: result.movement,
    };
  } catch (err: any) {
    console.error("[createUnifiedMovementAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error inesperado al registrar el movimiento.",
    };
  }
}

/**
 * Anula un movimiento de ingreso o egreso.
 * Permiso requerido: expenses.delete
 */
export async function cancelUnifiedMovementAction(
  businessId: string,
  movementId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "expenses.delete");
  if (!auth.success || !auth.context) {
    return {
      success: false,
      error: auth.error || "No tienes autorización para anular movimientos.",
    };
  }

  try {
    const result = await cancelUnifiedMovement(businessId, movementId);
    if (result.success) {
      revalidatePath(`/workspace/${businessId}/gastos`);
      revalidatePath(`/workspace/${businessId}/cajas`);
      revalidatePath(`/workspace/${businessId}/pos`);
    }
    return result;
  } catch (err: any) {
    console.error("[cancelUnifiedMovementAction Error]:", err);
    return {
      success: false,
      error: err?.message || "Error al anular el movimiento.",
    };
  }
}

/**
 * Consulta si existe un turno activo de caja para mostrar información contextual al registrar ingresos/egresos.
 */
export async function getActiveCashSessionForMovementsAction(businessId: string) {
  try {
    const session = await getActiveCashSession(businessId);
    return {
      success: true,
      hasActiveSession: !!session,
      session: session
        ? {
            id: session.id,
            registerId: session.registerId,
            status: session.status,
            initialAmount: session.initialAmount,
          }
        : null,
    };
  } catch (err: any) {
    return {
      success: false,
      hasActiveSession: false,
      error: err?.message || "Error al consultar turno activo.",
    };
  }
}
