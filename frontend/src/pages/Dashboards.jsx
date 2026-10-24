import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Async, useFetch, StatCard, Empty, Progress, Stars, Chips, BarBlock, fmtDate, Badge } from "../ui.jsx";

const first = (n) => (n || "there").split(" ")[0];

function Hero({ user, text, completion }) {
  return (
    <div className="hero"><div>
      <span className="pill light">{user.role.toUpperCase()} PORTAL</span>
      <h1>Welcome back, {first(user.name)}.</h1>
      <p>{text}</p>
      {completion !== undefined && <><Progress value={completion} /><small>Profile {completion}% complete{completion < 100 && <> · <Link to={`/${user.role.toLowerCase()}/profile`} style={{ color: "#fff" }}>finish your profile</Link></>}</small></>}
    </div><div className="hero-mark">SB</div></div>
  );
}
const Recent = ({ items, base }) => (
  <div className="card"><div className="section-title"><h3>Recent activity</h3><Link to={`${base}/notifications`} className="muted">View all</Link></div>
    {items?.length ? items.map((n) => <div className="mini-row" key={n.id}><div><b>{n.title}</b><div className="muted">{n.message}</div></div><span className="muted">{fmtDate(n.created_at)}</span></div>) : <Empty title="No activity yet" text="Updates about your applications, mentorships and exchanges show up here." />}
  </div>
);

function StudentDashboard({ user, d }) {
  const base = "/student";
  const levels = ["Beginner", "Intermediate", "Advanced"].map((name) => ({ name, value: d.skill_levels[name] || 0 }));
  return (<>
    <Hero user={user} completion={d.profile_completion} text="Track your skills, applications, mentorships and exchanges in one place." />
    <div className="stats auto">
      <StatCard label="Skills" value={d.counts.skills} hint={`${d.skill_levels.Advanced || 0} advanced`} />
      <StatCard label="Projects" value={d.counts.projects} hint={`${d.projects_by_status.Completed || 0} completed`} />
      <StatCard label="Applications" value={d.counts.applications} hint={`${d.applications_by_status.Accepted || 0} accepted · ${d.applications_by_status.Pending || 0} pending`} />
      <StatCard label="Skill exchanges" value={d.counts.exchanges} hint={`${d.pending_exchange_requests} awaiting your reply`} />
      <StatCard label="Mentorships" value={d.counts.mentorships} hint={`${d.mentorships_by_status.Active || 0} active`} />
    </div>
    <div className="split">
      <div className="card"><div className="section-title"><h3>Recommended internships</h3><Link to={`${base}/internships`} className="muted">Browse all</Link></div>
        {d.recommended_internships.length ? d.recommended_internships.map((i) => <div className="mini-row" key={i.id}><div><b>{i.title}</b><div className="muted">{i.company_name}{i.location ? ` · ${i.location}` : ""}</div><Chips items={i.matched_skills} /></div><span className="muted">{i.deadline ? `Due ${fmtDate(i.deadline)}` : ""}</span></div>) : <Empty title="No matches yet" text="Add skills to My Skills to see internships that fit them." />}
      </div>
      <div className="card"><div className="section-title"><h3>Recommended mentors</h3><Link to={`${base}/mentors`} className="muted">Find mentors</Link></div>
        {d.recommended_mentors.length ? d.recommended_mentors.map((m) => <div className="mini-row" key={m.id}><div><b>{m.name}</b><div className="muted">{m.job_title || (m.expertise || []).slice(0, 3).join(", ") || "Mentor"}</div></div><Stars value={m.rating} /></div>) : <Empty title="No mentors yet" />}
      </div>
    </div>
    <div className="split" style={{ marginTop: 18 }}>
      <div className="card"><div className="section-title"><h3>Skill progress</h3><Link to={`${base}/skills`} className="muted">Manage skills</Link></div><BarBlock data={levels} height={180} /></div>
      <div className="card"><div className="section-title"><h3>Upcoming activities</h3></div>
        {d.upcoming.length ? d.upcoming.map((u, i) => <div className="mini-row" key={i}><b>{u.label}</b><span className="muted">{fmtDate(u.date)}</span></div>) : <Empty title="Nothing scheduled" text="Deadlines and start dates of internships you applied to appear here." />}
      </div>
    </div>
    <div style={{ marginTop: 18 }}><Recent items={d.recent_activity} base={base} /></div>
  </>);
}

function MentorDashboard({ user, d }) {
  const base = "/mentor";
  return (<>
    <Hero user={user} completion={d.profile_completion} text="See who you are mentoring and which requests are waiting for you." />
    <div className="stats auto">
      <StatCard label="Active students" value={d.counts.active_students} />
      <StatCard label="Pending requests" value={d.counts.pending_requests} />
      <StatCard label="Completed mentorships" value={d.counts.completed} />
      <StatCard label="Rating" value={d.rating ?? "–"} hint={`${d.counts.rating_count} review${d.counts.rating_count === 1 ? "" : "s"}`} />
    </div>
    <div className="split">
      <div className="card"><div className="section-title"><h3>Student progress</h3><Link to={`${base}/mentees`} className="muted">All students</Link></div>
        {d.student_progress.length ? d.student_progress.map((s) => (
          <div className="mini-row" key={s.id}><div style={{ flex: 1 }}><b>{s.name}</b><div className="muted">{s.skills} skills · {s.projects_completed}/{s.projects_total} projects completed</div><Progress value={s.projects_total ? (s.projects_completed / s.projects_total) * 100 : 0} /></div></div>
        )) : <Empty title="No active students" text="Accept a request to start mentoring." />}
      </div>
      <Recent items={d.recent_activity} base={base} />
    </div>
  </>);
}

function RecruiterDashboard({ user, d }) {
  const base = "/recruiter";
  const st = ["Pending", "Shortlisted", "Accepted", "Rejected"].map((name) => ({ name, value: d.applications_by_status[name] || 0 }));
  return (<>
    <Hero user={user} completion={d.profile_completion} text="Review applicants and keep your internships moving." />
    <div className="stats auto">
      <StatCard label="Active internships" value={d.counts.active_internships} hint={`${d.counts.total_internships} in total`} />
      <StatCard label="Total applications" value={d.counts.total_applications} hint={`${d.counts.pending} awaiting review`} />
      <StatCard label="Shortlisted" value={d.counts.shortlisted} />
      <StatCard label="Selected" value={d.counts.selected} />
    </div>
    <div className="split">
      <div className="card"><div className="section-title"><h3>Application pipeline</h3><Link to={`${base}/analytics`} className="muted">Full analytics</Link></div><BarBlock data={st} height={200} /></div>
      <Recent items={d.recent_activity} base={base} />
    </div>
  </>);
}

function AdminDashboard({ user, d }) {
  const c = d.counts;
  return (<>
    <Hero user={user} text="Platform overview across every portal." />
    <div className="stats auto">
      {[["Total users", c.users], ["Students", c.students], ["Mentors", c.mentors], ["Recruiters", c.recruiters], ["Internships", c.internships], ["Applications", c.applications], ["Mentorships", c.mentorships], ["Skill exchanges", c.exchanges]].map(([l, v]) => <StatCard key={l} label={l} value={v} />)}
    </div>
    <div className="card"><div className="section-title"><h3>Latest admin activity</h3><Link to="/admin/logs" className="muted">View logs</Link></div>
      {d.recent_logs.length ? d.recent_logs.map((l) => <div className="mini-row" key={l.id}><b>{l.action}</b><span className="muted">{fmtDate(l.created_at)}</span></div>) : <Empty title="No admin actions logged yet" />}
    </div>
  </>);
}

export default function Dashboard() {
  const { user } = useAuth();
  const q = useFetch("/dashboard");
  const View = { Student: StudentDashboard, Mentor: MentorDashboard, Recruiter: RecruiterDashboard, Admin: AdminDashboard }[user.role];
  return <Async q={q}>{(d) => <View user={user} d={d} />}</Async>;
}
