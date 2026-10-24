import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, wrap, db, str, oneOf, uuid, logAdmin } from "../lib/http.js";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

/* ---- Skill catalog (all roles read, Admin manages) ---- */
export const catalog = Router();
catalog.get("/", wrap(async (req, res) => {
  let q = supabase.from("skills").select("id,name").order("name").limit(500);
  if (req.query.search) q = q.ilike("name", `%${String(req.query.search).slice(0, 60)}%`);
  res.json(db(await q));
}));
catalog.post("/", requireRole("Admin"), wrap(async (req, res) => {
  const name = str(req.body?.name, { label: "Skill name", required: true, max: 60 });
  const row = db(await supabase.from("skills").insert({ name }).select("*").single());
  await logAdmin(req.user.id, "skill.create", { id: row.id, name });
  res.status(201).json(row);
}));
catalog.put("/:id", requireRole("Admin"), wrap(async (req, res) => {
  const name = str(req.body?.name, { label: "Skill name", required: true, max: 60 });
  const row = db(await supabase.from("skills").update({ name }).eq("id", uuid(req.params.id)).select("*").single());
  await logAdmin(req.user.id, "skill.update", { id: row.id, name });
  res.json(row);
}));
catalog.delete("/:id", requireRole("Admin"), wrap(async (req, res) => {
  const id = uuid(req.params.id);
  db(await supabase.from("skills").delete().eq("id", id).select("id").single());
  await logAdmin(req.user.id, "skill.delete", { id });
  res.json({ ok: true });
}));

/* ---- A student's own skills (student_skills) ---- */
export const mine = Router();
mine.use(requireRole("Student"));
const shape = (r) => ({ skill_id: r.skill_id, name: r.skills?.name, level: r.level, is_primary: r.is_primary });

mine.get("/", wrap(async (req, res) => {
  const rows = db(await supabase.from("student_skills").select("skill_id,level,is_primary,skills(name)").eq("student_id", req.user.id));
  res.json(rows.map(shape).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name)));
}));

async function setPrimary(studentId, skillId) {
  db(await supabase.from("student_skills").update({ is_primary: false }).eq("student_id", studentId).eq("is_primary", true).select("skill_id"));
  db(await supabase.from("student_skills").update({ is_primary: true }).eq("student_id", studentId).eq("skill_id", skillId).select("skill_id"));
}

mine.post("/", wrap(async (req, res) => {
  const level = oneOf(req.body?.level || "Beginner", LEVELS, "Level");
  let skillId = req.body?.skill_id;
  if (skillId) uuid(skillId, "Skill");
  else {
    const name = str(req.body?.name, { label: "Skill", required: true, max: 60 });
    const { data: found } = await supabase.from("skills").select("id").ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    skillId = found?.id || db(await supabase.from("skills").insert({ name }).select("id").single()).id;
  }
  const { data: dup } = await supabase.from("student_skills").select("skill_id").eq("student_id", req.user.id).eq("skill_id", skillId).maybeSingle();
  if (dup) throw new HttpError(409, "You have already added this skill");
  db(await supabase.from("student_skills").insert({ student_id: req.user.id, skill_id: skillId, level }).select("skill_id").single());
  if (req.body?.is_primary) await setPrimary(req.user.id, skillId);
  const row = db(await supabase.from("student_skills").select("skill_id,level,is_primary,skills(name)").eq("student_id", req.user.id).eq("skill_id", skillId).single());
  res.status(201).json(shape(row));
}));

mine.put("/:skillId", wrap(async (req, res) => {
  const skillId = uuid(req.params.skillId, "Skill");
  const patch = {};
  if (req.body?.level !== undefined) patch.level = oneOf(req.body.level, LEVELS, "Level");
  if (Object.keys(patch).length) db(await supabase.from("student_skills").update(patch).eq("student_id", req.user.id).eq("skill_id", skillId).select("skill_id").single());
  if (req.body?.is_primary === true) await setPrimary(req.user.id, skillId);
  if (req.body?.is_primary === false) db(await supabase.from("student_skills").update({ is_primary: false }).eq("student_id", req.user.id).eq("skill_id", skillId).select("skill_id").single());
  const row = db(await supabase.from("student_skills").select("skill_id,level,is_primary,skills(name)").eq("student_id", req.user.id).eq("skill_id", skillId).single());
  res.json(shape(row));
}));

mine.delete("/:skillId", wrap(async (req, res) => {
  db(await supabase.from("student_skills").delete().eq("student_id", req.user.id).eq("skill_id", uuid(req.params.skillId, "Skill")).select("skill_id").single());
  res.json({ ok: true });
}));
