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

const CANONICAL_MAP = {
  super_admin: [
    "users.view", "users.create", "users.update", "users.disable", "users.delete",
    "businesses.view", "businesses.create", "businesses.update", "businesses.suspend", "businesses.delete",
    "subscriptions.view", "subscriptions.create", "subscriptions.update", "subscriptions.cancel",
    "plans.view", "plans.create", "plans.update", "plans.delete",
    "billing.view", "billing.manage",
    "support.view", "support.manage",
    "audit.view", "audit.export",
    "platform_settings.view", "platform_settings.update",
    "roles.view", "roles.manage"
  ],
  admin: [
    "users.view", "users.create", "users.update",
    "businesses.view", "businesses.create", "businesses.update",
    "subscriptions.view",
    "plans.view",
    "billing.view",
    "support.view", "support.manage",
    "audit.view",
    "roles.view",
    "platform_settings.view"
  ],
  owner: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view", "products.create", "products.update", "products.delete",
    "customers.view", "customers.create", "customers.update", "customers.delete",
    "inventory.view", "inventory.create", "inventory.update", "inventory.adjust",
    "expenses.view", "expenses.create", "expenses.update", "expenses.delete",
    "business_users.view", "business_users.create", "business_users.update", "business_users.disable",
    "business_settings.view", "business_settings.update",
    "reports.view", "reports.export"
  ],
  business_admin: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view", "products.create", "products.update",
    "customers.view", "customers.create", "customers.update",
    "inventory.view", "inventory.create", "inventory.update", "inventory.adjust",
    "expenses.view", "expenses.create", "expenses.update",
    "business_users.view", "business_users.create", "business_users.update",
    "business_settings.view",
    "reports.view", "reports.export"
  ],
  supervisor: [
    "sales.view", "sales.create", "sales.update", "sales.cancel",
    "orders.view", "orders.create", "orders.update", "orders.cancel", "orders.manage",
    "products.view",
    "customers.view", "customers.create", "customers.update",
    "inventory.view", "inventory.create", "inventory.adjust",
    "expenses.view", "expenses.create",
    "business_users.view",
    "reports.view"
  ],
  seller: [
    "sales.view", "sales.create",
    "orders.view", "orders.create", "orders.update",
    "products.view",
    "customers.view", "customers.create", "customers.update"
  ],
  cashier: [
    "sales.view", "sales.create",
    "orders.view", "orders.create",
    "products.view",
    "customers.view", "customers.create"
  ]
};

async function sync() {
  console.log("=== SYNCHRONIZING REAL DATABASE ROLE_PERMISSIONS ===");

  const { data: roles } = await client.from("roles").select("id, code, name");
  const { data: permissions } = await client.from("permissions").select("id, code");

  const permMap = new Map((permissions || []).map((p) => [p.code, p.id]));

  for (const role of roles || []) {
    const canonicalCodes = CANONICAL_MAP[role.code];
    if (!canonicalCodes) {
      console.log(`Skipping unknown role: ${role.code}`);
      continue;
    }

    console.log(`\nSyncing [${role.code}] -> target canonical count: ${canonicalCodes.length}...`);

    // 1. Delete existing associations for this role
    const { error: delErr } = await client
      .from("role_permissions")
      .delete()
      .eq("role_id", role.id);

    if (delErr) {
      console.error(`Error deleting existing role_permissions for ${role.code}:`, delErr);
      continue;
    }

    // 2. Insert canonical associations
    const missingPerms = [];
    const insertPayload = [];
    for (const code of canonicalCodes) {
      const permId = permMap.get(code);
      if (!permId) {
        missingPerms.push(code);
      } else {
        insertPayload.push({
          role_id: role.id,
          permission_id: permId,
        });
      }
    }

    if (missingPerms.length > 0) {
      console.warn(`Warning: Missing permissions in DB for ${role.code}:`, missingPerms);
    }

    if (insertPayload.length > 0) {
      const { error: insErr } = await client
        .from("role_permissions")
        .insert(insertPayload);

      if (insErr) {
        console.error(`Error inserting role_permissions for ${role.code}:`, insErr);
      } else {
        console.log(`Successfully synced ${insertPayload.length} permissions for ${role.code}!`);
      }
    }
  }

  console.log("\n=== POST-SYNC AUDIT VERIFICATION ===");
  const { data: finalRp } = await client
    .from("role_permissions")
    .select("role_id, permission_id, roles(code), permissions(code)");

  for (const r of roles || []) {
    const rolePerms = (finalRp || []).filter((item) => item.role_id === r.id);
    console.log(`Role [${r.code}] => Verified DB Count: ${rolePerms.length} (Expected: ${CANONICAL_MAP[r.code]?.length})`);
  }
}

sync().catch(console.error);
