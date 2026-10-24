-- SkillBridge migration 002: lock the tables against the public anon/publishable key.
--
-- RUN THIS ONLY AFTER you have put SUPABASE_SERVICE_ROLE_KEY in backend/.env and
-- confirmed the backend works with it (GET /api/health shows "serviceRole": true).
-- The service-role key bypasses RLS, so the Express API keeps working, while anyone
-- holding only the anon key can no longer read or write these tables directly.

alter table users                   enable row level security;
alter table skills                  enable row level security;
alter table student_profiles        enable row level security;
alter table mentor_profiles         enable row level security;
alter table recruiter_profiles      enable row level security;
alter table student_skills          enable row level security;
alter table projects                enable row level security;
alter table micro_internships       enable row level security;
alter table internship_applications enable row level security;
alter table mentorship_requests     enable row level security;
alter table skill_exchange_requests enable row level security;
alter table notifications           enable row level security;
alter table feedback                enable row level security;
alter table admin_logs              enable row level security;
-- No policies are created on purpose: with RLS on and no policy, anon/authenticated
-- roles get no access. Only the backend (service role) can touch the data.
