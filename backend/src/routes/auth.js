import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config.js";
import { signToken, authenticate } from "../middleware/auth.js";
import { HttpError, wrap, db, isEmail, str } from "../lib/http.js";

const r = Router();
const PROFILE_TABLE = { Student: "student_profiles", Mentor: "mentor_profiles", Recruiter: "recruiter_profiles" };
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

r.post("/register", wrap(async (req, res) => {
  const name = str(req.body?.name, { label: "Name", required: true, max: 100 });
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = req.body?.role || "Student";
  if (name.length < 2) throw new HttpError(400, "Name must be at least 2 characters");
  if (!isEmail(email)) throw new HttpError(400, "Enter a valid email address");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (role === "Admin") throw new HttpError(403, "Administrator accounts cannot be self-registered");
  if (!PROFILE_TABLE[role]) throw new HttpError(400, "Choose Student, Mentor or Recruiter");
  const password_hash = await bcrypt.hash(password, 12);
  const user = db(await supabase.from("users").insert({ name, email, password_hash, role }).select("id,name,email,role").single());
  db(await supabase.from(PROFILE_TABLE[role]).upsert({ id: user.id }));
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

r.post("/login", wrap(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) throw new HttpError(400, "Email and password are required");
  const { data: user } = await supabase.from("users").select("id,name,email,role,password_hash,is_active").eq("email", email).maybeSingle();
  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, "Invalid email or password");
  if (!user.is_active) throw new HttpError(403, "This account has been deactivated. Contact an administrator.");
  res.json({ token: signToken(user), user: publicUser(user) });
}));

r.get("/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

r.post("/change-password", authenticate, wrap(async (req, res) => {
  const current = String(req.body?.current_password || "");
  const next = String(req.body?.new_password || "");
  if (next.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
  const { data: u } = await supabase.from("users").select("password_hash").eq("id", req.user.id).single();
  if (!(await bcrypt.compare(current, u.password_hash))) throw new HttpError(400, "Current password is incorrect");
  db(await supabase.from("users").update({ password_hash: await bcrypt.hash(next, 12) }).eq("id", req.user.id).select("id").single());
  res.json({ ok: true });
}));

export default r;
