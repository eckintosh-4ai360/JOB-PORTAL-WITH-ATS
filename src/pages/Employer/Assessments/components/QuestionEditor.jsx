import { ArrowDown, ArrowUp, Copy, Trash2, Plus, X, Check } from "lucide-react";
import { QUESTION_TYPES, draftId, isChoice, typeOf } from "../../../../utils/assessments";

/**
 * One question in the builder. Choice questions carry their answer key
 * (ticked options); written questions carry a marking guide. Both are for the
 * employer only — the candidate sees the prompt and the options.
 */

const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const QuestionEditor = ({ question, index, total, onChange, onMove, onDuplicate, onRemove }) => {
  const choice = isChoice(question);
  const update = (patch) => onChange({ ...question, ...patch });

  const changeType = (type) => {
    const nextIsChoice = type === "single" || type === "multiple";
    let options = question.options;
    let correct = question.correct;
    if (nextIsChoice && options.length === 0) {
      options = [0, 1, 2].map(() => ({ id: draftId("o"), text: "" }));
    }
    if (!nextIsChoice) {
      options = [];
      correct = [];
    }
    // One right answer is all a single-answer question can have.
    if (type === "single" && correct.length > 1) correct = correct.slice(0, 1);
    update({ type, options, correct, points: nextIsChoice === choice ? question.points : nextIsChoice ? 1 : 5 });
  };

  const toggleCorrect = (optionId) => {
    if (question.type === "single") {
      update({ correct: [optionId] });
    } else {
      update({
        correct: question.correct.includes(optionId)
          ? question.correct.filter((id) => id !== optionId)
          : [...question.correct, optionId],
      });
    }
  };

  const setOption = (optionId, text) =>
    update({ options: question.options.map((option) => (option.id === optionId ? { ...option, text } : option)) });

  const removeOption = (optionId) =>
    update({
      options: question.options.filter((option) => option.id !== optionId),
      correct: question.correct.filter((id) => id !== optionId),
    });

  const missingKey = choice && question.correct.length === 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          {index + 1}
        </span>
        <select
          value={question.type}
          onChange={(e) => changeType(e.target.value)}
          aria-label={`Question ${index + 1} type`}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            typeOf(question.type).marked === "auto"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          }`}
        >
          {typeOf(question.type).marked === "auto" ? "Marked automatically" : "You mark it"}
        </span>

        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          Points
          <input
            type="number"
            min={1}
            max={100}
            value={question.points}
            onChange={(e) => update({ points: e.target.value === "" ? "" : Number(e.target.value) })}
            aria-label={`Question ${index + 1} points`}
            className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <div className="flex items-center">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up" className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move question down" className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Duplicate question" className="rounded-lg p-1.5 text-gray-400 hover:text-indigo-600">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} aria-label="Delete question" className="rounded-lg p-1.5 text-gray-400 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <textarea
        rows={2}
        value={question.prompt}
        maxLength={1000}
        onChange={(e) => update({ prompt: e.target.value })}
        placeholder="Write the question as the candidate will read it"
        aria-label={`Question ${index + 1}`}
        className={`${fieldClass} mt-3 resize-y`}
      />

      {choice ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
            {question.type === "single" ? "Tick the correct answer" : "Tick every correct answer"}
          </p>
          {question.options.map((option, optionIndex) => {
            const correct = question.correct.includes(option.id);
            return (
              <div key={option.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCorrect(option.id)}
                  aria-pressed={correct}
                  aria-label={`Mark option ${optionIndex + 1} as correct`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 transition ${
                    question.type === "single" ? "rounded-full" : "rounded-md"
                  } ${
                    correct
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={option.text}
                  maxLength={300}
                  onChange={(e) => setOption(option.id, e.target.value)}
                  placeholder={`Option ${optionIndex + 1}`}
                  aria-label={`Option ${optionIndex + 1}`}
                  className={`${fieldClass} ${correct ? "border-emerald-300 dark:border-emerald-500/40" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  disabled={question.options.length <= 2}
                  aria-label={`Remove option ${optionIndex + 1}`}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-rose-600 disabled:opacity-30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {question.options.length < 8 && (
            <button
              type="button"
              onClick={() => update({ options: [...question.options, { id: draftId("o"), text: "" }] })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </button>
          )}
          {missingKey && <p className="text-xs font-semibold text-amber-600">No correct answer ticked yet.</p>}
        </div>
      ) : (
        <div className="mt-3">
          <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
            Marking guide — what a full-marks answer includes (only you see this)
          </label>
          <textarea
            rows={2}
            value={question.guidance}
            maxLength={1000}
            onChange={(e) => update({ guidance: e.target.value })}
            placeholder="e.g. Names at least three triage categories and explains how priority is decided"
            className={`${fieldClass} mt-1 resize-y`}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionEditor;
