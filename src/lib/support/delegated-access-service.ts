import { createClient } from "@/lib/supabase/server";
import { logAuditAction } from "@/lib/audit/audit-service";
import { sendAdminAccessRequestEmail } from "@/lib/email/resend";

export type AdminGrantChannel = "in_app" | "manual_whatsapp";
export type AdminGrantStatus = "pending" | "approved" | "rejected" | "expired" | "revoked";
export type AdminGrantScope =
  | "orders_read"
  | "sales_read"
  | "inventory_read"
  | "finance_read"
  | "settings_read";

export interface AdminAccessGrant {
  id: string;
  ticketId: string;
  ticketNumber?: string;
  businessId: string;
  businessName?: string;
  requestedBy: string;
  requesterName?: string;
  approvedBy?: string | null;
  approverName?: string | null;
  grantChannel: AdminGrantChannel;
  status: AdminGrantStatus;
  scope: AdminGrantScope;
  targetResourceType: string;
  targetResourceId?: string | null;
  reason: string;
  whatsappEvidenceRef?: string | null;
  verifiedPhone?: string | null;
  durationHours: number;
  validFrom?: string | null;
  validUntil?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccessLog {
  id: string;
  grantId: string;
  businessId: string;
  adminUserId: string;
  adminUserName?: string;
  resourceName: string;
  accessedRecordId?: string | null;
  queryFilters?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
  accessedAt: string;
}

export const SCOPE_LABELS: Record<AdminGrantScope, string> = {
  orders_read: "Lectura de Pedidos y Comandas",
  sales_read: "Lectura de Ventas y Comprobantes",
  inventory_read: "Lectura de Inventario y Catálogo",
  finance_read: "Lectura de Finanzas y Caja",
  settings_read: "Lectura de Configuración del Negocio",
};

/**
 * Obtiene el cliente Supabase Admin para operaciones con privilegios de sistema
 */
async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return await createClient();
}

/**
 * 1. Solicita acceso administrativo in-app (creado por personal de soporte)
 */
export async function requestAdminAccess(params: {
  ticketId: string;
  businessId: string;
  requestedBy: string;
  scope: AdminGrantScope;
  targetResourceType?: string;
  targetResourceId?: string | null;
  reason: string;
  durationHours?: number;
}): Promise<{ success: boolean; grant?: AdminAccessGrant; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const duration = Math.min(Math.max(params.durationHours || 2, 1), 8);

    // 1. Validar que el solicitante sea personal de plataforma
    const { data: requester } = await admin
      .from("users")
      .select("id, name, email, platform_role, status")
      .eq("id", params.requestedBy)
      .maybeSingle();

    if (!requester || requester.status !== "active") {
      return { success: false, error: "Usuario solicitante no válido o inactivo." };
    }

    if (!["super_admin", "admin", "soporte"].includes(requester.platform_role)) {
      return { success: false, error: "Solo personal de soporte o administración puede solicitar acceso técnico." };
    }

    // 2. Validar que el ticket pertenezca al negocio
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, ticket_number, business_id, status")
      .eq("id", params.ticketId)
      .maybeSingle();

    if (!ticket) {
      return { success: false, error: "El ticket de soporte no existe." };
    }

    if (ticket.business_id !== params.businessId) {
      return { success: false, error: "El ticket no corresponde al negocio especificado." };
    }

    if (ticket.status === "closed" || ticket.status === "resolved") {
      return { success: false, error: "No se puede solicitar acceso sobre un ticket resuelto o cerrado." };
    }

    // 3. Obtener información del negocio y su dueño
    const { data: business } = await admin
      .from("businesses")
      .select("id, name, email, phone")
      .eq("id", params.businessId)
      .maybeSingle();

    if (!business) {
      return { success: false, error: "Negocio no encontrado." };
    }

    // 4. Insertar la solicitud de grant
    const grantPayload = {
      ticket_id: params.ticketId,
      business_id: params.businessId,
      requested_by: params.requestedBy,
      grant_channel: "in_app" as const,
      status: "pending" as const,
      scope: params.scope,
      target_resource_type: params.targetResourceType || "general",
      target_resource_id: params.targetResourceId || null,
      reason: params.reason.trim(),
      duration_hours: duration,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newGrant, error: insertError } = await admin
      .from("admin_access_grants")
      .insert(grantPayload)
      .select("*")
      .single();

    if (insertError || !newGrant) {
      console.error("❌ Error al insertar admin_access_grant:", insertError);
      return { success: false, error: insertError?.message || "Error al registrar la solicitud." };
    }

    // 5. Notificar in-app al dueño del negocio
    try {
      await admin.from("platform_notifications").insert({
        business_id: params.businessId,
        type: "security_alert",
        title: "Solicitud de asistencia técnica",
        message: `${requester.name || requester.email} solicita acceso de lectura temporal (${SCOPE_LABELS[params.scope]}) para el ticket ${ticket.ticket_number}.`,
        link: `/workspace/${params.businessId}/configuracion`,
        read: false,
        metadata: {
          grant_id: newGrant.id,
          ticket_id: params.ticketId,
          scope: params.scope,
        },
      });
    } catch (notifErr) {
      console.warn("⚠️ No se pudo registrar la notificación in-app:", notifErr);
    }

    // 6. Enviar correo transaccional al dueño (no bloqueante)
    try {
      // Buscar el correo del dueño
      const { data: ownerUser } = await admin
        .from("business_users")
        .select("user_id, users(id, name, email)")
        .eq("business_id", params.businessId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const ownerEmail = (ownerUser?.users as any)?.email || business.email;
      const ownerName = (ownerUser?.users as any)?.name || "Propietario";

      if (ownerEmail) {
        await sendAdminAccessRequestEmail({
          to: ownerEmail,
          ownerName,
          businessName: business.name,
          requesterName: requester.name || requester.email,
          ticketNumber: ticket.ticket_number,
          scopeLabel: SCOPE_LABELS[params.scope],
          durationHours: duration,
          reason: params.reason,
          workspaceUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/workspace/${params.businessId}/configuracion`,
        });
      }
    } catch (emailErr) {
      console.warn("⚠️ No se pudo enviar el correo de solicitud de acceso:", emailErr);
    }

    // 7. Auditoría
    await logAuditAction({
      action: "create",
      entityType: "admin_access_grant",
      entityId: newGrant.id,
      businessId: params.businessId,
      userId: params.requestedBy,
      newData: { ...grantPayload, id: newGrant.id },
      metadata: {
        original_action: "request_admin_access",
        ticketNumber: ticket.ticket_number,
        scope: params.scope,
        durationHours: duration,
      },
    });

    return {
      success: true,
      grant: {
        id: newGrant.id,
        ticketId: newGrant.ticket_id,
        ticketNumber: ticket.ticket_number,
        businessId: newGrant.business_id,
        businessName: business.name,
        requestedBy: newGrant.requested_by,
        requesterName: requester.name || requester.email,
        grantChannel: newGrant.grant_channel,
        status: newGrant.status,
        scope: newGrant.scope,
        targetResourceType: newGrant.target_resource_type,
        targetResourceId: newGrant.target_resource_id,
        reason: newGrant.reason,
        durationHours: newGrant.duration_hours,
        createdAt: newGrant.created_at,
        updatedAt: newGrant.updated_at,
      },
    };
  } catch (err: any) {
    console.error("❌ Excepción en requestAdminAccess:", err);
    return { success: false, error: err?.message || "Error inesperado al solicitar acceso." };
  }
}

/**
 * 2. Aprueba una solicitud de acceso in-app (ejecutado por el Dueño del negocio)
 */
export async function approveAdminAccess(params: {
  grantId: string;
  approvedBy: string;
}): Promise<{ success: boolean; grant?: AdminAccessGrant; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    // 1. Obtener el grant
    const { data: grant } = await admin
      .from("admin_access_grants")
      .select("*, support_tickets(ticket_number), businesses(name)")
      .eq("id", params.grantId)
      .maybeSingle();

    if (!grant) {
      return { success: false, error: "Solicitud de autorización no encontrada." };
    }

    if (grant.status !== "pending") {
      return { success: false, error: `La solicitud ya no está pendiente (estado actual: ${grant.status}).` };
    }

    // 2. Validar que quien aprueba sea estrictamente el dueño (owner) activo del negocio
    const { data: approverMembership } = await admin
      .from("business_users")
      .select("id, status, roles(code)")
      .eq("business_id", grant.business_id)
      .eq("user_id", params.approvedBy)
      .maybeSingle();

    const roleCode = (approverMembership?.roles as any)?.code;
    if (!approverMembership || approverMembership.status !== "active" || roleCode !== "owner") {
      return { success: false, error: "Solo el dueño (propietario) del negocio puede autorizar el acceso técnico." };
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + grant.duration_hours * 60 * 60 * 1000);

    const updatePayload = {
      status: "approved" as const,
      approved_by: params.approvedBy,
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data: updatedGrant, error: updateError } = await admin
      .from("admin_access_grants")
      .update(updatePayload)
      .eq("id", params.grantId)
      .select("*")
      .single();

    if (updateError || !updatedGrant) {
      return { success: false, error: updateError?.message || "Error al aprobar la autorización." };
    }

    // Auditoría
    await logAuditAction({
      action: "status_change",
      entityType: "admin_access_grant",
      entityId: grant.id,
      businessId: grant.business_id,
      userId: params.approvedBy,
      oldData: { status: "pending" },
      newData: { status: "approved", valid_from: updatePayload.valid_from, valid_until: updatePayload.valid_until },
      metadata: {
        original_action: "approve_admin_access",
        grantId: grant.id,
        ticketId: grant.ticket_id,
        scope: grant.scope,
      },
    });

    return {
      success: true,
      grant: {
        id: updatedGrant.id,
        ticketId: updatedGrant.ticket_id,
        ticketNumber: (grant.support_tickets as any)?.ticket_number,
        businessId: updatedGrant.business_id,
        businessName: (grant.businesses as any)?.name,
        requestedBy: updatedGrant.requested_by,
        approvedBy: updatedGrant.approved_by,
        grantChannel: updatedGrant.grant_channel,
        status: updatedGrant.status,
        scope: updatedGrant.scope,
        targetResourceType: updatedGrant.target_resource_type,
        targetResourceId: updatedGrant.target_resource_id,
        reason: updatedGrant.reason,
        durationHours: updatedGrant.duration_hours,
        validFrom: updatedGrant.valid_from,
        validUntil: updatedGrant.valid_until,
        createdAt: updatedGrant.created_at,
        updatedAt: updatedGrant.updated_at,
      },
    };
  } catch (err: any) {
    console.error("❌ Excepción en approveAdminAccess:", err);
    return { success: false, error: err?.message || "Error al autorizar el acceso." };
  }
}

/**
 * 3. Rechaza una solicitud de acceso (por el Dueño o por el Administrador solicitante)
 */
export async function rejectAdminAccess(params: {
  grantId: string;
  userId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    const { data: grant } = await admin
      .from("admin_access_grants")
      .select("*")
      .eq("id", params.grantId)
      .maybeSingle();

    if (!grant) {
      return { success: false, error: "Solicitud no encontrada." };
    }

    if (grant.status !== "pending") {
      return { success: false, error: `No se puede rechazar una solicitud en estado ${grant.status}.` };
    }

    const { error: updateError } = await admin
      .from("admin_access_grants")
      .update({
        status: "rejected",
        revoke_reason: params.reason || "Rechazado por el usuario",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.grantId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Auditoría
    await logAuditAction({
      action: "status_change",
      entityType: "admin_access_grant",
      entityId: grant.id,
      businessId: grant.business_id,
      userId: params.userId,
      oldData: { status: "pending" },
      newData: { status: "rejected" },
      metadata: { original_action: "reject_admin_access", reason: params.reason },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al rechazar solicitud." };
  }
}

/**
 * 4. Registra una autorización recibida por WhatsApp (registro manual por el agente)
 */
export async function registerWhatsAppAccess(params: {
  ticketId: string;
  businessId: string;
  registeredBy: string;
  scope: AdminGrantScope;
  targetResourceType?: string;
  targetResourceId?: string | null;
  reason: string;
  whatsappEvidenceRef: string;
  verifiedPhone: string;
  durationHours?: number;
}): Promise<{ success: boolean; grant?: AdminAccessGrant; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();
    const duration = Math.min(Math.max(params.durationHours || 2, 1), 8);

    // 1. Validar que quien registra sea personal de plataforma
    const { data: agent } = await admin
      .from("users")
      .select("id, name, email, platform_role, status")
      .eq("id", params.registeredBy)
      .maybeSingle();

    if (!agent || agent.status !== "active" || !["super_admin", "admin", "soporte"].includes(agent.platform_role)) {
      return { success: false, error: "Solo personal de soporte puede registrar autorizaciones manuales." };
    }

    // 2. Validar ticket y negocio
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, ticket_number, business_id, status")
      .eq("id", params.ticketId)
      .maybeSingle();

    if (!ticket || ticket.business_id !== params.businessId) {
      return { success: false, error: "El ticket no corresponde al negocio especificado." };
    }

    if (ticket.status === "closed" || ticket.status === "resolved") {
      return { success: false, error: "No se puede registrar autorización sobre un ticket resuelto o cerrado." };
    }

    // 3. Validar evidencias requeridas
    if (!params.whatsappEvidenceRef || params.whatsappEvidenceRef.trim().length < 3) {
      return { success: false, error: "Se requiere una referencia o identificador de evidencia de WhatsApp válido." };
    }

    if (!params.verifiedPhone || params.verifiedPhone.trim().length < 6) {
      return { success: false, error: "Se requiere el número de teléfono verificado del cliente." };
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + duration * 60 * 60 * 1000);

    const grantPayload = {
      ticket_id: params.ticketId,
      business_id: params.businessId,
      requested_by: params.registeredBy,
      approved_by: null, // Consentimiento manual externo, no autenticado in-app
      grant_channel: "manual_whatsapp" as const,
      status: "approved" as const,
      scope: params.scope,
      target_resource_type: params.targetResourceType || "general",
      target_resource_id: params.targetResourceId || null,
      reason: params.reason.trim(),
      whatsapp_evidence_ref: params.whatsappEvidenceRef.trim(),
      verified_phone: params.verifiedPhone.trim(),
      duration_hours: duration,
      valid_from: now.toISOString(),
      valid_until: validUntil.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data: newGrant, error: insertError } = await admin
      .from("admin_access_grants")
      .insert(grantPayload)
      .select("*")
      .single();

    if (insertError || !newGrant) {
      return { success: false, error: insertError?.message || "Error al registrar la autorización por WhatsApp." };
    }

    // Auditoría estricta de registro manual
    await logAuditAction({
      action: "create",
      entityType: "admin_access_grant",
      entityId: newGrant.id,
      businessId: params.businessId,
      userId: params.registeredBy,
      newData: { ...grantPayload, id: newGrant.id },
      metadata: {
        original_action: "register_whatsapp_admin_access",
        channel: "manual_whatsapp",
        verifiedPhone: params.verifiedPhone,
        evidenceRef: params.whatsappEvidenceRef,
        disclaimer: "Autorización manual externa declarada por el agente. No verificada criptográficamente in-app.",
      },
    });

    return {
      success: true,
      grant: {
        id: newGrant.id,
        ticketId: newGrant.ticket_id,
        ticketNumber: ticket.ticket_number,
        businessId: newGrant.business_id,
        requestedBy: newGrant.requested_by,
        requesterName: agent.name || agent.email,
        grantChannel: newGrant.grant_channel,
        status: newGrant.status,
        scope: newGrant.scope,
        targetResourceType: newGrant.target_resource_type,
        targetResourceId: newGrant.target_resource_id,
        reason: newGrant.reason,
        whatsappEvidenceRef: newGrant.whatsapp_evidence_ref,
        verifiedPhone: newGrant.verified_phone,
        durationHours: newGrant.duration_hours,
        validFrom: newGrant.valid_from,
        validUntil: newGrant.valid_until,
        createdAt: newGrant.created_at,
        updatedAt: newGrant.updated_at,
      },
    };
  } catch (err: any) {
    console.error("❌ Excepción en registerWhatsAppAccess:", err);
    return { success: false, error: err?.message || "Error al registrar autorización de WhatsApp." };
  }
}

/**
 * 5. Revoca un acceso administrativo (Kill-switch por el Dueño o Soporte)
 */
export async function revokeAdminAccess(params: {
  grantId: string;
  revokedBy: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    const { data: grant } = await admin
      .from("admin_access_grants")
      .select("*")
      .eq("id", params.grantId)
      .maybeSingle();

    if (!grant) {
      return { success: false, error: "Autorización no encontrada." };
    }

    if (grant.status === "revoked" || grant.status === "expired") {
      return { success: true }; // Ya no está activo
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from("admin_access_grants")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        revoked_by: params.revokedBy,
        revoke_reason: params.reason || "Acceso revocado por el usuario",
        updated_at: nowIso,
      })
      .eq("id", params.grantId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Auditoría
    await logAuditAction({
      action: "status_change",
      entityType: "admin_access_grant",
      entityId: grant.id,
      businessId: grant.business_id,
      userId: params.revokedBy,
      oldData: { status: grant.status },
      newData: { status: "revoked", revoked_at: nowIso },
      metadata: { original_action: "revoke_admin_access", reason: params.reason },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al revocar acceso." };
  }
}

/**
 * 6. Revocación automática al cerrar o resolver un ticket de soporte
 */
export async function revokeAllGrantsForTicket(
  ticketId: string,
  revocationReason: string = "Ticket de soporte finalizado"
): Promise<{ success: boolean; revokedCount: number }> {
  try {
    const admin = await getSupabaseAdminClient();

    const { data: activeGrants } = await admin
      .from("admin_access_grants")
      .select("id, business_id")
      .eq("ticket_id", ticketId)
      .in("status", ["approved", "pending"]);

    if (!activeGrants || activeGrants.length === 0) {
      return { success: true, revokedCount: 0 };
    }

    const nowIso = new Date().toISOString();
    await admin
      .from("admin_access_grants")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        revoke_reason: revocationReason,
        updated_at: nowIso,
      })
      .eq("ticket_id", ticketId)
      .in("status", ["approved", "pending"]);

    return { success: true, revokedCount: activeGrants.length };
  } catch (err: any) {
    console.error("❌ Error revocando grants por cierre de ticket:", err);
    return { success: false, revokedCount: 0 };
  }
}

/**
 * 7. Valida si existe un grant activo y vigente para una operación administrativa
 */
export async function validateActiveGrant(params: {
  grantId?: string;
  businessId: string;
  adminUserId: string;
  requiredScope: AdminGrantScope;
  targetResourceId?: string | null;
}): Promise<{ valid: boolean; grant?: AdminAccessGrant; reason?: string }> {
  try {
    const admin = await getSupabaseAdminClient();

    let query = admin
      .from("admin_access_grants")
      .select("*")
      .eq("business_id", params.businessId)
      .eq("status", "approved")
      .is("revoked_at", null);

    if (params.grantId) {
      query = query.eq("id", params.grantId);
    } else {
      query = query.eq("requested_by", params.adminUserId);
    }

    const { data: grants } = await query;

    if (!grants || grants.length === 0) {
      return { valid: false, reason: "No existe una autorización administrativa activa para este negocio." };
    }

    const now = new Date();

    for (const rawGrant of grants) {
      // Validar caducidad en tiempo real
      if (rawGrant.valid_until && new Date(rawGrant.valid_until) < now) {
        // Marcar como expirado de forma asíncrona
        admin
          .from("admin_access_grants")
          .update({ status: "expired", updated_at: now.toISOString() })
          .eq("id", rawGrant.id)
          .then();
        continue;
      }

      // Validar coincidencia estricta de alcance (Principio de Mínimo Privilegio)
      if (rawGrant.scope !== params.requiredScope) {
        continue;
      }

      // Si el grant fue concedido para un recurso específico (ej. un pedido concreto):
      if (rawGrant.target_resource_id) {
        // La consulta DEBE solicitar ese recurso específico. No se permite listar todos los registros.
        if (!params.targetResourceId || params.targetResourceId !== rawGrant.target_resource_id) {
          continue;
        }
      }

      return {
        valid: true,
        grant: {
          id: rawGrant.id,
          ticketId: rawGrant.ticket_id,
          businessId: rawGrant.business_id,
          requestedBy: rawGrant.requested_by,
          approvedBy: rawGrant.approved_by,
          grantChannel: rawGrant.grant_channel,
          status: rawGrant.status,
          scope: rawGrant.scope,
          targetResourceType: rawGrant.target_resource_type,
          targetResourceId: rawGrant.target_resource_id,
          reason: rawGrant.reason,
          durationHours: rawGrant.duration_hours,
          validFrom: rawGrant.valid_from,
          validUntil: rawGrant.valid_until,
          createdAt: rawGrant.created_at,
          updatedAt: rawGrant.updated_at,
        },
      };
    }

    return { valid: false, reason: "La autorización no cubre el alcance solicitado o ha expirado." };
  } catch (err: any) {
    console.error("❌ Excepción en validateActiveGrant:", err);
    return { valid: false, reason: "Error al validar la autorización administrativa." };
  }
}

/**
 * 8. Registra obligatoriamente la consulta forense de lectura.
 * Si este registro falla, arroja un error para impedir la fuga de datos no auditados.
 */
export async function logAdminAccess(params: {
  grantId: string;
  businessId: string;
  adminUserId: string;
  resourceName: string;
  accessedRecordId?: string | null;
  queryFilters?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const admin = await getSupabaseAdminClient();

  const logPayload = {
    grant_id: params.grantId,
    business_id: params.businessId,
    admin_user_id: params.adminUserId,
    resource_name: params.resourceName,
    accessed_record_id: params.accessedRecordId || null,
    query_filters: params.queryFilters || {},
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    accessed_at: new Date().toISOString(),
  };

  const { error } = await admin.from("admin_access_logs").insert(logPayload);

  if (error) {
    console.error("🚨 FALLO CRÍTICO DE AUDITORÍA: No se pudo registrar admin_access_log:", error);
    throw new Error("Fallo de seguridad: No se pudo registrar la auditoría obligatoria de acceso.");
  }
}

/**
 * 9. Consulta los grants asociados a un ticket o a un negocio
 */
export async function getAdminAccessGrants(params: {
  ticketId?: string;
  businessId?: string;
}): Promise<AdminAccessGrant[]> {
  const admin = await getSupabaseAdminClient();

  let query = admin
    .from("admin_access_grants")
    .select(`
      *,
      support_tickets(ticket_number),
      businesses(name),
      users!admin_access_grants_requested_by_fkey(name, email)
    `)
    .order("created_at", { ascending: false });

  if (params.ticketId) {
    query = query.eq("ticket_id", params.ticketId);
  }
  if (params.businessId) {
    query = query.eq("business_id", params.businessId);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  return rows.map((r: any) => ({
    id: r.id,
    ticketId: r.ticket_id,
    ticketNumber: r.support_tickets?.ticket_number,
    businessId: r.business_id,
    businessName: r.businesses?.name,
    requestedBy: r.requested_by,
    requesterName: r.users?.name || r.users?.email,
    approvedBy: r.approved_by,
    grantChannel: r.grant_channel,
    status: r.status,
    scope: r.scope,
    targetResourceType: r.target_resource_type,
    targetResourceId: r.target_resource_id,
    reason: r.reason,
    whatsappEvidenceRef: r.whatsapp_evidence_ref,
    verifiedPhone: r.verified_phone,
    durationHours: r.duration_hours,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    revokedAt: r.revoked_at,
    revokeReason: r.revoke_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
