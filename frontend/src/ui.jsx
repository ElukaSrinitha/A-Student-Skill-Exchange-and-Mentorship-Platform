import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { api } from "./api.js";

/* ---------- data hook ---------- */
export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path).then((data) => live && setState({ data, loading: false, error: "" })).catch((e) => live && setState({ data: null, loading: false, error: e.message }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* ---------- toasts ---------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, type, message }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), type === "error" ? 6000 : 3500);
  }, []);
  const api_ = useRef({ success: (m) => push("success", m), error: (m) => push("error", m) }).current;
  return (
    <ToastCtx.Provider value={api_}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- confirm dialog ---------- */
const ConfirmCtx = createContext(null);
export const useConfirm = () => useContext(ConfirmCtx);
function ConfirmProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const ask = useCallback((opts) => new Promise((resolve) => setDlg({ ...opts, resolve })), []);
  const close = (v) => { dlg.resolve(v); setDlg(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {dlg && (
        <Modal title={dlg.title || "Are you sure?"} onClose={() => close(false)} small>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>{dlg.message}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => close(false)}>Cancel</button>
            <button className={`btn ${dlg.danger ? "danger" : "dark"}`} onClick={() => close(true)}>{dlg.confirmText || "Confirm"}</button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const Providers = ({ children }) => <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>;

/* ---------- layout pieces ---------- */
export function Modal({ title, onClose, children, wide, small }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal card ${wide ? "wide" : ""} ${small ? "small" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="section-title"><h3>{title}</h3><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
export const PageHeader = ({ title, sub, actions }) => (
  <div className="page-heading row"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{actions && <div className="head-actions">{actions}</div>}</div>
);
export const StatCard = ({ label, value, hint }) => (
  <div className="card stat"><small>{label}</small><h2>{value ?? "–"}</h2>{hint && <span className="muted">{hint}</span>}</div>
);
export const Empty = ({ title = "Nothing here yet", text, action }) => (
  <div className="empty"><b>{title}</b>{text && <p>{text}</p>}{action}</div>
);
export const Loading = ({ text = "Loading…" }) => <div className="empty">{text}</div>;
export const ErrorBox = ({ error, retry }) => (
  <div className="error-box"><b>Something went wrong</b><p>{error}</p>{retry && <button className="btn ghost sm" onClick={retry}>Try again</button>}</div>
);
/** Renders loading / error / content for a useFetch result. */
export function Async({ q, children }) {
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  return children(q.data);
}

const TONE = {
  Pending: "warn", Shortlisted: "info", Accepted: "ok", Active: "ok", Completed: "ok", Published: "ok", Rejected: "bad", Closed: "mute", Expired: "bad",
  Draft: "mute", Deactivated: "bad", Planning: "info", "In Progress": "warn", Beginner: "mute", Intermediate: "info", Advanced: "ok",
};
export const Badge = ({ status }) => <span className={`badge ${TONE[status] || ""}`}>{status}</span>;
export const Chips = ({ items = [] }) => <div>{items.map((s) => <span className="chip" key={typeof s === "string" ? s : s.name}>{typeof s === "string" ? s : s.name}{s.level ? ` · ${s.level}` : ""}</span>)}</div>;
export const Stars = ({ value, count }) => value == null ? <span className="muted">No ratings yet</span> : <span className="stars" title={`${value} out of 5`}>{"★".repeat(Math.round(value))}{"☆".repeat(5 - Math.round(value))} <span className="muted">{value}{count ? ` (${count})` : ""}</span></span>;
export const Progress = ({ value }) => <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${Math.min(100, value || 0)}%` }} /></div>;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "–");
export const money = (n) => (n === null || n === undefined ? "Unpaid / not stated" : `₹${Number(n).toLocaleString("en-IN")}`);

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={value === t.key} className={value === t.key ? "active" : ""} onClick={() => onChange(t.key)}>{t.label}{t.count !== undefined && <small>{t.count}</small>}</button>)}</div>;
}
export function DataTable({ columns, rows, rowKey = "id", empty }) {
  if (!rows.length) return empty || <Empty />;
  return (
    <div className="table-wrap"><table className="data"><thead><tr>{columns.map((c) => <th key={c.h}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r[rowKey] ?? i}>{columns.map((c) => <td key={c.h}>{c.render ? c.render(r) : r[c.key] ?? "–"}</td>)}</tr>)}</tbody></table></div>
  );
}
export function Pager({ page, total, size, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / size));
  if (pages <= 1) return null;
  return <div className="pager"><button className="btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span className="muted">Page {page} of {pages}</span><button className="btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></div>;
}

/* ---------- form fields ---------- */
export const Field = ({ label, hint, full, children }) => <label className={full ? "full-span" : ""}>{label}{children}{hint && <small>{hint}</small>}</label>;
export const Input = ({ label, hint, full, ...p }) => <Field label={label} hint={hint} full={full}><input {...p} /></Field>;
export const Textarea = ({ label, hint, full = true, ...p }) => <Field label={label} hint={hint} full={full}><textarea {...p} /></Field>;
export const Select = ({ label, hint, full, options, placeholder, ...p }) => (
  <Field label={label} hint={hint} full={full}>
    <select {...p}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}</select>
  </Field>
);

/** Reads a File as base64 and uploads it. Calls onDone(url). */
export function FileUpload({ kind, accept, label, current, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("File must be 5 MB or smaller");
    setBusy(true);
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("Could not read the file")); r.readAsDataURL(file); });
      const out = await api("/uploads", { method: "POST", body: { kind, filename: file.name, content_type: file.type, data } });
      onDone(out.url, file.name);
      toast.success("File uploaded");
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="upload">
      <label className="btn ghost sm"><Upload size={14} /> {busy ? "Uploading…" : label}<input type="file" hidden accept={accept} onChange={pick} disabled={busy} /></label>
      {current ? <a href={current} target="_blank" rel="noreferrer">View current file</a> : <span className="muted">Nothing uploaded yet</span>}
    </div>
  );
}

/* ---------- chart ---------- */
export function BarBlock({ data, xKey = "name", yKey = "value", height = 220 }) {
  if (!data?.length) return <Empty title="No data yet" />;
  return (
    <div style={{ height }}><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey={xKey} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey={yKey} fill="#6658e8" radius={[6, 6, 0, 0]} /></BarChart>
    </ResponsiveContainer></div>
  );
}
