import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, oneOf, uuid, today, notify, logAdmin, userMap, skillsByStudent, projectsByStudent } from "../lib/http.js";

const r = Router();
const STATUSES = ["Pending", "Shortlisted", "Accepted", "Rejected"];

/** Student: apply (cover note + resume). Duplicates, closed and expired internships are rejected here, and by a DB unique key. */
r.post("/", requireRole("Student"), wrap(async (req, res) => {
  const internship_id = uuid(req.body?.internship_id, "Internship");
  const cover_note = str(req.body?.cover_note, { label: "Cover note", required: true, max: 2000 });
  const i = db(await supabase.from("micro_internships").select("id,title,status,deadline,recruiter_id").eq("id", internship_id).single());
  if (i.status !== "Published") throw new HttpError(400, "This internship is not open for applications");
  if (i.deadline && i.deadline < today()) throw new HttpError(400, "The application deadline has passed");
  const { data: dup } = await supabase.from("internship_applications").select("id").eq("internship_id", internship_id).eq("student_id", req.user.id).maybeSingle();
  if (dup) throw new HttpError(409, "You have already applied to this internship");
  let resume_url = str(req.body?.resume_url, { max: 500 });
  if (!resume_url) resume_url = (await supabase.from("student_profiles").select("resume_url").eq("id", req.user.id).maybeSingle()).data?.resume_url || null;
  const row = db(await supabase.from("internship_applications").insert({ internship_id, student_id: req.user.id, cover_note, resume_url }).select("*").single());
  await notify(i.recruiter_id, { title: "New application", message: `${req.user.name} applied to "${i.title}".`, type: "Application", link: "/recruiter/applications" });
  res.status(201).json(row);
}));

/** Student: own applications with internship details. */
r.get("/mine", requireRole("Student"), wrap(async (req, res) => {
  const apps = db(await supabase.from("internship_applications").select("*").eq("student_id", req.user.id).order("created_at", { ascending: false }));
  const ids = apps.map((a) => a.internship_id);
  const ints = ids.length ? db(await supabase.from("micro_internships").select("id,title,location,work_mode,stipend,duration,deadline,start_date,end_date,recruiter_id").in("id", ids)) : [];
  const I = new Map(ints.map((x) => [x.id, x]));
  const U = await userMap(ints.map((x) => x.recruiter_id));
  const prof = ints.length ? db(await supabase.from("recruiter_profiles").select("id,company_name").in("id", ints.map((x) => x.recruiter_id))) : [];
  const P = new Map(prof.map((p) => [p.id, p.company_name]));
  res.json(apps.map((a) => {
    const i = I.get(a.internship_id);
    return { ...a, internship: i ? { ...i, company_name: P.get(i.recruiter_id) || U.get(i.recruiter_id)?.name } : null };
  }));
}));

/** Recruiter: applications for their own internships, with student info, skills and projects. */
async function forRecruiter(recruiterId, { internship_id, status } = {}) {
  const ints = db(await supabase.from("micro_internships").select("id,title").eq("recruiter_id", recruiterId));
  const ownIds = ints.map((i) => i.id);
  if (!ownIds.length) return [];
  let q = supabase.from("internship_applications").select("*").in("internship_id", internship_id ? ownIds.filter((x) => x === internship_id) : ownIds).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const apps = db(await q);
  const sids = apps.map((a) => a.student_id);
  const [U, S, P] = await Promise.all([userMap(sids), skillsByStudent(sids), projectsByStudent(sids)]);
  const prof = sids.length ? db(await supabase.from("student_profiles").select("id,college,department,graduation_year,resume_url,linkedin_url,github_url,portfolio_url,bio").in("id", sids)) : [];
  const PR = new Map(prof.map((p) => [p.id, p]));
  const T = new Map(ints.map((i) => [i.id, i.title]));
  return apps.map((a) => ({
    ...a, internship_title: T.get(a.internship_id),
    student: { ...(U.get(a.student_id) || {}), ...(PR.get(a.student_id) || {}), skills: S.get(a.student_id) || [], projects: P.get(a.student_id) || [] },
    resume_url: a.resume_url || PR.get(a.student_id)?.resume_url || null,
  }));
}
r.get("/recruiter", requireRole("Recruiter"), wrap(async (req, res) => {
  const status = req.query.status ? oneOf(String(req.query.status), STATUSES, "Status") : undefined;
  const internship_id = req.query.internship_id ? uuid(String(req.query.internship_id)) : undefined;
  res.json(await forRecruiter(req.user.id, { status, internship_id }));
}));

/** Recruiter (owner) or Admin: move an application through the pipeline. */
r.patch("/:id/status", requireRole("Recruiter", "Admin"), wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const status = oneOf(req.body?.status, STATUSES, "Status");
  const app = db(await supabase.from("internship_applications").select("id,student_id,internship_id,status").eq("id", id).single());
  const i = db(await supabase.from("micro_internships").select("title,recruiter_id").eq("id", app.internship_id).single());
  if (req.user.role !== "Admin" && i.recruiter_id !== req.user.id) throw new HttpError(403, "You can only review applications to your own internships");
  const row = db(await supabase.from("internship_applications").update({ status }).eq("id", id).select("*").single());
  if (status !== app.status && status !== "Pending") {
    await notify(app.student_id, { title: `Application ${status.toLowerCase()}`, message: `Your application for "${i.title}" is now ${status}.`, type: "Application", link: "/student/applications" });
  }
  if (req.user.role === "Admin") await logAdmin(req.user.id, "application.status", { id, status });
  res.json(row);
}));

export default r;
