import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Async, useFetch, useToast, PageHeader, Progress, Input, Textarea, FileUpload, Field } from "../ui.jsx";

// type: text | number | area | list | url | file:<kind>
const FIELDS = {
  Student: [
    ["Personal information"],
    ["phone", "Phone", "text"], ["location", "Location", "text"],
    ["bio", "Bio", "area"], ["avatar_url", "Profile photo", "file:avatar:image/png,image/jpeg,image/webp"],
    ["Academic information"],
    ["college", "College", "text"], ["department", "Department", "text"], ["graduation_year", "Graduation year", "number", { min: 1990, max: 2100 }],
    ["Career and interests"],
    ["career_goal", "Career goal", "text"], ["interests", "Interests", "list", { hint: "Separate with commas" }],
    ["Links and resume"],
    ["linkedin_url", "LinkedIn", "url"], ["github_url", "GitHub", "url"], ["portfolio_url", "Portfolio", "url"],
    ["resume_url", "Resume (PDF or Word, up to 5 MB)", "file:resume:application/pdf,.doc,.docx"],
  ],
  Mentor: [
    ["Personal information"], ["bio", "Bio", "area"],
    ["Professional information"],
    ["job_title", "Job title", "text"], ["company", "Company", "text"], ["experience_years", "Years of experience", "number", { min: 0, max: 70 }],
    ["expertise", "Areas of expertise", "list", { hint: "Separate with commas, e.g. React, Data Science" }],
    ["availability", "Availability", "text", { hint: "e.g. Weekends, 2 hours per week" }], ["linkedin_url", "LinkedIn", "url"],
  ],
  Recruiter: [
    ["Company"], ["company_name", "Company name", "text"], ["industry", "Industry", "text"], ["location", "Location", "text"],
    ["description", "Company description", "area"], ["logo_url", "Logo", "file:logo:image/png,image/jpeg,image/webp"],
    ["Links"], ["website", "Website", "url"], ["linkedin_url", "LinkedIn", "url"],
  ],
};

const toForm = (d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""]));

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const q = useFetch("/profile");
  const [form, setForm] = useState(null);
  const [completion, setCompletion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => { if (q.data) { setForm(toForm(q.data)); setCompletion(q.data.profile_completion); } }, [q.data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!String(form.name || "").trim() || form.name.trim().length < 2) e.name = "Enter your name";
    for (const [k, label, type, o] of FIELDS[user.role].filter((f) => f.length > 1)) {
      const v = String(form[k] ?? "").trim();
      if (!v) continue;
      if (type === "number" && (!Number.isInteger(Number(v)) || Number(v) < o.min || Number(v) > o.max)) e[k] = `${label} must be a whole number between ${o.min} and ${o.max}`;
      if (type === "url" && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/.test(v)) e[k] = `${label} must be a valid link`;
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async (ev) => {
    ev.preventDefault();
    if (!validate()) return toast.error("Please fix the highlighted fields");
    setSaving(true);
    try {
      const payload = { name: form.name };
      for (const f of FIELDS[user.role]) if (f.length > 1) payload[f[0]] = form[f[0]];
      const saved = await api("/profile", { method: "PUT", body: payload });
      setForm(toForm(saved)); setCompletion(saved.profile_completion);
      setUser({ ...user, name: saved.name });
      toast.success("Profile saved");
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <Async q={q}>{() => form && (<>
      <PageHeader title={user.role === "Recruiter" ? "Company profile" : "My profile"} sub="This is what mentors, recruiters and other students see." />
      <div className="card" style={{ marginBottom: 18 }}><div className="section-title"><h3>Profile completion</h3><b>{completion}%</b></div><Progress value={completion} /></div>
      <form className="card form-grid" onSubmit={save} noValidate>
        <Input label="Full name" value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
        <Field label="Email"><input value={form.email || ""} disabled /></Field>
        {errors.name && <div className="error full-span">{errors.name}</div>}
        {FIELDS[user.role].map((f) => {
          if (f.length === 1) return <h3 key={f[0]} className="full-span" style={{ margin: "10px 0 0" }}>{f[0]}</h3>;
          const [k, label, type, o = {}] = f;
          const err = errors[k] && <div className="error full-span">{errors[k]}</div>;
          if (type.startsWith("file:")) {
            const [, kind, accept] = type.split(":");
            const uploaded = async (url) => {
              set(k, url);
              try { const s = await api("/profile", { method: "PUT", body: { [k]: url } }); setCompletion(s.profile_completion); }
              catch (e) { toast.error(e.message); }
            };
            return <div className="full-span" key={k} style={{ display: "grid", gap: 7 }}><b style={{ fontSize: 13 }}>{label}</b><FileUpload kind={kind} accept={accept} label="Choose file" current={form[k]} onDone={uploaded} /></div>;
          }
          if (type === "area") return <React.Fragment key={k}><Textarea label={label} value={form[k] || ""} maxLength={1500} onChange={(e) => set(k, e.target.value)} />{err}</React.Fragment>;
          return <React.Fragment key={k}><Input label={label} hint={o.hint} type={type === "number" ? "number" : "text"} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />{err}</React.Fragment>;
        })}
        <div className="full-span"><button className="btn dark" disabled={saving}><Save size={15} />{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </>)}</Async>
  );
}
