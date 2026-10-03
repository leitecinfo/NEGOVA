import { AuditLogModel, AuditFilterParams, AuditLogsResult } from "./types";

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

const ACTION_LABELS: Record<string, { label: string; variant: AuditLogModel["actionVariant"] }> = {
  create_business: { label: "Creación de Negocio", variant: "create" },
  update_business: { label: "Actualización de Negocio", variant: "update" },
  suspend_business: { label: "Suspensión de Negocio", variant: "status" },
  activate_business: { label: "Activación de Negocio", variant: "status" },
  delete_business: { label: "Eliminación de Negocio", variant: "delete" },
  create_user: { label: "Creación de Usuario", variant: "create" },
  update_user: { label: "Actualización de Usuario", variant: "update" },
  update_user_status: { label: "Cambio de Estado de Usuario", variant: "status" },
  reset_user_password: { label: "Reseteo de Clave", variant: "security" },
  renew_subscription: { label: "Renovación de Suscripción", variant: "update" },
  extend_subscription: { label: "Extensión de Vigencia", variant: "update" },
  change_subscription_plan: { label: "Cambio de Plan", variant: "update" },
  suspend_subscription: { label: "Suspensión de Suscripción", variant: "status" },
  activate_subscription: { label: "Activación de Suscripción", variant: "status" },
  update_annual_discount_config: { label: "Ajuste de Descuento Anual", variant: "update" },
  lockout: { label: "Bloqueo por Seguridad", variant: "security" },
  security_lockout: { label: "Bloqueo por Fuerza Bruta", variant: "security" },
  login: { label: "Inicio de Sesión", variant: "security" },
};

export async function getAuditLogsList(params: AuditFilterParams = {}): Promise<AuditLogsResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize || 15));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const adminClient = await getSupabaseAdminClient();

    let query = adminClient
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (params.action && params.action !== "all") {
      query = query.eq("action", params.action);
    }

    if (params.entityType && params.entityType !== "all") {
      query = query.eq("entity_type", params.entityType);
    }

    if (params.userId && params.userId !== "all") {
      query = query.eq("user_id", params.userId);
    }

    if (params.startDate) {
      query = query.gte("created_at", params.startDate);
    }

    if (params.endDate) {
      query = query.lte("created_at", params.endDate);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`);
    }

    const { data: rows, count, error } = await query.range(from, to);

    if (error) {
      console.error("Error consultando audit_logs:", error);
      return getEmptyAuditResult(page, pageSize);
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Obtener nombres/emails de los usuarios autores de los logs
    const userIds = Array.from(
      new Set((rows || []).map((r) => r.user_id).filter(Boolean) as string[])
    );

    const userMap = new Map<string, { fullName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: usersData } = await adminClient
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds);

      (usersData || []).forEach((u) => {
        userMap.set(u.id, { fullName: u.full_name, email: u.email });
      });
    }

    // Calcular estadísticas globales
    const [secRes, bizRes, usrRes, subRes] = await Promise.all([
      adminClient.from("audit_logs").select("*", { count: "exact", head: true }).or("action.ilike.%lockout%,action.ilike.%security%,action.ilike.%login%"),
      adminClient.from("audit_logs").select("*", { count: "exact", head: true }).eq("entity_type", "business"),
      adminClient.from("audit_logs").select("*", { count: "exact", head: true }).eq("entity_type", "user"),
      adminClient.from("audit_logs").select("*", { count: "exact", head: true }).eq("entity_type", "subscription"),
    ]);

    const logs: AuditLogModel[] = (rows || []).map((r) => {
      const meta = ACTION_LABELS[r.action] || {
        label: r.action.replace(/_/g, " ").toUpperCase(),
        variant: "default" as const,
      };

      const user = r.user_id ? userMap.get(r.user_id) : null;

      return {
        id: r.id,
        userId: r.user_id,
        userName: user?.fullName || (r.user_id ? "Usuario ID: " + r.user_id.slice(0, 8) : "Sistema / Cron"),
        userEmail: user?.email,
        action: r.action,
        actionLabel: meta.label,
        actionVariant: meta.variant,
        entityType: r.entity_type || "general",
        entityId: r.entity_id,
        metadata: r.metadata,
        ipAddress: r.metadata?.ip || r.metadata?.ipAddress || null,
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
    console.error("Error al procesar getAuditLogsList:", err);
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
