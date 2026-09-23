import {
  Clock, Search, Star, Calendar, Hourglass, XCircle, Award, CheckCircle2,
} from "lucide-react";

/**
 * How pipeline stages, AI fit scores and applicant avatars look across the
 * employer screens. Stages are the employer's own, so their look comes from
 * what they mean — the candidate phase they map to, and whether they are an
 * outcome — rather than from their names.
 */

const TONES = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    ring: "ring-slate-200 dark:ring-slate-500/30",
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-200 dark:ring-blue-500/30",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-200 dark:ring-violet-500/30",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-600 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-500/30",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-200 dark:ring-indigo-500/30",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-500/30",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-500 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
  },
};

const PHASE_TONE = {
  received: "slate",
  under_review: "blue",
  shortlisted: "violet",
  interview: "amber",
  decision: "indigo",
};

const PHASE_ICON = {
  received: Clock,
  under_review: Search,
  shortlisted: Star,
  interview: Calendar,
  decision: Hourglass,
};

export const stageStyle = (stage) => {
  if (!stage) return { ...TONES.slate, icon: Clock };
  if (stage.type === "rejected") return { ...TONES.red, icon: XCircle };
  if (stage.type === "offer" || stage.type === "hired") return { ...TONES.emerald, icon: stage.type === "hired" ? Award : CheckCircle2 };
  if (stage.type === "interview") return { ...TONES.amber, icon: Calendar };
  return { ...TONES[PHASE_TONE[stage.phase]] || TONES.slate, icon: PHASE_ICON[stage.phase] || Clock };
};

/** Colour band for an AI fit score. Matches the candidate-side bands. */
export const fitTone = (score) => {
  if (score === null || score === undefined)
    return "bg-gray-50 text-gray-500 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30";
  if (score >= 80)
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30";
  if (score >= 65)
    return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30";
  if (score >= 50)
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30";
  return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30";
};

export const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
  "from-purple-400 to-indigo-500",
];

export const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** A stable gradient per applicant, so the same person keeps one colour across lists. */
export const avatarGradient = (key = "") => {
  let hash = 0;
  for (const ch of String(key)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

/** An applicant's assessment summary (API `assessment`) in a few words. */
export const assessmentLabel = (assessment) => {
  if (!assessment) return { text: "—", tone: "muted" };
  if (assessment.bestPercent !== null && assessment.bestPercent !== undefined) {
    return { text: `${assessment.bestPercent}%`, tone: assessment.passed ? "pass" : "fail" };
  }
  if (assessment.pending) return { text: "Pending", tone: "pending" };
  if (assessment.sent) return { text: "No result", tone: "muted" };
  return { text: "—", tone: "muted" };
};

export const ASSESSMENT_TONES = {
  pass: "text-emerald-600 dark:text-emerald-400",
  fail: "text-rose-600 dark:text-rose-400",
  pending: "text-amber-600 dark:text-amber-400",
  muted: "text-gray-400 dark:text-gray-500",
};
