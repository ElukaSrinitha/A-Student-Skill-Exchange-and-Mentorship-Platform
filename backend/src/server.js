import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PORT, CORS_ORIGINS, usingServiceRole, supabase } from "./config.js";
import { authenticate } from "./middleware/auth.js";
import { HttpError } from "./lib/http.js";
import authRoutes from "./routes/auth.js";
import profileRoutes, { uploads, settings } from "./routes/profile.js";
import { catalog, mine as mySkills } from "./routes/skills.js";
import projectRoutes from "./routes/projects.js";
import internshipRoutes from "./routes/internships.js";
import applicationRoutes from "./routes/applications.js";
import { directory as mentorDirectory, mentorships, mentees } from "./routes/mentors.js";
import exchangeRoutes from "./routes/exchanges.js";
import notificationRoutes from "./routes/notifications.js";
import feedbackRoutes from "./routes/feedback.js";
import dashboardRoutes from "./routes/dashboard.js";
import recruiterAnalytics from "./routes/recruiterAnalytics.js";
import adminRoutes from "./routes/admin.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", async (_req, res) => {
  const { error } = await supabase.from("users").select("id", { head: true, count: "exact" }).limit(1);
  res.status(error ? 503 : 200).json({ ok: !error, database: error ? "unreachable" : "supabase", serviceRole: usingServiceRole });
});

app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many login attempts. Try again later." } }));
app.use("/api/auth/register", rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many sign-ups from this address. Try again later." } }));

app.use("/api/auth", authRoutes);

// Everything below requires a valid, active account.
app.use("/api", authenticate);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/uploads", uploads);
app.use("/api/settings", settings);
app.use("/api/skills", catalog);
app.use("/api/my-skills", mySkills);
app.use("/api/projects", projectRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/mentors", mentorDirectory);
app.use("/api/mentorships", mentorships);
app.use("/api/mentees", mentees);
app.use("/api/exchanges", exchangeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/recruiter-analytics", recruiterAnalytics);
app.use("/api/admin", adminRoutes);

app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === "entity.too.large" ? 413 : 500);
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong on the server" : err.message });
});

app.listen(PORT, () => console.log(`SkillBridge API running on http://localhost:${PORT}`));
