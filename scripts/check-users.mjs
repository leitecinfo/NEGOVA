import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: authUsers, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  console.log("=== AUTH USERS ===");
  for (const u of authUsers.users) {
    console.log({
      id: u.id,
      email: u.email,
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
    });
  }

  const { data: dbUsers, error: dbErr } = await supabaseAdmin.from("users").select("*");
  console.log("=== DB USERS ===");
  console.log(dbUsers);
}

main().catch(console.error);
