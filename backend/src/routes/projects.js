import { Router } from "express";
import { supabase } from "../config.js";
import { requireRole } from "../middleware/auth.js";
import { wrap, db, str, list, oneOf, uuid } from "../lib/http.js";

const r = Router();
r.use(requireRole("Student"));
const STATUSES = ["Planning", "In Progress", "Completed"];

const body = (b) => ({
  title: str(b?.title, { label: "Title", required: true, max: 150 }),
  description: str(b?.description, { label: "Description", max: 2000 }),
  status: oneOf(b?.status || "Planning", STATUSES, "Status"),
  tech_stack: list(b?.tech_stack),
  project_url: str(b?.project_url, { label: "Project link", max: 300 }),
  repo_url: str(b?.repo_url, { label: "Repository link", max: 300 }),
});

r.get("/", wrap(async (req, res) => {
  let q = supabase.from("projects").select("*").eq("student_id", req.user.id).order("created_at", { ascending: false });
  if (req.query.status) q = q.eq("status", String(req.query.status));
  if (req.query.search) q = q.ilike("title", `%${String(req.query.search).slice(0, 80)}%`);
  res.json(db(await q));
}));
r.get("/:id", wrap(async (req, res) => res.json(db(await supabase.from("projects").select("*").eq("id", uuid(req.params.id)).eq("student_id", req.user.id).single()))));
r.post("/", wrap(async (req, res) => res.status(201).json(db(await supabase.from("projects").insert({ ...body(req.body), student_id: req.user.id }).select("*").single()))));
r.put("/:id", wrap(async (req, res) => res.json(db(await supabase.from("projects").update(body(req.body)).eq("id", uuid(req.params.id)).eq("student_id", req.user.id).select("*").single()))));
r.delete("/:id", wrap(async (req, res) => {
  db(await supabase.from("projects").delete().eq("id", uuid(req.params.id)).eq("student_id", req.user.id).select("id").single());
  res.json({ ok: true });
}));
export default r;
