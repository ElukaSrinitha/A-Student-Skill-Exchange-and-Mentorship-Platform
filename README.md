# SkillBridge

Student / Mentor / Recruiter / Admin portal. React + Vite frontend, Express backend, Supabase Postgres.

This is version 2 of the project: same architecture and the same 14 database tables as before, with
security fixes, real ownership checks, and the missing features from all four portals built out. Nothing
was rebuilt from scratch — see `CHANGELOG.md` for exactly what changed and why.

## 1. Set up the database

1. Open your existing Supabase project's SQL Editor.
2. If you have never run `database/schema.sql`, run it first.
3. Run **`database/migrations/001_complete_system.sql`**. It is additive and safe to re-run: new columns,
   new indexes, status constraints, and `updated_at` triggers. It does not drop or rename anything.
4. Run `npm run seed` (see step 3 below) once your `.env` is set up, to populate the skill catalog and four
   demo accounts (`student@demo.com` / `mentor@demo.com` / `recruiter@demo.com` / `admin@demo.com`, password
   `Demo@12345` unless you set `DEMO_PASSWORD`).
5. Only after you've confirmed the backend works (step 3), run **`database/migrations/002_enable_rls.sql`**.
   This turns on Row Level Security with no policies, so only your backend (using the service-role key) can
   read or write the tables — the public/anon key can no longer touch them directly. Do this last, since it
   will break anything still using the anon key.

## 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

```env
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # Project Settings → API. Keep secret.
JWT_SECRET=...                                     # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
CORS_ORIGIN=http://localhost:5173
```

The service-role key is what lets the backend bypass RLS once you enable it in step 1.5. If you only have
the anon key, the app still runs, but your tables stay wide open to anyone with that key — set
`SUPABASE_ANON_KEY` instead and treat this as temporary.

## 3. Install and run

This is an npm workspaces project, so **one `npm install` at the project root** installs both the
backend's and frontend's dependencies — don't run `npm install` separately inside `backend/` or
`frontend/` unless you're troubleshooting.

```bash
npm install
npm run seed          # skill catalog + demo accounts (backend/.env must be set first)
npm run dev            # runs backend (:5000) and frontend (:5173) together
```

If you already ran `npm install` before this fix and are seeing `ERR_MODULE_NOT_FOUND` when the backend
starts, delete `node_modules` (and `package-lock.json` if present) at the project root and run
`npm install` again from there.

Or separately: `npm run backend` / `npm run frontend`.

Visit `http://localhost:5000/api/health` — it should report `{"ok":true,"database":"supabase","serviceRole":true}`.

To promote a real account to Administrator instead of using the demo one:

```bash
npm run create-admin -- "Your Name" you@example.com "a-strong-password"
```

## What's real, what isn't

Every button in every portal calls a real REST endpoint backed by Supabase Postgres — see
`CHANGELOG.md` for the full endpoint list. There is no mock data and no localStorage database; the browser
only keeps the session token. Messaging was intentionally left out: there is no messaging infrastructure in
the schema, and the brief was explicit about not faking one.

## Portal functionality

- **Student:** profile with resume/links, skills (with primary skill), projects, skill exchange (with a
  real student directory and skill pickers), find mentors, mentorship tracking, internship browse/search/
  recommendations, applications with resume + cover note, notifications, feedback.
- **Mentor:** profile, mentorship requests (accept/reject/complete), mentee list with skills/projects/
  progress, notifications, feedback.
- **Recruiter:** company profile, create/edit/close internships (Draft/Published/Closed), applications with
  full applicant context (skills, projects, resume) and a Shortlisted status, analytics.
- **Admin:** user management (search/filter/activate/deactivate/delete) split by role, read-only monitors
  for internships/applications/mentorships/exchanges, skill catalog management, notification broadcast,
  feedback moderation, CSV reports, platform analytics, admin action log.

## Project layout

```
backend/src/
  config.js            env/config, Supabase client
  middleware/auth.js    JWT auth, role guard
  lib/http.js           shared validation, error handling, notify/log helpers
  routes/                one file per resource
database/
  schema.sql             original schema (baseline, unchanged)
  migrations/             001 additive columns/constraints, 002 enable RLS
frontend/src/
  api.js, auth.jsx        API client, session/auth context
  ui.jsx                  shared components (toasts, modals, tables, cards…)
  nav.js, Shell.jsx        sidebar/topbar shell, per-role navigation
  pages/                   one or two files per portal
```
link:https://skillbridge-frontend-6jzq.onrender.com
SkillBridge – Skill exchange, mentorship and micro-internships
 
