import { LayoutDashboard, Plus, Briefcase, Building2, Mail, ShieldAlert, Users, UserSearch, ClipboardCheck, Copy, LayoutTemplate } from "lucide-react";

export const landingFeatures = {
  title: "Designed for",
  highlightedTitle: "serious hiring",
  subtitle:
    "Simple, reliable tools for candidates exploring opportunities and employers managing job posts, profiles, and applications.",
  groups: [
    {
      title: "For Candidates",
      kicker: "Find your next role",
      accent: "primary",
      features: [
        {
          icon: "Search",
          title: "Focused Job Search",
          description:
            "Browse current openings and view role details without unnecessary distractions.",
          variant: "card",
        },
        {
          icon: "FileText",
          title: "Candidate Profile",
          description:
            "Keep your personal and professional details ready for applications.",
          variant: "card",
        },
        {
          icon: "Star",
          title: "Saved Jobs",
          description:
            "Shortlist promising roles and return to them when you are ready to apply.",
          variant: "plain",
        },
        {
          icon: "ClipboardCheck",
          title: "Application Flow",
          description:
            "Move from job discovery to application details through a direct, guided path.",
          variant: "plain",
        },
      ],
    },
    {
      title: "For Employers",
      kicker: "Manage active hiring",
      accent: "secondary",
      features: [
        {
          icon: "BriefcaseBusiness",
          title: "Job Posting",
          description:
            "Create openings with the role, location, compensation, and requirements candidates need.",
          variant: "card",
          highlighted: true,
        },
        {
          icon: "BarChart3",
          title: "Hiring Dashboard",
          description:
            "Track posted roles, recent activity, and hiring progress from one employer workspace.",
          variant: "card",
        },
        {
          icon: "Users",
          title: "Applicant Review",
          description:
            "Open applicant records and review candidate information tied to each job.",
          variant: "plain",
        },
        {
          icon: "Building2",
          title: "Company Profile",
          description:
            "Maintain company details so candidates understand the organization behind each role.",
          variant: "plain",
        },
      ],
    },
  ],
};

// Navigation menu for employer
export const NAVIGATION_MENU = [
{ id: "employer-dashboard", name: "Dashboard", icon: LayoutDashboard },
{ id: "post-job", name: "Post Job", icon: Plus },
{ id: "job-templates", name: "Job Templates", icon: LayoutTemplate },
{ id: "manage-jobs", name: "Manage Jobs", icon: Briefcase },
{ id: "talent-search", name: "Talent Search", icon: UserSearch },
{ id: "assessments", name: "Assessments", icon: ClipboardCheck },
{ id: "duplicates", name: "Duplicates", icon: Copy },
{ id: "email-templates", name: "Email Templates", icon: Mail },
{ id: "company-profile", name: "Company Profile", icon: Building2 },
];

// Navigation shown to platform administrators.
export const ADMIN_NAVIGATION_MENU = [
  { id: "admin-overview", name: "Overview", icon: LayoutDashboard },
  { id: "admin-companies", name: "Companies", icon: Building2 },
  { id: "admin-accounts", name: "Accounts", icon: Users },
  { id: "admin-jobs", name: "Job Postings", icon: Briefcase },
  { id: "admin-moderation", name: "Trust & Safety", icon: ShieldAlert },
  { id: "admin-duplicates", name: "Duplicate Accounts", icon: Copy },
  { id: "admin-email-templates", name: "Email Templates", icon: Mail },
];

