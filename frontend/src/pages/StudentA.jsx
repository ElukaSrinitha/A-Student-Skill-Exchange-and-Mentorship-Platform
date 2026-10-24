import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Star, Eye, ExternalLink } from "lucide-react";
import { api, qs } from "../api.js";
import { Async, useFetch, useDebounced, useToast, useConfirm, PageHeader, Tabs, Empty, Modal, Badge, Chips, Input, Select, Textarea, Field, fmtDate } from "../ui.jsx";

/* ===================== My Skills ===================== */
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
export function MySkills() {
  const toast = useToast(); const confirm = useConfirm();
  const q = useFetch("/my-skills"); const catalog = useFetch("/skills");
  const [search, setSearch] = useState(""); const [modal, setModal] = useState(null);
  const [f, setF] = useState({ name: "", level: "Beginner", is_primary: false });

  const openNew = () => { setF({ name: "", level: "Beginner", is_primary: false }); setModal({}); };
  const openEdit = (s) => { setF({ name: s.name, level: s.level, is_primary: s.is_primary }); setModal(s); };
  const save = async (e) => {
    e.preventDefault();
    try {
      if (modal.skill_id) await api(`/my-skills/${modal.skill_id}`, { method: "PUT", body: { level: f.level, is_primary: f.is_primary } });
      else { if (!f.name.trim()) return toast.error("Enter a skill name"); await api("/my-skills", { method: "POST", body: f }); }
      toast.success(modal.skill_id ? "Skill updated" : "Skill added"); setModal(null); q.reload(); catalog.reload();
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (s) => { if (!(await confirm({ title: "Remove skill?", message: `Remove ${s.name} from your skills?`, confirmText: "Remove", danger: true }))) return; try { await api(`/my-skills/${s.skill_id}`, { method: "DELETE" }); toast.success("Skill removed"); q.reload(); } catch (e) { toast.error(e.message); } };
  const primary = async (s) => { try { await api(`/my-skills/${s.skill_id}`, { method: "PUT", body: { is_primary: !s.is_primary } }); q.reload(); } catch (e) { toast.error(e.message); } };

  return (<>
    <PageHeader title="My skills" sub="Skills you list here are used for recommendations and skill exchange." actions={<button className="btn dark" onClick={openNew}><Plus size={15} /> Add skill</button>} />
    <div className="filters"><input placeholder="Search your skills" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search your skills" /></div>
    <Async q={q}>{(items) => {
      const shown = items.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
      return shown.length ? (
        <div className="cards">{shown.map((s) => (
          <div className="card item-card" key={s.skill_id}>
            <div className="row"><h3>{s.name}</h3><Badge status={s.level} /></div>
            {s.is_primary && <span className="chip">Primary skill</span>}
            <div className="actions">
              <button className="btn ghost sm" onClick={() => primary(s)}><Star size={13} /> {s.is_primary ? "Unset primary" : "Make primary"}</button>
              <button className="btn ghost sm" onClick={() => openEdit(s)}><Pencil size={13} /> Edit</button>
              <button className="btn danger sm" onClick={() => remove(s)}><Trash2 size={13} /> Remove</button>
            </div>
          </div>))}</div>
      ) : <div className="card"><Empty title={items.length ? "No skills match your search" : "No skills yet"} text={items.length ? undefined : "Add the skills you have so others can find and exchange with you."} action={!items.length && <button className="btn dark" onClick={openNew}>Add your first skill</button>} /></div>;
    }}</Async>
    {modal && (
      <Modal title={modal.skill_id ? `Edit ${modal.name}` : "Add skill"} onClose={() => setModal(null)} small>
        <form onSubmit={save} className="stack" noValidate>
          {!modal.skill_id && <Field label="Skill" hint="Pick from the list or type a new one"><input list="skill-catalog" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /><datalist id="skill-catalog">{(catalog.data || []).map((s) => <option key={s.id} value={s.name} />)}</datalist></Field>}
          <Select label="Level" value={f.level} options={LEVELS} onChange={(e) => setF({ ...f, level: e.target.value })} />
          <label className="check"><input type="checkbox" checked={f.is_primary} onChange={(e) => setF({ ...f, is_primary: e.target.checked })} /> This is my primary skill</label>
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">{modal.skill_id ? "Save changes" : "Add skill"}</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== My Projects ===================== */
const STATUSES = ["Planning", "In Progress", "Completed"];
const blank = { title: "", description: "", status: "Planning", tech_stack: "", project_url: "", repo_url: "" };
export function Projects() {
  const toast = useToast(); const confirm = useConfirm();
  const [status, setStatus] = useState(""); const [search, setSearch] = useState("");
  const ds = useDebounced(search);
  const q = useFetch(`/projects${qs({ status, search: ds })}`);
  const [modal, setModal] = useState(null); const [view, setView] = useState(null); const [f, setF] = useState(blank);

  const openNew = () => { setF(blank); setModal({}); };
  const openEdit = (p) => { setF({ ...blank, ...p, description: p.description || "", tech_stack: (p.tech_stack || []).join(", "), project_url: p.project_url || "", repo_url: p.repo_url || "" }); setModal(p); };
  const save = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return toast.error("Give the project a title");
    const body = { title: f.title, description: f.description, status: f.status, tech_stack: f.tech_stack, project_url: f.project_url, repo_url: f.repo_url };
    try { if (modal.id) await api(`/projects/${modal.id}`, { method: "PUT", body }); else await api("/projects", { method: "POST", body }); toast.success(modal.id ? "Project updated" : "Project added"); setModal(null); q.reload(); }
    catch (err) { toast.error(err.message); }
  };
  const remove = async (p) => { if (!(await confirm({ title: "Delete project?", message: `“${p.title}” will be permanently deleted.`, confirmText: "Delete", danger: true }))) return; try { await api(`/projects/${p.id}`, { method: "DELETE" }); toast.success("Project deleted"); q.reload(); } catch (e) { toast.error(e.message); } };

  return (<>
    <PageHeader title="My projects" sub="Showcase what you have built. Recruiters and mentors can see your projects." actions={<button className="btn dark" onClick={openNew}><Plus size={15} /> Add project</button>} />
    <div className="filters"><input placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" />
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
    <Async q={q}>{(items) => items.length ? (
      <div className="cards">{items.map((p) => (
        <div className="card item-card" key={p.id}>
          <div className="row"><h3>{p.title}</h3><Badge status={p.status} /></div>
          <p>{p.description ? (p.description.length > 140 ? `${p.description.slice(0, 140)}…` : p.description) : <span className="muted">No description</span>}</p>
          <Chips items={p.tech_stack || []} />
          <div className="actions">
            <button className="btn ghost sm" onClick={() => setView(p)}><Eye size={13} /> View</button>
            <button className="btn ghost sm" onClick={() => openEdit(p)}><Pencil size={13} /> Edit</button>
            <button className="btn danger sm" onClick={() => remove(p)}><Trash2 size={13} /> Delete</button>
          </div>
        </div>))}</div>
    ) : <div className="card"><Empty title="No projects found" text="Add a project to show your work to mentors and recruiters." action={<button className="btn dark" onClick={openNew}>Add a project</button>} /></div>}</Async>
    {view && (
      <Modal title={view.title} onClose={() => setView(null)}>
        <dl className="kv"><dt>Status</dt><dd><Badge status={view.status} /></dd><dt>Description</dt><dd>{view.description || "–"}</dd><dt>Tech stack</dt><dd><Chips items={view.tech_stack || []} /></dd>
          <dt>Project link</dt><dd>{view.project_url ? <a href={view.project_url} target="_blank" rel="noreferrer">{view.project_url} <ExternalLink size={12} /></a> : "–"}</dd>
          <dt>Repository</dt><dd>{view.repo_url ? <a href={view.repo_url} target="_blank" rel="noreferrer">{view.repo_url} <ExternalLink size={12} /></a> : "–"}</dd><dt>Created</dt><dd>{fmtDate(view.created_at)}</dd></dl>
      </Modal>)}
    {modal && (
      <Modal title={modal.id ? "Edit project" : "Add project"} onClose={() => setModal(null)}>
        <form onSubmit={save} className="form-grid" noValidate>
          <Input label="Title" full value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Select label="Status" value={f.status} options={STATUSES} onChange={(e) => setF({ ...f, status: e.target.value })} />
          <Input label="Tech stack" hint="Separate with commas" value={f.tech_stack} onChange={(e) => setF({ ...f, tech_stack: e.target.value })} />
          <Input label="Project link" value={f.project_url} onChange={(e) => setF({ ...f, project_url: e.target.value })} />
          <Input label="Repository link" value={f.repo_url} onChange={(e) => setF({ ...f, repo_url: e.target.value })} />
          <div className="modal-actions full-span"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">{modal.id ? "Save changes" : "Add project"}</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== Skill Exchange ===================== */
export function Exchange() {
  const toast = useToast(); const confirm = useConfirm();
  const [sp] = useSearchParams();
  const [tab, setTab] = useState("find");
  const [search, setSearch] = useState(sp.get("q") || ""); const [skill, setSkill] = useState("");
  const ds = useDebounced(search); const dk = useDebounced(skill);
  const students = useFetch(`/exchanges/students${qs({ search: ds, skill: dk })}`);
  const mine = useFetch("/exchanges"); const mySkills = useFetch("/my-skills");
  const [target, setTarget] = useState(null); const [f, setF] = useState({ offer_skill: "", request_skill: "", message: "" });

  const list = mine.data || [];
  const received = list.filter((x) => x.direction === "received" && ["Pending", "Accepted"].includes(x.status));
  const sent = list.filter((x) => x.direction === "sent" && ["Pending", "Accepted"].includes(x.status));
  const history = list.filter((x) => ["Completed", "Rejected"].includes(x.status));
  const pendingIn = received.filter((x) => x.status === "Pending").length;

  const openRequest = (s) => { setTarget(s); setF({ offer_skill: "", request_skill: "", message: "" }); };
  const send = async (e) => {
    e.preventDefault();
    if (!f.offer_skill || !f.request_skill) return toast.error("Choose both a skill to offer and a skill to learn");
    try { await api("/exchanges", { method: "POST", body: { ...f, to_student: target.id } }); toast.success("Exchange request sent"); setTarget(null); mine.reload(); setTab("sent"); }
    catch (err) { toast.error(err.message); }
  };
  const setStatus = async (x, status) => {
    if (status === "Rejected" && !(await confirm({ title: "Reject request?", message: "The other student will be notified.", confirmText: "Reject", danger: true }))) return;
    try { await api(`/exchanges/${x.id}/status`, { method: "PATCH", body: { status } }); toast.success(`Request ${status.toLowerCase()}`); mine.reload(); } catch (err) { toast.error(err.message); }
  };

  const Row = ({ x }) => {
    const other = x.direction === "sent" ? x.to_name : x.from_name;
    return (
      <div className="card item-card">
        <div className="row"><h3>{x.direction === "sent" ? `To ${other}` : `From ${other}`}</h3><Badge status={x.status} /></div>
        <p><b>{x.direction === "sent" ? "You teach" : "They teach"}:</b> {x.offer_skill_name} &nbsp;·&nbsp; <b>{x.direction === "sent" ? "You learn" : "They want"}:</b> {x.request_skill_name}</p>
        {x.message && <p className="muted">“{x.message}”</p>}<span className="muted">{fmtDate(x.created_at)}</span>
        <div className="actions">
          {x.direction === "received" && x.status === "Pending" && <><button className="btn ok sm" onClick={() => setStatus(x, "Accepted")}>Accept</button><button className="btn danger sm" onClick={() => setStatus(x, "Rejected")}>Reject</button></>}
          {x.status === "Accepted" && <button className="btn dark sm" onClick={() => setStatus(x, "Completed")}>Mark as completed</button>}
        </div>
      </div>
    );
  };
  const Cards = ({ items, empty }) => items.length ? <div className="cards">{items.map((x) => <Row key={x.id} x={x} />)}</div> : <div className="card"><Empty title={empty} /></div>;

  return (<>
    <PageHeader title="Skill exchange" sub="Trade what you know for what you want to learn." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "find", label: "Find students" }, { key: "received", label: "Received", count: pendingIn || received.length }, { key: "sent", label: "Sent", count: sent.length }, { key: "history", label: "History", count: history.length }]} />
    {tab === "find" && (<>
      <div className="filters"><input placeholder="Search students by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" /><input placeholder="Filter by skill (e.g. Python)" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filter by skill" /></div>
      <Async q={students}>{(items) => items.length ? (
        <div className="cards">{items.map((s) => (
          <div className="card item-card" key={s.id}>
            <h3>{s.name}</h3><span className="muted">{[s.college, s.department].filter(Boolean).join(" · ") || "Student"}</span>
            {s.skills.length ? <Chips items={s.skills} /> : <span className="muted">No skills listed yet</span>}
            <div className="actions"><button className="btn dark sm" disabled={!s.skills.length} onClick={() => openRequest(s)}>Request exchange</button></div>
          </div>))}</div>
      ) : <div className="card"><Empty title="No students found" text="Try a different name or skill." /></div>}</Async>
    </>)}
    {tab !== "find" && <Async q={mine}>{() => tab === "received" ? <Cards items={received} empty="No incoming requests" /> : tab === "sent" ? <Cards items={sent} empty="You have no open requests" /> : <Cards items={history} empty="No completed or declined exchanges yet" />}</Async>}
    {target && (
      <Modal title={`Exchange skills with ${target.name}`} onClose={() => setTarget(null)}>
        <form onSubmit={send} className="stack" noValidate>
          <Select label="Skill I will teach" value={f.offer_skill} placeholder={(mySkills.data || []).length ? "Choose one of your skills" : "Add skills to My Skills first"} options={(mySkills.data || []).map((s) => [s.skill_id, `${s.name} (${s.level})`])} onChange={(e) => setF({ ...f, offer_skill: e.target.value })} />
          <Select label="Skill I want to learn" value={f.request_skill} placeholder="Choose one of their skills" options={target.skills.map((s) => [s.skill_id, `${s.name} (${s.level})`])} onChange={(e) => setF({ ...f, request_skill: e.target.value })} />
          <Textarea label="Message (optional)" value={f.message} maxLength={500} onChange={(e) => setF({ ...f, message: e.target.value })} />
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setTarget(null)}>Cancel</button><button className="btn dark">Send request</button></div>
        </form>
      </Modal>)}
  </>);
}
