import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUserContext {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: "super_admin" | "admin" | "business_owner" | "staff" | "customer";
  status: string;
  isSuperAdmin: boolean;
}

/**
 * Obtiene y valida la sesión de administrador en el entorno Server-Side.
 * Si el usuario no está autenticado o no cuenta con privilegios de plataforma,
 * redirige automáticamente a la pantalla de login.
 */
export async function requireAdminSession(): Promise<AdminUserContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?error=session_required");
  }

  // 1. Obtener perfil e identidad desde public.users y public.profiles
  let userRecord: { platform_role: string; status: string } | null = null;
  let profileRecord: { full_name: string | null; avatar_url: string | null } | null = null;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
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
        : (userRecord?.platform_role || "customer");

  const role = resolvedRole as AdminUserContext["role"];
  const status = userRecord?.status || "active";

  // 2. Control estricto de acceso a nivel servidor para la plataforma
  const isAuthorized = (role === "super_admin" || role === "admin") && status === "active";

  if (!isAuthorized) {
    // Si no tiene privilegios de plataforma interna, redirigir
    redirect("/login?error=unauthorized");
  }

  const fullName = profileRecord?.full_name?.trim() || user.email?.split("@")[0] || "Administrador";

  return {
    id: user.id,
    email: user.email || "",
    fullName,
    avatarUrl: profileRecord?.avatar_url || null,
    role,
    status,
    isSuperAdmin: role === "super_admin",
  };
}
