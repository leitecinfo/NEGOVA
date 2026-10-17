"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import {
  getPlatformFinancialSummary,
  registerPlatformExpense,
  updatePlatformExpense,
  deletePlatformExpense,
} from "@/lib/finance/finance-service";
import { PlatformExpense, FinancialFilterParams } from "@/lib/finance/types";

export async function fetchFinancialSummaryAction(params?: FinancialFilterParams) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getPlatformFinancialSummary(params);
  return { success: true, data: result };
}

export async function registerExpenseAction(data: {
  category: PlatformExpense["category"];
  concept: string;
  amount: number;
  date?: string;
  receiptReference?: string;
  notes?: string;
}) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await registerPlatformExpense({
    ...data,
    adminUserId: auth.userId,
  });

  if (result.success) {
    revalidatePath("/admin/finanzas");
  }

  return result;
}

export async function updateExpenseAction(
  id: string,
  data: Partial<PlatformExpense>
) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await updatePlatformExpense(id, data, auth.userId);

  if (result.success) {
    revalidatePath("/admin/finanzas");
  }

  return result;
}

export async function deleteExpenseAction(id: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado" };
  }

  const result = await deletePlatformExpense(id, auth.userId);

  if (result.success) {
    revalidatePath("/admin/finanzas");
  }

  return result;
}
