import { ATTEMPT_STATUS, scoreTone } from "../../../../utils/assessments";

export const AttemptStatusBadge = ({ status, awaiting }) => {
  const config = ATTEMPT_STATUS[status] || ATTEMPT_STATUS.invited;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${config.badge}`}>
      {config.label}
      {status === "submitted" && awaiting > 0 ? ` · ${awaiting}` : ""}
    </span>
  );
};

/** A score as a bar and a number. Partial scores (still being marked) show in grey. */
export const ScoreBar = ({ percent, score, maxScore, passMark, pending }) => {
  if (percent === null || percent === undefined) {
    if (score === null || score === undefined) return <span className="text-xs text-gray-400">—</span>;
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400" title="Some answers still need marking">
        {score}/{maxScore} so far
      </span>
    );
  }
  const tone = scoreTone(percent, passMark);
  return (
    <div className="flex min-w-[110px] items-center gap-2" title={`${score} of ${maxScore} points`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full rounded-full ${pending ? "bg-gray-300" : tone.bar}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`text-sm font-bold ${tone.text}`}>{percent}%</span>
    </div>
  );
};

export const ResultBadge = ({ passed }) => {
  if (passed === null || passed === undefined) return <span className="text-xs text-gray-400">—</span>;
  return passed ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
      Pass
    </span>
  ) : (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
      Below pass mark
    </span>
  );
};

export const StatTile = ({ label, value, hint, tone }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    <p
      className={`mt-1 text-2xl font-extrabold ${
        tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);
