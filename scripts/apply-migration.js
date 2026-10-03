/**
 * Apply SQL migration to Supabase by executing it via the SQL REST endpoint
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

// Extract project ref from URL: https://xxxx.supabase.co -> xxxx
const projectRef = url.replace("https://", "").replace(".supabase.co", "");

async function main() {
  const sqlPath = path.resolve(__dirname, "..", "supabase", "migrations", "20260910_json_to_postgresql_migration.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  
  console.log("Applying migration to Supabase project: " + projectRef);
  console.log("SQL length: " + sql.length + " chars\n");
  
  // Execute via Supabase Management API
  // POST /v1/projects/{ref}/database/query
  const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${envVars.SUPABASE_ACCESS_TOKEN || key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!mgmtResp.ok) {
    const errText = await mgmtResp.text();
    console.log("Management API failed (" + mgmtResp.status + "): " + errText.slice(0, 500));
    console.log("\nFalling back to pg-meta / SQL endpoint...");
    
    // Try the pg-meta SQL endpoint  
    // Supabase exposes a SQL execution endpoint at /pg/
    // Actually, we need to use the Supabase Studio SQL approach
    // The proper way from outside is to use the Supabase CLI or the dashboard
    
    console.log("\n=====================================================");
    console.log("INSTRUCCIÓN MANUAL REQUERIDA:");
    console.log("=====================================================");
    console.log("1. Abre el Supabase Dashboard: https://supabase.com/dashboard/project/" + projectRef);
    console.log("2. Ve a SQL Editor");
    console.log("3. Copia y ejecuta el contenido de:");
    console.log("   supabase/migrations/20260910_json_to_postgresql_migration.sql");
    console.log("4. Después de ejecutar, vuelve y corre: node scripts/verify-migration.js");
    console.log("=====================================================");
    return;
  }

  const result = await mgmtResp.json();
  console.log("Migration applied successfully!");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
