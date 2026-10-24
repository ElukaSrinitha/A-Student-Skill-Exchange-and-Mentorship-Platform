import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, oneOf, uuid, notify, logAdmin, userMap, skillMap, skillsByStudent } from "../lib/http.js";

const r = Router();

/** Student directory for skill exchange: other active students with their skills. Filters: search (name), skill (name). */
r.get("/students", requireRole("Student"), wrap(async (req, res) => {
  let q = supabase.from("users").select("id,name").eq("role", "Student").eq("is_active", true).neq("id", req.user.id).order("name").limit(300);
  if (req.query.search) q = q.ilike("name", `%${String(req.query.search).slice(0, 60)}%`);
  const users = db(await q);
  const S = await skillsByStudent(users.map((u) => u.id));
  const prof = users.length ? db(await supabase.from("student_profiles").select("id,college,department").in("id", users.map((u) => u.id))) : [];
  const P = new Map(prof.map((p) => [p.id, p]));
  const skill = String(req.query.skill || "").toLowerCase();
  let out = users.map((u) => ({ ...u, ...(P.get(u.id) || {}), skills: S.get(u.id) || [] }));
  if (skill) out = out.filter((u) => u.skills.some((s) => s.name?.toLowerCase().includes(skill)));
  res.json(out);
}));

r.post("/", requireRole("Student"), wrap(async (req, res) => {
  const to_student = uuid(req.body?.to_student, "Student");
  const offer_skill = uuid(req.body?.offer_skill, "Skill to offer");
  const request_skill = uuid(req.body?.request_skill, "Skill to learn");
  const message = str(req.body?.message, { label: "Message", max: 500 });
  if (to_student === req.user.id) throw new HttpError(400, "You cannot exchange skills with yourself");
  const { data: target } = await supabase.from("users").select("id,name").eq("id", to_student).eq("role", "Student").eq("is_active", true).maybeSingle();
  if (!target) throw new HttpError(404, "Student not found");
  const { data: mineHas } = await supabase.from("student_skills").select("skill_id").eq("student_id", req.user.id).eq("skill_id", offer_skill).maybeSingle();
  if (!mineHas) throw new HttpError(400, "You can only offer a skill that is on your My Skills list");
  const { data: theirHas } = await supabase.from("student_skills").select("skill_id").eq("student_id", to_student).eq("skill_id", request_skill).maybeSingle();
  if (!theirHas) throw new HttpError(400, "That student has not listed the skill you want to learn");
  const { data: dup } = await supabase.from("skill_exchange_requests").select("id").eq("from_student", req.user.id).eq("to_student", to_student).eq("offer_skill", offer_skill).eq("request_skill", request_skill).eq("status", "Pending").maybeSingle();
  if (dup) throw new HttpError(409, "You already sent this exact request and it is still pending");
  const row = db(await supabase.from("skill_exchange_requests").insert({ from_student: req.user.id, to_student, offer_skill, request_skill, message }).select("*").single());
  const K = await skillMap([offer_skill, request_skill]);
  await notify(to_student, { title: "New skill exchange request", message: `${req.user.name} offers ${K.get(offer_skill)} in exchange for ${K.get(request_skill)}.`, type: "Exchange", link: "/student/exchange" });
  res.status(201).json(row);
}));

/** My requests, tagged direction: "sent" | "received". */
r.get("/", requireRole("Student"), wrap(async (req, res) => {
  const rows = db(await supabase.from("skill_exchange_requests").select("*").or(`from_student.eq.${req.user.id},to_student.eq.${req.user.id}`).order("created_at", { ascending: false }));
  const U = await userMap(rows.flatMap((x) => [x.from_student, x.to_student]));
  const K = await skillMap(rows.flatMap((x) => [x.offer_skill, x.request_skill]));
  res.json(rows.map((x) => ({ ...x, direction: x.from_student === req.user.id ? "sent" : "received",
    from_name: U.get(x.from_student)?.name, to_name: U.get(x.to_student)?.name, offer_skill_name: K.get(x.offer_skill), request_skill_name: K.get(x.request_skill) })));
}));

/** Recipient: Accepted | Rejected (from Pending). Either participant: Completed (from Accepted). */
r.patch("/:id/status", requireRole("Student", "Admin"), wrap(async (req, res) => {
  const id = uuid(req.params.id);
  const status = oneOf(req.body?.status, ["Accepted", "Rejected", "Completed", "Pending"], "Status");
  const x = db(await supabase.from("skill_exchange_requests").select("*").eq("id", id).single());
  if (req.user.role === "Student") {
    const isTo = x.to_student === req.user.id; const isFrom = x.from_student === req.user.id;
    if (!isTo && !isFrom) throw new HttpError(403, "This exchange is not yours");
    const okAnswer = isTo && x.status === "Pending" && ["Accepted", "Rejected"].includes(status);
    const okComplete = x.status === "Accepted" && status === "Completed";
    if (!okAnswer && !okComplete) throw new HttpError(400, "That status change is not allowed");
  }
  const row = db(await supabase.from("skill_exchange_requests").update({ status }).eq("id", id).select("*").single());
  if (req.user.role === "Student") {
    const other = x.from_student === req.user.id ? x.to_student : x.from_student;
    await notify(other, { title: `Skill exchange ${status.toLowerCase()}`, message: `${req.user.name} marked your skill exchange as ${status.toLowerCase()}.`, type: "Exchange", link: "/student/exchange" });
  } else await logAdmin(req.user.id, "exchange.status", { id, status });
  res.json(row);
}));

export default r;
