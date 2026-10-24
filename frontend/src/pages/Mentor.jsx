import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { Async, useFetch, useToast, useConfirm, PageHeader, Tabs, Empty, Badge, Chips, Progress, fmtDate } from "../ui.jsx";

/* ===================== Mentorship requests ===================== */
export function MentorRequests() {
  const toast = useToast(); const confirm = useConfirm();
  const q = useFetch("/mentorships");
  const [tab, setTab] = useState("Pending");
  const STATES = ["Pending", "Active", "Completed", "Rejected"];

  const setStatus = async (x, status) => {
    const copy = { Rejected: ["Decline request?", "The student will be told you declined.", "Decline"], Completed: ["Mark as completed?", "This ends the active mentorship.", "Mark completed"] }[status];
    if (copy && !(await confirm({ title: copy[0], message: copy[1], confirmText: copy[2], danger: status === "Rejected" }))) return;
    try { await api(`/mentorships/${x.id}/status`, { method: "PATCH", body: { status } }); toast.success(status === "Active" ? "Request accepted" : status === "Rejected" ? "Request declined" : "Mentorship completed"); q.reload(); }
    catch (e) { toast.error(e.message); }
  };

  return (<>
    <PageHeader title="Mentorship requests" sub="Respond to students and manage your active mentorships." />
    <Async q={q}>{(items) => {
      const shown = items.filter((x) => x.status === tab);
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={STATES.map((s) => ({ key: s, label: s, count: items.filter((x) => x.status === s).length }))} />
        {shown.length ? <div className="cards">{shown.map((x) => (
          <div className="card item-card" key={x.id}>
            <div className="row"><h3>{x.student?.name}</h3><Badge status={x.status} /></div>
            <span className="muted">{[x.student?.college, x.student?.department].filter(Boolean).join(" · ") || "Student"}</span>
            {x.student?.career_goal && <span className="muted">Goal: {x.student.career_goal}</span>}
            <p>“{x.message}”</p><span className="muted">Requested {fmtDate(x.created_at)}</span>
            <div className="actions">
              {x.status === "Pending" && <><button className="btn ok sm" onClick={() => setStatus(x, "Active")}>Accept</button><button className="btn danger sm" onClick={() => setStatus(x, "Rejected")}>Reject</button></>}
              {x.status === "Active" && <button className="btn dark sm" onClick={() => setStatus(x, "Completed")}>Mark as completed</button>}
            </div>
          </div>))}</div>
          : <div className="card"><Empty title={`No ${tab.toLowerCase()} requests`} /></div>}
      </>);
    }}</Async>
  </>);
}

/* ===================== My students (mentees) ===================== */
export function Mentees() {
  const [sp] = useSearchParams();
  const q = useFetch("/mentees");
  const [search, setSearch] = useState(sp.get("q") || "");
  const [tab, setTab] = useState("Active");
  return (<>
    <PageHeader title="My students" sub="Skills, projects and progress of the students you mentor." />
    <div className="filters"><input placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" /></div>
    <Async q={q}>{(items) => {
      const shown = items.filter((m) => m.status === tab && (m.name || "").toLowerCase().includes(search.toLowerCase()));
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={["Active", "Completed"].map((s) => ({ key: s, label: s, count: items.filter((x) => x.status === s).length }))} />
        {shown.length ? <div className="cards">{shown.map((m) => {
          const pct = m.progress.projects_total ? Math.round((m.progress.projects_completed / m.progress.projects_total) * 100) : 0;
          return (
            <div className="card item-card" key={m.mentorship_id}>
              <div className="row"><h3>{m.name}</h3><Badge status={m.status} /></div>
              <span className="muted">{[m.college, m.department, m.graduation_year].filter(Boolean).join(" · ") || m.email}</span>
              {m.career_goal && <span className="muted">Goal: {m.career_goal}</span>}
              <div><b style={{ fontSize: 13 }}>Skills</b>{m.skills.length ? <Chips items={m.skills} /> : <div className="muted">None listed</div>}</div>
              <div><b style={{ fontSize: 13 }}>Projects ({m.progress.projects_completed}/{m.progress.projects_total} completed)</b><Progress value={pct} />
                {m.projects.slice(0, 4).map((p) => <div className="mini-row" key={p.id}><span>{p.title}</span><Badge status={p.status} /></div>)}
                {!m.projects.length && <div className="muted">No projects yet</div>}</div>
              <span className="muted">Mentoring since {fmtDate(m.since)}</span>
            </div>);
        })}</div>
          : <div className="card"><Empty title={items.length ? "No students match" : `No ${tab.toLowerCase()} students`} text={items.length ? undefined : "Accept a mentorship request to see students here."} /></div>}
      </>);
    }}</Async>
  </>);
}
