import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n[config] Missing ${name}. Copy backend/.env.example to backend/.env and fill it in.\n`);
    process.exit(1);
  }
  return v;
}

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = need("JWT_SECRET");
if (JWT_SECRET.length < 16 || JWT_SECRET === "replace_with_a_long_random_secret") {
  console.error("\n[config] JWT_SECRET must be a random string of at least 16 characters.\n");
  process.exit(1);
}
export const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
export const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "skillbridge-files";

const url = need("SUPABASE_URL");
export const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!key) {
  console.error("\n[config] Set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY in backend/.env.\n");
  process.exit(1);
}
if (!usingServiceRole) {
  console.warn("[config] WARNING: running with the anon key. Set SUPABASE_SERVICE_ROLE_KEY and run database/migrations/002_enable_rls.sql to protect your data.");
}

export const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
