/**
 * Shared vocabulary for assessments — question types, attempt statuses and
 * score colours — so the builder, the results pages and the candidate's test
 * page describe things the same way.
 */

export const QUESTION_TYPES = [
  { value: "single", label: "Multiple choice — one answer", hint: "Choose one answer", marked: "auto" },
  { value: "multiple", label: "Multiple choice — several answers", hint: "Choose all that apply", marked: "auto" },
  { value: "short", label: "Short answer", hint: "A sentence or two", marked: "manual" },
  { value: "long", label: "Written answer", hint: "A fuller written answer", marked: "manual" },
];

export const typeOf = (value) => QUESTION_TYPES.find((type) => type.value === value) || QUESTION_TYPES[0];

export const isChoice = (question) => question.type === "single" || question.type === "multiple";

export const ATTEMPT_STATUS = {
  invited: {
    label: "Invited",
    badge: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  },
  in_progress: {
    label: "In progress",
    badge: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  },
  submitted: {
    label: "To mark",
    badge: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  },
  scored: {
    label: "Scored",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  },
  expired: {
    label: "Expired",
    badge: "bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  },
};

export const ASSESSMENT_STATUS = {
  draft: { label: "Draft", badge: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300" },
  active: { label: "Active", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  archived: { label: "Archived", badge: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

/** Bar and text colour for a percentage, relative to the pass mark. */
export const scoreTone = (percent, passMark = 60) => {
  if (percent === null || percent === undefined) return { bar: "bg-gray-300", text: "text-gray-400" };
  if (percent >= passMark) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (percent >= passMark - 15) return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${seconds}s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** Points written without trailing zeros: 2, 2.5. */
export const formatPoints = (value) =>
  value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);

let draftCounter = 0;
export const draftId = (prefix = "q") => {
  draftCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${draftCounter}`;
};

export const newQuestion = (type = "single") => ({
  id: draftId(),
  type,
  prompt: "",
  points: type === "long" ? 10 : type === "short" ? 5 : 1,
  guidance: "",
  options: isChoice({ type })
    ? [
        { id: draftId("o"), text: "" },
        { id: draftId("o"), text: "" },
        { id: draftId("o"), text: "" },
      ]
    : [],
  correct: [],
});
