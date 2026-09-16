import { LayoutDashboard, Plus, Briefcase, Building2, Mail } from "lucide-react";

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
{ id: "manage-jobs", name: "Manage Jobs", icon: Briefcase },
{ id: "email-templates", name: "Email Templates", icon: Mail },
{ id: "company-profile", name: "Company Profile", icon: Building2 },
];

// Navigation shown to platform administrators.
export const ADMIN_NAVIGATION_MENU = [
  { id: "admin-email-templates", name: "Email Templates", icon: Mail },
];

// ── Static demo data for employer dashboard ───────────────────────────────────

export const RECENT_JOBS = [
  {
    _id: "job_1",
    title: "Backend Developer",
    location: "New York",
    createdAt: "2025-07-23T09:00:00.000Z",
    isActive: true,
    isClosed: false,
    applicantCount: 12,
  },
  {
    _id: "job_2",
    title: "Frontend Developer",
    location: "New York",
    createdAt: "2025-07-23T09:00:00.000Z",
    isActive: false,
    isClosed: true,
    applicantCount: 8,
  },
  {
    _id: "job_3",
    title: "UI/UX Designer",
    location: "Remote",
    createdAt: "2025-07-20T08:00:00.000Z",
    isActive: true,
    isClosed: false,
    applicantCount: 5,
  },
];

export const RECENT_APPLICATIONS = [
  {
    _id: "app_1",
    applicant: "John Mensah",
    job: { title: "Backend Developer" },
    updatedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), // 14 hours ago
    status: "pending",
  },
  {
    _id: "app_2",
    applicant: "Sarah Osei",
    job: { title: "Frontend Developer" },
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    status: "shortlisted",
  },
  {
    _id: "app_3",
    applicant: "David Asante",
    job: { title: "UI/UX Designer" },
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    status: "reviewing",
  },
  {
    _id: "app_4",
    applicant: "Ama Boateng",
    job: { title: "Backend Developer" },
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    status: "accepted",
  },
];
