"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import {
  getPlatformFinancialSummary,
  registerPlatformExpense,
} from "@/lib/finance/finance-service";
import { PlatformExpense } from "@/lib/finance/types";

export async function fetchFinancialSummaryAction() {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getPlatformFinancialSummary();
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
