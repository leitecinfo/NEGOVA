"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { AnnualDiscountConfig } from "@/lib/subscriptions/types";
import { getAnnualDiscountConfig, saveAnnualDiscountConfig } from "@/lib/subscriptions/annual-discount-service";

export async function getAnnualDiscountAction(): Promise<AnnualDiscountConfig> {
  return await getAnnualDiscountConfig();
}

export async function updateAnnualDiscountAction(config: AnnualDiscountConfig) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "No autorizado. Solo administradores pueden modificar los descuentos de planes." };
  }

  const result = await saveAnnualDiscountConfig(config, auth.userId);
  if (result.success) {
    revalidatePath("/admin/planes");
    revalidatePath("/planes");
    revalidatePath("/");
  }

  return result;
}
