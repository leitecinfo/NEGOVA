import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
const getEnv = (key) => {
  const match = env.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match ? match[1].trim() : "";
};
const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const client = createClient(url, key);

async function run() {
  const { data: roles, error: rErr } = await client.from("roles").select("*");
  const { data: perms, error: pErr } = await client.from("permissions").select("*");
  const { data: rp, error: rpErr } = await client.from("role_permissions").select("role_id, permission_id, roles(code), permissions(code)");

  if (rErr) console.error("Roles error:", rErr);
  if (pErr) console.error("Permissions error:", pErr);
  if (rpErr) console.error("Role_permissions error:", rpErr);

  console.log("=== TOTAL PERMISSIONS IN DB:", perms?.length, "===");
  if (perms) {
    perms.sort((a, b) => (a.scope || "").localeCompare(b.scope || "") || (a.code || "").localeCompare(b.code || ""));
    perms.forEach((p) => {
      console.log(`[${p.scope}] ${p.module || "-"} -> ${p.code} (${p.name})`);
    });
  }

  console.log("\n=== ROLES IN DB ===");
  roles?.forEach((r) => {
    console.log(`Role: ${r.code} | Name: ${r.name} | Scope: ${r.scope} | is_system: ${r.is_system_role} | status: ${r.status}`);
  });

  console.log("\n=== ROLE_PERMISSIONS MAPPINGS ===");
  for (const r of roles || []) {
    const rolePerms = (rp || []).filter((item) => item.role_id === r.id);
    const codes = rolePerms.map((item) => item.permissions?.code).filter(Boolean).sort();
    console.log(`Role [${r.code}] (${r.scope}) => Count: ${codes.length}`);
    console.log("   " + codes.join(", "));
  }
}

run().catch(console.error);
