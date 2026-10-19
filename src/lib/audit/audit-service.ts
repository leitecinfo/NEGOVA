import { AuditLogModel, AuditFilterParams, AuditLogsResult, LogAuditActionParams, AuditActionType } from "./types";

const VALID_AUDIT_ACTIONS: readonly AuditActionType[] = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "status_change",
  "permission_change",
  "subscription_change",
  "other",
] as const;

const ACTION_LABELS: Record<string, { label: string; variant: AuditLogModel["actionVariant"] }> = {
  create: { label: "Creación", variant: "create" },
  update: { label: "Actualización", variant: "update" },
  delete: { label: "Eliminación", variant: "delete" },
  login: { label: "Inicio de Sesión", variant: "security" },
  logout: { label: "Cierre de Sesión", variant: "security" },
  status_change: { label: "Cambio de Estado", variant: "status" },
  permission_change: { label: "Modificación de Permisos", variant: "security" },
  subscription_change: { label: "Cambio de Suscripción", variant: "update" },
  other: { label: "Evento de Plataforma", variant: "default" },
};

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

/**
 * Valida si una cadena es un UUID v4 válido
 */
function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Normaliza cualquier acción de la aplicación a los valores válidos del enum `public.audit_action`.
 * Si la acción original es más descriptiva (ej: 'create_business', 'mfa_login_success'),
 * se mapea al enum PostgreSQL y la acción específica se preserva en metadata.
 */
function mapToAuditAction(rawAction: string): { action: AuditActionType; specificAction?: string } {
  const lower = (rawAction || "").toLowerCase().trim();

  if ((VALID_AUDIT_ACTIONS as readonly string[]).includes(lower)) {
    return { action: lower as AuditActionType };
  }

  // Mapeos inteligentes para preservar retrocompatibilidad
  if (lower.includes("login") || lower.includes("lockout") || lower.includes("auth")) {
    return { action: "login", specificAction: rawAction };
  }
  if (lower.includes("logout")) {
    return { action: "logout", specificAction: rawAction };
  }
  if (lower.includes("permission") || lower.includes("role")) {
    return { action: "permission_change", specificAction: rawAction };
  }
  if (lower.includes("status") || lower.includes("suspend") || lower.includes("activate")) {
    return { action: "status_change", specificAction: rawAction };
  }
  if (lower.includes("subscription")) {
    return { action: "subscription_change", specificAction: rawAction };
  }
  if (lower.startsWith("create") || lower.startsWith("register") || lower.startsWith("new")) {
    return { action: "create", specificAction: rawAction };
  }
  if (lower.startsWith("update") || lower.startsWith("edit") || lower.startsWith("renew") || lower.startsWith("extend")) {
    return { action: "update", specificAction: rawAction };
  }
  if (lower.startsWith("delete") || lower.startsWith("remove") || lower.startsWith("destroy")) {
    return { action: "delete", specificAction: rawAction };
  }

  return { action: "other", specificAction: rawAction };
}

/**
 * SERVICIO CENTRALIZADO DE AUDITORÍA: logAuditAction
 *
 * Registra un evento en `public.audit_logs` de forma NO BLOQUEANTE y append-only.
 * Nunca lanza excepciones que rompan el flujo de negocio principal.
 */
export async function logAuditAction(params: LogAuditActionParams): Promise<{ success: boolean; error?: string }> {
  if (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST)) {
    return { success: true };
  }
  try {
    const adminClient = await getSupabaseAdminClient();
    const { action, specificAction } = mapToAuditAction(params.action);

    const metadataPayload: Record<string, any> = {
      ...(params.metadata || {}),
      ...(params.description ? { description: params.description } : {}),
      ...(specificAction ? { original_action: specificAction } : {}),
    };

    if (params.businessName && !metadataPayload.business_name) {
      metadataPayload.business_name = params.businessName;
    } else if (params.businessId && isValidUuid(params.businessId) && !metadataPayload.business_name) {
      try {
        const { data: bData } = await adminClient.from("businesses").select("name").eq("id", params.businessId).single();
        if (bData?.name) {
          metadataPayload.business_name = bData.name;
        }
      } catch (e) {
        // Ignorar error al resolver nombre
      }
    }

    // entity_id en la base de datos es UUID. Si viene una cadena no-UUID (ej: slug, código de setting),
    // se envía null como UUID y se conserva en metadata.
    let validEntityId: string | null = null;
    if (params.entityId) {
      if (isValidUuid(params.entityId)) {
        validEntityId = params.entityId;
      } else {
        metadataPayload.original_entity_id = params.entityId;
      }
    }

    const insertPayload: Record<string, any> = {
      business_id: isValidUuid(params.businessId) ? params.businessId : null,
      user_id: isValidUuid(params.userId) ? params.userId : null,
      action,
      entity_type: params.entityType || null,
      entity_id: validEntityId,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      metadata: metadataPayload,
    };

    if (params.createdAt) {
      insertPayload.created_at = params.createdAt;
    }

    const { error } = await adminClient.from("audit_logs").insert(insertPayload);

    if (error) {
      console.warn("[Audit Warning] No se pudo guardar el registro de auditoría:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.warn("[Audit Warning] Excepción no bloqueante al registrar auditoría:", err?.message || err);
    return { success: false, error: err?.message || "Excepción de auditoría" };
  }
}

/**
 * Consulta de registros de auditoría para el panel administrativo o para la futura vista de negocio
 */
export async function getAuditLogsList(params: AuditFilterParams = {}): Promise<AuditLogsResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 15));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const adminClient = await getSupabaseAdminClient();

    let query = adminClient
      .from("audit_logs")
      .select("*, users(id, email, profiles(full_name)), businesses(id, name)", { count: "exact" })
      .order("created_at", { ascending: false });

    // Aislamiento Multi-Tenant por negocio si se especifica
    if (params.businessId) {
      query = query.eq("business_id", params.businessId);
    }

    // Filtro por acción exacta del enum PostgreSQL
    if (params.action && params.action !== "all") {
      const { action: normalizedAction } = mapToAuditAction(params.action);
      query = query.eq("action", normalizedAction);
    }

    // Filtro por entidad
    if (params.entityType && params.entityType !== "all") {
      query = query.eq("entity_type", params.entityType);
    }

    // Filtro por usuario
    if (params.userId && params.userId !== "all") {
      query = query.eq("user_id", params.userId);
    }

    // Filtro por rango de fechas
    if (params.startDate) {
      query = query.gte("created_at", params.startDate);
    }

    if (params.endDate) {
      query = query.lte("created_at", params.endDate);
    }

    // Búsqueda general segura compatible con PostgreSQL
    // (Buscamos sobre entity_type con ilike, y si coincide con acciones válidas filtramos por action.eq)
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const matchingActions = (VALID_AUDIT_ACTIONS as readonly string[]).filter((a) =>
        a.toLowerCase().includes(q.toLowerCase())
      );

      const orConditions: string[] = [
        `entity_type.ilike.*${q}*`,
        `metadata->>original_action.ilike.*${q}*`,
        `metadata->>business_name.ilike.*${q}*`
      ];
      matchingActions.forEach((act) => {
        orConditions.push(`action.eq.${act}`);
      });

      if (isValidUuid(q)) {
        orConditions.push(`entity_id.eq.${q}`);
        orConditions.push(`business_id.eq.${q}`);
        orConditions.push(`user_id.eq.${q}`);
      }

      query = query.or(orConditions.join(","));
    }

    const { data: rows, count, error } = await query.range(from, to);

    if (error) {
      console.error("[Audit Error] Error consultando audit_logs:", error);
      return getEmptyAuditResult(page, pageSize);
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Estadísticas globales optimizadas sin búsquedas ilike sobre enums
    let statsQueryBase: any = adminClient.from("audit_logs");
    if (params.businessId) {
      statsQueryBase = statsQueryBase.eq("business_id", params.businessId);
    }

    const [secRes, bizRes, usrRes, subRes] = await Promise.all([
      adminClient
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .in("action", ["login", "logout", "status_change", "permission_change"]),
      adminClient
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("entity_type", "business"),
      adminClient
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("entity_type", "user"),
      adminClient
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("entity_type", "subscription"),
    ]);

    const logs: AuditLogModel[] = (rows || []).map((r: any) => {
      const meta = ACTION_LABELS[r.action] || {
        label: (r.metadata?.original_action || r.action).replace(/_/g, " ").toUpperCase(),
        variant: "default" as const,
      };

      const user = r.users;
      const profile = user?.profiles;
      const userName = profile?.full_name || (user?.email ? user.email.split("@")[0] : r.user_id ? "Usuario " + r.user_id.slice(0, 8) : "Sistema / Cron");

      return {
        id: r.id,
        businessId: r.business_id,
        businessName: r.businesses?.name || r.metadata?.business_name || null,
        userId: r.user_id,
        userName,
        userEmail: user?.email || r.metadata?.email,
        action: r.metadata?.original_action || r.action,
        actionLabel: meta.label,
        actionVariant: meta.variant,
        entityType: r.entity_type || "general",
        entityId: r.entity_id || r.metadata?.original_entity_id || null,
        oldData: r.old_data,
        newData: r.new_data,
        metadata: r.metadata,
        ipAddress: r.ip_address || r.metadata?.ip || r.metadata?.ipAddress || null,
        userAgent: r.user_agent,
        createdAt: r.created_at,
      };
    });

    return {
      logs,
      totalCount,
      page,
      pageSize,
      totalPages,
      stats: {
        totalEvents: totalCount,
        securityEvents: secRes.count || 0,
        businessEvents: bizRes.count || 0,
        userEvents: usrRes.count || 0,
        subscriptionEvents: subRes.count || 0,
      },
    };
  } catch (err) {
    console.error("[Audit Error] Excepción procesando getAuditLogsList:", err);
    return getEmptyAuditResult(page, pageSize);
  }
}

function getEmptyAuditResult(page: number, pageSize: number): AuditLogsResult {
  return {
    logs: [],
    totalCount: 0,
    page,
    pageSize,
    totalPages: 1,
    stats: {
      totalEvents: 0,
      securityEvents: 0,
      businessEvents: 0,
      userEvents: 0,
      subscriptionEvents: 0,
    },
  };
}
