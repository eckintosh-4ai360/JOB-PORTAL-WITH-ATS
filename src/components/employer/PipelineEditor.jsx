import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Lock, Plus, RotateCcw, Trash2, Workflow, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Edit the stages applications move through.
 *
 * Each stage has an internal name the hiring team uses, and a separate answer
 * to "what does the candidate see?" — one of five plain phases. That split is
 * the point: a team can run Longlist, Panel Review and Reference Check without
 * any of those words reaching a candidate.
 *
 * The server holds the real rules (utils/hiringPipeline.validateStages) and
 * its message is shown as-is when a list breaks one.
 */

const TYPE_OPTIONS = [
  { value: "standard", label: "Just a stage" },
  { value: "interview", label: "Schedules an interview" },
  { value: "offer", label: "Makes an offer" },
  { value: "hired", label: "Marks as hired" },
];

// A stage that does something is only meaningful under one phase.
const PHASE_FOR_TYPE = { interview: "interview", offer: "decision", hired: "decision" };

let rowCounter = 0;
const rowKey = () => {
  rowCounter += 1;
  return `row_${rowCounter}`;
};

const withKeys = (stages) => stages.map((stage) => ({ ...stage, key: stage.id || rowKey() }));

const fieldClass =
  "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const PipelineEditor = ({ stages, phases, defaults, rejectedStage, onClose, onSaved }) => {
  const [rows, setRows] = useState(() => withKeys(stages));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const update = (key, patch) => {
    setError("");
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.type && PHASE_FOR_TYPE[patch.type]) next.phase = PHASE_FOR_TYPE[patch.type];
        return next;
      })
    );
  };

  const move = (index, delta) => {
    setError("");
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row);
      return next;
    });
  };

  const remove = (key) => {
    setError("");
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const add = () => {
    setError("");
    // A new stage goes just before the outcome stages, where most additions belong.
    setRows((current) => {
      const firstOutcome = current.findIndex((row) => row.type === "offer" || row.type === "hired");
      const at = firstOutcome === -1 ? current.length : firstOutcome;
      const phase = current[Math.max(at - 1, 0)]?.phase || "under_review";
      const next = [...current];
      next.splice(at, 0, { key: rowKey(), id: "", name: "", phase, type: "standard" });
      return next;
    });
  };

  const save = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await axiosInstance.put(API_PATHS.APPLICATIONS.UPDATE_PIPELINE, {
        stages: rows.map(({ id, name, phase, type }) => ({ id, name, phase, type })),
      });
      toast.success("Pipeline saved");
      onSaved(res.data.stages);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the pipeline.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-editor-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
              <Workflow className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 id="pipeline-editor-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Hiring pipeline
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Stage names are internal. Candidates only ever see the column on the right.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pipeline editor"
            className="text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="hidden grid-cols-[1.5rem_1fr_11rem_10rem_5.5rem] gap-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:grid">
            <span />
            <span>Stage (internal)</span>
            <span>Does</span>
            <span>Candidate sees</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => {
              const isFirst = index === 0;
              const phaseLocked = Boolean(PHASE_FOR_TYPE[row.type]) || isFirst;
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-1 items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-2 dark:border-gray-800 dark:bg-gray-800/40 sm:grid-cols-[1.5rem_1fr_11rem_10rem_5.5rem]"
                >
                  <span className="hidden text-center text-xs font-bold text-gray-400 sm:block">{index + 1}</span>
                  <input
                    type="text"
                    value={row.name}
                    maxLength={40}
                    onChange={(e) => update(row.key, { name: e.target.value })}
                    placeholder="e.g. Reference check"
                    aria-label={`Stage ${index + 1} name`}
                    className={fieldClass}
                  />
                  <select
                    value={row.type}
                    disabled={isFirst}
                    onChange={(e) => update(row.key, { type: e.target.value })}
                    aria-label={`What stage ${index + 1} does`}
                    className={`${fieldClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.phase}
                    disabled={phaseLocked}
                    onChange={(e) => update(row.key, { phase: e.target.value })}
                    aria-label={`What candidates see at stage ${index + 1}`}
                    title={
                      isFirst
                        ? "New applications land here, so candidates see Application received"
                        : phaseLocked
                          ? "Set by what this stage does"
                          : undefined
                    }
                    className={`${fieldClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {phases.map((phase) => (
                      <option key={phase.key} value={phase.key}>
                        {phase.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index <= 1}
                      aria-label="Move stage up"
                      className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={isFirst || index === rows.length - 1}
                      aria-label="Move stage down"
                      className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-gray-200"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row.key)}
                      disabled={isFirst}
                      aria-label="Remove stage"
                      className="rounded-lg p-1.5 text-gray-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-1 items-center gap-2 rounded-xl border border-dashed border-gray-200 p-2 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500 sm:grid-cols-[1.5rem_1fr_11rem_10rem_5.5rem]">
              <Lock className="hidden h-3.5 w-3.5 justify-self-center sm:block" />
              <span className="px-2.5 font-semibold">{rejectedStage?.name || "Rejected"}</span>
              <span className="px-2.5">Ends the application</span>
              <span className="px-2.5">Decision · Not selected</span>
              <span />
            </div>
          </div>

          <button
            type="button"
            onClick={add}
            disabled={rows.length >= 12}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-bold text-gray-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
          >
            <Plus className="h-3.5 w-3.5" />
            {rows.length >= 12 ? "12 stages at most" : "Add stage"}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            Stages run top to bottom and applications only move forward. What candidates see can stay the same or
            move on, never go back. Candidates are emailed only when what they see changes, or for an interview,
            offer, hire or rejection. A stage that still has applications in it cannot be removed.
          </p>

          {error && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              setError("");
              setRows(withKeys(defaults));
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to default
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-50 dark:shadow-none"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineEditor;
