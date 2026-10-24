import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { api, qs } from "../api.js";
import { Async, useFetch, useDebounced, useToast, PageHeader, Tabs, Empty, Modal, Badge, Chips, Stars, Textarea, FileUpload, fmtDate, money } from "../ui.jsx";

/* ===================== Find Mentors ===================== */
export function FindMentors() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ search: sp.get("q") || "", expertise: "", min_experience: "", availability: "" });
  const ds = useDebounced(f.search); const da = useDebounced(f.availability);
  const q = useFetch(`/mentors${qs({ search: ds, expertise: f.expertise, min_experience: f.min_experience, availability: da })}`);
  const all = useFetch("/mentors"); // unfiltered list feeds the expertise filter
  const expertiseOptions = useMemo(() => [...new Set((all.data || []).flatMap((m) => m.expertise || []))].sort(), [all.data]);
  const [view, setView] = useState(null); const [req, setReq] = useState(null); const [msg, setMsg] = useState("");

  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return toast.error("Tell the mentor what you'd like help with");
    try { await api("/mentorships", { method: "POST", body: { mentor_id: req.id, message: msg } }); toast.success("Mentorship request sent"); setReq(null); setView(null); setMsg(""); q.reload(); all.reload(); }
    catch (err) { toast.error(err.message); }
  };
  const action = (m) => m.my_request ? <button className="btn ghost sm" disabled>{m.my_request === "Active" ? "Your mentor" : "Request pending"}</button> : <button className="btn dark sm" onClick={() => { setMsg(""); setReq(m); }}>Request mentorship</button>;

  return (<>
    <PageHeader title="Find mentors" sub="Get guidance from people who have done what you want to do." />
    <div className="filters">
      <input placeholder="Search by name, role or topic" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} aria-label="Search mentors" />
      <select value={f.expertise} onChange={(e) => setF({ ...f, expertise: e.target.value })} aria-label="Filter by expertise"><option value="">Any expertise</option>{expertiseOptions.map((x) => <option key={x}>{x}</option>)}</select>
      <select value={f.min_experience} onChange={(e) => setF({ ...f, min_experience: e.target.value })} aria-label="Minimum experience"><option value="">Any experience</option>{[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}+ years</option>)}</select>
      <input placeholder="Availability (e.g. weekends)" value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })} aria-label="Filter by availability" />
    </div>
    <Async q={q}>{(items) => items.length ? (
      <div className="cards">{items.map((m) => (
        <div className="card item-card" key={m.id}>
          <div className="row"><h3>{m.name}</h3><Stars value={m.rating} count={m.rating_count} /></div>
          <span className="muted">{[m.job_title, m.company].filter(Boolean).join(" at ") || "Mentor"}{m.experience_years != null ? ` · ${m.experience_years} yrs experience` : ""}</span>
          <Chips items={m.expertise} />
          <p>{m.availability ? `Available: ${m.availability}` : <span className="muted">Availability not stated</span>}</p>
          <div className="actions"><button className="btn ghost sm" onClick={() => setView(m)}>View profile</button>{action(m)}</div>
        </div>))}</div>
    ) : <div className="card"><Empty title="No mentors match" text="Try removing a filter." /></div>}</Async>
    {view && (
      <Modal title={view.name} onClose={() => setView(null)}>
        <dl className="kv"><dt>Role</dt><dd>{[view.job_title, view.company].filter(Boolean).join(" at ") || "–"}</dd><dt>Experience</dt><dd>{view.experience_years != null ? `${view.experience_years} years` : "–"}</dd>
          <dt>Expertise</dt><dd><Chips items={view.expertise} /></dd><dt>Availability</dt><dd>{view.availability || "–"}</dd><dt>Rating</dt><dd><Stars value={view.rating} count={view.rating_count} /></dd>
          <dt>Current students</dt><dd>{view.active_mentees}</dd><dt>About</dt><dd>{view.bio || "–"}</dd>
          {view.linkedin_url && <><dt>LinkedIn</dt><dd><a href={view.linkedin_url} target="_blank" rel="noreferrer">{view.linkedin_url} <ExternalLink size={12} /></a></dd></>}</dl>
        <div className="modal-actions">{action(view)}</div>
      </Modal>)}
    {req && (
      <Modal title={`Request mentorship from ${req.name}`} onClose={() => setReq(null)} small>
        <form onSubmit={send} className="stack" noValidate>
          <Textarea label="What would you like help with?" value={msg} maxLength={1000} onChange={(e) => setMsg(e.target.value)} />
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setReq(null)}>Cancel</button><button className="btn dark">Send request</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== My Mentorships ===================== */
export function MyMentorships() {
  const q = useFetch("/mentorships");
  const [tab, setTab] = useState("Pending");
  const STATES = ["Pending", "Active", "Completed", "Rejected"];
  return (<>
    <PageHeader title="My mentorships" sub="Track your mentorship requests and active mentors." />
    <Async q={q}>{(items) => {
      const shown = items.filter((x) => x.status === tab);
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={STATES.map((s) => ({ key: s, label: s, count: items.filter((x) => x.status === s).length }))} />
        {shown.length ? <div className="cards">{shown.map((x) => (
          <div className="card item-card" key={x.id}>
            <div className="row"><h3>{x.mentor?.name}</h3><Badge status={x.status} /></div>
            <span className="muted">{[x.mentor?.job_title, x.mentor?.company].filter(Boolean).join(" at ") || "Mentor"}</span>
            <Chips items={x.mentor?.expertise || []} />
            <p><b>Your request:</b> {x.message || "–"}</p>
            <span className="muted">Requested {fmtDate(x.created_at)}{x.updated_at && x.status !== "Pending" ? ` · updated ${fmtDate(x.updated_at)}` : ""}</span>
            {x.mentor?.availability && <span className="muted">Availability: {x.mentor.availability}</span>}
          </div>))}</div>
          : <div className="card"><Empty title={`No ${tab.toLowerCase()} mentorships`} text={tab === "Pending" ? "Find a mentor and send a request." : undefined} /></div>}
      </>);
    }}</Async>
  </>);
}

/* ===================== Micro-Internships ===================== */
export function Internships() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState("all");
  const [f, setF] = useState({ search: sp.get("q") || "", work_mode: "", location: "", skill: "", min_stipend: "" });
  const ds = useDebounced(f.search); const dl = useDebounced(f.location); const dk = useDebounced(f.skill);
  const all = useFetch(`/internships${qs({ search: ds, work_mode: f.work_mode, location: dl, skill: dk, min_stipend: f.min_stipend })}`);
  const rec = useFetch("/internships/recommended");
  const profile = useFetch("/profile");
  const [view, setView] = useState(null); const [apply, setApply] = useState(null);
  const [note, setNote] = useState(""); const [resume, setResume] = useState(""); const [busy, setBusy] = useState(false);

  const openApply = (i) => { setApply(i); setNote(""); setResume(""); };
  const submit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return toast.error("Write a short cover note");
    setBusy(true);
    try { await api("/applications", { method: "POST", body: { internship_id: apply.id, cover_note: note, resume_url: resume || undefined } }); toast.success("Application submitted"); setApply(null); setView(null); all.reload(); rec.reload(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const applyBtn = (i) => i.my_application ? <button className="btn ghost sm" disabled>Applied · {i.my_application}</button> : <button className="btn dark sm" onClick={() => openApply(i)}>Apply</button>;

  const source = tab === "recommended" ? rec : all;
  const profileResume = profile.data?.resume_url;

  return (<>
    <PageHeader title="Micro-internships" sub="Short, real projects with companies that are hiring." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "all", label: "All internships" }, { key: "recommended", label: "Recommended for you", count: rec.data?.length }]} />
    {tab === "all" && (
      <div className="filters">
        <input placeholder="Search by title" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} aria-label="Search internships" />
        <select value={f.work_mode} onChange={(e) => setF({ ...f, work_mode: e.target.value })} aria-label="Work mode"><option value="">Any work mode</option>{["Remote", "On-site", "Hybrid"].map((m) => <option key={m}>{m}</option>)}</select>
        <input placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} aria-label="Location" />
        <input placeholder="Skill (exact, e.g. React)" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} aria-label="Skill" />
        <input type="number" min="0" placeholder="Min stipend (₹)" value={f.min_stipend} onChange={(e) => setF({ ...f, min_stipend: e.target.value })} aria-label="Minimum stipend" />
      </div>)}
    <Async q={source}>{(items) => items.length ? (
      <div className="cards">{items.map((i) => (
        <div className="card item-card" key={i.id}>
          <div className="row"><h3>{i.title}</h3>{i.work_mode && <Badge status={i.work_mode} />}</div>
          <span className="muted">{i.company_name}{i.location ? ` · ${i.location}` : ""}</span>
          <Chips items={i.skills || []} />
          {tab === "recommended" && <span className="muted">Matches your skills: {i.matched_skills.join(", ")}</span>}
          <p>{i.duration ? `${i.duration} · ` : ""}{money(i.stipend)}{i.openings ? ` · ${i.openings} opening${i.openings > 1 ? "s" : ""}` : ""}</p>
          <span className="muted">{i.deadline ? `Apply by ${fmtDate(i.deadline)}` : "No deadline"}</span>
          <div className="actions"><button className="btn ghost sm" onClick={() => setView(i)}>View details</button>{applyBtn(i)}</div>
        </div>))}</div>
    ) : <div className="card"><Empty title={tab === "recommended" ? "No recommendations yet" : "No internships match"} text={tab === "recommended" ? "Add skills in My Skills and we'll match them to internships." : "Try changing your filters."} /></div>}</Async>
    {view && (
      <Modal title={view.title} onClose={() => setView(null)} wide>
        <dl className="kv"><dt>Company</dt><dd>{view.company_name}</dd><dt>Skills</dt><dd><Chips items={view.skills || []} /></dd><dt>Work mode</dt><dd>{view.work_mode || "–"}</dd><dt>Location</dt><dd>{view.location || "–"}</dd>
          <dt>Duration</dt><dd>{view.duration || "–"}</dd><dt>Stipend</dt><dd>{money(view.stipend)}</dd><dt>Openings</dt><dd>{view.openings}</dd><dt>Deadline</dt><dd>{fmtDate(view.deadline)}</dd>
          <dt>Start date</dt><dd>{fmtDate(view.start_date)}</dd><dt>End date</dt><dd>{fmtDate(view.end_date)}</dd><dt>About the role</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.description}</dd>
          {view.responsibilities && <><dt>Responsibilities</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.responsibilities}</dd></>}{view.requirements && <><dt>Requirements</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.requirements}</dd></>}</dl>
        <div className="modal-actions">{applyBtn(view)}</div>
      </Modal>)}
    {apply && (
      <Modal title={`Apply to ${apply.title}`} onClose={() => setApply(null)}>
        <form onSubmit={submit} className="stack" noValidate>
          <Textarea label="Cover note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} hint="Why are you a good fit for this internship?" />
          <div><b style={{ fontSize: 13 }}>Resume</b>
            <p className="muted" style={{ margin: "4px 0 8px" }}>{resume ? "Using the file you just uploaded." : profileResume ? "We'll attach the resume from your profile." : "You have no resume on your profile yet. Upload one now or apply without it."}</p>
            <FileUpload kind="resume" accept="application/pdf,.doc,.docx" label={resume || profileResume ? "Use a different resume" : "Upload resume"} current={resume || profileResume} onDone={(url) => setResume(url)} /></div>
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setApply(null)}>Cancel</button><button className="btn dark" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== My Applications ===================== */
export function MyApplications() {
  const q = useFetch("/applications/mine");
  const [tab, setTab] = useState("All");
  const STATES = ["All", "Pending", "Shortlisted", "Accepted", "Rejected"];
  return (<>
    <PageHeader title="My applications" sub="Follow every application from submitted to decision." />
    <Async q={q}>{(items) => {
      const shown = tab === "All" ? items : items.filter((x) => x.status === tab);
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={STATES.map((s) => ({ key: s, label: s, count: s === "All" ? items.length : items.filter((x) => x.status === s).length }))} />
        {shown.length ? <div className="cards">{shown.map((a) => (
          <div className="card item-card" key={a.id}>
            <div className="row"><h3>{a.internship?.title || "Internship removed"}</h3><Badge status={a.status} /></div>
            <span className="muted">{a.internship?.company_name}{a.internship?.location ? ` · ${a.internship.location}` : ""}</span>
            <p><b>Cover note:</b> {a.cover_note || "–"}</p>
            <span className="muted">Applied {fmtDate(a.created_at)}{a.internship?.deadline ? ` · deadline ${fmtDate(a.internship.deadline)}` : ""}</span>
            {a.resume_url && <a href={a.resume_url} target="_blank" rel="noreferrer">View submitted resume <ExternalLink size={12} /></a>}
          </div>))}</div>
          : <div className="card"><Empty title={items.length ? `No ${tab.toLowerCase()} applications` : "You haven't applied yet"} text={items.length ? undefined : "Browse micro-internships and apply to get started."} /></div>}
      </>);
    }}</Async>
  </>);
}
