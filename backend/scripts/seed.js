// Development only: fills the skill catalog and creates one demo account per role in the REAL database.
// Usage: npm run seed            (password defaults to Demo@12345, override with DEMO_PASSWORD=...)
import bcrypt from "bcryptjs";
import { supabase } from "../src/config.js";

if (process.env.NODE_ENV === "production") { console.error("Refusing to seed demo accounts in production."); process.exit(1); }

const SKILLS = ["React", "JavaScript", "Python", "SQL", "Node.js", "UI/UX Design", "Machine Learning", "Data Analysis", "Java", "Figma", "Communication", "Public Speaking"];
for (const name of SKILLS) await supabase.from("skills").upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
console.log(`Skill catalog ready (${SKILLS.length} skills).`);

const password = process.env.DEMO_PASSWORD || "Demo@12345";
const hash = await bcrypt.hash(password, 12);
const demo = [
  ["Demo Student", "student@demo.com", "Student", "student_profiles"],
  ["Demo Mentor", "mentor@demo.com", "Mentor", "mentor_profiles"],
  ["Demo Recruiter", "recruiter@demo.com", "Recruiter", "recruiter_profiles"],
  ["Demo Admin", "admin@demo.com", "Admin", null],
];
for (const [name, email, role, table] of demo) {
  let { data: u } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (!u) {
    const res = await supabase.from("users").insert({ name, email, role, password_hash: hash }).select("id").single();
    if (res.error) { console.error(email, res.error.message); continue; }
    u = res.data;
  }
  if (table) await supabase.from(table).upsert({ id: u.id });
  console.log(`  ${role.padEnd(9)} ${email}`);
}
console.log(`Demo password: ${password}`);
