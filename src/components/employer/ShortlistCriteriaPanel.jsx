import { SlidersHorizontal, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { DEFAULT_CRITERIA, RECOMMENDATION_OPTIONS, CHECKABLE_TYPES, countCriteria } from "../../utils/shortlistCriteria";

/**
 * The criteria assisted shortlisting checks applicants against. Every one is
 * optional; the checks happen on the server, which says for each applicant
 * which were met, which were not, and which it could not tell.
 */

const inputClass =
  "w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-400 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const Toggle = ({ checked, onChange, label, hint, children }) => (
  <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</span>
        {hint && <span className="block text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
      </span>
    </label>
    {children && <div className="mt-2.5 pl-6.5">{children}</div>}
  </div>
);

const ScreeningRule = ({ question, rule, onChange }) => {
  if (question.type === "yes_no") {
    const value = rule?.equals === true ? "yes" : rule?.equals === false ? "no" : "";
    return (
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value ? { equals: event.target.value === "yes" } : null)
        }
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="">Any answer</option>
        <option value="yes">Must answer Yes</option>
        <option value="no">Must answer No</option>
      </select>
    );
  }

  if (question.type === "number" || question.type === "salary") {
    const update = (key, value) => {
      const next = { min: rule?.min ?? "", max: rule?.max ?? "", [key]: value };
      onChange(next.min === "" && next.max === "" ? null : next);
    };
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {question.type === "salary" && <span>GH₵</span>}
        <input
          type="number"
          min="0"
          value={rule?.min ?? ""}
          onChange={(event) => update("min", event.target.value)}
          placeholder="Min"
          aria-label={`Lowest answer for ${question.prompt}`}
          className={inputClass}
        />
        <span>to</span>
        <input
          type="number"
          min="0"
          value={rule?.max ?? ""}
          onChange={(event) => update("max", event.target.value)}
          placeholder="Max"
          aria-label={`Highest answer for ${question.prompt}`}
          className={inputClass}
        />
      </div>
    );
  }

  // choice
  const chosen = rule?.anyOf || [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {question.options.map((option) => {
        const on = chosen.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = on ? chosen.filter((item) => item !== option) : [...chosen, option];
              onChange(next.length ? { anyOf: next } : null);
            }}
            aria-pressed={on}
            className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
              on
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};

const ShortlistCriteriaPanel = ({ criteria, onChange, questions = [], onRun, running = false }) => {
  const set = (patch) => onChange({ ...criteria, ...patch });
  const checkable = questions.filter((question) => CHECKABLE_TYPES.includes(question.type));
  const active = countCriteria(criteria);

  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
          <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
          Criteria
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {active} on
          </span>
        </h3>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_CRITERIA })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600"
          title="Back to the default criteria"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <Toggle
        checked={criteria.useFit}
        onChange={(useFit) => set({ useFit })}
        label="AI fit at least"
        hint="How well the CV matches this job's requirements"
      >
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={criteria.minFit}
            disabled={!criteria.useFit}
            onChange={(event) => set({ minFit: Number(event.target.value) })}
            className="flex-1 accent-indigo-600"
            aria-label="Minimum AI fit"
          />
          <span className="w-10 text-right text-sm font-bold text-gray-800 dark:text-gray-200">{criteria.minFit}%</span>
        </div>
      </Toggle>

      <Toggle
        checked={criteria.useRecommendation}
        onChange={(useRecommendation) => set({ useRecommendation })}
        label="AI recommends"
        hint="The AI's suggested next step for the applicant"
      >
        <div className="flex flex-wrap gap-1.5">
          {RECOMMENDATION_OPTIONS.map((option) => {
            const on = criteria.recommendations.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!criteria.useRecommendation}
                onClick={() =>
                  set({
                    recommendations: on
                      ? criteria.recommendations.filter((id) => id !== option.id)
                      : [...criteria.recommendations, option.id],
                  })
                }
                aria-pressed={on}
                className={`rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
                  on
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Toggle>

      <Toggle
        checked={criteria.coreSkills}
        onChange={(coreSkills) => set({ coreSkills })}
        label="Has every core skill"
        hint="Every required skill the AI read from your advert"
      />

      <Toggle
        checked={criteria.meetsExperience}
        onChange={(meetsExperience) => set({ meetsExperience })}
        label="Meets the experience asked for"
        hint="Years of experience against what the advert asks"
      />

      <Toggle
        checked={criteria.useAssessment}
        onChange={(useAssessment) => set({ useAssessment })}
        label="Assessment score at least"
        hint="Their best marked assessment for this application"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={criteria.minAssessment}
            disabled={!criteria.useAssessment}
            onChange={(event) => set({ minAssessment: event.target.value })}
            className={inputClass}
            aria-label="Minimum assessment score"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </Toggle>

      {checkable.length > 0 && (
        <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Screening answers</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Only the answers you set here are checked.</p>
          <div className="mt-3 space-y-3">
            {checkable.map((question) => (
              <div key={question.id}>
                <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">{question.prompt}</p>
                <ScreeningRule
                  question={question}
                  rule={criteria.screening[question.id]}
                  onChange={(rule) => {
                    const screening = { ...criteria.screening };
                    if (rule) screening[question.id] = rule;
                    else delete screening[question.id];
                    set({ screening });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
        <label htmlFor="top-n" className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Tick the top
        </label>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            id="top-n"
            type="number"
            min="1"
            max="100"
            value={criteria.topN}
            onChange={(event) => set({ topN: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })}
            className={inputClass}
          />
          suggestions
        </div>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {running ? "Checking applicants…" : "Find matches"}
      </button>
    </div>
  );
};

export default ShortlistCriteriaPanel;
