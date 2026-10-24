import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, int, num, date, list, oneOf, uuid, today, logAdmin, tally } from "../lib/http.js";

const r = Router();
const STATUSES = ["Draft", "Published", "Closed"];
const MODES = ["Remote", "On-site", "Hybrid"];

/** Adds company name and the computed "effective" status (Published past its deadline shows as Expired). */
async function decorate(rows) {
  const ids = [...new Set(rows.map((x) => x.recruiter_id))];
  const prof = ids.length ? db(await supabase.from("recruiter_profiles").select("id,company_name,logo_url").in("id", ids)) : [];
  const users = ids.length ? db(await supabase.from("users").select("id,name").in("id", ids)) : [];
  const P = new Map(prof.map((p) => [p.id, p])); const U = new Map(users.map((u) => [u.id, u]));
  return rows.map((x) => ({
    ...x,
    company_name: P.get(x.recruiter_id)?.company_name || U.get(x.recruiter_id)?.name || "Company",
    company_logo: P.get(x.recruiter_id)?.logo_url || null,
    effective_status: x.status === "Published" && x.deadline && x.deadline < today() ? "Expired" : x.status,
  }));
}
const visibleToStudents = (q) => q.eq("status", "Published").or(`deadline.is.null,deadline.gte.${today()}`);

function payload(b, isUpdate = false) {
  const p = {
    title: str(b?.title, { label: "Title", required: true, max: 150 }),
    description: str(b?.description, { label: "Description", required: true, max: 4000 }),
    skills: list(b?.skills),
    duration: str(b?.duration, { label: "Duration", max: 60 }),
    location: str(b?.location, { label: "Location", max: 120 }),
    work_mode: b?.work_mode ? oneOf(b.work_mode, MODES, "Work mode") : null,
    stipend: num(b?.stipend, { label: "Stipend" }),
    openings: int(b?.openings ?? 1, { label: "Openings", min: 1, max: 1000 }) ?? 1,
    deadline: date(b?.deadline, { label: "Deadline" }),
    start_date: date(b?.start_date, { label: "Start date" }),
    end_date: date(b?.end_date, { label: "End date" }),
    responsibilities: str(b?.responsibilities, { label: "Responsibilities", max: 3000 }),
    requirements: str(b?.requirements, { label: "Requirements", max: 3000 }),
    status: oneOf(b?.status || "Draft", ["Draft", "Published"], "Status"),
  };
  if (p.start_date && p.end_date && p.end_date < p.start_date) throw new HttpError(400, "End date must be after the start date");
  if (p.deadline && p.start_date && p.deadline > p.start_date) throw new HttpError(400, "Deadline must be on or before the start date");
  return p;
}

/** Students: browse published internships, with filters and an "already applied" flag. */
r.get("/", requireRole("Student", "Mentor"), wrap(async (req, res) => {
  let q = visibleToStudents(supabase.from("micro_internships").select("*")).order("created_at", { ascending: false }).limit(200);
  const { search, work_mode, location, skill, min_stipend } = req.query;
  if (search) q = q.ilike("title", `%${String(search).slice(0, 80)}%`);
  if (work_mode) q = q.eq("work_mode", String(work_mode));
  if (location) q = q.ilike("location", `%${String(location).slice(0, 80)}%`);
  if (skill) q = q.contains("skills", [String(skill)]);
  if (min_stipend) q = q.gte("stipend", Number(min_stipend) || 0);
  const rows = await decorate(db(await q));
  let applied = new Map();
  if (req.user.role === "Student" && rows.length) {
    const a = db(await supabase.from("internship_applications").select("internship_id,status").eq("student_id", req.user.id).in("internship_id", rows.map((x) => x.id)));
    applied = new Map(a.map((x) => [x.internship_id, x.status]));
  }
  res.json(rows.map((x) => ({ ...x, my_application: applied.get(x.id) || null })));
}));

/** Students: internships whose skills overlap the student's own skills. */
r.get("/recommended", requireRole("Student"), wrap(async (req, res) => {
  const mine = db(await supabase.from("student_skills").select("skills(name)").eq("student_id", req.user.id)).map((s) => s.skills?.name?.toLowerCase()).filter(Boolean);
  if (!mine.length) return res.json([]);
  const rows = await decorate(db(await visibleToStudents(supabase.from("micro_internships").select("*")).limit(200)));
  const applied = new Set(db(await supabase.from("internship_applications").select("internship_id").eq("student_id", req.user.id)).map((a) => a.internship_id));
  const scored = rows
    .filter((x) => !applied.has(x.id))
    .map((x) => ({ ...x, matched_skills: (x.skills || []).filter((s) => mine.includes(s.toLowerCase())) }))
    .filter((x) => x.matched_skills.length)
    .sort((a, b) => b.matched_skills.length - a.matched_skills.length);
  res.json(scored.slice(0, 12));
}));

/** Recruiters: own internships with application counts. */
r.get("/mine", requireRole("Recruiter"), wrap(async (req, res) => {
  let q = supabase.from("micro_internships").select("*").eq("recruiter_id", req.user.id).order("created_at", { ascending: false });
  if (req.query.search) q = q.ilike("title", `%${String(req.query.search).slice(0, 80)}%`);
  const rows = await decorate(db(await q));
  const apps = rows.length ? db(await supabase.from("internship_applications").select("internship_id,status").in("internship_id", rows.map((x) => x.id))) : [];
  const total = tally(apps, "internship_id");
  const sel = tally(apps.filter((a) => a.status === "Accepted"), "internship_id");
  const out = rows.map((x) => ({ ...x, application_count: total[x.id] || 0, accepted_count: sel[x.id] || 0 }));
  res.json(req.query.status ? out.filter((x) => x.effective_status === req.query.status) : out);
}));

r.get("/:id", wrap(async (req, res) => {
  const row = db(await supabase.from("micro_internships").select("*").eq("id", uuid(req.params.id)).single());
  const isOwner = row.recruiter_id === req.user.id;
  if (!isOwner && req.user.role !== "Admin" && !(row.status === "Published")) throw new HttpError(404, "Internship not found");
  res.json((await decorate([row]))[0]);
}));

r.post("/", requireRole("Recruiter"), wrap(async (req, res) => {
  const row = db(await supabase.from("micro_internships").insert({ ...payload(req.body), recruiter_id: req.user.id }).select("*").single());
  res.status(201).json((await decorate([row]))[0]);
}));

/** Owner (or Admin) can edit. Closed internships can be re-opened by choosing Published. */
async function ownedOrAdmin(req) {
  const id = uuid(req.params.id);
  const row = db(await supabase.from("micro_internships").select("id,recruiter_id,title").eq("id", id).single());
  if (row.recruiter_id !== req.user.id && req.user.role !== "Admin") throw new HttpError(403, "You can only manage your own internships");
  return row;
}
r.put("/:id", requireRole("Recruiter", "Admin"), wrap(async (req, res) => {
  const row = await ownedOrAdmin(req);
  const updated = db(await supabase.from("micro_internships").update(payload(req.body)).eq("id", row.id).select("*").single());
  if (req.user.role === "Admin") await logAdmin(req.user.id, "internship.update", { id: row.id, title: row.title });
  res.json((await decorate([updated]))[0]);
}));
r.post("/:id/close", requireRole("Recruiter", "Admin"), wrap(async (req, res) => {
  const row = await ownedOrAdmin(req);
  const updated = db(await supabase.from("micro_internships").update({ status: "Closed" }).eq("id", row.id).select("*").single());
  if (req.user.role === "Admin") await logAdmin(req.user.id, "internship.close", { id: row.id, title: row.title });
  res.json((await decorate([updated]))[0]);
}));
r.delete("/:id", requireRole("Recruiter", "Admin"), wrap(async (req, res) => {
  const row = await ownedOrAdmin(req);
  db(await supabase.from("micro_internships").delete().eq("id", row.id).select("id").single());
  if (req.user.role === "Admin") await logAdmin(req.user.id, "internship.delete", { id: row.id, title: row.title });
  res.json({ ok: true });
}));

export default r;
export { decorate };
