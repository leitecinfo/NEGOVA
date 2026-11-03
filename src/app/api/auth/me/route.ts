import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface AuthMeResponse {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    role: string;
    roleLabel: string;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    dashboardUrl: string;
  } | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<AuthMeResponse>({
        authenticated: false,
        user: null,
      });
    }

    let userRecord: { platform_role?: string | null; status?: string | null } | null = null;
    let profileRecord: { full_name?: string | null; avatar_url?: string | null } | null = null;
    let supabaseAdmin: any = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const [userRes, profileRes] = await Promise.all([
        supabaseAdmin
          .from("users")
          .select("platform_role, status")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      userRecord = userRes.data;
      profileRecord = profileRes.data;
    } else {
      const [userRes, profileRes] = await Promise.all([
        supabase
          .from("users")
          .select("platform_role, status")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      userRecord = userRes.data;
      profileRecord = profileRes.data;
    }

    const authRole = user.app_metadata?.role || user.user_metadata?.role;
    const resolvedRole =
      userRecord?.platform_role === "super_admin" || userRecord?.platform_role === "admin"
        ? userRecord.platform_role
        : authRole === "super_admin" || authRole === "admin"
        ? authRole
        : userRecord?.platform_role || "customer";

    const isSuperAdmin = resolvedRole === "super_admin";
    const isAdmin = resolvedRole === "admin" || isSuperAdmin;

    let roleLabel = "Cliente";
    if (isSuperAdmin) {
      roleLabel = "Super Admin";
    } else if (resolvedRole === "admin") {
      roleLabel = "Administrador";
    } else if (resolvedRole === "business_owner") {
      roleLabel = "Propietario";
    } else if (resolvedRole === "staff") {
      roleLabel = "Colaborador";
    }

    const fullName =
      profileRecord?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      user.email?.split("@")[0] ||
      "Usuario";

    const avatarUrl =
      profileRecord?.avatar_url ||
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    let dashboardUrl = isAdmin ? "/admin" : "/dashboard";

    if (!isAdmin) {
      const { getUserActiveBusinessId } = await import("@/lib/auth/workspace-context");
      const userBizId = await getUserActiveBusinessId(user.id);
      if (userBizId) {
        dashboardUrl = `/workspace/${userBizId}`;
        try {
          const clientForRole = supabaseAdmin || supabase;
          const { data: memberData } = await clientForRole
            .from("business_users")
            .select("roles(id, code, name)")
            .eq("business_id", userBizId)
            .eq("user_id", user.id)
            .maybeSingle();

          const rData = Array.isArray(memberData?.roles) ? memberData?.roles[0] : memberData?.roles;
          if (rData?.code === "owner") {
            roleLabel = "Propietario";
          } else if (rData?.name) {
            roleLabel = rData.name;
          }
        } catch {
          // Mantener roleLabel si falla consulta
        }
      } else {
        dashboardUrl = "/login?error=no_active_business";
      }
    }

    return NextResponse.json<AuthMeResponse>({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email || "",
        fullName,
        avatarUrl,
        role: resolvedRole,
        roleLabel,
        isSuperAdmin,
        isAdmin,
        dashboardUrl,
      },
    });
  } catch (err) {
    console.error("Error in /api/auth/me:", err);
    return NextResponse.json<AuthMeResponse>({
      authenticated: false,
      user: null,
    });
  }
}
