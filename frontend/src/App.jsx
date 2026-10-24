import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { Providers } from "./ui.jsx";
import Shell from "./Shell.jsx";
import Landing from "./pages/Landing.jsx";
import Dashboard from "./pages/Dashboards.jsx";
import Profile from "./pages/Profile.jsx";
import { Notifications, Settings, Feedback } from "./pages/Common.jsx";
import { MySkills, Projects, Exchange } from "./pages/StudentA.jsx";
import { FindMentors, MyMentorships, Internships, MyApplications } from "./pages/StudentB.jsx";
import { MentorRequests, Mentees } from "./pages/Mentor.jsx";
import { RecruiterInternships, RecruiterApplications, RecruiterAnalytics } from "./pages/Recruiter.jsx";
import { Users, Monitor, AdminSkills, AdminNotifications, AdminFeedback, Reports, AdminAnalytics, Logs } from "./pages/Admin.jsx";

// One table drives both the sidebar and the routes. Order here is the sidebar order.
const PAGES = {
  Student: { dashboard: Dashboard, profile: Profile, skills: MySkills, projects: Projects, exchange: Exchange, mentors: FindMentors, mentorships: MyMentorships, internships: Internships, applications: MyApplications, notifications: Notifications, feedback: Feedback, settings: Settings },
  Mentor: { dashboard: Dashboard, profile: Profile, requests: MentorRequests, mentees: Mentees, notifications: Notifications, feedback: Feedback, settings: Settings },
  Recruiter: { dashboard: Dashboard, profile: Profile, internships: RecruiterInternships, applications: RecruiterApplications, analytics: RecruiterAnalytics, notifications: Notifications, feedback: Feedback, settings: Settings },
  Admin: {
    dashboard: Dashboard, users: () => <Users />, students: () => <Users role="Student" />, mentors: () => <Users role="Mentor" />, recruiters: () => <Users role="Recruiter" />,
    internships: () => <Monitor entity="internships" />, applications: () => <Monitor entity="applications" />, mentorships: () => <Monitor entity="mentorships" />, exchanges: () => <Monitor entity="exchanges" />,
    skills: AdminSkills, notifications: AdminNotifications, feedback: AdminFeedback, reports: Reports, analytics: AdminAnalytics, logs: Logs, settings: Settings,
  },
};

function Guarded({ children }) {
  const loc = useLocation();
  // Remount the page when the query string changes so search from the top bar takes effect.
  return <React.Fragment key={loc.pathname + loc.search}>{children}</React.Fragment>;
}

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="center-screen">Loading…</div>;
  if (!user) return <Routes><Route path="*" element={<Landing />} /></Routes>;
  const pages = PAGES[user.role] || {};
  const base = `/${user.role.toLowerCase()}`;
  return (
    <Shell keys={Object.keys(pages)}>
      <Routes>
        {Object.entries(pages).map(([key, Page]) => <Route key={key} path={`${base}/${key}`} element={<Guarded><Page /></Guarded>} />)}
        {/* Any URL outside the signed-in user's own portal falls back to their dashboard. */}
        <Route path="*" element={<Navigate to={`${base}/dashboard`} replace />} />
      </Routes>
    </Shell>
  );
}

export default function Root() {
  return <BrowserRouter><AuthProvider><Providers><AppRoutes /></Providers></AuthProvider></BrowserRouter>;
}
