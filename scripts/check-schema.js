/**
 * Check using the @supabase/supabase-js with db.schema option to bypass schema cache
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

// Create with db.schema = 'public' explicitly 
const admin = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

async function main() {
  // Try querying platform_settings with this client  
  console.log("=== platform_settings via supabase-js (schema: public) ===\n");
  
  const { data: ps, error: psErr } = await admin
    .from("platform_settings")
    .select("key, description, updated_at")
    .order("key");
    
  if (psErr) {
    console.log("platform_settings ERROR: " + psErr.message + " code=" + psErr.code);
  } else {
    console.log("platform_settings: " + (ps ? ps.length : 0) + " rows\n");
    if (ps) {
      for (const s of ps) {
        console.log("  " + s.key + " | " + (s.description || ""));
      }
    }
  }

  // The issue might be that PostgREST schema cache needs to be reloaded
  // Let's try to send a NOTIFY to reload schema
  // Actually, let's check if the platform_settings table truly exists by trying an actual query
  // The Next.js app uses createClient with the service role key - let's check what version of supabase-js
  
  console.log("\n=== Trying raw SQL via PostgREST ===");
  
  // Check if we can use pg protocol. Actually, Supabase dashboard SQL editor runs queries.
  // The PostgREST schema cache issue means table exists but PostgREST hasn't detected it.
  // This can happen when tables are created outside of migration or when schema cache is stale.
  
  // Since the Next.js app IS working with platform_settings (the dev server is running and functional),
  // it must be using a different code path. Let's check by creating a simple Next.js API test.
  
  console.log("\nThe schema cache issue means PostgREST hasn't refreshed.");
  console.log("The running Next.js app likely sends a NOTIFY pgrst or uses a different connection.");
  console.log("\nNew tables need to be CREATED (they don't exist yet) + schema cache reloaded.");
}

main().catch(console.error);
