import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Menu, Search, X, Bell } from "lucide-react";
import { useAuth } from "./auth.jsx";
import { api } from "./api.js";
import { iconFor, labelFor, searchTarget } from "./nav.js";

export const Logo = () => <div className="brand"><div className="logo">S</div><span>SkillBridge</span></div>;

export default function Shell({ keys, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const base = `/${user.role.toLowerCase()}`;

  useEffect(() => {
    let live = true;
    const load = () => api("/notifications/unread-count").then((d) => live && setUnread(d.count)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    window.addEventListener("sb:notifications-changed", load);
    return () => { live = false; clearInterval(t); window.removeEventListener("sb:notifications-changed", load); };
  }, []);

  const onSearch = (e) => {
    if (e.key !== "Enter" || !q.trim()) return;
    nav(`${base}/${searchTarget[user.role]}?q=${encodeURIComponent(q.trim())}`);
    setQ("");
  };

  return (
    <div className="app">
      <aside className={`sidebar ${open ? "show" : ""}`}>
        <Logo />
        <button className="close" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        <nav aria-label="Main">
          {keys.map((k) => { const I = iconFor(user.role, k); return (
            <NavLink key={k} to={`${base}/${k}`} className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setOpen(false)}><I size={18} /><span>{labelFor(user.role, k)}</span></NavLink>
          ); })}
        </nav>
        <button className="logout" onClick={logout}><LogOut size={18} /><span>Logout</span></button>
      </aside>
      <main className="main">
        <header>
          <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearch} placeholder={user.role === "Admin" ? "Search users…" : user.role === "Mentor" ? "Search your students…" : "Search internships…"} aria-label="Search" /></div>
          <div className="top-actions">
            <span className="role">{user.role}</span>
            <button className="bell" onClick={() => nav(`${base}/notifications`)} aria-label={`Notifications, ${unread} unread`}><Bell size={20} />{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</button>
            <button className="avatar" style={{ border: 0 }} onClick={() => nav(`${base}/${user.role === "Admin" ? "settings" : "profile"}`)} aria-label="Your profile">{(user.name || "SB").slice(0, 2).toUpperCase()}</button>
          </div>
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
