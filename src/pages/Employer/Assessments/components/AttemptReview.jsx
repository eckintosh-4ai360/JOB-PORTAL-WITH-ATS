import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Check, CircleSlash, Clock, CalendarCheck, Save, BookOpen, MinusCircle } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import { formatDuration, formatPoints, isChoice, scoreTone, typeOf } from "../../../../utils/assessments";
import { AttemptStatusBadge } from "./AssessmentUI";

/**
 * One candidate's answers, question by question, with the mark beside each.
 *
 * Choice questions arrive already marked against the answer key; the employer
 * can still adjust any mark. Written answers show the marking guide next to
 * the candidate's words and wait for a mark. The running total at the bottom
 * updates as marks are entered, before anything is saved.
 */

const initialsOf = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const ChoiceAnswer = ({ question, value }) => {
  const chosen = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const correct = new Set(question.correct);

  return (
    <ul className="mt-3 space-y-1.5">
      {question.options.map((option) => {
        const picked = chosen.has(option.id);
        const right = correct.has(option.id);
        const tone = picked && right
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
          : picked
            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            : right
              ? "border-dashed border-emerald-300 text-gray-700 dark:border-emerald-500/40 dark:text-gray-200"
              : "border-gray-100 text-gray-600 dark:border-gray-800 dark:text-gray-400";
        return (
          <li key={option.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${tone}`}>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                question.type === "single" ? "rounded-full" : "rounded"
              } ${picked ? "border-current bg-current" : "border-gray-300 dark:border-gray-600"}`}
            >
              {picked && <Check className="h-3 w-3 text-white dark:text-gray-900" />}
            </span>
            <span className="min-w-0 flex-1">{option.text}</span>
            {right && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Correct answer
              </span>
            )}
            {picked && !right && (
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                Their answer
              </span>
            )}
          </li>
        );
      })}
      {chosen.size === 0 && <li className="text-sm italic text-gray-400">No answer given.</li>}
    </ul>
  );
};

const WrittenAnswer = ({ question, value }) => (
  <div className="mt-3 space-y-2">
    {value && String(value).trim() ? (
      <p className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-800 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-200">
        {value}
      </p>
    ) : (
      <p className="rounded-xl border border-dashed border-gray-200 p-3 text-sm italic text-gray-400 dark:border-gray-700">
        No answer given — scored zero.
      </p>
    )}
    {question.guidance && (
      <p className="flex items-start gap-2 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-bold">Marking guide: </span>
          {question.guidance}
        </span>
      </p>
    )}
  </div>
);

const MarkPanel = ({ question, entry, mark, note, onMark, onNote }) => {
  const choice = isChoice(question);
  const value = mark === "" ? null : Number(mark);
  const pending = mark === "";
  const auto = entry?.autoPoints;
  const overridden = choice && value !== null && auto !== null && auto !== undefined && value !== auto;

  return (
    <div className={`rounded-xl border p-3 ${pending ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5" : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Mark</span>
        {pending ? (
          <span className="text-[10px] font-bold uppercase text-amber-600">Needs marking</span>
        ) : choice ? (
          <span className={`text-[10px] font-bold uppercase ${value > 0 ? "text-emerald-600" : "text-rose-500"}`}>
            {overridden ? "Adjusted" : value > 0 ? "Correct" : "Incorrect"}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={question.points}
          step={0.5}
          value={mark}
          onChange={(e) => onMark(e.target.value)}
          aria-label={`Mark out of ${question.points}`}
          className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <span className="text-sm text-gray-400">/ {question.points}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {[
          { label: "0", value: 0 },
          { label: "Half", value: Math.round(question.points) / 2 },
          { label: "Full", value: question.points },
        ].map((quick) => (
          <button
            key={quick.label}
            type="button"
            onClick={() => onMark(String(quick.value))}
            className={`flex-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition ${
              value === quick.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {quick.label}
          </button>
        ))}
      </div>
      {choice && overridden && (
        <button type="button" onClick={() => onMark(String(auto))} className="mt-1.5 text-[11px] font-semibold text-indigo-600 hover:underline">
          Reset to automatic mark ({formatPoints(auto)})
        </button>
      )}
      <textarea
        rows={2}
        value={note}
        maxLength={500}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label="Marking note"
        className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
    </div>
  );
};

const AttemptReview = ({ attemptId, onClose, onSaved }) => {
  const [data, setData] = useState(null);
  const [marks, setMarks] = useState({});
  const [notes, setNotes] = useState({});
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hydrate = (payload) => {
    setData(payload);
    const nextMarks = {};
    const nextNotes = {};
    for (const question of payload.questions) {
      const entry = payload.answers?.[question.id];
      nextMarks[question.id] = entry?.points === null || entry?.points === undefined ? "" : String(entry.points);
      nextNotes[question.id] = entry?.note || "";
    }
    setMarks(nextMarks);
    setNotes(nextNotes);
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.ATTEMPT(attemptId))
      .then((res) => {
        if (!cancelled) hydrate(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Could not load this result.");
        onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, onClose]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = useMemo(() => {
    if (!data) return null;
    let score = 0;
    let pending = 0;
    let max = 0;
    for (const question of data.questions) {
      max += question.points;
      const value = marks[question.id];
      if (value === "" || value === undefined) pending += 1;
      else score += Math.min(question.points, Math.max(0, Number(value) || 0));
    }
    const percent = max ? Math.round((score / max) * 100) : 0;
    return { score, max, pending, percent };
  }, [data, marks]);

  const save = async () => {
    for (const question of data.questions) {
      const value = marks[question.id];
      if (value === "") continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > question.points) {
        toast.error(`Marks for question ${data.questions.indexOf(question) + 1} must be between 0 and ${question.points}.`);
        return;
      }
    }
    setIsSaving(true);
    try {
      const points = Object.fromEntries(Object.entries(marks).map(([id, value]) => [id, value === "" ? null : Number(value)]));
      const res = await axiosInstance.put(API_PATHS.ASSESSMENTS.SCORE(attemptId), { points, notes });
      toast.success(res.data.message);
      hydrate(res.data);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the marks.");
    } finally {
      setIsSaving(false);
    }
  };

  const attempt = data?.attempt;
  const finished = attempt && (attempt.status === "submitted" || attempt.status === "scored");
  const tone = totals ? scoreTone(totals.pending ? null : totals.percent, attempt?.passMark) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assessment result"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-gray-50 shadow-2xl dark:bg-gray-950"
      >
        {!data ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-4 border-b border-gray-100 bg-white px-6 py-5 dark:border-gray-800 dark:bg-gray-900">
              {data.candidate?.avatar ? (
                <img src={data.candidate.avatar} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 font-bold text-white">
                  {initialsOf(attempt.candidateName)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{attempt.candidateName}</h2>
                  <AttemptStatusBadge status={attempt.status} awaiting={attempt.awaitingMarking} />
                </div>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {attempt.assessmentTitle} · {attempt.jobTitle}
                  {attempt.stage ? ` · ${attempt.stage}` : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                  {attempt.submittedAt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Submitted {moment(attempt.submittedAt).format("D MMM YYYY, HH:mm")}
                    </span>
                  )}
                  {attempt.timeTakenSeconds !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Took {formatDuration(attempt.timeTakenSeconds)}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!finished ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <MinusCircle className="mb-3 h-10 w-10 text-gray-300" />
                <p className="font-bold text-gray-800 dark:text-gray-100">
                  {attempt.status === "expired"
                    ? "The deadline passed before this candidate started."
                    : attempt.status === "in_progress"
                      ? "This candidate is taking the assessment now."
                      : "This candidate has not started yet."}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {attempt.status === "invited" ? `Due ${moment(attempt.dueAt).format("D MMM YYYY")}.` : "Answers appear here once they submit."}
                </p>
              </div>
            ) : (
              <>
                {/* Questions with marks alongside */}
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  {data.questions.map((question, index) => {
                    const entry = data.answers?.[question.id];
                    return (
                      <section
                        key={question.id}
                        className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-[1fr_13rem]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                              Q{index + 1}
                            </span>
                            {typeOf(question.type).label} · {question.points} pt{question.points === 1 ? "" : "s"}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">
                            {question.prompt}
                          </p>
                          {isChoice(question) ? (
                            <ChoiceAnswer question={question} value={entry?.value} />
                          ) : (
                            <WrittenAnswer question={question} value={entry?.value} />
                          )}
                        </div>
                        <MarkPanel
                          question={question}
                          entry={entry}
                          mark={marks[question.id] ?? ""}
                          note={notes[question.id] ?? ""}
                          onMark={(value) => {
                            setMarks((current) => ({ ...current, [question.id]: value }));
                            setDirty(true);
                          }}
                          onNote={(value) => {
                            setNotes((current) => ({ ...current, [question.id]: value }));
                            setDirty(true);
                          }}
                        />
                      </section>
                    );
                  })}
                </div>

                {/* Running total */}
                <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Score</p>
                    <p className={`text-2xl font-extrabold ${tone.text}`}>
                      {formatPoints(totals.score)}
                      <span className="text-base font-semibold text-gray-400"> / {totals.max}</span>
                      {!totals.pending && <span className="ml-2 text-lg">{totals.percent}%</span>}
                    </p>
                  </div>
                  <div className="text-sm">
                    {totals.pending ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                        <CircleSlash className="h-4 w-4" />
                        {totals.pending} answer{totals.pending === 1 ? "" : "s"} still to mark
                      </span>
                    ) : totals.percent >= attempt.passMark ? (
                      <span className="font-semibold text-emerald-600">Passes the {attempt.passMark}% mark</span>
                    ) : (
                      <span className="font-semibold text-rose-600">Below the {attempt.passMark}% pass mark</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={save}
                    disabled={isSaving || !dirty}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {dirty ? "Save marks" : "Saved"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttemptReview;
