/**
 * Script: seed.mjs
 * Purpose: Populates initial settings and the 4 members into Supabase using the Service Role Key.
 * Note: The SQL migration in supabase/migrations/001_initial_schema.sql must be run first.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ Error: .env.local file not found.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🌱 Verifying and seeding database...");

  // 1. Seed / Verify Settings
  const { data: settingsData, error: settingsError } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    console.error("⚠️ Settings table error (Did you run the SQL migration?):", settingsError.message);
  } else if (!settingsData) {
    const { error: insertSettingsError } = await supabase.from("settings").insert({
      id: 1,
      app_name: "Mill Manager",
      meal_price: 60.0,
      currency: "BDT",
      timezone: "Asia/Dhaka",
      friday_dinner_disabled: true,
    });
    if (insertSettingsError) {
      console.error("❌ Error inserting settings:", insertSettingsError.message);
    } else {
      console.log("✅ Default settings created (Meal price: ৳60.00 BDT).");
    }
  } else {
    console.log("✅ Settings already present:", settingsData.app_name);
  }

  // 2. Seed / Verify Members
  const { data: existingMembers, error: membersError } = await supabase
    .from("members")
    .select("name");

  if (membersError) {
    console.error("⚠️ Members table error (Did you run the SQL migration?):", membersError.message);
  } else {
    const initialNames = ["Tuhin", "Rahim", "Karim", "Hasan"];
    const existingNames = new Set((existingMembers || []).map((m) => m.name));

    for (const name of initialNames) {
      if (!existingNames.has(name)) {
        await supabase.from("members").insert({ name, status: "active" });
        console.log(`✅ Member added: ${name}`);
      } else {
        console.log(`ℹ️ Member already exists: ${name}`);
      }
    }
  }

  console.log("\n✨ Database check complete!");
}

main();
