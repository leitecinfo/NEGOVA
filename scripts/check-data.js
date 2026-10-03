/**
 * Check what data currently exists in the new tables and in platform_settings
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

const admin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check table row counts
  const tables = [
    "support_conversations",
    "support_chat_messages",
    "support_interactions",
    "support_tickets",
    "platform_invoices",
    "platform_expenses",
    "business_document_configs",
    "business_sale_documents",
    "business_sale_items",
    "platform_notifications",
  ];

  console.log("=== ROWS IN NEW TABLES ===\n");
  for (const t of tables) {
    const { data, error } = await admin.from(t).select("*").limit(5);
    if (error) {
      console.log(t + " -> ERROR: " + error.message);
    } else {
      console.log(t + " -> " + (data ? data.length : 0) + " rows found (limit 5)");
      if (data && data.length > 0) {
        console.log("  Sample: " + JSON.stringify(data[0]).slice(0, 200));
      }
    }
  }

  // Check platform_settings keys (via RPC or direct query since schema cache issue)
  console.log("\n=== PLATFORM_SETTINGS KEYS ===\n");
  
  // Use RPC to query raw SQL
  const { data: psData, error: psError } = await admin.rpc("exec_sql", {
    sql: "SELECT key, length(value::text) as value_len, description FROM public.platform_settings ORDER BY key"
  });
  
  if (psError) {
    console.log("RPC failed: " + psError.message);
    
    // Fallback: try direct from
    const { data: direct, error: dirErr } = await admin
      .from("platform_settings")
      .select("key, description, updated_at");
    
    if (dirErr) {
      console.log("Direct query also failed: " + dirErr.message);
    } else if (direct) {
      for (const s of direct) {
        console.log("  " + s.key + " | " + (s.description || ""));
      }
    }
  } else if (psData) {
    console.log(JSON.stringify(psData, null, 2));
  }

  // Try to check known JSON keys directly
  console.log("\n=== CHECKING SPECIFIC KEYS ===\n");
  const keys = [
    "platform:support_store",
    "support:conversations", 
    "platform:invoices",
    "platform:expenses",
    "platform:notifications_store",
    "core_config",
    "platform:annual_discount",
    "security:rate_limit_records",
  ];

  for (const key of keys) {
    const { data, error } = await admin
      .from("platform_settings")
      .select("key, updated_at")
      .eq("key", key)
      .maybeSingle();
    
    if (error) {
      console.log("  " + key + " -> ERROR: " + error.message);
    } else if (data) {
      console.log("  " + key + " -> EXISTS, updated: " + data.updated_at);
    } else {
      console.log("  " + key + " -> NOT FOUND");
    }
  }

  // Check any keys starting with "business_doc_config:" or "business_documents:" or "support:messages:"
  console.log("\n=== CHECKING WILDCARD KEYS ===\n");
  const prefixes = ["business_doc_config:", "business_documents:", "support:messages:"];
  for (const prefix of prefixes) {
    const { data, error } = await admin
      .from("platform_settings")
      .select("key, updated_at")
      .like("key", prefix + "%");
    
    if (error) {
      console.log("  " + prefix + "* -> ERROR: " + error.message);
    } else if (data && data.length > 0) {
      console.log("  " + prefix + "* -> FOUND " + data.length + " keys:");
      for (const d of data) {
        console.log("    " + d.key);
      }
    } else {
      console.log("  " + prefix + "* -> NO KEYS FOUND");
    }
  }
}

main().catch(console.error);
