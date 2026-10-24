-- SkillBridge migration 001: additive changes only.
-- Safe to run more than once. Run it in the Supabase SQL Editor AFTER schema.sql.
-- Nothing is dropped; existing rows are kept (legacy status values are mapped first).

-- ---------- users ----------
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- ---------- profiles ----------
alter table student_profiles add column if not exists linkedin_url text;
alter table student_profiles add column if not exists github_url text;
alter table student_profiles add column if not exists portfolio_url text;
alter table student_profiles add column if not exists phone text;
alter table student_profiles add column if not exists location text;
alter table student_profiles add column if not exists career_goal text;

alter table mentor_profiles add column if not exists job_title text;
alter table mentor_profiles add column if not exists company text;
alter table mentor_profiles add column if not exists linkedin_url text;

alter table recruiter_profiles add column if not exists location text;
alter table recruiter_profiles add column if not exists linkedin_url text;

-- ---------- skills ----------
alter table student_skills add column if not exists is_primary boolean not null default false;
create unique index if not exists uq_student_primary_skill on student_skills(student_id) where is_primary;
do $$ begin
  create unique index if not exists uq_skills_name_lower on skills(lower(name));
exception when others then
  raise notice 'Skipped uq_skills_name_lower (case-duplicate skill names exist): %', sqlerrm;
end $$;

-- ---------- projects ----------
alter table projects add column if not exists tech_stack text[];
alter table projects add column if not exists project_url text;
alter table projects add column if not exists repo_url text;
alter table projects add column if not exists updated_at timestamptz default now();
update projects set status='In Progress' where status is null or status not in ('Planning','In Progress','Completed');
alter table projects alter column status set default 'Planning';
alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check check (status in ('Planning','In Progress','Completed'));

-- ---------- micro_internships ----------
alter table micro_internships add column if not exists responsibilities text;
alter table micro_internships add column if not exists requirements text;
alter table micro_internships add column if not exists updated_at timestamptz default now();
update micro_internships set status='Published' where status is null or status not in ('Draft','Published','Closed');
alter table micro_internships drop constraint if exists micro_internships_status_check;
alter table micro_internships add constraint micro_internships_status_check check (status in ('Draft','Published','Closed'));

-- ---------- internship_applications ----------
alter table internship_applications add column if not exists resume_url text;
alter table internship_applications add column if not exists updated_at timestamptz default now();
update internship_applications set status='Pending' where status is null or status not in ('Pending','Shortlisted','Accepted','Rejected');
alter table internship_applications drop constraint if exists internship_applications_status_check;
alter table internship_applications add constraint internship_applications_status_check check (status in ('Pending','Shortlisted','Accepted','Rejected'));

-- ---------- mentorship_requests ----------
alter table mentorship_requests add column if not exists updated_at timestamptz default now();
update mentorship_requests set status='Active' where status='Accepted';
update mentorship_requests set status='Pending' where status is null or status not in ('Pending','Active','Completed','Rejected');
alter table mentorship_requests drop constraint if exists mentorship_requests_status_check;
alter table mentorship_requests add constraint mentorship_requests_status_check check (status in ('Pending','Active','Completed','Rejected'));

-- ---------- skill_exchange_requests ----------
alter table skill_exchange_requests add column if not exists message text;
alter table skill_exchange_requests add column if not exists updated_at timestamptz default now();
update skill_exchange_requests set status='Pending' where status is null or status not in ('Pending','Accepted','Rejected','Completed');
alter table skill_exchange_requests drop constraint if exists skill_exchange_status_check;
alter table skill_exchange_requests add constraint skill_exchange_status_check check (status in ('Pending','Accepted','Rejected','Completed'));
alter table skill_exchange_requests drop constraint if exists skill_exchange_not_self;
alter table skill_exchange_requests add constraint skill_exchange_not_self check (from_student <> to_student);

-- ---------- notifications ----------
alter table notifications add column if not exists link text;

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['users','projects','micro_internships','internship_applications','mentorship_requests','skill_exchange_requests'] loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$I', t);
    execute format('create trigger trg_%1$s_updated before update on %1$I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------- indexes on foreign keys / common filters ----------
create index if not exists idx_projects_student on projects(student_id);
create index if not exists idx_internships_recruiter on micro_internships(recruiter_id);
create index if not exists idx_internships_status on micro_internships(status);
create index if not exists idx_applications_student on internship_applications(student_id);
create index if not exists idx_applications_internship on internship_applications(internship_id);
create index if not exists idx_mentorship_student on mentorship_requests(student_id);
create index if not exists idx_mentorship_mentor on mentorship_requests(mentor_id);
create index if not exists idx_exchange_from on skill_exchange_requests(from_student);
create index if not exists idx_exchange_to on skill_exchange_requests(to_student);
create index if not exists idx_notifications_recipient on notifications(recipient, read);
create index if not exists idx_feedback_target on feedback(target_id);
create index if not exists idx_student_skills_skill on student_skills(skill_id);
create index if not exists idx_admin_logs_created on admin_logs(created_at desc);
