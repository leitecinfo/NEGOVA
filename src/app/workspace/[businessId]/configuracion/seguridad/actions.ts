"use server";

import { revalidatePath } from "next/cache";
import { verifyWorkspaceAction } from "@/lib/auth/workspace-context";
import { logAuditAction } from "@/lib/audit/audit-service";
import {
  getUser2faStatus,
  initiateTotpEnrollment,
  confirmAndActivate2fa,
  disableUser2fa,
  generateRecoveryCodes,
  storeRecoveryCodes,
  hashRecoveryCode,
  getBusinessSecuritySettings,
  updateBusinessSecuritySettings,
  UserTwoFactorStatus,
  BusinessSecuritySettings,
  TotpEnrollmentData,
} from "@/lib/auth/two-factor-service";

export interface SecurityConfigViewData {
  userStatus: UserTwoFactorStatus;
  userEmail: string;
  isOwnerOrAdmin: boolean;
  businessSecurity: BusinessSecuritySettings;
}

/**
 * Server Action: Consulta la configuración consolidada de seguridad y 2FA [CONF-004]
 */
export async function getSecurityConfigAction(
  businessId: string
): Promise<{ success: boolean; data?: SecurityConfigViewData; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "No autorizado para consultar la configuración de seguridad." };
  }

  try {
    const userId = auth.context.userId;
    const userEmail = auth.context.userEmail || "";
    const isOwnerOrAdmin = Boolean(auth.context.isOwner || auth.context.isSuperAdmin || auth.context.roleCode === "admin");

    const [userStatus, businessSecurity] = await Promise.all([
      getUser2faStatus(userId),
      getBusinessSecuritySettings(businessId),
    ]);

    return {
      success: true,
      data: {
        userStatus,
        userEmail,
        isOwnerOrAdmin,
        businessSecurity,
      },
    };
  } catch (err: any) {
    console.error("[getSecurityConfigAction] Error:", err);
    return { success: false, error: err?.message || "Error al consultar la configuración de seguridad." };
  }
}

/**
 * Server Action: Inicia el registro TOTP generando secreto, QR y códigos de respaldo [CONF-004]
 */
export async function start2faEnrollmentAction(
  businessId: string
): Promise<{ success: boolean; data?: TotpEnrollmentData; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "Sesión no válida o expirada." };
  }

  try {
    const userId = auth.context.userId;
    const userEmail = auth.context.userEmail || "usuario@negova.com";
    const enrollmentData = await initiateTotpEnrollment(userId, userEmail);

    return {
      success: true,
      data: enrollmentData,
    };
  } catch (err: any) {
    console.error("[start2faEnrollmentAction] Error:", err);
    return { success: false, error: err?.message || "Error al iniciar el registro de 2FA." };
  }
}

/**
 * Server Action: Confirma el código de 6 dígitos y activa 2FA para el usuario [CONF-004]
 */
export async function confirm2faEnrollmentAction(
  businessId: string,
  factorId: string,
  secretBase32: string,
  code: string,
  rawRecoveryCodes: string[]
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "Sesión no válida." };
  }

  try {
    const userId = auth.context.userId;
    const res = await confirmAndActivate2fa(userId, factorId, secretBase32, code, rawRecoveryCodes);

    if (!res.success) {
      return res;
    }

    // Registrar en auditoría
    await logAuditAction({
      businessId,
      userId,
      action: "update",
      entityType: "account_security",
      entityId: userId,
      metadata: {
        event: "2fa_enabled",
        factorId,
        recoveryCodesCount: rawRecoveryCodes.length,
      },
    });

    revalidatePath(`/workspace/${businessId}/configuracion/seguridad`);
    return { success: true };
  } catch (err: any) {
    console.error("[confirm2faEnrollmentAction] Error:", err);
    return { success: false, error: err?.message || "Error al confirmar la activación de 2FA." };
  }
}

/**
 * Server Action: Desactiva la verificación en dos pasos del usuario [CONF-004]
 */
export async function disable2faAction(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "Sesión no válida." };
  }

  try {
    const userId = auth.context.userId;
    const res = await disableUser2fa(userId);

    if (!res.success) {
      return res;
    }

    await logAuditAction({
      businessId,
      userId,
      action: "update",
      entityType: "account_security",
      entityId: userId,
      metadata: {
        event: "2fa_disabled",
      },
    });

    revalidatePath(`/workspace/${businessId}/configuracion/seguridad`);
    return { success: true };
  } catch (err: any) {
    console.error("[disable2faAction] Error:", err);
    return { success: false, error: err?.message || "Error al desactivar 2FA." };
  }
}

/**
 * Server Action: Regenera códigos de respaldo para el usuario [CONF-004]
 */
export async function regenerateRecoveryCodesAction(
  businessId: string
): Promise<{ success: boolean; rawCodes?: string[]; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.view");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "Sesión no válida." };
  }

  try {
    const userId = auth.context.userId;
    const userStatus = await getUser2faStatus(userId);
    if (!userStatus.isEnabled) {
      return { success: false, error: "Debes tener 2FA activo para regenerar códigos de respaldo." };
    }

    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);
    await storeRecoveryCodes(userId, hashedCodes);

    await logAuditAction({
      businessId,
      userId,
      action: "update",
      entityType: "account_security",
      entityId: userId,
      metadata: {
        event: "recovery_codes_regenerated",
        count: rawCodes.length,
      },
    });

    revalidatePath(`/workspace/${businessId}/configuracion/seguridad`);
    return { success: true, rawCodes };
  } catch (err: any) {
    console.error("[regenerateRecoveryCodesAction] Error:", err);
    return { success: false, error: err?.message || "Error al regenerar códigos de respaldo." };
  }
}

/**
 * Server Action: Actualiza la política de obligatoriedad de 2FA para administradores [CONF-004]
 */
export async function updateBusiness2faEnforcementAction(
  businessId: string,
  require2faForAdmins: boolean
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyWorkspaceAction(businessId, "business_settings.update");
  if (!auth.success || !auth.context?.userId) {
    return { success: false, error: auth.error || "No autorizado para modificar las políticas del negocio." };
  }

  if (!auth.context.isOwner && !auth.context.isSuperAdmin) {
    return { success: false, error: "Solo el propietario o administrador principal puede cambiar esta política." };
  }

  try {
    const res = await updateBusinessSecuritySettings(businessId, { require2faForAdmins });
    if (!res.success) {
      return res;
    }

    await logAuditAction({
      businessId,
      userId: auth.context.userId,
      action: "update",
      entityType: "business_security_policy",
      entityId: businessId,
      metadata: {
        require2faForAdmins,
      },
    });

    revalidatePath(`/workspace/${businessId}/configuracion/seguridad`);
    return { success: true };
  } catch (err: any) {
    console.error("[updateBusiness2faEnforcementAction] Error:", err);
    return { success: false, error: err?.message || "Error al actualizar la política de seguridad." };
  }
}
