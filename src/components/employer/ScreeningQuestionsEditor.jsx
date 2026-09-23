/**
 * The questions a candidate answers when applying for this job.
 *
 * Presets cover what most employers ask; any of them can be reworded. Every
 * question costs the candidate time, so the list is capped and the editor says
 * so, rather than letting an application turn into a form.
 */

import {
  MAX_SCREENING_QUESTIONS,
  newQuestionKey,
} from "../../utils/screeningQuestions";

const TYPE_OPTIONS = [
  { value: "text", label: "Short answer" },
  { value: "number", label: "Number" },
  { value: "salary", label: "Salary (GH₵)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "choice", label: "Multiple choice" },
  { value: "date", label: "Date" },
];

const PRESETS = [
  { label: "Years of experience", prompt: "How many years of relevant experience do you have?", type: "number" },
  { label: "Right to work", prompt: "Are you legally permitted to work in Ghana?", type: "yes_no" },
  { label: "Expected salary", prompt: "What is your expected monthly salary?", type: "salary" },
  { label: "Start date", prompt: "When can you start?", type: "date" },
  { label: "Notice period", prompt: "What is your notice period?", type: "choice", options: ["Immediately", "2 weeks", "1 month", "More than 1 month"] },
  { label: "Relocation", prompt: "Are you willing to relocate for this role?", type: "yes_no" },
];

const fieldClass =
  "h-11 px-3 rounded-xl bg-surface-card border border-border-default font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20";

const ScreeningQuestionsEditor = ({ questions, onChange }) => {
  const atLimit = questions.length >= MAX_SCREENING_QUESTIONS;
  const usedPrompts = new Set(questions.map((question) => question.prompt.trim().toLowerCase()));

  const update = (key, patch) =>
    onChange(questions.map((question) => (question.key === key ? { ...question, ...patch } : question)));

  const remove = (key) => onChange(questions.filter((question) => question.key !== key));

  const move = (index, delta) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  const add = (preset = {}) => {
    if (atLimit) return;
    onChange([
      ...questions,
      {
        key: newQuestionKey(),
        prompt: preset.prompt || "",
        type: preset.type || "text",
        required: true,
        options: preset.options ? [...preset.options] : [],
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="font-label-lg font-semibold text-text-primary">Screening questions</label>
        <p className="font-body-sm text-text-muted">
          Asked when a candidate applies. Keep it short — every question slows the application down.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const used = usedPrompts.has(preset.prompt.toLowerCase());
          return (
            <button
              key={preset.label}
              type="button"
              disabled={used || atLimit}
              onClick={() => add(preset)}
              className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-primary ring-1 ring-border-default transition-colors hover:bg-brand-indigo-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">{used ? "check" : "add"}</span>
              {preset.label}
            </button>
          );
        })}
      </div>

      {questions.map((question, index) => (
        <div
          key={question.key}
          className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-container-low p-3"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-center font-label-md font-bold text-text-muted">
              {index + 1}
            </span>
            <input
              type="text"
              value={question.prompt}
              maxLength={200}
              onChange={(e) => update(question.key, { prompt: e.target.value })}
              placeholder="e.g. How many years of React experience do you have?"
              aria-label={`Question ${index + 1}`}
              className={`${fieldClass} min-w-0 flex-1`}
            />
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move question up"
                className="rounded-lg p-2 text-text-muted hover:text-on-surface disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === questions.length - 1}
                aria-label="Move question down"
                className="rounded-lg p-2 text-text-muted hover:text-on-surface disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              </button>
              <button
                type="button"
                onClick={() => remove(question.key)}
                aria-label="Remove question"
                className="rounded-lg p-2 text-text-muted hover:text-error"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-7">
            <select
              value={question.type}
              onChange={(e) => {
                const type = e.target.value;
                update(question.key, {
                  type,
                  options: type === "choice" && question.options.length === 0 ? ["", ""] : question.options,
                });
              }}
              aria-label="Answer type"
              className={`${fieldClass} cursor-pointer`}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-2 font-body-sm text-text-secondary">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => update(question.key, { required: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              Required
            </label>

            {question.type === "salary" && (
              <span className="font-body-sm text-text-muted">
                Filled in from the candidate&apos;s profile when they have set one.
              </span>
            )}
          </div>

          {question.type === "choice" && (
            <div className="flex flex-col gap-2 pl-7">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const options = [...question.options];
                      options[optionIndex] = e.target.value;
                      update(question.key, { options });
                    }}
                    placeholder={`Answer ${optionIndex + 1}`}
                    aria-label={`Answer ${optionIndex + 1}`}
                    className={`${fieldClass} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    disabled={question.options.length <= 2}
                    onClick={() =>
                      update(question.key, {
                        options: question.options.filter((_, i) => i !== optionIndex),
                      })
                    }
                    aria-label={`Remove answer ${optionIndex + 1}`}
                    className="rounded-lg p-2 text-text-muted hover:text-error disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
              {question.options.length < 10 && (
                <button
                  type="button"
                  onClick={() => update(question.key, { options: [...question.options, ""] })}
                  className="self-start font-label-md font-semibold text-primary hover:underline"
                >
                  + Add answer
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => add()}
        disabled={atLimit}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-border-default px-4 py-2.5 font-label-md font-semibold text-text-secondary transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {atLimit ? `Limit of ${MAX_SCREENING_QUESTIONS} questions reached` : "Add your own question"}
      </button>
    </div>
  );
};

export default ScreeningQuestionsEditor;
