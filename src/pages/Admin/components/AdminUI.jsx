/**
 * The handful of pieces every platform-control screen needs, kept in one place
 * so Companies, Accounts and Job Postings read as one workspace rather than
 * three separately-built pages.
 */

export const StatTile = ({ label, value, hint, tone = "default" }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
    <p
      className={`mt-1 text-2xl font-extrabold ${
        tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : tone === "warn"
            ? "text-amber-600 dark:text-amber-400"
            : "text-gray-900 dark:text-gray-100"
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

const PILL_STYLES = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  setup_incomplete: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
};

const PILL_LABELS = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  setup_incomplete: "Setup unfinished",
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
