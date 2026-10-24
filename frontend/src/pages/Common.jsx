import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Trash2, LogOut, Pencil } from "lucide-react";
import { api, qs } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Async, useFetch, useToast, useConfirm, PageHeader, Tabs, Empty, Modal, Select, Textarea, Input, Stars, fmtDate } from "../ui.jsx";

const ping = () => window.dispatchEvent(new Event("sb:notifications-changed"));

/* ===================== Notifications ===================== */
export function Notifications() {
  const toast = useToast(); const confirm = useConfirm(); const nav = useNavigate();
  const [tab, setTab] = useState("all"); const [type, setType] = useState("");
  const q = useFetch(`/notifications${qs({ unread: tab === "unread" ? "true" : "", type })}`);
  const run = async (fn, msg) => { try { await fn(); msg && toast.success(msg); q.reload(); ping(); } catch (e) { toast.error(e.message); } };
  const open = (n) => { if (!n.read) api(`/notifications/${n.id}/read`, { method: "PATCH", body: {} }).then(ping).catch(() => {}); if (n.link) nav(n.link); };
  return (<>
    <PageHeader title="Notifications" sub="Updates about your applications, mentorships, exchanges and the platform."
      actions={<button className="btn ghost" onClick={() => run(() => api("/notifications/read-all", { method: "POST", body: {} }), "All notifications marked as read")}><Check size={15} /> Mark all as read</button>} />
    <div className="filters">
      <Tabs tabs={[{ key: "all", label: "All" }, { key: "unread", label: "Unread" }]} value={tab} onChange={setTab} />
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type"><option value="">All types</option>{["Application", "Mentorship", "Exchange", "Internship", "System"].map((t) => <option key={t}>{t}</option>)}</select>
    </div>
    <Async q={q}>{(items) => items.length ? (
      <div className="list">{items.map((n) => (
        <div key={n.id} className={`notif ${n.read ? "read" : "unread"}`}>
          <span className="dot" />
          <div className="body" style={{ cursor: n.link ? "pointer" : "default" }} onClick={() => open(n)}><b>{n.title}</b><span>{n.message}</span><span className="muted">{n.type || "System"} · {fmtDate(n.created_at)}</span></div>
          <div className="actions">
            <button className="btn ghost sm" onClick={() => run(() => api(`/notifications/${n.id}/read`, { method: "PATCH", body: { read: !n.read } }))}>{n.read ? "Mark unread" : "Mark read"}</button>
            <button className="btn ghost sm" aria-label="Delete notification" onClick={async () => { if (await confirm({ title: "Delete notification?", message: "This cannot be undone.", confirmText: "Delete", danger: true })) run(() => api(`/notifications/${n.id}`, { method: "DELETE" }), "Notification deleted"); }}><Trash2 size={14} /></button>
          </div>
        </div>))}</div>
    ) : <div className="card"><Empty title={tab === "unread" ? "You're all caught up" : "No notifications yet"} text="New activity will appear here." /></div>}</Async>
  </>);
}

/* ===================== Settings ===================== */
export function Settings() {
  const { user, logout } = useAuth(); const toast = useToast();
  const prefs = useFetch("/settings/preferences");
  const [p, setP] = useState(null);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (prefs.data) setP(prefs.data); }, [prefs.data]);

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 8) return toast.error("New password must be at least 8 characters");
    if (pw.new_password !== pw.confirm) return toast.error("New passwords do not match");
    setBusy(true);
    try { await api("/auth/change-password", { method: "POST", body: { current_password: pw.current_password, new_password: pw.new_password } }); toast.success("Password updated"); setPw({ current_password: "", new_password: "", confirm: "" }); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const savePrefs = async () => { try { await api("/settings/preferences", { method: "PUT", body: p }); toast.success("Notification preferences saved"); } catch (e) { toast.error(e.message); } };

  return (<>
    <PageHeader title="Settings" sub="Manage your account, password and notifications." />
    <div className="split">
      <div className="stack">
        <div className="card"><div className="section-title"><h3>Account</h3></div>
          <dl className="kv"><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd>{user.role}</dd></dl>
          <div style={{ marginTop: 16 }}><button className="btn ghost" onClick={logout}><LogOut size={15} /> Log out</button></div>
        </div>
        <form className="card form-grid" onSubmit={changePw} style={{ gridTemplateColumns: "1fr" }}>
          <div className="section-title" style={{ margin: 0 }}><h3>Change password</h3></div>
          <Input label="Current password" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          <div><button className="btn dark" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></div>
        </form>
      </div>
      <div className="card"><div className="section-title"><h3>Notification preferences</h3></div>
        <Async q={prefs}>{() => p && (<>
          <p className="muted">Choose which in-app notifications you receive.</p>
          {Object.keys(p).map((t) => <label key={t} className="check mini-row" style={{ display: "flex" }}><span>{t} notifications</span><input type="checkbox" checked={p[t]} onChange={(e) => setP({ ...p, [t]: e.target.checked })} /></label>)}
          <div style={{ marginTop: 14 }}><button className="btn dark" onClick={savePrefs}>Save preferences</button></div>
        </>)}</Async>
      </div>
    </div>
  </>);
}

/* ===================== Feedback (Student, Mentor, Recruiter) ===================== */
export function Feedback() {
  const toast = useToast(); const confirm = useConfirm();
  const [box, setBox] = useState("given"); const [modal, setModal] = useState(null);
  const q = useFetch(`/feedback?box=${box}`);
  const targets = useFetch("/feedback/targets");
  const [f, setF] = useState({ target_id: "", rating: "5", comment: "" });

  const openNew = () => { setF({ target_id: "", rating: "5", comment: "" }); setModal({}); };
  const openEdit = (x) => { setF({ target_id: x.target_id, rating: String(x.rating), comment: x.comment || "" }); setModal(x); };
  const submit = async (e) => {
    e.preventDefault();
    if (!modal.id && !f.target_id) return toast.error("Choose who you are reviewing");
    try {
      if (modal.id) await api(`/feedback/${modal.id}`, { method: "PUT", body: { rating: Number(f.rating), comment: f.comment } });
      else await api("/feedback", { method: "POST", body: { ...f, rating: Number(f.rating) } });
      toast.success(modal.id ? "Feedback updated" : "Feedback submitted"); setModal(null); q.reload();
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (x) => { if (!(await confirm({ title: "Delete feedback?", message: "This removes your review.", confirmText: "Delete", danger: true }))) return; try { await api(`/feedback/${x.id}`, { method: "DELETE" }); toast.success("Feedback deleted"); q.reload(); } catch (e) { toast.error(e.message); } };

  return (<>
    <PageHeader title="Feedback" sub="Rate people you have worked with on SkillBridge." actions={<button className="btn dark" onClick={openNew}>Give feedback</button>} />
    <Tabs tabs={[{ key: "given", label: "Given by me" }, { key: "received", label: "Received" }]} value={box} onChange={setBox} />
    <Async q={q}>{(items) => items.length ? (
      <div className="cards">{items.map((x) => (
        <div className="card item-card" key={x.id}>
          <div className="row"><h3>{box === "given" ? `To ${x.target_name || "user"}` : `From ${x.author_name || "user"}`}</h3><Stars value={x.rating} /></div>
          <p>{x.comment || <span className="muted">No comment</span>}</p><span className="muted">{fmtDate(x.created_at)}</span>
          {box === "given" && <div className="actions"><button className="btn ghost sm" onClick={() => openEdit(x)}><Pencil size={13} /> Edit</button><button className="btn danger sm" onClick={() => remove(x)}><Trash2 size={13} /> Delete</button></div>}
        </div>))}</div>
    ) : <div className="card"><Empty title={box === "given" ? "You haven't given feedback yet" : "No feedback received yet"} text={box === "given" ? "You can review mentors, mentees and applicants you have worked with." : undefined} /></div>}</Async>
    {modal && (
      <Modal title={modal.id ? "Edit feedback" : "Give feedback"} onClose={() => setModal(null)}>
        <form onSubmit={submit} className="stack" noValidate>
          {!modal.id && <Select label="Who are you reviewing?" value={f.target_id} placeholder="Choose a person" options={(targets.data || []).map((t) => [t.id, `${t.name} (${t.role})`])} onChange={(e) => setF({ ...f, target_id: e.target.value })} hint={targets.data && !targets.data.length ? "You can review people once you have an active mentorship, an accepted application, or a shortlisted applicant." : undefined} />}
          <Select label="Rating" value={f.rating} options={[["5", "5 – Excellent"], ["4", "4 – Good"], ["3", "3 – Okay"], ["2", "2 – Poor"], ["1", "1 – Very poor"]]} onChange={(e) => setF({ ...f, rating: e.target.value })} />
          <Textarea label="Comment" value={f.comment} maxLength={1000} onChange={(e) => setF({ ...f, comment: e.target.value })} />
          <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn dark">{modal.id ? "Save changes" : "Submit feedback"}</button></div>
        </form>
      </Modal>)}
  </>);
}
