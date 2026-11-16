/**
 * Script: setup-admin.mjs
 * Purpose: Securely creates the initial Admin user for Mill Management System
 * Usage: node scripts/setup-admin.mjs <admin-email> <admin-password>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read environment variables from .env.local
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

const supabaseUrl = urlMatch[1].trim();
const serviceRoleKey = keyMatch[1].trim();

const email = process.argv[2] || "admin@mill.local";
const password = process.argv[3] || "Admin123456!";

console.log(`🔐 Creating or verifying Admin user: ${email}...`);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check if user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Error listing users:", listError.message);
    process.exit(1);
  }

  const existing = usersData.users.find((u) => u.email === email);
  if (existing) {
    console.log(`ℹ️ Admin user already exists with ID: ${existing.id}`);
    console.log(`🔑 You can log in using email: ${email}`);
    return;
  }

  // Create admin user with email confirmed
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    console.error("❌ Failed to create admin user:", createError.message);
    process.exit(1);
  }

  console.log("✅ Admin user created successfully!");
  console.log(`   User ID:  ${newUser.user.id}`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log("\n🚀 You can now sign in at http://localhost:3000/login");
}

main();
