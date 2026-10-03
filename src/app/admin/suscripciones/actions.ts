"use server";

import { revalidatePath } from "next/cache";
import { verifyUserPermission } from "@/lib/auth/authorization";
import {
  getSubscriptionsList,
  renewOrExtendSubscription,
  changeSubscriptionStatus,
  changeSubscriptionPlan,
  SubscriptionFilterParams,
  SubscriptionsListResult,
  SubscriptionStatus,
} from "@/lib/subscriptions/subscriptions-service";
import { PlanId } from "@/config/plans";

/**
 * 1. SERVER ACTION: OBTENER LISTA DE SUSCRIPCIONES Y KPIS GLOBALES
 */
export async function getSubscriptionsListAction(
  params: SubscriptionFilterParams = {}
): Promise<SubscriptionsListResult> {
  try {
    await verifyUserPermission("subscriptions.view");
    return await getSubscriptionsList(params);
  } catch (err: any) {
    console.error("[getSubscriptionsListAction Error]:", err);
    return {
      subscriptions: [],
      totalCount: 0,
      page: 1,
      pageSize: 15,
      totalPages: 1,
      kpis: {
        total: 0,
        active: 0,
        trial: 0,
        expiringSoon: 0,
        suspendedOrPastDue: 0,
        monthlyEstimatedRevenue: 0,
      },
    };
  }
}

/**
 * 2. SERVER ACTION: RENOVAR O EXTENDER VIGENCIA DE SUSCRIPCIÓN
 * Se invoca tanto desde el módulo global Suscripciones como desde la ficha del negocio.
 */
export async function renewSubscriptionAction(
  businessIdOrSubId: string,
  months: number = 1,
  planId?: PlanId
): Promise<{ success: boolean; error?: string; periodEnd?: string }> {
  try {
    const actor = await verifyUserPermission("subscriptions.update");
    const result = await renewOrExtendSubscription(
      businessIdOrSubId,
      months,
      planId,
      actor.userId
    );

    if (result.success) {
      revalidatePath("/admin/suscripciones");
      revalidatePath("/admin/negocios");
      revalidatePath(`/admin/negocios/${businessIdOrSubId}`);
      revalidatePath("/admin");
    }

    return result;
  } catch (err: any) {
    console.error("[renewSubscriptionAction Error]:", err);
    return {
      success: false,
      error: err.message || "Acceso denegado o error al renovar la suscripción.",
    };
  }
}

/**
 * 3. SERVER ACTION: CAMBIAR ESTADO DE LA SUSCRIPCIÓN
 */
export async function changeSubscriptionStatusAction(
  subscriptionId: string,
  newStatus: SubscriptionStatus,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("subscriptions.update");
    const result = await changeSubscriptionStatus(
      subscriptionId,
      newStatus,
      reason,
      actor.userId
    );

    if (result.success) {
      revalidatePath("/admin/suscripciones");
      revalidatePath("/admin/negocios");
      revalidatePath("/admin");
    }

    return result;
  } catch (err: any) {
    console.error("[changeSubscriptionStatusAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible modificar el estado de la suscripción.",
    };
  }
}

/**
 * 4. SERVER ACTION: CAMBIAR PLAN DE LA SUSCRIPCIÓN (UPGRADE / DOWNGRADE)
 */
export async function changeSubscriptionPlanAction(
  subscriptionId: string,
  newPlanId: PlanId
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await verifyUserPermission("subscriptions.update");
    const result = await changeSubscriptionPlan(
      subscriptionId,
      newPlanId,
      actor.userId
    );

    if (result.success) {
      revalidatePath("/admin/suscripciones");
      revalidatePath("/admin/negocios");
      revalidatePath("/admin");
    }

    return result;
  } catch (err: any) {
    console.error("[changeSubscriptionPlanAction Error]:", err);
    return {
      success: false,
      error: err.message || "No fue posible actualizar el plan de la suscripción.",
    };
  }
}
