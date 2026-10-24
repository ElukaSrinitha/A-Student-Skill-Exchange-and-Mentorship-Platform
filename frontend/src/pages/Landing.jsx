import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { Logo } from "../Shell.jsx";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function Landing() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Student" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && form.name.trim().length < 2) return setError("Enter your full name");
    if (!isEmail(form.email)) return setError("Enter a valid email address");
    if (mode === "register" && form.password.length < 8) return setError("Password must be at least 8 characters");
    if (!form.password) return setError("Enter your password");
    setBusy(true);
    try { await authenticate(mode, mode === "login" ? { email: form.email, password: form.password } : form); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="landing">
      <nav><Logo /><div><button className="linkbtn" onClick={() => setMode("login")}>Login</button><button className="btn primary" onClick={() => setMode("register")}>Get started</button></div></nav>
      <div className="landing-grid">
        <div>
          <span className="pill">STUDENT • MENTOR • RECRUITER • ADMIN</span>
          <h1>Connect skills.<br /><em>Create opportunities.</em><br />Build your future.</h1>
          <p>SkillBridge connects skill exchange, mentorship and real micro-internships in one platform.</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => setMode("login")}>Log in</button>
            <button className="btn ghost" onClick={() => setMode("register")}>Create an account</button>
          </div>
        </div>
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p>{mode === "login" ? "Sign in to your portal." : "Choose your role and create an account."}</p>
          {mode === "register" && <label>Full name<input autoComplete="name" value={form.name} onChange={set("name")} /></label>}
          <label>Email<input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></label>
          <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} />{mode === "register" && <span className="hint">At least 8 characters</span>}</label>
          {mode === "register" && <label>I am a<select value={form.role} onChange={set("role")}>{["Student", "Mentor", "Recruiter"].map((r) => <option key={r}>{r}</option>)}</select></label>}
          <button className="btn dark full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
          {error && <div className="error" role="alert">{error}</div>}
          <small>{mode === "login" ? <>New here? <button type="button" className="linkbtn" style={{ color: "#4a48a5", margin: 0 }} onClick={() => setMode("register")}>Create an account</button></> : <>Already registered? <button type="button" className="linkbtn" style={{ color: "#4a48a5", margin: 0 }} onClick={() => setMode("login")}>Log in</button></>}</small>
        </form>
      </div>
      <div className="feature-row">{["Skill Exchange", "Micro-Internships", "Mentorship", "Analytics"].map((x) => <div className="feature" key={x}><CheckCircle2 size={18} /><b>{x}</b><span>Connected workflow</span></div>)}</div>
    </div>
  );
}
