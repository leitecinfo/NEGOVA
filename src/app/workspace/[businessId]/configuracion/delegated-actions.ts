"use server";

import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import {
  approveAdminAccess,
  rejectAdminAccess,
  revokeAdminAccess,
  getAdminAccessGrants,
} from "@/lib/support/delegated-access-service";

/**
 * Lista las solicitudes y autorizaciones de acceso administrativo del negocio
 */
export async function getBusinessGrantsAction(businessId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado.", grants: [] };
  }

  try {
    const grants = await getAdminAccessGrants({ businessId });
    return { success: true, grants };
  } catch (err: any) {
    return { success: false, error: err?.message, grants: [] };
  }
}

/**
 * Aprueba una solicitud de acceso técnico desde el Workspace
 */
export async function approveBusinessGrantAction(grantId: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  return await approveAdminAccess({
    grantId,
    approvedBy: auth.userId,
  });
}

/**
 * Rechaza una solicitud de acceso técnico desde el Workspace
 */
export async function rejectBusinessGrantAction(grantId: string, reason?: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  return await rejectAdminAccess({
    grantId,
    userId: auth.userId,
    reason,
  });
}

/**
 * Revoca inmediatamente un acceso activo (Kill-switch del dueño)
 */
export async function revokeBusinessGrantAction(grantId: string, reason?: string) {
  const auth = await getCurrentUserAuthorization();
  if (!auth) {
    return { success: false, error: "No autenticado." };
  }

  return await revokeAdminAccess({
    grantId,
    revokedBy: auth.userId,
    reason: reason || "Acceso revocado por el dueño del negocio",
  });
}
