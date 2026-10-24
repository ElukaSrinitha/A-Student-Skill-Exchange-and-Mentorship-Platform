import { Router } from "express";
import { supabase } from "../config.js";
import { wrap, db, count, tally, today, skillsByStudent, projectsByStudent, userMap } from "../lib/http.js";
import { completion } from "./profile.js";
import { loadMentors } from "./mentors.js";
import { decorate } from "./internships.js";

const r = Router();
const recentActivity = async (userId) => db(await supabase.from("notifications").select("id,title,message,type,created_at,read").eq("recipient", userId).order("created_at", { ascending: false }).limit(6));
const unread = (userId) => count("notifications", (q) => q.eq("recipient", userId).eq("read", false));

async function student(user) {
  const id = user.id;
  const [skills, projects, apps, exchanges, mentorships, prof] = await Promise.all([
    db(await supabase.from("student_skills").select("level,is_primary,skills(name)").eq("student_id", id)),
    db(await supabase.from("projects").select("status").eq("student_id", id)),
    db(await supabase.from("internship_applications").select("status,internship_id").eq("student_id", id)),
    db(await supabase.from("skill_exchange_requests").select("status,to_student").or(`from_student.eq.${id},to_student.eq.${id}`)),
    db(await supabase.from("mentorship_requests").select("status").eq("student_id", id)),
    supabase.from("student_profiles").select("*").eq("id", id).maybeSingle(),
  ]);
  const mySkillNames = skills.map((s) => s.skills?.name?.toLowerCase()).filter(Boolean);
  const open = await decorate(db(await supabase.from("micro_internships").select("*").eq("status", "Published").or(`deadline.is.null,deadline.gte.${today()}`).limit(200)));
  const appliedIds = new Set(apps.map((a) => a.internship_id));
  const recommended_internships = open.filter((x) => !appliedIds.has(x.id))
    .map((x) => ({ id: x.id, title: x.title, company_name: x.company_name, location: x.location, deadline: x.deadline, matched_skills: (x.skills || []).filter((s) => mySkillNames.includes(s.toLowerCase())) }))
    .filter((x) => x.matched_skills.length).sort((a, b) => b.matched_skills.length - a.matched_skills.length).slice(0, 4);
  const mentors = await loadMentors();
  const recommended_mentors = mentors.map((m) => ({ id: m.id, name: m.name, job_title: m.job_title, expertise: m.expertise, rating: m.rating, overlap: (m.expertise || []).filter((e) => mySkillNames.includes(e.toLowerCase())).length }))
    .sort((a, b) => b.overlap - a.overlap || (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  const applied = apps.length ? db(await supabase.from("micro_internships").select("id,title,deadline,start_date").in("id", apps.map((a) => a.internship_id))) : [];
  const upcoming = applied.flatMap((i) => [i.deadline && i.deadline >= today() ? { label: `Deadline: ${i.title}`, date: i.deadline } : null, i.start_date && i.start_date >= today() ? { label: `Starts: ${i.title}`, date: i.start_date } : null]).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  return {
    profile_completion: await completion(user, prof.data),
    counts: {
      skills: skills.length, projects: projects.length, applications: apps.length,
      exchanges: exchanges.length, mentorships: mentorships.length,
    },
    projects_by_status: tally(projects, "status"), applications_by_status: tally(apps, "status"),
    exchanges_by_status: tally(exchanges, "status"), mentorships_by_status: tally(mentorships, "status"),
    skill_levels: tally(skills, "level"),
    pending_exchange_requests: exchanges.filter((x) => x.status === "Pending" && x.to_student === id).length,
    recommended_internships, recommended_mentors, upcoming, recent_activity: await recentActivity(id), unread_notifications: await unread(id),
  };
}

async function mentor(user) {
  const rows = db(await supabase.from("mentorship_requests").select("*").eq("mentor_id", user.id));
  const active = rows.filter((x) => x.status === "Active");
  const fb = db(await supabase.from("feedback").select("rating").eq("target_id", user.id));
  const sids = active.map((x) => x.student_id);
  const [U, S, P] = await Promise.all([userMap(sids), skillsByStudent(sids), projectsByStudent(sids)]);
  const prof = await supabase.from("mentor_profiles").select("*").eq("id", user.id).maybeSingle();
  return {
    profile_completion: await completion(user, prof.data),
    counts: { active_students: active.length, pending_requests: rows.filter((x) => x.status === "Pending").length, completed: rows.filter((x) => x.status === "Completed").length, rating_count: fb.length },
    rating: fb.length ? Math.round((fb.reduce((a, b) => a + b.rating, 0) / fb.length) * 10) / 10 : null,
    student_progress: active.slice(0, 6).map((x) => { const p = P.get(x.student_id) || []; return { id: x.student_id, name: U.get(x.student_id)?.name, skills: (S.get(x.student_id) || []).length, projects_total: p.length, projects_completed: p.filter((y) => y.status === "Completed").length }; }),
    recent_activity: await recentActivity(user.id), unread_notifications: await unread(user.id),
  };
}

async function recruiter(user) {
  const ints = db(await supabase.from("micro_internships").select("id,status,deadline").eq("recruiter_id", user.id));
  const ids = ints.map((i) => i.id);
  const apps = ids.length ? db(await supabase.from("internship_applications").select("status").in("internship_id", ids)) : [];
  const prof = await supabase.from("recruiter_profiles").select("*").eq("id", user.id).maybeSingle();
  return {
    profile_completion: await completion(user, prof.data),
    counts: {
      active_internships: ints.filter((i) => i.status === "Published" && (!i.deadline || i.deadline >= today())).length,
      total_internships: ints.length, total_applications: apps.length,
      shortlisted: apps.filter((a) => a.status === "Shortlisted").length, selected: apps.filter((a) => a.status === "Accepted").length,
      pending: apps.filter((a) => a.status === "Pending").length,
    },
    applications_by_status: tally(apps, "status"),
    recent_activity: await recentActivity(user.id), unread_notifications: await unread(user.id),
  };
}

async function admin(user) {
  const [users, students, mentors, recruiters, internships, applications, mentorships, exchanges] = await Promise.all([
    count("users"), count("users", (q) => q.eq("role", "Student")), count("users", (q) => q.eq("role", "Mentor")), count("users", (q) => q.eq("role", "Recruiter")),
    count("micro_internships"), count("internship_applications"), count("mentorship_requests"), count("skill_exchange_requests"),
  ]);
  const logs = db(await supabase.from("admin_logs").select("id,action,created_at,actor_id").order("created_at", { ascending: false }).limit(6));
  return { counts: { users, students, mentors, recruiters, internships, applications, mentorships, exchanges }, recent_logs: logs, unread_notifications: await unread(user.id) };
}

r.get("/", wrap(async (req, res) => {
  const fn = { Student: student, Mentor: mentor, Recruiter: recruiter, Admin: admin }[req.user.role];
  res.json(await fn(req.user));
}));
export default r;
