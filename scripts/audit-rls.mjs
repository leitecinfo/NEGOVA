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
  console.log("=== CHECKING POSTGRES TABLES & RLS ===");

  // Check which tables are accessible and test anon vs auth
  const tables = [
    "users",
    "profiles",
    "businesses",
    "business_users",
    "roles",
    "permissions",
    "role_permissions",
    "subscriptions",
    "plans",
    "audit_logs",
    "platform_settings",
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await client
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        console.log(`Table [${table}]: ERROR ${error.message} (code: ${error.code})`);
      } else {
        console.log(`Table [${table}]: EXISTS, count = ${count}`);
      }
    } catch (e) {
      console.log(`Table [${table}]: EXCEPTION`, e.message);
    }
  }

  // Now test with Anon key to see what RLS blocks/allows for unauthenticated
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const anonClient = createClient(url, anonKey);
  console.log("\n=== TESTING ANON (UNAUTHENTICATED) ACCESS ===");
  for (const table of tables) {
    try {
      const { data, error } = await anonClient.from(table).select("*").limit(2);
      if (error) {
        console.log(`Anon -> [${table}]: BLOCKED (${error.message})`);
      } else {
        console.log(`Anon -> [${table}]: RETURNED ${data.length} rows (Potential public exposure if sensitive!)`);
      }
    } catch (e) {
      console.log(`Anon -> [${table}]: EXCEPTION`, e.message);
    }
  }
}

run().catch(console.error);
