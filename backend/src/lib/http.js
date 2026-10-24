import { supabase } from "../config.js";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PG = {
  "23505": [409, "This record already exists"],
  "23503": [400, "A referenced record does not exist"],
  "23514": [400, "A value is not allowed"],
  "22P02": [400, "A value has the wrong format"],
  "PGRST116": [404, "Record not found"],
};
/** Unwraps a supabase-js result: returns data or throws an HttpError. */
export function db({ data, error }) {
  if (error) {
    const m = PG[error.code];
    if (m) throw new HttpError(m[0], m[1]);
    console.error("[db]", error);
    throw new HttpError(500, "Database error");
  }
  return data;
}

export const ROLES = ["Student", "Mentor", "Recruiter", "Admin"];
export const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
export const today = () => new Date().toISOString().slice(0, 10);

/** Trimmed string or null. Throws when `required` and empty. */
export function str(v, { label = "Value", required = false, max = 2000 } = {}) {
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) { if (required) throw new HttpError(400, `${label} is required`); return null; }
  if (s.length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
  return s;
}
export function int(v, { label = "Value", min = 0, max = 1e9, required = false } = {}) {
  if (v === undefined || v === null || v === "") { if (required) throw new HttpError(400, `${label} is required`); return null; }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}`);
  return n;
}
export function num(v, { label = "Value", min = 0, required = false } = {}) {
  if (v === undefined || v === null || v === "") { if (required) throw new HttpError(400, `${label} is required`); return null; }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new HttpError(400, `${label} must be a number of at least ${min}`);
  return n;
}
export function date(v, { label = "Date", required = false } = {}) {
  if (v === undefined || v === null || v === "") { if (required) throw new HttpError(400, `${label} is required`); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v))) throw new HttpError(400, `${label} must be a valid date`);
  return String(v);
}
export function list(v, { max = 30 } = {}) {
  if (v === undefined || v === null || v === "") return null;
  const arr = Array.isArray(v) ? v : String(v).split(",");
  const out = [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(0, max);
  return out.length ? out : null;
}
export function oneOf(v, allowed, label = "Value") {
  if (!allowed.includes(v)) throw new HttpError(400, `${label} must be one of: ${allowed.join(", ")}`);
  return v;
}
export const uuid = (v, label = "Id") => { if (!isUuid(v)) throw new HttpError(400, `${label} is not valid`); return v; };

/** Sends an in-app notification unless the recipient switched that type off. Never throws. */
export async function notify(recipient, { title, message, type = "System", link = null }) {
  try {
    const { data: u } = await supabase.from("users").select("notification_prefs").eq("id", recipient).maybeSingle();
    if (u?.notification_prefs && u.notification_prefs[type] === false) return;
    await supabase.from("notifications").insert({ recipient, title, message, type, link });
  } catch (e) { console.error("[notify]", e.message); }
}
/** Writes an admin_logs row. Never throws. */
export async function logAdmin(actor, action, metadata = {}) {
  try { await supabase.from("admin_logs").insert({ actor_id: actor, action, metadata }); }
  catch (e) { console.error("[logAdmin]", e.message); }
}

/** Fetches users by id and returns a Map(id -> {id,name,email}). */
export async function userMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = db(await supabase.from("users").select("id,name,email").in("id", unique));
  return new Map(rows.map((r) => [r.id, r]));
}
export async function skillMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = db(await supabase.from("skills").select("id,name").in("id", unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}
/** student_id -> [{skill_id,name,level,is_primary}] */
export async function skillsByStudent(studentIds) {
  const unique = [...new Set(studentIds.filter(Boolean))];
  const out = new Map(unique.map((id) => [id, []]));
  if (!unique.length) return out;
  const rows = db(await supabase.from("student_skills").select("student_id,skill_id,level,is_primary,skills(name)").in("student_id", unique));
  rows.forEach((r) => out.get(r.student_id)?.push({ skill_id: r.skill_id, name: r.skills?.name, level: r.level, is_primary: r.is_primary }));
  return out;
}
export async function projectsByStudent(studentIds) {
  const unique = [...new Set(studentIds.filter(Boolean))];
  const out = new Map(unique.map((id) => [id, []]));
  if (!unique.length) return out;
  const rows = db(await supabase.from("projects").select("id,student_id,title,status,project_url,repo_url").in("student_id", unique).order("created_at", { ascending: false }));
  rows.forEach((r) => out.get(r.student_id)?.push(r));
  return out;
}
export const count = async (table, apply) => {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count: c, error } = await q;
  if (error) { console.error("[count]", table, error.message); return 0; }
  return c || 0;
};
export const tally = (rows, key) => rows.reduce((o, r) => { const k = typeof key === "function" ? key(r) : r[key]; o[k] = (o[k] || 0) + 1; return o; }, {});
