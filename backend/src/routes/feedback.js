import { Router } from "express";
import { supabase } from "../config.js";
import { HttpError, wrap, db, str, int, uuid, notify, userMap } from "../lib/http.js";

const r = Router();

/** People this user is allowed to review, based on real relationships (mentorships and internship applications). */
async function eligibleTargets(user) {
  const ids = new Set();
  if (user.role === "Student") {
    db(await supabase.from("mentorship_requests").select("mentor_id").eq("student_id", user.id).in("status", ["Active", "Completed"])).forEach((m) => ids.add(m.mentor_id));
    const apps = db(await supabase.from("internship_applications").select("internship_id").eq("student_id", user.id).eq("status", "Accepted"));
    if (apps.length) db(await supabase.from("micro_internships").select("recruiter_id").in("id", apps.map((a) => a.internship_id))).forEach((i) => ids.add(i.recruiter_id));
  } else if (user.role === "Mentor") {
    db(await supabase.from("mentorship_requests").select("student_id").eq("mentor_id", user.id).in("status", ["Active", "Completed"])).forEach((m) => ids.add(m.student_id));
  } else if (user.role === "Recruiter") {
    const ints = db(await supabase.from("micro_internships").select("id").eq("recruiter_id", user.id));
    if (ints.length) db(await supabase.from("internship_applications").select("student_id").in("internship_id", ints.map((i) => i.id)).in("status", ["Shortlisted", "Accepted"])).forEach((a) => ids.add(a.student_id));
  }
  const U = await userMap([...ids]);
  const roles = ids.size ? db(await supabase.from("users").select("id,role").in("id", [...ids])) : [];
  return roles.map((x) => ({ id: x.id, name: U.get(x.id)?.name, role: x.role }));
}

r.get("/targets", wrap(async (req, res) => res.json(req.user.role === "Admin" ? [] : await eligibleTargets(req.user))));

r.get("/", wrap(async (req, res) => {
  const box = req.query.box === "received" ? "received" : "given";
  const col = box === "given" ? "author_id" : "target_id";
  const rows = db(await supabase.from("feedback").select("*").eq(col, req.user.id).order("created_at", { ascending: false }).limit(200));
  const U = await userMap(rows.flatMap((x) => [x.author_id, x.target_id]));
  res.json(rows.map((x) => ({ ...x, author_name: U.get(x.author_id)?.name, target_name: U.get(x.target_id)?.name })));
}));

r.post("/", wrap(async (req, res) => {
  if (req.user.role === "Admin") throw new HttpError(403, "Administrators moderate feedback but do not submit it");
  const target_id = uuid(req.body?.target_id, "Person");
  const rating = int(req.body?.rating, { label: "Rating", min: 1, max: 5, required: true });
  const comment = str(req.body?.comment, { label: "Comment", max: 1000 });
  const allowed = await eligibleTargets(req.user);
  if (!allowed.some((t) => t.id === target_id)) throw new HttpError(403, "You can only review people you have worked with on SkillBridge");
  const row = db(await supabase.from("feedback").insert({ author_id: req.user.id, target_id, rating, comment }).select("*").single());
  await notify(target_id, { title: "New feedback received", message: `${req.user.name} rated you ${rating}/5.`, type: "System", link: `/${(allowed.find((t) => t.id === target_id)?.role || "student").toLowerCase()}/feedback` });
  res.status(201).json(row);
}));

r.put("/:id", wrap(async (req, res) => {
  const patch = { rating: int(req.body?.rating, { label: "Rating", min: 1, max: 5, required: true }), comment: str(req.body?.comment, { label: "Comment", max: 1000 }) };
  res.json(db(await supabase.from("feedback").update(patch).eq("id", uuid(req.params.id)).eq("author_id", req.user.id).select("*").single()));
}));
r.delete("/:id", wrap(async (req, res) => {
  db(await supabase.from("feedback").delete().eq("id", uuid(req.params.id)).eq("author_id", req.user.id).select("id").single());
  res.json({ ok: true });
}));

export default r;
