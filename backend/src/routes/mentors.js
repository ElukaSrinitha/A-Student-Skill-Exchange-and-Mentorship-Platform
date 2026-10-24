import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, oneOf, uuid, notify, logAdmin, userMap, skillsByStudent, projectsByStudent } from "../lib/http.js";

/* ================= Mentor directory (Students browse) ================= */
export const directory = Router();

export async function loadMentors() {
  const users = db(await supabase.from("users").select("id,name,email").eq("role", "Mentor").eq("is_active", true).limit(500));
  const ids = users.map((u) => u.id);
  if (!ids.length) return [];
  const [profiles, fb, ms] = await Promise.all([
    supabase.from("mentor_profiles").select("*").in("id", ids),
    supabase.from("feedback").select("target_id,rating").in("target_id", ids),
    supabase.from("mentorship_requests").select("mentor_id,status").in("mentor_id", ids),
  ]);
  const P = new Map(db(profiles).map((p) => [p.id, p]));
  const ratings = new Map();
  db(fb).forEach((f) => { if (f.rating) { const a = ratings.get(f.target_id) || []; a.push(f.rating); ratings.set(f.target_id, a); } });
  const active = new Map();
  db(ms).forEach((m) => { if (m.status === "Active") active.set(m.mentor_id, (active.get(m.mentor_id) || 0) + 1); });
  return users.map((u) => {
    const p = P.get(u.id) || {}; const rs = ratings.get(u.id) || [];
    return { id: u.id, name: u.name, bio: p.bio, expertise: p.expertise || [], experience_years: p.experience_years, availability: p.availability, job_title: p.job_title, company: p.company, linkedin_url: p.linkedin_url,
      rating: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null, rating_count: rs.length, active_mentees: active.get(u.id) || 0 };
  });
}

directory.get("/", requireRole("Student"), wrap(async (req, res) => {
  const { search, expertise, min_experience, availability } = req.query;
  let list = await loadMentors();
  const s = String(search || "").toLowerCase();
  if (s) list = list.filter((m) => [m.name, m.bio, m.job_title, m.company, ...(m.expertise || [])].filter(Boolean).some((t) => t.toLowerCase().includes(s)));
  if (expertise) list = list.filter((m) => (m.expertise || []).some((e) => e.toLowerCase() === String(expertise).toLowerCase()));
  if (min_experience) list = list.filter((m) => (m.experience_years || 0) >= Number(min_experience));
  if (availability) list = list.filter((m) => (m.availability || "").toLowerCase().includes(String(availability).toLowerCase()));
  const mine = db(await supabase.from("mentorship_requests").select("mentor_id,status").eq("student_id", req.user.id).in("status", ["Pending", "Active"]));
  const M = new Map(mine.map((x) => [x.mentor_id, x.status]));
  res.json(list.map((m) => ({ ...m, my_request: M.get(m.id) || null })).sort((a, b) => (b.rating || 0) - (a.rating || 0)));
}));
directory.get("/:id", requireRole("Student"), wrap(async (req, res) => {
  const m = (await loadMentors()).find((x) => x.id === uuid(req.params.id));
  if (!m) throw new HttpError(404, "Mentor not found");
  res.json(m);
}));

/* ================= Mentorship requests ================= */
export const mentorships = Router();
const TRANSITIONS = { Pending: ["Active", "Rejected"], Active: ["Completed"], Completed: [], Rejected: [] };

mentorships.post("/", requireRole("Student"), wrap(async (req, res) => {
  const mentor_id = uuid(req.body?.mentor_id, "Mentor");
  const message = str(req.body?.message, { label: "Message", required: true, max: 1000 });
  const { data: mentor } = await supabase.from("users").select("id,name").eq("id", mentor_id).eq("role", "Mentor").eq("is_active", true).maybeSingle();
  if (!mentor) throw new HttpError(404, "Mentor not found");
  const { data: open } = await supabase.from("mentorship_requests").select("id,status").eq("student_id", req.user.id).eq("mentor_id", mentor_id).in("status", ["Pending", "Active"]).maybeSingle();
  if (open) throw new HttpError(409, open.status === "Active" ? "You are already being mentored by this mentor" : "You already have a pending request with this mentor");
  const row = db(await supabase.from("mentorship_requests").insert({ student_id: req.user.id, mentor_id, message }).select("*").single());
  await notify(mentor_id, { title: "New mentorship request", message: `${req.user.name} asked you to be their mentor.`, type: "Mentorship", link: "/mentor/requests" });
  res.status(201).json(row);
}));

/** Student: their requests (+ mentor). Mentor: requests to them (+ student, skills for active ones). */
mentorships.get("/", requireRole("Student", "Mentor"), wrap(async (req, res) => {
  const col = req.user.role === "Student" ? "student_id" : "mentor_id";
  let q = supabase.from("mentorship_requests").select("*").eq(col, req.user.id).order("created_at", { ascending: false });
  if (req.query.status) q = q.eq("status", String(req.query.status));
  const rows = db(await q);
  const U = await userMap(rows.flatMap((x) => [x.student_id, x.mentor_id]));
  let extra = {};
  if (req.user.role === "Student") {
    const mids = rows.map((x) => x.mentor_id);
    const prof = mids.length ? db(await supabase.from("mentor_profiles").select("id,expertise,experience_years,availability,job_title,company").in("id", mids)) : [];
    extra = Object.fromEntries(prof.map((p) => [p.id, p]));
  } else {
    const sids = rows.map((x) => x.student_id);
    const prof = sids.length ? db(await supabase.from("student_profiles").select("id,college,department,career_goal").in("id", sids)) : [];
    extra = Object.fromEntries(prof.map((p) => [p.id, p]));
  }
  res.json(rows.map((x) => ({ ...x, student: { ...(U.get(x.student_id) || {}), ...(req.user.role === "Mentor" ? extra[x.student_id] : {}) }, mentor: { ...(U.get(x.mentor_id) || {}), ...(req.user.role === "Student" ? extra[x.mentor_id] : {}) } })));
}));

/** Mentor moves Pending→Active|Rejected and Active→Completed. Admin may set any valid state. */
mentorships.patch("/:id/status", requireRole("Mentor", "Admin"), wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const status = oneOf(req.body?.status, ["Active", "Rejected", "Completed", "Pending"], "Status");
  const m = db(await supabase.from("mentorship_requests").select("*").eq("id", id).single());
  if (req.user.role === "Mentor" && m.mentor_id !== req.user.id) throw new HttpError(403, "This request is not addressed to you");
  if (req.user.role === "Mentor" && !TRANSITIONS[m.status].includes(status)) throw new HttpError(400, `A ${m.status.toLowerCase()} mentorship cannot become ${status.toLowerCase()}`);
  const row = db(await supabase.from("mentorship_requests").update({ status }).eq("id", id).select("*").single());
  const verb = { Active: "accepted", Rejected: "declined", Completed: "marked as completed" }[status];
  if (verb) await notify(m.student_id, { title: `Mentorship ${status.toLowerCase()}`, message: `Your mentorship with ${req.user.role === "Mentor" ? req.user.name : "your mentor"} was ${verb}.`, type: "Mentorship", link: "/student/mentorships" });
  if (req.user.role === "Admin") await logAdmin(req.user.id, "mentorship.status", { id, status });
  res.json(row);
}));

/* ================= Mentor: mentees ================= */
export const mentees = Router();
mentees.get("/", requireRole("Mentor"), wrap(async (req, res) => {
  const rows = db(await supabase.from("mentorship_requests").select("*").eq("mentor_id", req.user.id).in("status", ["Active", "Completed"]).order("created_at", { ascending: false }));
  const sids = rows.map((x) => x.student_id);
  const [U, S, P] = await Promise.all([userMap(sids), skillsByStudent(sids), projectsByStudent(sids)]);
  const prof = sids.length ? db(await supabase.from("student_profiles").select("id,college,department,graduation_year,career_goal").in("id", sids)) : [];
  const PR = new Map(prof.map((p) => [p.id, p]));
  res.json(rows.map((x) => {
    const projects = P.get(x.student_id) || [];
    return { mentorship_id: x.id, status: x.status, since: x.created_at, ...(U.get(x.student_id) || {}), ...(PR.get(x.student_id) || {}),
      skills: S.get(x.student_id) || [], projects,
      progress: { projects_total: projects.length, projects_completed: projects.filter((p) => p.status === "Completed").length, skills_total: (S.get(x.student_id) || []).length } };
  }));
}));
