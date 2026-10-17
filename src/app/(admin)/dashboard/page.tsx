import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserActiveBusinessId } from "@/lib/auth/workspace-context";

export default async function LegacyDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: dbUser } = await supabaseAdmin
    .from("users")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  const isPlatformUser =
    dbUser?.platform_role === "super_admin" ||
    dbUser?.platform_role === "admin" ||
    dbUser?.platform_role === "staff";

  if (isPlatformUser) {
    redirect("/admin");
  }

  const businessId = await getUserActiveBusinessId(user.id);
  if (businessId) {
    redirect(`/workspace/${businessId}`);
  }

  redirect("/login?error=no_active_business");
}
