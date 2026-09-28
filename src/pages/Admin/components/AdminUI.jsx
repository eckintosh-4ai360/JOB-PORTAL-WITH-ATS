/**
 * The handful of pieces every platform-control screen needs, kept in one place
 * so Companies, Accounts and Job Postings read as one workspace rather than
 * three separately-built pages.
 */

const STAT_TONES = {
  default: {
    dot: "bg-slate-400",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-400/10 dark:text-slate-200",
    value: "text-gray-900 dark:text-slate-50",
  },
  info: {
    dot: "bg-sky-500",
    icon: "bg-sky-50 text-sky-600 dark:bg-sky-400/15 dark:text-sky-200",
    value: "text-gray-900 dark:text-slate-50",
  },
  success: {
    dot: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200",
    value: "text-gray-900 dark:text-slate-50",
  },
  warn: {
    dot: "bg-amber-500",
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200",
    value: "text-gray-900 dark:text-slate-50",
  },
  danger: {
    dot: "bg-rose-500",
    icon: "bg-rose-50 text-rose-600 dark:bg-rose-400/15 dark:text-rose-200",
    value: "text-gray-900 dark:text-slate-50",
  },
};

export const StatTile = ({ label, value, hint, tone = "default", icon: Icon }) => {
  const style = STAT_TONES[tone] || STAT_TONES.default;

  return (
    <div className="group h-full rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_12px_28px_rgba(40,34,86,0.08)] dark:border-slate-700/80 dark:bg-[#111b2d] dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)] dark:hover:border-primary/50 dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.34)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
            {label}
          </p>
          <p className={`mt-3 text-3xl font-extrabold tracking-tight sm:text-[2rem] ${style.value}`}>{value}</p>
        </div>
        {Icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-gray-400 dark:text-slate-400">{hint}</p>}
    </div>
  );
};

/** Shared title treatment for the platform-control workspace. */
export const AdminPageHeader = ({ icon: Icon, eyebrow = "Platform control", title, description, actions }) => (
  <div className="flex flex-col gap-4 border-b border-border-default pb-5 dark:border-slate-700/80 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      <div className="mt-2 flex items-center gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-light text-primary dark:bg-indigo-400/15 dark:text-indigo-200">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-slate-50 sm:text-3xl">{title}</h1>
      </div>
      {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 dark:text-slate-400">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">{actions}</div>}
  </div>
);

const PILL_STYLES = {
  in_review: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  setup_incomplete: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
};

const PILL_LABELS = {
  pending: "Submitted",
  in_review: "Under review",
  approved: "Verified",
  rejected: "Rejected",
  setup_incomplete: "Unverified",
};

export const StatePill = ({ state, label, tone }) => (
  <span
    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
      PILL_STYLES[tone || state] || PILL_STYLES.neutral
    }`}
  >
    {label || PILL_LABELS[state] || state}
  </span>
);

export const FilterTabs = ({ options, value, onChange }) => (
  <div className="flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        onClick={() => onChange(option.id)}
        className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
          value === option.id
            ? "bg-white text-violet-700 shadow-xs dark:bg-gray-900 dark:text-violet-300"
            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        {option.label}
        {typeof option.count === "number" && (
          <span className="ml-1.5 text-xs font-extrabold opacity-60">{option.count}</span>
        )}
      </button>
    ))}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder }) => (
  <input
    type="search"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:w-64"
  />
);

export const EmptyRow = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
    {Icon && (
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
        <Icon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
      </span>
    )}
    <p className="text-base font-bold text-gray-700 dark:text-gray-200">{title}</p>
    {description && <p className="max-w-sm text-sm text-gray-400 dark:text-gray-500">{description}</p>}
  </div>
);

/** A labelled value in a review panel; renders a dash rather than nothing. */
export const DetailRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col gap-0.5 py-2">
    <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {label}
    </span>
    <span className={`break-words text-sm text-gray-800 dark:text-gray-200 ${mono ? "font-mono" : ""}`}>
      {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
    </span>
  </div>
);

export const Pagination = ({ page, pages, onPage }) => {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        Previous
      </button>
      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        Next
      </button>
    </div>
  );
};
