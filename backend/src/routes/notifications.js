import { Router } from "express";
import { supabase } from "../config.js";
import { wrap, db, uuid, count } from "../lib/http.js";

const r = Router();
r.get("/", wrap(async (req, res) => {
  let q = supabase.from("notifications").select("*").eq("recipient", req.user.id).order("created_at", { ascending: false }).limit(200);
  if (req.query.unread === "true") q = q.eq("read", false);
  if (req.query.type) q = q.eq("type", String(req.query.type));
  res.json(db(await q));
}));
r.get("/unread-count", wrap(async (req, res) => res.json({ count: await count("notifications", (q) => q.eq("recipient", req.user.id).eq("read", false)) })));
r.post("/read-all", wrap(async (req, res) => {
  db(await supabase.from("notifications").update({ read: true }).eq("recipient", req.user.id).eq("read", false).select("id"));
  res.json({ ok: true });
}));
r.patch("/:id/read", wrap(async (req, res) => {
  const read = req.body?.read !== false;
  res.json(db(await supabase.from("notifications").update({ read }).eq("id", uuid(req.params.id)).eq("recipient", req.user.id).select("*").single()));
}));
r.delete("/:id", wrap(async (req, res) => {
  db(await supabase.from("notifications").delete().eq("id", uuid(req.params.id)).eq("recipient", req.user.id).select("id").single());
  res.json({ ok: true });
}));
export default r;
