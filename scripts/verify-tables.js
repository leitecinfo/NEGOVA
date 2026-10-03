/**
 * Script to verify which tables actually exist in Supabase PostgreSQL
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Manual .env.local parser
const envPath = path.resolve(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES_TO_CHECK = [
  "support_conversations",
  "support_chat_messages",
  "support_interactions",
  "support_tickets",
  "platform_invoices",
  "platform_expenses",
  "business_document_configs",
  "business_sale_documents",
  "business_sale_items",
  "notifications",
  "platform_notifications",
  // Core
  "users",
  "profiles",
  "businesses",
  "business_users",
  "subscriptions",
  "plans",
  "roles",
  "permissions",
  "role_permissions",
  "audit_logs",
  "platform_settings",
];

async function main() {
  console.log("=== VERIFICACION DE TABLAS EN SUPABASE ===\n");
  
  for (const table of TABLES_TO_CHECK) {
    try {
      const { data, error, count } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      
      if (error) {
        if (error.message.includes("does not exist") || error.code === "42P01" || error.message.includes("relation")) {
          console.log("NO_EXISTE: " + table);
        } else {
          console.log("ERROR: " + table + " -> " + error.message + " code=" + error.code);
        }
      } else {
        console.log("EXISTE: " + table + " (" + (count !== null ? count : "?") + " registros)");
      }
    } catch (err) {
      console.log("EXCEPCION: " + table + " -> " + err.message);
    }
  }

  // Check JSON keys in platform_settings
  console.log("\n=== CLAVES JSON EN PLATFORM_SETTINGS ===\n");
  const { data: settings, error: settingsErr } = await admin
    .from("platform_settings")
    .select("key, description, updated_at")
    .order("key");

  if (settingsErr) {
    console.log("Error al leer platform_settings:", settingsErr.message);
  } else if (settings) {
    for (const s of settings) {
      console.log("  KEY: " + s.key + " | " + (s.description || "(sin desc)") + " | updated: " + s.updated_at);
    }
    console.log("\n  Total claves: " + settings.length);
  }
}

main().catch(console.error);
