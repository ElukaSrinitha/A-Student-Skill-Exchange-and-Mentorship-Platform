import jwt from "jsonwebtoken";
import { JWT_SECRET, supabase } from "../config.js";
import { HttpError, wrap } from "../lib/http.js";

export const signToken = (user) => jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });

/** Verifies the bearer token, then re-loads the user so role changes, deactivation and deletion take effect immediately. */
export const authenticate = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
  let payload;
  try { payload = jwt.verify(h.slice(7), JWT_SECRET); } catch { throw new HttpError(401, "Your session has expired. Please log in again."); }
  const { data: user } = await supabase.from("users").select("id,name,email,role,is_active").eq("id", payload.sub).maybeSingle();
  if (!user) throw new HttpError(401, "Account no longer exists");
  if (!user.is_active) throw new HttpError(403, "This account has been deactivated");
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, "You do not have permission for this action"));
