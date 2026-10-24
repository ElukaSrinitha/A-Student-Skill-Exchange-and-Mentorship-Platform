create extension if not exists pgcrypto;
create table if not exists users(id uuid primary key default gen_random_uuid(),name text not null,email text unique not null,password_hash text not null,role text not null check(role in ('Student','Mentor','Recruiter','Admin')),created_at timestamptz default now(),updated_at timestamptz default now());
create table if not exists skills(id uuid primary key default gen_random_uuid(),name text unique not null,created_at timestamptz default now());
create table if not exists student_profiles(id uuid primary key references users(id) on delete cascade,bio text,college text,department text,graduation_year int,interests text[],resume_url text,avatar_url text);
create table if not exists mentor_profiles(id uuid primary key references users(id) on delete cascade,bio text,expertise text[],experience_years int,availability text);
create table if not exists recruiter_profiles(id uuid primary key references users(id) on delete cascade,company_name text,description text,industry text,website text,logo_url text);
create table if not exists student_skills(student_id uuid references users(id) on delete cascade,skill_id uuid references skills(id) on delete cascade,level text check(level in('Beginner','Intermediate','Advanced')),primary key(student_id,skill_id));
create table if not exists projects(id uuid primary key default gen_random_uuid(),student_id uuid references users(id) on delete cascade,title text not null,description text,status text default 'Active',created_at timestamptz default now());
create table if not exists micro_internships(id uuid primary key default gen_random_uuid(),recruiter_id uuid references users(id) on delete cascade,title text not null,description text not null,skills text[],duration text,location text,work_mode text,stipend numeric,openings int default 1,deadline date,start_date date,end_date date,status text default 'Published',created_at timestamptz default now());
create table if not exists internship_applications(id uuid primary key default gen_random_uuid(),internship_id uuid references micro_internships(id) on delete cascade,student_id uuid references users(id) on delete cascade,status text default 'Pending',cover_note text,created_at timestamptz default now(),unique(internship_id,student_id));
create table if not exists mentorship_requests(id uuid primary key default gen_random_uuid(),student_id uuid references users(id) on delete cascade,mentor_id uuid references users(id) on delete cascade,status text default 'Pending',message text,created_at timestamptz default now());
create table if not exists skill_exchange_requests(id uuid primary key default gen_random_uuid(),from_student uuid references users(id) on delete cascade,to_student uuid references users(id) on delete cascade,offer_skill uuid references skills(id),request_skill uuid references skills(id),status text default 'Pending',created_at timestamptz default now());
create table if not exists notifications(id uuid primary key default gen_random_uuid(),recipient uuid references users(id) on delete cascade,title text not null,message text not null,type text,read boolean default false,created_at timestamptz default now());
create table if not exists feedback(id uuid primary key default gen_random_uuid(),author_id uuid references users(id) on delete cascade,target_id uuid references users(id) on delete cascade,rating int check(rating between 1 and 5),comment text,created_at timestamptz default now());
create table if not exists admin_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references users(id),action text not null,metadata jsonb,created_at timestamptz default now());
create index if not exists idx_internships_title on micro_internships using gin(to_tsvector('english',title));
create index if not exists idx_users_role on users(role);

-- SkillBridge currently authenticates through the Express JWT layer.
-- Keep Supabase RLS disabled for these custom-JWT tables unless you later
-- migrate authentication to Supabase Auth and add matching auth.uid() policies.
