import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, Download, Power } from "lucide-react";
import { api, qs, download } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Async, useFetch, useDebounced, useToast, useConfirm, PageHeader, Tabs, Empty, Modal, Badge, DataTable, Pager, Input, Select, Textarea, Stars, BarBlock, fmtDate } from "../ui.jsx";

/* ===================== Users / Students / Mentors / Recruiters ===================== */
export function Users({ role: fixedRole }) {
  const { user: me } = useAuth();
  const toast = useToast(); const confirm = useConfirm();
  const [sp] = useSearchParams();
  const [search, setSearch] = useState(sp.get("q") || ""); const [role, setRole] = useState(""); const [active, setActive] = useState(""); const [page, setPage] = useState(1);
  const ds = useDebounced(search);
  const effectiveRole = fixedRole || role;
  const q = useFetch(`/admin/users${qs({ search: ds, role: effectiveRole, active, page })}`, [fixedRole]);
  const [modal, setModal] = useState(null); const [view, setView] = useState(null); const [f, setF] = useState({ name: "", email: "", password: "", role: fixedRole || "Student" });

  const openNew = () => { setF({ name: "", email: "", password: "", role: fixedRole || "Student" }); setModal({}); };
  const openEdit = (u) => { setF({ name: u.name, email: u.email, password: "", role: u.role }); setModal(u); };
  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.email.trim()) return toast.error("Name and email are required");
    if (!modal.id && f.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (modal.id && f.password && f.password.length < 8) return toast.error("New password must be at least 8 characters");
    try {
      if (modal.id) await api(`/admin/users/${modal.id}`, { method: "PUT", body: { name: f.name, email: f.email, ...(f.password ? { password: f.password } : {}) } });
      else await api("/admin/users", { method: "POST", body: f });
      toast.success(modal.id ? "User updated" : "User created"); setModal(null); q.reload();
    } catch (err) { toast.error(err.message); }
  };
  const toggle = async (u) => {
    if (u.is_active && !(await confirm({ title: "Deactivate account?", message: `${u.name} will be signed out and unable to log in until reactivated.`, confirmText: "Deactivate", danger: true }))) return;
    try { await api(`/admin/users/${u.id}`, { method: "PUT", body: { is_active: !u.is_active } }); toast.success(u.is_active ? "Account deactivated" : "Account activated"); q.reload(); } catch (e) { toast.error(e.message); }
  };
  const remove = async (u) => {
    if (!(await confirm({ title: "Delete user permanently?", message: `${u.name} (${u.email}) and everything they created will be deleted. This cannot be undone. Consider deactivating instead.`, confirmText: "Delete permanently", danger: true }))) return;
    try { await api(`/admin/users/${u.id}`, { method: "DELETE" }); toast.success("User deleted"); q.reload(); } catch (e) { toast.error(e.message); }
  };
  const openView = async (u) => { try { setView(await api(`/admin/users/${u.id}`)); } catch (e) { toast.error(e.message); } };
  const title = fixedRole ? `${fixedRole}s` : "Users";

  return (<>
    <PageHeader title={title} sub={fixedRole ? `Manage ${fixedRole.toLowerCase()} accounts.` : "Manage every account on the platform."} actions={<button className="btn dark" onClick={openNew}><Plus size={15} /> Add {fixedRole ? fixedRole.toLowerCase() : "user"}</button>} />
    <div className="filters">
      <input placeholder="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" />
      {!fixedRole && <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role"><option value="">All roles</option>{["Student", "Mentor", "Recruiter", "Admin"].map((r) => <option key={r}>{r}</option>)}</select>}
      <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">Active and inactive</option><option value="true">Active</option><option value="false">Deactivated</option></select>
    </div>
    <Async q={q}>{(d) => (<div className="card">
      <DataTable rows={d.items} empty={<Empty title="No users found" text="Try a different search or filter." />} columns={[
        { h: "Name", render: (u) => <b>{u.name}</b> }, { h: "Email", key: "email" }, { h: "Role", key: "role" },
        { h: "Status", render: (u) => <Badge status={u.is_active ? "Active" : "Deactivated"} /> }, { h: "Joined", render: (u) => fmtDate(u.created_at) },
        { h: "Actions", render: (u) => <div style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost sm" aria-label="View" onClick={() => openView(u)}><Eye size={13} /></button>
          <button className="btn ghost sm" aria-label="Edit" onClick={() => openEdit(u)}><Pencil size={13} /></button>
          {u.id !== me.id && <button className="btn ghost sm" title={u.is_active ? "Deactivate" : "Activate"} aria-label={u.is_active ? "Deactivate" : "Activate"} onClick={() => toggle(u)}><Power size={13} /></button>}
          {u.id !== me.id && <button className="btn danger sm" aria-label="Delete" onClick={() => remove(u)}><Trash2 size={13} /></button>}</div> },
      ]} />
      <Pager page={d.page} total={d.total} size={d.page_size} onChange={setPage} />
    </div>)}</Async>
    {view && (
      <Modal title={view.name} onClose={() => setView(null)}>
        <dl className="kv"><dt>Email</dt><dd>{view.email}</dd><dt>Role</dt><dd>{view.role}</dd><dt>Status</dt><dd>{view.is_active ? "Active" : "Deactivated"}</dd><dt>Joined</dt><dd>{fmtDate(view.created_at)}</dd>
          {Object.entries(view.stats || {}).map(([k, v]) => <React.Fragment key={k}><dt style={{ textTransform: "capitalize" }}>{k}</dt><dd>{v}</dd></React.Fragment>)}
          {view.profile && Object.entries(view.profile).filter(([k, v]) => k !== "id" && v !== null && v !== "" && !(Array.isArray(v) && !v.length)).map(([k, v]) => <React.Fragment key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd></React.Fragment>)}</dl>
      </Modal>)}
    {modal && (
      <Modal title={modal.id ? `Edit ${modal.name}` : "Add user"} onClose={() => setModal(null)}>
        <form onSubmit={save} className="stack" noValidate>
          <Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          {!modal.id && <Select label="Role" value={f.role} options={["Student", "Mentor", "Recruiter", "Admin"]} onChange={(e) => setF({ ...f, role: e.target.value })} />}
          <Input label={modal.id ? "Reset password (optional)" : "Password"} type="password" autoComplete="new-password" hint="At least 8 characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">{modal.id ? "Save changes" : "Create user"}</button></div>
        </form>
      </Modal>)}
  </>);
}

/* ===================== Read-only monitors (+ internship close/delete) ===================== */
const MONITORS = {
  internships: { title: "Internships", sub: "All internships across recruiters.", statuses: ["Draft", "Published", "Closed"],
    cols: (act) => [{ h: "Title", render: (r) => <b>{r.title}</b> }, { h: "Company", key: "company_name" }, { h: "Status", render: (r) => <Badge status={r.effective_status} /> }, { h: "Applications", key: "application_count" }, { h: "Deadline", render: (r) => fmtDate(r.deadline) }, { h: "Actions", render: act }] },
  applications: { title: "Applications", sub: "Monitor every internship application.", statuses: ["Pending", "Shortlisted", "Accepted", "Rejected"],
    cols: () => [{ h: "Student", key: "student_name" }, { h: "Internship", key: "internship_title" }, { h: "Recruiter", key: "recruiter_name" }, { h: "Status", render: (r) => <Badge status={r.status} /> }, { h: "Applied", render: (r) => fmtDate(r.created_at) }] },
  mentorships: { title: "Mentorships", sub: "Monitor mentorship requests and progress.", statuses: ["Pending", "Active", "Completed", "Rejected"],
    cols: () => [{ h: "Student", key: "student_name" }, { h: "Mentor", key: "mentor_name" }, { h: "Status", render: (r) => <Badge status={r.status} /> }, { h: "Requested", render: (r) => fmtDate(r.created_at) }, { h: "Message", render: (r) => <span className="muted">{(r.message || "").slice(0, 60)}</span> }] },
  exchanges: { title: "Skill exchanges", sub: "Monitor skill exchange activity.", statuses: ["Pending", "Accepted", "Rejected", "Completed"],
    cols: () => [{ h: "From", key: "from_name" }, { h: "To", key: "to_name" }, { h: "Offers", key: "offer_skill_name" }, { h: "Wants", key: "request_skill_name" }, { h: "Status", render: (r) => <Badge status={r.status} /> }, { h: "Date", render: (r) => fmtDate(r.created_at) }] },
};
export function Monitor({ entity }) {
  const m = MONITORS[entity]; const toast = useToast(); const confirm = useConfirm();
  const [sp] = useSearchParams(); const [status, setStatus] = useState(""); const [search, setSearch] = useState(sp.get("q") || "");
  const ds = useDebounced(search);
  const q = useFetch(`/admin/${entity}${qs({ status, search: entity === "internships" ? ds : "" })}`, [entity]);
  const act = (r) => (<div style={{ display: "flex", gap: 6 }}>
    {r.status === "Published" && <button className="btn ghost sm" onClick={async () => { if (await confirm({ title: "Close internship?", message: "Students will no longer be able to apply.", confirmText: "Close" })) try { await api(`/internships/${r.id}/close`, { method: "POST", body: {} }); toast.success("Internship closed"); q.reload(); } catch (e) { toast.error(e.message); } }}>Close</button>}
    <button className="btn danger sm" aria-label="Delete" onClick={async () => { if (await confirm({ title: "Delete internship?", message: `“${r.title}” and its applications will be permanently deleted.`, confirmText: "Delete", danger: true })) try { await api(`/internships/${r.id}`, { method: "DELETE" }); toast.success("Internship deleted"); q.reload(); } catch (e) { toast.error(e.message); } }}><Trash2 size={13} /></button></div>);
  return (<>
    <PageHeader title={m.title} sub={m.sub} />
    <div className="filters">
      {entity === "internships" && <input placeholder="Search by title" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />}
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{m.statuses.map((s) => <option key={s}>{s}</option>)}</select>
    </div>
    <Async q={q}>{(rows) => <div className="card"><DataTable rows={rows} columns={m.cols(act)} empty={<Empty title={`No ${m.title.toLowerCase()} found`} />} /></div>}</Async>
  </>);
}

/* ===================== Skills ===================== */
export function AdminSkills() {
  const toast = useToast(); const confirm = useConfirm();
  const q = useFetch("/admin/skills"); const [modal, setModal] = useState(null); const [name, setName] = useState(""); const [search, setSearch] = useState("");
  const save = async (e) => {
    e.preventDefault(); if (!name.trim()) return toast.error("Enter a skill name");
    try { if (modal.id) await api(`/skills/${modal.id}`, { method: "PUT", body: { name } }); else await api("/skills", { method: "POST", body: { name } }); toast.success(modal.id ? "Skill renamed" : "Skill added"); setModal(null); q.reload(); }
    catch (err) { toast.error(err.message); }
  };
  const remove = async (s) => { if (!(await confirm({ title: "Delete skill?", message: s.students ? `${s.students} student(s) have this skill; it will be removed from their profiles.` : "This skill is not used by anyone.", confirmText: "Delete", danger: true }))) return; try { await api(`/skills/${s.id}`, { method: "DELETE" }); toast.success("Skill deleted"); q.reload(); } catch (e) { toast.error(e.message); } };
  return (<>
    <PageHeader title="Skills" sub="The skill catalog students choose from." actions={<button className="btn dark" onClick={() => { setName(""); setModal({}); }}><Plus size={15} /> Add skill</button>} />
    <div className="filters"><input placeholder="Search skills" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search skills" /></div>
    <Async q={q}>{(rows) => <div className="card"><DataTable rows={rows.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))} empty={<Empty title="No skills found" />} columns={[
      { h: "Skill", render: (s) => <b>{s.name}</b> }, { h: "Students", key: "students" }, { h: "Added", render: (s) => fmtDate(s.created_at) },
      { h: "Actions", render: (s) => <div style={{ display: "flex", gap: 6 }}><button className="btn ghost sm" aria-label="Rename" onClick={() => { setName(s.name); setModal(s); }}><Pencil size={13} /></button><button className="btn danger sm" aria-label="Delete" onClick={() => remove(s)}><Trash2 size={13} /></button></div> },
    ]} /></div>}</Async>
    {modal && <Modal title={modal.id ? "Rename skill" : "Add skill"} onClose={() => setModal(null)} small>
      <form onSubmit={save} className="stack" noValidate><Input label="Skill name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">Save</button></div></form>
    </Modal>}
  </>);
}

/* ===================== Notifications broadcast ===================== */
export function AdminNotifications() {
  const toast = useToast(); const confirm = useConfirm();
  const [f, setF] = useState({ audience: "All", title: "", message: "" }); const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.message.trim()) return toast.error("Enter a title and a message");
    if (!(await confirm({ title: "Send notification?", message: `This will notify ${f.audience === "All" ? "every active user" : `all active ${f.audience.toLowerCase()}s`}.`, confirmText: "Send" }))) return;
    setBusy(true);
    try { const r = await api("/admin/notifications", { method: "POST", body: f }); toast.success(`Sent to ${r.sent} user${r.sent === 1 ? "" : "s"}`); setF({ ...f, title: "", message: "" }); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (<>
    <PageHeader title="Notifications" sub="Send a system announcement to users. Your own notifications are under the bell." />
    <form className="card stack" style={{ maxWidth: 640 }} onSubmit={send} noValidate>
      <Select label="Audience" value={f.audience} options={[["All", "Everyone"], ["Student", "Students"], ["Mentor", "Mentors"], ["Recruiter", "Recruiters"], ["Admin", "Admins"]]} onChange={(e) => setF({ ...f, audience: e.target.value })} />
      <Input label="Title" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea label="Message" value={f.message} maxLength={1000} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <div><button className="btn dark" disabled={busy}>{busy ? "Sending…" : "Send announcement"}</button></div>
    </form>
  </>);
}

/* ===================== Feedback moderation ===================== */
export function AdminFeedback() {
  const toast = useToast(); const confirm = useConfirm();
  const q = useFetch("/admin/feedback");
  const remove = async (x) => { if (!(await confirm({ title: "Delete feedback?", message: "Removes this review for everyone.", confirmText: "Delete", danger: true }))) return; try { await api(`/admin/feedback/${x.id}`, { method: "DELETE" }); toast.success("Feedback deleted"); q.reload(); } catch (e) { toast.error(e.message); } };
  return (<>
    <PageHeader title="Feedback" sub="Review and moderate feedback across the platform." />
    <Async q={q}>{(rows) => <div className="card"><DataTable rows={rows} empty={<Empty title="No feedback yet" />} columns={[
      { h: "From", key: "author_name" }, { h: "About", key: "target_name" }, { h: "Rating", render: (x) => <Stars value={x.rating} /> }, { h: "Comment", render: (x) => x.comment || <span className="muted">–</span> }, { h: "Date", render: (x) => fmtDate(x.created_at) },
      { h: "Actions", render: (x) => <button className="btn danger sm" aria-label="Delete" onClick={() => remove(x)}><Trash2 size={13} /></button> },
    ]} /></div>}</Async>
  </>);
}

/* ===================== Reports ===================== */
export function Reports() {
  const toast = useToast(); const [busy, setBusy] = useState("");
  const items = [["users", "Users", "Everyone on the platform with role and status"], ["internships", "Internships", "All internships with status, dates and stipend"], ["applications", "Applications", "Every application and its current status"], ["mentorships", "Mentorships", "All mentorship requests and statuses"], ["exchanges", "Skill exchanges", "All skill exchange requests and statuses"]];
  const get = async (k) => { setBusy(k); try { await download(`/admin/reports/${k}`, `skillbridge-${k}.csv`); toast.success("Report downloaded"); } catch (e) { toast.error(e.message); } finally { setBusy(""); } };
  return (<>
    <PageHeader title="Reports" sub="Download platform data as CSV files." />
    <div className="cards">{items.map(([k, t, d]) => <div className="card item-card" key={k}><h3>{t}</h3><p>{d}</p><div className="actions"><button className="btn dark sm" disabled={busy === k} onClick={() => get(k)}><Download size={13} /> {busy === k ? "Preparing…" : "Download CSV"}</button></div></div>)}</div>
  </>);
}

/* ===================== Analytics ===================== */
export function AdminAnalytics() {
  const q = useFetch("/admin/analytics");
  const Block = ({ t, data, k = "name" }) => <div className="card"><div className="section-title"><h3>{t}</h3></div><BarBlock data={data} xKey={k} /></div>;
  return (<>
    <PageHeader title="Analytics" sub="Live figures from the database." />
    <Async q={q}>{(d) => (<div className="stack">
      <div className="split"><Block t="Users by role" data={d.users_by_role} /><Block t="Sign-ups per week (last 8 weeks)" data={d.signups_by_week} k="week" /></div>
      <div className="split"><Block t="Applications by status" data={d.applications_by_status} /><Block t="Internships by status" data={d.internships_by_status} /></div>
      <div className="split"><Block t="Mentorships by status" data={d.mentorships_by_status} /><Block t="Skill exchanges by status" data={d.exchanges_by_status} /></div>
      <Block t="Most common student skills" data={d.top_skills} />
    </div>)}</Async>
  </>);
}

/* ===================== Admin logs ===================== */
export function Logs() {
  const [page, setPage] = useState(1);
  const q = useFetch(`/admin/logs?page=${page}`);
  return (<>
    <PageHeader title="Admin logs" sub="A record of administrator actions." />
    <Async q={q}>{(d) => <div className="card"><DataTable rows={d.items} empty={<Empty title="No admin actions logged yet" text="Actions such as editing users or deleting records appear here." />} columns={[
      { h: "When", render: (l) => new Date(l.created_at).toLocaleString() }, { h: "Admin", render: (l) => l.actor_name || "–" }, { h: "Action", render: (l) => <b>{l.action}</b> },
      { h: "Details", render: (l) => <span className="muted">{l.metadata ? JSON.stringify(l.metadata) : ""}</span> },
    ]} /><Pager page={d.page} total={d.total} size={d.page_size} onChange={setPage} /></div>}</Async>
  </>);
}
