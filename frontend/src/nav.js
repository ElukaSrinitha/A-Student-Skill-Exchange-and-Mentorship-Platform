import { LayoutDashboard, UserRound, GraduationCap, ArrowLeftRight, FolderKanban, BriefcaseBusiness, BarChart3, Bell, Users, Star, Settings, ClipboardList, FileText, ScrollText, Megaphone, Building2, UserCheck, Compass, Tag, Download } from "lucide-react";

// key -> [label, icon]. Roles can rename a key (see LABELS below).
export const META = {
  dashboard: ["Dashboard", LayoutDashboard], profile: ["Profile", UserRound], skills: ["Skills", GraduationCap], projects: ["Projects", FolderKanban],
  exchange: ["Skill Exchange", ArrowLeftRight], mentors: ["Mentors", Compass], mentorships: ["Mentorships", UserCheck], internships: ["Internships", BriefcaseBusiness],
  applications: ["Applications", ClipboardList], requests: ["Mentorship Requests", ClipboardList], mentees: ["Students", Users], analytics: ["Analytics", BarChart3],
  notifications: ["Notifications", Bell], feedback: ["Feedback", Star], settings: ["Settings", Settings], users: ["Users", Users], students: ["Students", GraduationCap],
  recruiters: ["Recruiters", Building2], exchanges: ["Skill Exchanges", ArrowLeftRight], reports: ["Reports", Download], logs: ["Admin Logs", ScrollText],
};
export const LABELS = {
  Student: { skills: "My Skills", projects: "My Projects", mentors: "Find Mentors", mentorships: "My Mentorships", internships: "Micro-Internships", applications: "My Applications" },
  Mentor: { mentees: "My Students" },
  Recruiter: { profile: "Company Profile", internships: "Internships" },
  Admin: { internships: "Internships", applications: "Applications", mentorships: "Mentorships", skills: "Skills", notifications: "Notifications", mentors: "Mentors", students: "Students" },
};
export const ADMIN_ICONS = { skills: Tag, notifications: Megaphone, applications: FileText };
export const labelFor = (role, key) => LABELS[role]?.[key] || META[key][0];
export const iconFor = (role, key) => (role === "Admin" && ADMIN_ICONS[key]) || META[key][1];
export const searchTarget = { Student: "internships", Mentor: "mentees", Recruiter: "internships", Admin: "users" };
