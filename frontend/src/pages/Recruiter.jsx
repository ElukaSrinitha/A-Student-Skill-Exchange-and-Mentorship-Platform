import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, XCircle, ExternalLink } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, qs } from "../api.js";
import { Async, useFetch, useToast, useConfirm, PageHeader, Tabs, Empty, Modal, Badge, Chips, Input, Select, Textarea, DataTable, StatCard, BarBlock, fmtDate, money } from "../ui.jsx";

/* ===================== Internships ===================== */
const blank = { title: "", description: "", skills: "", duration: "", location: "", work_mode: "Remote", stipend: "", openings: 1, deadline: "", start_date: "", end_date: "", responsibilities: "", requirements: "", status: "Draft" };

export function RecruiterInternships() {
  const toast = useToast(); const confirm = useConfirm();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState("All"); const [search] = useState(sp.get("q") || "");
  const q = useFetch(`/internships/mine${qs({ search })}`);
  const [modal, setModal] = useState(null); const [view, setView] = useState(null); const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const openNew = () => { setF(blank); setModal({}); };
  const openEdit = (i) => { setF({ ...blank, ...Object.fromEntries(Object.entries(i).map(([k, v]) => [k, v ?? ""])), skills: (i.skills || []).join(", "), status: i.status === "Closed" ? "Published" : i.status }); setModal(i); };

  const validate = () => {
    if (!f.title.trim()) return "Enter a title";
    if (!f.description.trim()) return "Enter a description";
    if (f.stipend !== "" && (Number.isNaN(Number(f.stipend)) || Number(f.stipend) < 0)) return "Stipend must be zero or more";
    if (!Number.isInteger(Number(f.openings)) || Number(f.openings) < 1) return "Openings must be at least 1";
    if (f.start_date && f.end_date && f.end_date < f.start_date) return "End date must be after the start date";
    if (f.deadline && f.start_date && f.deadline > f.start_date) return "Deadline must be on or before the start date";
    return "";
  };
  const save = async (e) => {
    e.preventDefault();
    const err = validate(); if (err) return toast.error(err);
    const body = { ...f, openings: Number(f.openings), stipend: f.stipend === "" ? null : Number(f.stipend) };
    ["id", "recruiter_id", "created_at", "updated_at", "company_name", "company_logo", "effective_status", "application_count", "accepted_count"].forEach((k) => delete body[k]);
    try {
      if (modal.id) await api(`/internships/${modal.id}`, { method: "PUT", body }); else await api("/internships", { method: "POST", body });
      toast.success(modal.id ? "Internship updated" : f.status === "Published" ? "Internship published" : "Draft saved"); setModal(null); q.reload();
    } catch (er) { toast.error(er.message); }
  };
  const close = async (i) => { if (!(await confirm({ title: "Close internship?", message: "Students will no longer be able to apply. Existing applications are kept.", confirmText: "Close internship" }))) return; try { await api(`/internships/${i.id}/close`, { method: "POST", body: {} }); toast.success("Internship closed"); q.reload(); } catch (e) { toast.error(e.message); } };
  const remove = async (i) => { if (!(await confirm({ title: "Delete internship?", message: `“${i.title}” and all ${i.application_count} of its applications will be permanently deleted.`, confirmText: "Delete", danger: true }))) return; try { await api(`/internships/${i.id}`, { method: "DELETE" }); toast.success("Internship deleted"); q.reload(); } catch (e) { toast.error(e.message); } };

  const STATES = ["All", "Published", "Draft", "Closed", "Expired"];
  return (<>
    <PageHeader title="Internships" sub="Create, publish and manage your micro-internships." actions={<button className="btn dark" onClick={openNew}><Plus size={15} /> Create internship</button>} />
    <Async q={q}>{(items) => {
      const shown = tab === "All" ? items : items.filter((i) => i.effective_status === tab);
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={STATES.map((s) => ({ key: s, label: s, count: s === "All" ? items.length : items.filter((i) => i.effective_status === s).length }))} />
        <div className="card"><DataTable rows={shown} empty={<Empty title="No internships here" text="Create an internship to start receiving applications." action={<button className="btn dark" onClick={openNew}>Create internship</button>} />} columns={[
          { h: "Title", render: (i) => <b>{i.title}</b> }, { h: "Status", render: (i) => <Badge status={i.effective_status} /> },
          { h: "Applications", render: (i) => `${i.application_count} (${i.accepted_count} accepted)` }, { h: "Openings", key: "openings" },
          { h: "Deadline", render: (i) => fmtDate(i.deadline) },
          { h: "Actions", render: (i) => <div className="actions" style={{ display: "flex", gap: 6 }}>
            <button className="btn ghost sm" aria-label="View" onClick={() => setView(i)}><Eye size={13} /></button>
            <button className="btn ghost sm" aria-label="Edit" onClick={() => openEdit(i)}><Pencil size={13} /></button>
            {i.status === "Published" && <button className="btn ghost sm" aria-label="Close internship" title="Close" onClick={() => close(i)}><XCircle size={13} /></button>}
            <button className="btn danger sm" aria-label="Delete" onClick={() => remove(i)}><Trash2 size={13} /></button></div> },
        ]} /></div>
      </>);
    }}</Async>
    {view && (
      <Modal title={view.title} onClose={() => setView(null)} wide>
        <dl className="kv"><dt>Status</dt><dd><Badge status={view.effective_status} /></dd><dt>Skills</dt><dd><Chips items={view.skills || []} /></dd><dt>Work mode</dt><dd>{view.work_mode || "–"}</dd><dt>Location</dt><dd>{view.location || "–"}</dd>
          <dt>Duration</dt><dd>{view.duration || "–"}</dd><dt>Stipend</dt><dd>{money(view.stipend)}</dd><dt>Openings</dt><dd>{view.openings}</dd><dt>Deadline</dt><dd>{fmtDate(view.deadline)}</dd><dt>Start – end</dt><dd>{fmtDate(view.start_date)} – {fmtDate(view.end_date)}</dd>
          <dt>Description</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.description}</dd><dt>Responsibilities</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.responsibilities || "–"}</dd><dt>Requirements</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.requirements || "–"}</dd></dl>
      </Modal>)}
    {modal && (
      <Modal title={modal.id ? "Edit internship" : "Create internship"} onClose={() => setModal(null)} wide>
        <form onSubmit={save} className="form-grid" noValidate>
          <Input label="Title" full value={f.title} maxLength={150} onChange={set("title")} />
          <Textarea label="Description" value={f.description} onChange={set("description")} />
          <Textarea label="Responsibilities" value={f.responsibilities} onChange={set("responsibilities")} />
          <Textarea label="Requirements" value={f.requirements} onChange={set("requirements")} />
          <Input label="Skills" hint="Separate with commas, e.g. React, SQL" value={f.skills} onChange={set("skills")} />
          <Input label="Duration" hint="e.g. 8 weeks" value={f.duration} onChange={set("duration")} />
          <Input label="Location" value={f.location} onChange={set("location")} />
          <Select label="Work mode" value={f.work_mode} options={["Remote", "On-site", "Hybrid"]} onChange={set("work_mode")} />
          <Input label="Stipend (₹ per month)" type="number" min="0" value={f.stipend} onChange={set("stipend")} />
          <Input label="Openings" type="number" min="1" value={f.openings} onChange={set("openings")} />
          <Input label="Application deadline" type="date" value={f.deadline || ""} onChange={set("deadline")} />
          <Input label="Start date" type="date" value={f.start_date || ""} onChange={set("start_date")} />
          <Input label="End date" type="date" value={f.end_date || ""} onChange={set("end_date")} />
          <Select label="Visibility" value={f.status} options={[["Draft", "Draft (only you can see it)"], ["Published", "Published (students can apply)"]]} onChange={set("status")} />
          <div className="modal-actions full-span"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">{modal.id ? "Save changes" : f.status === "Published" ? "Publish internship" : "Save draft"}</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== Applications ===================== */
export function RecruiterApplications() {
  const toast = useToast(); const confirm = useConfirm();
  const [status, setStatus] = useState("All"); const [internship, setInternship] = useState("");
  const ints = useFetch("/internships/mine");
  const q = useFetch(`/applications/recruiter${qs({ status, internship_id: internship })}`);
  const [view, setView] = useState(null);
  const STATES = ["All", "Pending", "Shortlisted", "Accepted", "Rejected"];

  const move = async (a, s) => {
    if (s === "Rejected" && !(await confirm({ title: "Reject applicant?", message: `${a.student.name} will be notified.`, confirmText: "Reject", danger: true }))) return;
    try { await api(`/applications/${a.id}/status`, { method: "PATCH", body: { status: s } }); toast.success(`Application ${s.toLowerCase()}`); q.reload(); setView(null); } catch (e) { toast.error(e.message); }
  };
  const Actions = ({ a }) => (<div className="actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {a.status !== "Shortlisted" && a.status !== "Accepted" && <button className="btn ghost sm" onClick={() => move(a, "Shortlisted")}>Shortlist</button>}
    {a.status !== "Accepted" && <button className="btn ok sm" onClick={() => move(a, "Accepted")}>Accept</button>}
    {a.status !== "Rejected" && <button className="btn danger sm" onClick={() => move(a, "Rejected")}>Reject</button>}
  </div>);

  return (<>
    <PageHeader title="Applications" sub="Review applicants for your internships." />
    <div className="filters"><select value={internship} onChange={(e) => setInternship(e.target.value)} aria-label="Filter by internship"><option value="">All internships</option>{(ints.data || []).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></div>
    <Tabs value={status} onChange={setStatus} tabs={STATES.map((s) => ({ key: s, label: s }))} />
    <Async q={q}>{(items) => items.length ? (
      <div className="cards">{items.map((a) => (
        <div className="card item-card" key={a.id}>
          <div className="row"><h3>{a.student.name}</h3><Badge status={a.status} /></div>
          <span className="muted">Applied to {a.internship_title} · {fmtDate(a.created_at)}</span>
          <span className="muted">{[a.student.college, a.student.department, a.student.graduation_year].filter(Boolean).join(" · ") || a.student.email}</span>
          <Chips items={a.student.skills} />
          <span className="muted">{a.student.projects.length} project{a.student.projects.length === 1 ? "" : "s"}</span>
          <div className="actions"><button className="btn ghost sm" onClick={() => setView(a)}>View application</button></div>
          <Actions a={a} />
        </div>))}</div>
    ) : <div className="card"><Empty title="No applications found" text="Applications appear here once students apply to your published internships." /></div>}</Async>
    {view && (
      <Modal title={view.student.name} onClose={() => setView(null)} wide>
        <dl className="kv"><dt>Applied to</dt><dd>{view.internship_title}</dd><dt>Status</dt><dd><Badge status={view.status} /></dd><dt>Email</dt><dd>{view.student.email}</dd>
          <dt>Education</dt><dd>{[view.student.college, view.student.department, view.student.graduation_year].filter(Boolean).join(" · ") || "–"}</dd>
          <dt>About</dt><dd>{view.student.bio || "–"}</dd><dt>Cover note</dt><dd style={{ whiteSpace: "pre-wrap" }}>{view.cover_note || "–"}</dd>
          <dt>Resume</dt><dd>{view.resume_url ? <a href={view.resume_url} target="_blank" rel="noreferrer">Open resume <ExternalLink size={12} /></a> : "Not provided"}</dd>
          <dt>Skills</dt><dd>{view.student.skills.length ? <Chips items={view.student.skills} /> : "–"}</dd>
          <dt>Projects</dt><dd>{view.student.projects.length ? view.student.projects.map((p) => <div key={p.id}>{p.title} <Badge status={p.status} /> {p.project_url && <a href={p.project_url} target="_blank" rel="noreferrer">link</a>}</div>) : "–"}</dd>
          {["linkedin_url", "github_url", "portfolio_url"].filter((k) => view.student[k]).map((k) => <React.Fragment key={k}><dt>{k.replace("_url", "")}</dt><dd><a href={view.student[k]} target="_blank" rel="noreferrer">{view.student[k]}</a></dd></React.Fragment>)}</dl>
        <div className="modal-actions"><Actions a={view} /></div>
      </Modal>)}
  </>);
}

/* ===================== Analytics ===================== */
export function RecruiterAnalytics() {
  const q = useFetch("/recruiter-analytics");
  return (<>
    <PageHeader title="Analytics" sub="How your internships and applicants are performing." />
    <Async q={q}>{(d) => (<>
      <div className="stats auto"><StatCard label="Internships" value={d.totals.internships} /><StatCard label="Applications" value={d.totals.applications} />
        {d.status_distribution.map((s) => <StatCard key={s.name} label={s.name} value={s.value} />)}</div>
      <div className="split">
        <div className="card"><div className="section-title"><h3>Status distribution</h3></div><BarBlock data={d.status_distribution} /></div>
        <div className="card"><div className="section-title"><h3>Top applicant skills</h3></div><BarBlock data={d.top_applicant_skills} /></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}><div className="section-title"><h3>Applications in the last 30 days</h3></div>
        {d.applications_last_30_days.length ? <div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.applications_last_30_days}><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="value" name="Applications" stroke="#6658e8" fill="#6658e8" fillOpacity={0.12} strokeWidth={3} /></AreaChart></ResponsiveContainer></div> : <Empty title="No applications in the last 30 days" />}
      </div>
      <div className="card" style={{ marginTop: 18 }}><div className="section-title"><h3>Internship performance</h3></div>
        <DataTable rows={d.internship_performance} empty={<Empty title="No internships yet" />} columns={[{ h: "Internship", key: "title" }, { h: "Status", render: (r) => <Badge status={r.status} /> }, { h: "Applications", key: "applications" }, { h: "Accepted", key: "accepted" }]} /></div>
    </>)}</Async>
  </>);
}
