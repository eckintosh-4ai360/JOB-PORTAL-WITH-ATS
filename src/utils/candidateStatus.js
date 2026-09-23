/**
 * How a candidate's own application status is displayed.
 *
 * The API never tells a candidate which internal stage they are in — only one
 * of five phases (Application received → Under review → Shortlisted →
 * Interview → Decision), and, once there is one, the outcome. Everything a
 * candidate-facing page shows about progress comes from here.
 */

export const CANDIDATE_STEPS = [
  { phase: "received", label: "Application received" },
  { phase: "under_review", label: "Under review" },
  { phase: "shortlisted", label: "Shortlisted" },
  { phase: "interview", label: "Interview" },
  { phase: "decision", label: "Decision" },
];

const DISPLAY = {
  received: {
    label: "Application received",
    icon: "inbox",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
    dot: "bg-slate-400",
  },
  under_review: {
    label: "Under review",
    icon: "manage_search",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
    dot: "bg-blue-500",
  },
  shortlisted: {
    label: "Shortlisted",
    icon: "star",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30",
    dot: "bg-violet-500",
  },
  interview: {
    label: "Interview",
    icon: "event",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  decision: {
    label: "Decision pending",
    icon: "hourglass_top",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30",
    dot: "bg-indigo-500",
  },
  offer: {
    label: "Offer made",
    icon: "workspace_premium",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  hired: {
    label: "Hired",
    icon: "celebration",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  unsuccessful: {
    label: "Not selected",
    icon: "block",
    badge: "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
};

/**
 * The single key a candidate page filters and colours by: the outcome once
 * there is one, the phase until then.
 */
export const candidateStatusKey = (application) => {
  const status = application?.candidateStatus;
  if (!status) return "received";
  return status.outcome || status.phase || "received";
};

export const candidateStatusDisplay = (application) => {
  const key = candidateStatusKey(application);
  return { key, ...(DISPLAY[key] || DISPLAY.received) };
};

/** Whether the application is still moving — no outcome yet. */
export const isActiveApplication = (application) => !application?.candidateStatus?.outcome;

/** Whether an interview has been scheduled and not yet overtaken by an outcome. */
export const hasUpcomingInterview = (application) =>
  application?.candidateStatus?.phase === "interview" && Boolean(application?.interview?.date);
