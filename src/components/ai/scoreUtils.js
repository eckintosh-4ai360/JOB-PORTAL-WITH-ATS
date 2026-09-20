/**
 * Shared scoring presentation helpers.
 *
 * One source of truth for how a score maps to a colour and a label, so a 72%
 * reads the same on a job card, a match ring, and an applicant row.
 */

/** Semantic bands. Kept coarse on purpose — a 3-point difference is noise. */
export const scoreBand = (score) => {
  if (score === null || score === undefined) return "unknown";
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "partial";
  return "weak";
};

/**
 * Tailwind tokens per band. Emerald for good news, amber for "needs work",
 * rose for weak — never colour alone, always paired with a number or label.
 */
export const SCORE_STYLES = {
  excellent: {
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/25",
    ring: "#059669",
    track: "#D1FAE5",
    bar: "from-emerald-400 to-emerald-600",
    label: "Excellent match",
  },
  strong: {
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/25",
    ring: "#10B981",
    track: "#D1FAE5",
    bar: "from-emerald-300 to-emerald-500",
    label: "Strong match",
  },
  good: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    border: "border-sky-200 dark:border-sky-500/25",
    ring: "#0284C7",
    track: "#DBEAFE",
    bar: "from-sky-300 to-sky-500",
    label: "Good match",
  },
  partial: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/25",
    ring: "#D97706",
    track: "#FEF3C7",
    bar: "from-amber-300 to-amber-500",
    label: "Partial match",
  },
  weak: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/25",
    ring: "#E11D48",
    track: "#FFE4E6",
    bar: "from-rose-300 to-rose-500",
    label: "Weak match",
  },
  unknown: {
    text: "text-text-muted",
    bg: "bg-surface-container",
    border: "border-border-default",
    ring: "#94A3B8",
    track: "#E2E8F0",
    bar: "from-slate-300 to-slate-400",
    label: "Not scored",
  },
};

export const scoreStyle = (score) => SCORE_STYLES[scoreBand(score)];

/** Human labels for the six match dimensions. */
export const DIMENSION_LABELS = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
  location: "Location",
  salary: "Salary expectations",
};

export const DIMENSION_ICONS = {
  skills: "psychology",
  experience: "work_history",
  education: "school",
  certifications: "verified",
  location: "location_on",
  salary: "payments",
};

/** Order dimensions by weight so the ones that move the score come first. */
export const orderedDimensions = (dimensions = {}) =>
  Object.entries(dimensions)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));

export const ATS_STATUS_STYLES = {
  pass: { icon: "check_circle", text: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", label: "Pass" },
  warn: { icon: "error", text: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", label: "Needs work" },
  fail: { icon: "cancel", text: "text-rose-600 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", label: "Failed" },
};

export const PRIORITY_STYLES = {
  high: { text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/25", label: "High impact" },
  medium: { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/25", label: "Medium" },
  low: { text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", border: "border-sky-200 dark:border-sky-500/25", label: "Nice to have" },
};

export const IMPORTANCE_STYLES = {
  critical: { text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/25" },
  high: { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/25" },
  medium: { text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", border: "border-sky-200 dark:border-sky-500/25" },
};

export const RECOMMENDATION_STYLES = {
  shortlist: { label: "Shortlist", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/25", icon: "star" },
  interview: { label: "Interview", text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10", border: "border-sky-200 dark:border-sky-500/25", icon: "event_available" },
  hold: { label: "Hold", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/25", icon: "pause_circle" },
  reject: { label: "Not a fit", text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/25", icon: "do_not_disturb_on" },
};

/** Format a monthly cedi salary range compactly. */
export const formatSalary = (min, max) => {
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);
  if (min && max) return `GH₵ ${k(min)} – ${k(max)}`;
  if (min) return `From GH₵ ${k(min)}`;
  if (max) return `Up to GH₵ ${k(max)}`;
  return "Not disclosed";
};
