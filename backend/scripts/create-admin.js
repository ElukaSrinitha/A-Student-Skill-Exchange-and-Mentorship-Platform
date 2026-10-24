// Usage: npm run create-admin -- "Full Name" admin@example.com "a-strong-password"
import bcrypt from "bcryptjs";
import { supabase } from "../src/config.js";

const [name, emailRaw, password] = process.argv.slice(2);
const email = (emailRaw || "").trim().toLowerCase();
if (!name || !email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- "Full Name" admin@example.com "password-of-8+-chars"');
  process.exit(1);
}
const { data: existing } = await supabase.from("users").select("id,role").eq("email", email).maybeSingle();
const password_hash = await bcrypt.hash(password, 12);
if (existing) {
  const { error } = await supabase.from("users").update({ role: "Admin", password_hash, is_active: true }).eq("id", existing.id);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Existing user ${email} is now an active Admin with the new password.`);
} else {
  const { error } = await supabase.from("users").insert({ name, email, password_hash, role: "Admin" });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Admin ${email} created.`);
}
