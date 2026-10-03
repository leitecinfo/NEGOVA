import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: user, error: getErr } = await supabaseAdmin.auth.admin.getUserById("fb3dd639-2033-4ee4-8208-88cbfb665a36");
  if (getErr || !user) {
    console.error("Error getting user:", getErr);
    return;
  }

  console.log("Current user:", user.user.email, user.user.app_metadata, user.user.user_metadata);

  const { data: updated, error: updErr } = await supabaseAdmin.auth.admin.updateUserById("fb3dd639-2033-4ee4-8208-88cbfb665a36", {
    app_metadata: {
      ...user.user.app_metadata,
      role: "super_admin",
    },
    user_metadata: {
      ...user.user.user_metadata,
      role: "super_admin",
      full_name: "Super Administrador",
    },
  });

  if (updErr) {
    console.error("Error updating user:", updErr);
    return;
  }

  console.log("Updated user:", updated.user.email, updated.user.app_metadata, updated.user.user_metadata);

  // Also ensure public.users has platform_role = 'super_admin' and status = 'active'
  const { error: dbErr } = await supabaseAdmin
    .from("users")
    .update({
      platform_role: "super_admin",
      status: "active",
      must_change_password: false,
    })
    .eq("id", "fb3dd639-2033-4ee4-8208-88cbfb665a36");

  if (dbErr) {
    console.error("Error updating db user:", dbErr);
  } else {
    console.log("DB user updated successfully!");
  }
}

main().catch(console.error);
