import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, int, oneOf, uuid, isEmail, ROLES, count, tally, userMap, skillMap, skillsByStudent, notify, logAdmin } from "../lib/http.js";
import { decorate } from "./internships.js";

const r = Router();
r.use(requireRole("Admin"));
const PROFILE_TABLE = { Student: "student_profiles", Mentor: "mentor_profiles", Recruiter: "recruiter_profiles" };
const USER_COLS = "id,name,email,role,is_active,created_at";
const PAGE = 20;

/* ---------------- Users ---------------- */
r.get("/users", wrap(async (req, res) => {
  const page = Math.max(1, int(req.query.page || 1, { min: 1, max: 10000 }) || 1);
  let q = supabase.from("users").select(USER_COLS, { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (req.query.role) q = q.eq("role", oneOf(String(req.query.role), ROLES, "Role"));
  if (req.query.active === "true" || req.query.active === "false") q = q.eq("is_active", req.query.active === "true");
  if (req.query.search) { const s = String(req.query.search).slice(0, 60).replace(/[%,()]/g, " "); q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`); }
  const { data, error, count: total } = await q;
  if (error) throw new HttpError(500, "Database error");
  res.json({ items: data, total, page, page_size: PAGE });
}));

r.get("/users/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const user = db(await supabase.from("users").select(USER_COLS).eq("id", id).single());
  const profile = PROFILE_TABLE[user.role] ? (await supabase.from(PROFILE_TABLE[user.role]).select("*").eq("id", id).maybeSingle()).data : null;
  const stats = {};
  if (user.role === "Student") {
    stats.skills = await count("student_skills", (q) => q.eq("student_id", id)); stats.projects = await count("projects", (q) => q.eq("student_id", id));
    stats.applications = await count("internship_applications", (q) => q.eq("student_id", id)); stats.mentorships = await count("mentorship_requests", (q) => q.eq("student_id", id));
  } else if (user.role === "Mentor") { stats.mentees = await count("mentorship_requests", (q) => q.eq("mentor_id", id).eq("status", "Active")); stats.requests = await count("mentorship_requests", (q) => q.eq("mentor_id", id)); }
  else if (user.role === "Recruiter") stats.internships = await count("micro_internships", (q) => q.eq("recruiter_id", id));
  res.json({ ...user, profile, stats });
}));

r.post("/users", wrap(async (req, res) => {
  const name = str(req.body?.name, { label: "Name", required: true, max: 100 });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = oneOf(req.body?.role, ROLES, "Role");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email address");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const user = db(await supabase.from("users").insert({ name, email, role, password_hash: await bcrypt.hash(password, 12) }).select(USER_COLS).single());
  if (PROFILE_TABLE[role]) db(await supabase.from(PROFILE_TABLE[role]).upsert({ id: user.id }));
  await logAdmin(req.user.id, "user.create", { id: user.id, email, role });
  res.status(201).json(user);
}));

r.put("/users/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const patch = {};
  if (req.body?.name !== undefined) patch.name = str(req.body.name, { label: "Name", required: true, max: 100 });
  if (req.body?.email !== undefined) { const e = String(req.body.email).trim().toLowerCase(); if (!isEmail(e)) throw new HttpError(400, "Enter a valid email address"); patch.email = e; }
  if (req.body?.is_active !== undefined) {
    if (id === req.user.id && req.body.is_active === false) throw new HttpError(400, "You cannot deactivate your own account");
    patch.is_active = Boolean(req.body.is_active);
  }
  if (req.body?.password) { if (String(req.body.password).length < 8) throw new HttpError(400, "Password must be at least 8 characters"); patch.password_hash = await bcrypt.hash(String(req.body.password), 12); }
  if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to update");
  const user = db(await supabase.from("users").update(patch).eq("id", id).select(USER_COLS).single());
  await logAdmin(req.user.id, "user.update", { id, fields: Object.keys(patch).map((k) => (k === "password_hash" ? "password" : k)) });
  res.json(user);
}));

r.delete("/users/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id);
  if (id === req.user.id) throw new HttpError(400, "You cannot delete your own account");
  const target = db(await supabase.from("users").select("id,email,role").eq("id", id).single());
  if (target.role === "Admin" && (await count("users", (q) => q.eq("role", "Admin"))) <= 1) throw new HttpError(400, "You cannot delete the last administrator");
  db(await supabase.from("users").delete().eq("id", id).select("id").single());
  await logAdmin(req.user.id, "user.delete", { id, email: target.email, role: target.role });
  res.json({ ok: true });
}));

/* ---------------- Monitoring lists (read-only) ---------------- */
r.get("/internships", wrap(async (req, res) => {
  let q = supabase.from("micro_internships").select("*").order("created_at", { ascending: false }).limit(300);
  if (req.query.search) q = q.ilike("title", `%${String(req.query.search).slice(0, 80)}%`);
  if (req.query.status) q = q.eq("status", String(req.query.status));
  const rows = await decorate(db(await q));
  const apps = rows.length ? db(await supabase.from("internship_applications").select("internship_id").in("internship_id", rows.map((x) => x.id))) : [];
  const n = tally(apps, "internship_id");
  res.json(rows.map((x) => ({ ...x, application_count: n[x.id] || 0 })));
}));

r.get("/applications", wrap(async (req, res) => {
  let q = supabase.from("internship_applications").select("*").order("created_at", { ascending: false }).limit(300);
  if (req.query.status) q = q.eq("status", String(req.query.status));
  const rows = db(await q);
  const ints = rows.length ? db(await supabase.from("micro_internships").select("id,title,recruiter_id").in("id", [...new Set(rows.map((x) => x.internship_id))])) : [];
  const I = new Map(ints.map((i) => [i.id, i]));
  const U = await userMap([...rows.map((x) => x.student_id), ...ints.map((i) => i.recruiter_id)]);
  res.json(rows.map((x) => ({ ...x, internship_title: I.get(x.internship_id)?.title, student_name: U.get(x.student_id)?.name, recruiter_name: U.get(I.get(x.internship_id)?.recruiter_id)?.name })));
}));

r.get("/mentorships", wrap(async (req, res) => {
  let q = supabase.from("mentorship_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (req.query.status) q = q.eq("status", String(req.query.status));
  const rows = db(await q);
  const U = await userMap(rows.flatMap((x) => [x.student_id, x.mentor_id]));
  res.json(rows.map((x) => ({ ...x, student_name: U.get(x.student_id)?.name, mentor_name: U.get(x.mentor_id)?.name })));
}));

r.get("/exchanges", wrap(async (req, res) => {
  let q = supabase.from("skill_exchange_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (req.query.status) q = q.eq("status", String(req.query.status));
  const rows = db(await q);
  const U = await userMap(rows.flatMap((x) => [x.from_student, x.to_student]));
  const K = await skillMap(rows.flatMap((x) => [x.offer_skill, x.request_skill]));
  res.json(rows.map((x) => ({ ...x, from_name: U.get(x.from_student)?.name, to_name: U.get(x.to_student)?.name, offer_skill_name: K.get(x.offer_skill), request_skill_name: K.get(x.request_skill) })));
}));

r.get("/feedback", wrap(async (_req, res) => {
  const rows = db(await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(300));
  const U = await userMap(rows.flatMap((x) => [x.author_id, x.target_id]));
  res.json(rows.map((x) => ({ ...x, author_name: U.get(x.author_id)?.name, target_name: U.get(x.target_id)?.name })));
}));
r.delete("/feedback/:id", wrap(async (req, res) => {
  const id = uuid(req.params.id);
  db(await supabase.from("feedback").delete().eq("id", id).select("id").single());
  await logAdmin(req.user.id, "feedback.delete", { id });
  res.json({ ok: true });
}));

/* ---------------- Skills with usage ---------------- */
r.get("/skills", wrap(async (_req, res) => {
  const skills = db(await supabase.from("skills").select("id,name,created_at").order("name").limit(500));
  const used = db(await supabase.from("student_skills").select("skill_id"));
  const n = tally(used, "skill_id");
  res.json(skills.map((s) => ({ ...s, students: n[s.id] || 0 })));
}));

/* ---------------- Notifications broadcast ---------------- */
r.post("/notifications", wrap(async (req, res) => {
  const title = str(req.body?.title, { label: "Title", required: true, max: 120 });
  const message = str(req.body?.message, { label: "Message", required: true, max: 1000 });
  const audience = String(req.body?.audience || "All");
  let q = supabase.from("users").select("id").eq("is_active", true);
  if (ROLES.includes(audience)) q = q.eq("role", audience);
  else if (audience !== "All") throw new HttpError(400, "Choose an audience");
  const users = db(await q);
  if (!users.length) throw new HttpError(400, "No users match that audience");
  for (let i = 0; i < users.length; i += 200) {
    db(await supabase.from("notifications").insert(users.slice(i, i + 200).map((u) => ({ recipient: u.id, title, message, type: "System" }))));
  }
  await logAdmin(req.user.id, "notification.broadcast", { audience, recipients: users.length, title });
  res.status(201).json({ sent: users.length });
}));

/* ---------------- Logs ---------------- */
r.get("/logs", wrap(async (req, res) => {
  const page = Math.max(1, int(req.query.page || 1, { min: 1, max: 10000 }) || 1);
  const { data, error, count: total } = await supabase.from("admin_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
  if (error) throw new HttpError(500, "Database error");
  const U = await userMap(data.map((x) => x.actor_id));
  res.json({ items: data.map((x) => ({ ...x, actor_name: U.get(x.actor_id)?.name })), total, page, page_size: 30 });
}));

/* ---------------- Analytics ---------------- */
r.get("/analytics", wrap(async (_req, res) => {
  const since = new Date(Date.now() - 56 * 864e5).toISOString();
  const [users, apps, ints, ments, exch, ss] = await Promise.all([
    db(await supabase.from("users").select("role,created_at")), db(await supabase.from("internship_applications").select("status")),
    db(await supabase.from("micro_internships").select("status")), db(await supabase.from("mentorship_requests").select("status")),
    db(await supabase.from("skill_exchange_requests").select("status")), db(await supabase.from("student_skills").select("skill_id")),
  ]);
  const K = await skillMap(ss.map((x) => x.skill_id));
  const weekly = tally(users.filter((u) => u.created_at >= since), (u) => { const d = new Date(u.created_at); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); });
  const toList = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
  res.json({
    users_by_role: toList(tally(users, "role")), signups_by_week: Object.entries(weekly).map(([week, value]) => ({ week, value })).sort((a, b) => a.week.localeCompare(b.week)),
    applications_by_status: toList(tally(apps, "status")), internships_by_status: toList(tally(ints, "status")),
    mentorships_by_status: toList(tally(ments, "status")), exchanges_by_status: toList(tally(exch, "status")),
    top_skills: toList(tally(ss, (x) => K.get(x.skill_id) || "Unknown")).sort((a, b) => b.value - a.value).slice(0, 10),
  });
}));

/* ---------------- Reports (CSV export) ---------------- */
const csvCell = (v) => { let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(","))].join("\n");
const REPORTS = {
  users: async () => ({ rows: db(await supabase.from("users").select(USER_COLS).order("created_at")), cols: ["id", "name", "email", "role", "is_active", "created_at"] }),
  internships: async () => ({ rows: db(await supabase.from("micro_internships").select("id,title,status,location,work_mode,stipend,openings,deadline,start_date,end_date,created_at").order("created_at")), cols: ["id", "title", "status", "location", "work_mode", "stipend", "openings", "deadline", "start_date", "end_date", "created_at"] }),
  applications: async () => ({ rows: db(await supabase.from("internship_applications").select("id,internship_id,student_id,status,created_at").order("created_at")), cols: ["id", "internship_id", "student_id", "status", "created_at"] }),
  mentorships: async () => ({ rows: db(await supabase.from("mentorship_requests").select("id,student_id,mentor_id,status,created_at").order("created_at")), cols: ["id", "student_id", "mentor_id", "status", "created_at"] }),
  exchanges: async () => ({ rows: db(await supabase.from("skill_exchange_requests").select("id,from_student,to_student,offer_skill,request_skill,status,created_at").order("created_at")), cols: ["id", "from_student", "to_student", "offer_skill", "request_skill", "status", "created_at"] }),
};
r.get("/reports/:entity", wrap(async (req, res) => {
  const fn = REPORTS[req.params.entity];
  if (!fn) throw new HttpError(404, "Unknown report");
  const { rows, cols } = await fn();
  await logAdmin(req.user.id, "report.export", { entity: req.params.entity, rows: rows.length });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="skillbridge-${req.params.entity}.csv"`);
  res.send(toCsv(rows, cols));
}));

export default r;
