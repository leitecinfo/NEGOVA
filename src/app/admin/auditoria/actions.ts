"use server";

import { getCurrentUserAuthorization } from "@/lib/auth/authorization";
import { getAuditLogsList } from "@/lib/audit/audit-service";
import { AuditFilterParams } from "@/lib/audit/types";

export async function fetchAuditLogsAction(params: AuditFilterParams) {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, error: "Acceso no autorizado", data: null };
  }

  const result = await getAuditLogsList(params);
  return { success: true, data: result };
}

export async function fetchAuditFilterUsersAction() {
  const auth = await getCurrentUserAuthorization();
  if (!auth || !auth.isPlatformUser) {
    return { success: false, data: [] };
  }

  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) return { success: false, data: [] };

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: users } = await admin
      .from("users")
      .select("id, email, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    const mapped = (users || []).map((u: any) => {
      const name = u.profiles?.full_name;
      return {
        id: u.id,
        label: name ? `${name} (${u.email})` : u.email || u.id.slice(0, 8),
      };
    });

    return { success: true, data: mapped };
  } catch {
    return { success: false, data: [] };
  }
}
