import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { wrap, db, tally, skillsByStudent } from "../lib/http.js";

const r = Router();
r.get("/", requireRole("Recruiter"), wrap(async (req, res) => {
  const ints = db(await supabase.from("micro_internships").select("id,title,status,skills").eq("recruiter_id", req.user.id));
  const ids = ints.map((i) => i.id);
  const apps = ids.length ? db(await supabase.from("internship_applications").select("internship_id,student_id,status,created_at").in("internship_id", ids)) : [];
  const per = tally(apps, "internship_id");
  const S = await skillsByStudent(apps.map((a) => a.student_id));
  const skillCount = {};
  apps.forEach((a) => (S.get(a.student_id) || []).forEach((s) => { if (s.name) skillCount[s.name] = (skillCount[s.name] || 0) + 1; }));
  const byDay = tally(apps.filter((a) => Date.now() - new Date(a.created_at).getTime() < 30 * 864e5), (a) => a.created_at.slice(0, 10));
  res.json({
    status_distribution: Object.entries(tally(apps, "status")).map(([name, value]) => ({ name, value })),
    internship_performance: ints.map((i) => ({ id: i.id, title: i.title, status: i.status, applications: per[i.id] || 0, accepted: apps.filter((a) => a.internship_id === i.id && a.status === "Accepted").length })).sort((a, b) => b.applications - a.applications),
    top_applicant_skills: Object.entries(skillCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    applications_last_30_days: Object.entries(byDay).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
    totals: { internships: ints.length, applications: apps.length },
  });
}));
export default r;
