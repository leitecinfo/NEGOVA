"use server";

import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import {
  LoyaltyProgramConfig,
  CustomerLoyaltyAccount,
  LoyaltyTransaction,
  PointsRedemptionCalculation,
} from "@/lib/loyalty/types";
import {
  getLoyaltyProgramConfig,
  updateLoyaltyProgramConfig,
  getCustomerLoyaltyAccount,
  getCustomerLoyaltyHistory,
  adjustCustomerLoyaltyPoints,
  evaluatePointsRedemption,
} from "@/lib/loyalty/loyalty-service";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Consulta la configuración del programa de fidelización del negocio
 */
export async function getLoyaltyProgramConfigAction(
  businessId: string
): Promise<{ success: boolean; config?: LoyaltyProgramConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para ver configuración de fidelización." };
  }

  try {
    const config = await getLoyaltyProgramConfig(businessId);
    return { success: true, config };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener configuración de fidelización." };
  }
}

/**
 * Server Action: Modifica las reglas y parámetros del programa de fidelización
 */
export async function updateLoyaltyProgramConfigAction(
  businessId: string,
  input: Partial<LoyaltyProgramConfig>
): Promise<{ success: boolean; config?: LoyaltyProgramConfig; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para modificar el programa de fidelización." };
  }

  const result = await updateLoyaltyProgramConfig(businessId, input, auth.context.userId);
  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes`);
    revalidatePath(`/workspace/${businessId}/pos`);
    revalidatePath(`/workspace/${businessId}/configuracion`);
  }
  return result;
}

/**
 * Server Action: Consulta el saldo y resumen de puntos de fidelización de un cliente
 */
export async function getCustomerLoyaltyAccountAction(
  businessId: string,
  customerId: string
): Promise<{ success: boolean; account?: CustomerLoyaltyAccount; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para consultar puntos del cliente." };
  }

  try {
    const account = await getCustomerLoyaltyAccount(businessId, customerId);
    return { success: true, account };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener cuenta de fidelización." };
  }
}

/**
 * Server Action: Consulta el historial de movimientos de puntos de un cliente
 */
export async function getCustomerLoyaltyHistoryAction(
  businessId: string,
  customerId: string
): Promise<{ success: boolean; transactions?: LoyaltyTransaction[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para ver historial de puntos." };
  }

  try {
    const transactions = await getCustomerLoyaltyHistory(businessId, customerId);
    return { success: true, transactions };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al obtener historial de puntos." };
  }
}

/**
 * Server Action: Ajuste manual de puntos por parte de un administrador con trazabilidad auditada
 */
export async function adjustCustomerLoyaltyPointsAction(
  businessId: string,
  customerId: string,
  pointsDelta: number,
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.update");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para ajustar puntos de clientes." };
  }

  const result = await adjustCustomerLoyaltyPoints(
    businessId,
    customerId,
    pointsDelta,
    reason,
    auth.context.userId
  );

  if (result.success) {
    revalidatePath(`/workspace/${businessId}/clientes/${customerId}`);
  }

  return result;
}

/**
 * Server Action: Previsualiza y valida la redención de puntos en una comanda/venta
 */
export async function previewPointsRedemptionAction(
  businessId: string,
  customerId: string,
  pointsToRedeem: number,
  orderTotal: number
): Promise<{ success: boolean; calculation?: PointsRedemptionCalculation; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "customers.view");
  if (!auth.success || !auth.context) {
    return { success: false, error: auth.error || "No autorizado para evaluar puntos." };
  }

  try {
    const [config, account] = await Promise.all([
      getLoyaltyProgramConfig(businessId),
      getCustomerLoyaltyAccount(businessId, customerId),
    ]);

    const calculation = evaluatePointsRedemption(
      pointsToRedeem,
      account.pointsBalance,
      orderTotal,
      config
    );

    return { success: true, calculation };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al evaluar redención de puntos." };
  }
}

