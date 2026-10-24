# SkillBridge v2 — what changed and why

This upgrade kept the existing architecture (React + Vite, Express, Supabase Postgres, custom JWT auth) and
the 14 tables you already have. Nothing was rebuilt from scratch. This file explains every change so you can
verify it against the analysis report from before this work started.

## Security fixes (were critical)

- Removed the demo-account login bypass that accepted **any password** for the four demo emails, even with
  Supabase configured, and could hand out an Admin token.
- Removed the in-memory "demo fallback" data path entirely — the backend now refuses to start without valid
  Supabase credentials, so there is no non-database mode to accidentally ship.
- Blocked self-registration as Admin (`role: "Admin"` on `/auth/register` now returns 403).
- `GET /api/users` no longer exists as a raw table dump; admin user endpoints select explicit columns and
  never return `password_hash`.
- Added ownership checks everywhere a resource has an owner: a student can only edit/delete their own
  projects/applications/exchange requests; a recruiter can only edit/delete/close their own internships; a
  mentor can only act on requests addressed to them.
- Removed mass assignment: every write route now whitelists and validates fields (via `lib/http.js`
  helpers) instead of spreading `req.body` into the database call. `role` can no longer be changed by
  editing your own profile.
- `JWT_SECRET` is now required and rejected if it's the placeholder or under 16 characters; `helmet`,
  `express-rate-limit` (global + stricter on login/register), and a strict CORS allow-list were added.
- Added `database/migrations/002_enable_rls.sql` to turn on Row Level Security with no policies, so only the
  backend's service-role key can reach the tables — the previously-exposed anon key can no longer read or
  write anything directly.
- Fixed `index.html`: added `<!DOCTYPE html>`, a viewport meta tag (mobile styles were silently not applying
  without it), and a page title.

## Bug fixes

- **Profile save was broken for every role** — the old `PUT /api/profile` tried to upsert `name`/`email`
  into role-specific tables that have no such columns. Fixed: `name` now updates `users`, the rest updates
  the correct profile table.
- Recruiters could edit or delete each other's internships; any student could mark any application
  "Accepted"; any user could edit or delete any feedback. All fixed by the ownership checks above.
- The dashboard's "Activity overview" chart and the 86% profile-completion figure were hard-coded and
  labeled "Live backend data". Replaced with dashboards computed from real rows per role, and profile
  completion computed from which fields are actually filled in.
- Duplicate applications, duplicate pending exchange requests, and self-exchange are now rejected with a
  clear message instead of surfacing a raw Postgres error (a DB constraint still backs this up).

## New features, by portal

**Student:** My Skills (add/edit/remove, levels, one primary skill) — the `student_skills` table had no
endpoint or UI before. Skill exchange now has a real student directory with skill pickers instead of typed
UUIDs, sent/received tabs, accept/reject, and history. Find Mentors is a new directory with search/filters
and ratings computed from feedback. Projects gained a status selector, tech stack, and links. Internships
gained search/filters, a recommendations tab (matched by your skills), and a proper details view; applying
now takes a cover note and an optional resume upload (falls back to your profile resume). Notifications now
support unread state, mark-read, and delete. Settings gained password change and notification preferences.

**Mentor:** A real dashboard (active students, pending requests, completed, rating). Mentorship Requests now
supports the full Pending → Active → Completed lifecycle (previously only Accepted/Rejected existed).
Mentees shows each student's skills and project completion, computed from real data.

**Recruiter:** Internships now have Draft/Published/Closed status, a close action, responsibilities/
requirements fields, and date validation. Applications show full applicant context — skills, projects,
resume — and support a Shortlisted step before Accept/Reject. Analytics is now real: status distribution,
per-internship performance, top applicant skills, and a 30-day trend, all computed from your own data only.

**Admin:** User management now supports search, role/active filters, pagination, view, and
activate/deactivate (in addition to edit/delete) — with safeguards against deleting yourself or the last
admin. Added dedicated Students/Mentors/Recruiters views (filtered Users). Added read-only monitors for
internships, applications, mentorships, and exchanges. Added a Skills management page (was missing from the
admin nav). Added a notification broadcast tool. Added feedback moderation. Added CSV report exports. Added
real platform analytics. Admin Logs now actually receives entries — every admin write action logs itself.

**Common:** Real client-side routes (deep-linkable, back-button works) replacing the single-state-variable
page switch. Toasts and a confirm dialog replace `alert()`/`confirm()`. Loading, error, and empty states are
consistent across pages. Deactivated accounts are rejected at both login and on every subsequent request
(the auth middleware re-checks `is_active` per request, not just at login).

## Database migration (`database/migrations/001_complete_system.sql`)

Additive only — no table or column was dropped or renamed. Adds: `users.is_active`,
`users.notification_prefs`; profile links/location/phone/job-title/company columns; `student_skills.is_primary`;
`projects.tech_stack/project_url/repo_url`; `micro_internships.responsibilities/requirements`;
`internship_applications.resume_url`; `skill_exchange_requests.message`; `notifications.link`; `updated_at`
on the six tables that needed it, with a trigger to maintain it; CHECK constraints on every status column
(existing out-of-range values are mapped to a safe default first, e.g. old `Accepted` mentorships become
`Active`); and indexes on foreign keys and common filter columns. Migration `002` is separate and optional
(but recommended) so you can verify `001` works before locking the tables down with RLS.

## Left out on purpose

- **Messaging** — there is no messaging table or realtime infrastructure in the schema, and the brief said
  not to fake it. It's not in this version.
- **Mentor sessions/scheduling** — no table exists for this; it wasn't listed as required, and adding one
  would be a new table rather than filling a gap, so it was left for you to confirm before building.
