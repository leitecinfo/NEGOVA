/**
 * Check via raw SQL what tables exist in the database
 */
const fs = require("fs");
const path = require("path");

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

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function execSQL(sql) {
  const resp = await fetch(`${url}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  return resp;
}

async function main() {
  // Use the PostgREST /rest/v1/ endpoint to query platform_settings directly
  console.log("=== QUERYING PLATFORM_SETTINGS DIRECTLY ===\n");
  
  const resp = await fetch(`${url}/rest/v1/platform_settings?select=key,description,updated_at&order=key`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.log("platform_settings query status:", resp.status, txt.slice(0, 300));
  } else {
    const data = await resp.json();
    console.log("Found " + data.length + " keys in platform_settings:\n");
    for (const s of data) {
      console.log("  " + s.key + " | " + (s.description || "(no desc)"));
    }
  }

  // Check new tables
  console.log("\n=== CHECKING NEW TABLES ===\n");
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

  for (const t of tables) {
    const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Accept": "application/json",
      },
    });
    if (!r.ok) {
      const errText = await r.text();
      if (errText.includes("does not exist") || errText.includes("schema cache")) {
        console.log("  NO_EXISTE: " + t);
      } else {
        console.log("  ERROR: " + t + " -> " + r.status + " " + errText.slice(0, 150));
      }
    } else {
      const data = await r.json();
      console.log("  EXISTE: " + t + " -> " + data.length + " row(s) returned");
    }
  }
}

main().catch(console.error);
