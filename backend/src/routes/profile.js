import { Router } from "express";
import { supabase, STORAGE_BUCKET, usingServiceRole } from "../config.js";
import { HttpError, wrap, db, str, int, list, count } from "../lib/http.js";

const r = Router();
const TABLE = { Student: "student_profiles", Mentor: "mentor_profiles", Recruiter: "recruiter_profiles" };

const FIELDS = {
  Student: {
    bio: (v) => str(v, { label: "Bio", max: 1500 }), college: (v) => str(v, { label: "College", max: 150 }),
    department: (v) => str(v, { label: "Department", max: 150 }), graduation_year: (v) => int(v, { label: "Graduation year", min: 1990, max: 2100 }),
    interests: (v) => list(v), resume_url: (v) => str(v, { max: 500 }), avatar_url: (v) => str(v, { max: 500 }),
    linkedin_url: (v) => str(v, { label: "LinkedIn", max: 300 }), github_url: (v) => str(v, { label: "GitHub", max: 300 }),
    portfolio_url: (v) => str(v, { label: "Portfolio", max: 300 }), phone: (v) => str(v, { label: "Phone", max: 30 }),
    location: (v) => str(v, { label: "Location", max: 120 }), career_goal: (v) => str(v, { label: "Career goal", max: 300 }),
  },
  Mentor: {
    bio: (v) => str(v, { label: "Bio", max: 1500 }), expertise: (v) => list(v), experience_years: (v) => int(v, { label: "Experience", min: 0, max: 70 }),
    availability: (v) => str(v, { label: "Availability", max: 200 }), job_title: (v) => str(v, { label: "Job title", max: 120 }),
    company: (v) => str(v, { label: "Company", max: 120 }), linkedin_url: (v) => str(v, { label: "LinkedIn", max: 300 }),
  },
  Recruiter: {
    company_name: (v) => str(v, { label: "Company name", max: 150 }), description: (v) => str(v, { label: "Description", max: 2000 }),
    industry: (v) => str(v, { label: "Industry", max: 100 }), website: (v) => str(v, { label: "Website", max: 300 }),
    logo_url: (v) => str(v, { max: 500 }), location: (v) => str(v, { label: "Location", max: 150 }),
    linkedin_url: (v) => str(v, { label: "LinkedIn", max: 300 }),
  },
};

async function completion(user, profile) {
  const has = (v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");
  const checks = [];
  if (user.role === "Student") {
    for (const k of ["bio", "college", "department", "graduation_year", "interests", "resume_url", "career_goal", "linkedin_url"]) checks.push(has(profile?.[k]));
    checks.push((await count("student_skills", (q) => q.eq("student_id", user.id))) > 0);
    checks.push((await count("projects", (q) => q.eq("student_id", user.id))) > 0);
  } else if (user.role === "Mentor") {
    for (const k of ["bio", "expertise", "experience_years", "availability", "job_title", "company", "linkedin_url"]) checks.push(has(profile?.[k]));
  } else if (user.role === "Recruiter") {
    for (const k of ["company_name", "description", "industry", "website", "logo_url", "location"]) checks.push(has(profile?.[k]));
  } else return 100;
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
export { completion };

r.get("/", wrap(async (req, res) => {
  const { user } = req;
  let profile = null;
  if (TABLE[user.role]) profile = (await supabase.from(TABLE[user.role]).select("*").eq("id", user.id).maybeSingle()).data;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, ...(profile || {}), profile_completion: await completion(user, profile) });
}));

r.put("/", wrap(async (req, res) => {
  const { user } = req;
  const table = TABLE[user.role];
  if (!table) throw new HttpError(400, "Administrator details are managed in Users");
  if (req.body?.name !== undefined) {
    const name = str(req.body.name, { label: "Name", required: true, max: 100 });
    db(await supabase.from("users").update({ name }).eq("id", user.id).select("id").single());
    user.name = name;
  }
  const row = { id: user.id };
  for (const [k, fn] of Object.entries(FIELDS[user.role])) if (req.body?.[k] !== undefined) row[k] = fn(req.body[k]);
  const saved = db(await supabase.from(table).upsert(row).select("*").single());
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, ...saved, profile_completion: await completion(user, saved) });
}));

/* ---- File uploads (resume, logo, avatar). Body: { kind, filename, content_type, data(base64) } ---- */
const KINDS = {
  resume: { types: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], roles: ["Student"] },
  avatar: { types: ["image/png", "image/jpeg", "image/webp"], roles: ["Student", "Mentor", "Recruiter"] },
  logo: { types: ["image/png", "image/jpeg", "image/webp"], roles: ["Recruiter"] },
};
export const uploads = Router();
uploads.post("/", wrap(async (req, res) => {
  const { kind, filename, content_type, data } = req.body || {};
  const k = KINDS[kind];
  if (!k || !k.roles.includes(req.user.role)) throw new HttpError(403, "You cannot upload this kind of file");
  if (!k.types.includes(content_type)) throw new HttpError(400, `Unsupported file type for ${kind}`);
  if (typeof data !== "string" || !data) throw new HttpError(400, "File data is missing");
  const buf = Buffer.from(data, "base64");
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) throw new HttpError(400, "File must be between 1 byte and 5 MB");
  if (!usingServiceRole) throw new HttpError(501, "File uploads need SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  await supabase.storage.createBucket(STORAGE_BUCKET, { public: true }).catch(() => {});
  const safe = String(filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${kind}/${req.user.id}/${Date.now()}-${safe}`;
  const up = await supabase.storage.from(STORAGE_BUCKET).upload(path, buf, { contentType: content_type, upsert: false });
  if (up.error) { console.error("[upload]", up.error); throw new HttpError(500, "Upload failed. Check that the storage bucket can be created."); }
  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  res.status(201).json({ url: pub.publicUrl, filename: safe });
}));

/* ---- Settings: notification preferences ---- */
export const settings = Router();
export const NOTIFICATION_TYPES = ["Application", "Mentorship", "Exchange", "Internship", "System"];
settings.get("/preferences", wrap(async (req, res) => {
  const { data } = await supabase.from("users").select("notification_prefs").eq("id", req.user.id).single();
  const prefs = data?.notification_prefs || {};
  res.json(Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, prefs[t] !== false])));
}));
settings.put("/preferences", wrap(async (req, res) => {
  const prefs = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, req.body?.[t] !== false]));
  db(await supabase.from("users").update({ notification_prefs: prefs }).eq("id", req.user.id).select("id").single());
  res.json(prefs);
}));

export default r;
