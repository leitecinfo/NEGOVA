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
  console.log("=== CHECKING USERS IN DATABASE ===");
  const { data: users } = await client.from("users").select("*");
  console.log("Users:", users);

  console.log("\n=== CHECKING PROFILES IN DATABASE ===");
  const { data: profiles } = await client.from("profiles").select("*");
  console.log("Profiles:", profiles);

  console.log("\n=== CHECKING BUSINESSES IN DATABASE ===");
  const { data: businesses } = await client.from("businesses").select("*");
  console.log("Businesses:", businesses);

  console.log("\n=== CHECKING BUSINESS_USERS IN DATABASE ===");
  const { data: bus } = await client.from("business_users").select("*");
  console.log("Business users:", bus);
}

run().catch(console.error);
