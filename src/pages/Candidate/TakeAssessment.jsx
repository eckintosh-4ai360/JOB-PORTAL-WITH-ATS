import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";
import Navbar from "../../components/layout/Navbar";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Taking an assessment.
 *
 * One question at a time, in a quiet layout: the question, its answer options,
 * and a navigator showing what has been answered or flagged. Answers save as
 * they are given, so a closed tab or a dropped connection loses nothing. A
 * timed assessment runs on the server's clock — it keeps running if the page
 * is closed, and submits what was saved when time runs out.
 */

const TYPE_HINT = {
  single: "Choose one answer",
  multiple: "Choose all that apply",
  short: "Write a short answer",
  long: "Write your answer",
};

const TEXT_LIMIT = { short: 1000, long: 6000 };
const LETTERS = "ABCDEFGH";

const isAnswered = (question, value) => {
  if (question.type === "multiple") return Array.isArray(value) && value.length > 0;
  if (question.type === "single") return Boolean(value);
  return typeof value === "string" && value.trim().length > 0;
};

const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const Shell = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
    <Navbar />
    <main className="mx-auto w-full max-w-[760px] flex-1 px-margin-mobile pb-space-xl pt-space-lg md:px-margin">{children}</main>
  </div>
);

const Intro = ({ view, onStart, isStarting }) => (
  <Shell>
    <div className="rounded-3xl border border-border-default bg-surface-card p-space-lg shadow-sm">
      <p className="font-label-caps uppercase text-text-muted">
        {view.companyName} · {view.jobTitle}
      </p>
      <h1 className="mt-1 font-headline-lg font-bold text-text-primary">{view.title}</h1>

      <div className="mt-space-md grid grid-cols-1 gap-space-sm sm:grid-cols-3">
        {[
          { icon: "format_list_numbered", label: "Questions", value: view.questionCount },
          { icon: "timer", label: "Time allowed", value: view.timeLimitMinutes ? `${view.timeLimitMinutes} minutes` : "No limit" },
          { icon: "event", label: "Complete by", value: moment(view.dueAt).format("ddd D MMM, HH:mm") },
        ].map((fact) => (
          <div key={fact.label} className="rounded-2xl bg-surface-container-low p-space-sm">
            <span className="material-symbols-outlined text-[20px] text-primary">{fact.icon}</span>
            <p className="mt-1 font-body-sm text-text-muted">{fact.label}</p>
            <p className="font-label-lg font-bold text-text-primary">{fact.value}</p>
          </div>
        ))}
      </div>

      {view.instructions && (
        <div className="mt-space-md">
          <h2 className="font-label-caps uppercase text-text-muted">Instructions</h2>
          <p className="mt-1 whitespace-pre-wrap font-body-md leading-relaxed text-text-secondary">{view.instructions}</p>
        </div>
      )}

      <ul className="mt-space-md space-y-2 font-body-sm text-text-secondary">
        {[
          view.timeLimitMinutes
            ? `The ${view.timeLimitMinutes}-minute timer starts when you press Start and keeps running if you leave the page. When it ends, your saved answers are submitted.`
            : "There is no time limit — you can leave and come back before the deadline.",
          "Your answers save automatically as you go.",
          "You can move between questions, flag any to come back to, and review everything before you submit.",
          "Once submitted, answers cannot be changed.",
        ].map((rule) => (
          <li key={rule} className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-px text-[18px] text-primary">check_circle</span>
            {rule}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onStart}
        disabled={isStarting}
        className="mt-space-lg inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-space-lg py-3.5 font-label-lg font-bold text-on-primary shadow-sm transition-colors hover:bg-brand-indigo-dark disabled:opacity-60 sm:w-auto"
      >
        <span className="material-symbols-outlined text-[20px]">play_arrow</span>
        {isStarting ? "Starting…" : view.timeLimitMinutes ? `Start — ${view.timeLimitMinutes}-minute timer begins` : "Start assessment"}
      </button>
    </div>
  </Shell>
);

const Closed = ({ view }) => {
  const submitted = view.status === "submitted" || view.status === "scored";
  return (
    <Shell>
      <div className="flex flex-col items-center rounded-3xl border border-border-default bg-surface-card px-space-lg py-16 text-center shadow-sm">
        <span className={`material-symbols-outlined text-[48px] ${submitted ? "text-salary-emerald" : "text-text-muted"}`}>
          {submitted ? "task_alt" : "event_busy"}
        </span>
        <h1 className="mt-2 font-headline-md font-bold text-text-primary">
          {submitted ? "Assessment submitted" : "The deadline has passed"}
        </h1>
        <p className="mt-1 max-w-md font-body-md text-text-secondary">
          {submitted
            ? `Thank you. ${view.companyName || "The employer"} has your answers for ${view.title}${
                view.submittedAt ? `, submitted ${moment(view.submittedAt).format("D MMM YYYY [at] HH:mm")}` : ""
              }. They will be in touch about next steps.`
            : `${view.title} was due ${moment(view.dueAt).format("D MMM YYYY")}. Contact the employer if you need more time.`}
        </p>
        <Link
          to="/my-assessments"
          className="mt-space-md rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-on-surface hover:bg-surface-container-high"
        >
          Back to my assessments
        </Link>
      </div>
    </Shell>
  );
};

const TakeAssessment = () => {
  const { attemptId } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState(() => new Set());
  const [reviewing, setReviewing] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Changes not yet sent, and the debounce that sends them.
  const pending = useRef({});
  const saveTimer = useRef(null);
  const submittedRef = useRef(false);
  // The latest flush, for its own retry timer to call.
  const flushRef = useRef(null);

  const receive = useCallback((next) => {
    setView(next);
    setAnswers(next.answers || {});
    // Timers run on the server's clock, whatever the candidate's clock says.
    setClockOffset(new Date(next.serverNow).getTime() - Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.TAKE(attemptId))
      .then((res) => {
        if (!cancelled) receive(res.data.assessment);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "This assessment could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, receive]);

  const inProgress = view?.status === "in_progress";

  // Tick the clock once a second while the test is running.
  useEffect(() => {
    if (!inProgress) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [inProgress]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const changes = pending.current;
    if (Object.keys(changes).length === 0) return true;
    pending.current = {};
    setSaveState("saving");
    try {
      await axiosInstance.put(API_PATHS.ASSESSMENTS.SAVE_ANSWERS(attemptId), { answers: changes });
      setSaveState(Object.keys(pending.current).length ? "pending" : "saved");
      return true;
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.assessment) {
        submittedRef.current = true;
        toast(err.response.data.message);
        receive(err.response.data.assessment);
        return false;
      }
      // Put the changes back so the next attempt sends them.
      pending.current = { ...changes, ...pending.current };
      setSaveState("error");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushRef.current?.(), 5000);
      return false;
    }
  }, [attemptId, receive]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const answer = (questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    pending.current = { ...pending.current, [questionId]: value };
    setSaveState("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(), 1200);
  };

  // Warn before leaving with an answer still unsaved.
  useEffect(() => {
    if (!inProgress) return undefined;
    const warn = (event) => {
      if (Object.keys(pending.current).length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const submit = useCallback(
    async ({ auto = false } = {}) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setIsSubmitting(true);
      clearTimeout(saveTimer.current);
      pending.current = {};
      try {
        const res = await axiosInstance.post(API_PATHS.ASSESSMENTS.SUBMIT(attemptId), { answers });
        if (auto) toast("Time is up — your answers have been submitted.");
        receive(res.data.assessment);
      } catch (err) {
        submittedRef.current = false;
        toast.error(err.response?.data?.message || "Could not submit. Check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [attemptId, answers, receive]
  );

  const start = async () => {
    setIsStarting(true);
    try {
      const res = await axiosInstance.post(API_PATHS.ASSESSMENTS.START(attemptId));
      receive(res.data.assessment);
      setIndex(0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start the assessment.");
      if (err.response?.data?.assessment) receive(err.response.data.assessment);
    } finally {
      setIsStarting(false);
    }
  };

  const remaining = view?.deadline ? new Date(view.deadline).getTime() - (now + clockOffset) : null;
  const timed = inProgress && view?.timeLimitMinutes && remaining !== null;

  // Submit when the clock runs out.
  useEffect(() => {
    if (timed && remaining <= 0 && !submittedRef.current) {
      const timer = setTimeout(() => submit({ auto: true }), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [timed, remaining, submit]);

  const questions = useMemo(() => view?.questions || [], [view]);
  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  if (error) {
    return (
      <Shell>
        <div className="rounded-3xl border border-border-default bg-surface-card px-space-lg py-16 text-center">
          <p className="font-headline-sm font-bold text-text-primary">{error}</p>
          <Link to="/my-assessments" className="mt-3 inline-block font-label-md font-bold text-primary hover:underline">
            Back to my assessments
          </Link>
        </div>
      </Shell>
    );
  }

  if (!view) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Shell>
    );
  }

  if (view.status === "invited") return <Intro view={view} onStart={start} isStarting={isStarting} />;
  if (!inProgress) return <Closed view={view} />;

  const question = questions[Math.min(index, questions.length - 1)];
  const value = answers[question?.id];
  const last = index >= questions.length - 1;
  const lowTime = timed && remaining < 60 * 1000;
  const shortTime = timed && remaining < 5 * 60 * 1000;

  const goTo = (next) => {
    flush();
    setReviewing(false);
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
  };

  const toggleFlag = (id) =>
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const unanswered = questions.length - answeredCount;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border-default bg-surface-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-margin-mobile py-3 md:px-margin">
          <div className="min-w-0 flex-1">
            <p className="truncate font-label-lg font-bold text-text-primary">{view.title}</p>
            <p className="truncate font-body-sm text-text-muted">
              {view.companyName} · {view.jobTitle}
            </p>
          </div>
          <span
            className={`hidden items-center gap-1 font-body-sm sm:inline-flex ${
              saveState === "error" ? "text-error" : "text-text-muted"
            }`}
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-[16px]">
              {saveState === "saved" ? "cloud_done" : saveState === "error" ? "cloud_off" : "cloud_sync"}
            </span>
            {saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved — retrying" : "Saving…"}
          </span>
          {timed && (
            <span
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-numeric-metric font-bold tabular-nums ${
                lowTime
                  ? "animate-pulse bg-error-container text-on-error-container"
                  : shortTime
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                    : "bg-surface-container text-on-surface"
              }`}
              role="timer"
              aria-label={`Time remaining ${formatClock(remaining)}`}
            >
              <span className="material-symbols-outlined text-[18px]">timer</span>
              {formatClock(remaining)}
            </span>
          )}
        </div>
        <div className="h-1 w-full bg-surface-container">
          <div className="h-full bg-primary transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1100px] flex-1 gap-space-md px-margin-mobile py-space-lg md:px-margin lg:grid-cols-[1fr_15rem]">
        {reviewing ? (
          <section className="rounded-3xl border border-border-default bg-surface-card p-space-lg shadow-sm">
            <h1 className="font-headline-md font-bold text-text-primary">Review your answers</h1>
            <p className="mt-1 font-body-md text-text-secondary">
              {unanswered === 0
                ? "Every question has an answer."
                : `${unanswered} question${unanswered === 1 ? " has" : "s have"} no answer yet.`}{" "}
              Select any question to change it.
            </p>
            <ol className="mt-space-md divide-y divide-border-default">
              {questions.map((q, i) => {
                const done = isAnswered(q, answers[q.id]);
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => goTo(i)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-label-md font-bold ${done ? "bg-primary text-on-primary" : "bg-surface-container text-text-muted"}`}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-body-md text-text-primary">{q.prompt}</span>
                      {flagged.has(q.id) && <span className="material-symbols-outlined text-[18px] text-amber-500">flag</span>}
                      <span className={`shrink-0 font-body-sm ${done ? "text-salary-emerald" : "text-error"}`}>{done ? "Answered" : "No answer"}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-space-md flex flex-col-reverse gap-3 border-t border-border-default pt-space-md sm:flex-row sm:justify-between">
              <button type="button" onClick={() => goTo(questions.length - 1)} className="rounded-xl px-4 py-3 font-label-md font-semibold text-text-secondary hover:bg-surface-container">
                Back to questions
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) return;
                  submit();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-space-lg py-3 font-label-lg font-bold text-on-primary shadow-sm hover:bg-brand-indigo-dark disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
                {isSubmitting ? "Submitting…" : "Submit assessment"}
              </button>
            </div>
          </section>
        ) : (
          <section className="flex flex-col rounded-3xl border border-border-default bg-surface-card p-space-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-label-md font-bold text-primary">
                Question {index + 1} of {questions.length}
              </p>
              <p className="font-body-sm text-text-muted">
                {question.points} point{question.points === 1 ? "" : "s"} · {TYPE_HINT[question.type]}
              </p>
            </div>

            <h1 className="mt-space-sm whitespace-pre-wrap font-headline-sm font-bold leading-relaxed text-text-primary">{question.prompt}</h1>

            <div className="mt-space-md flex-1">
              {question.type === "single" || question.type === "multiple" ? (
                <div className="space-y-2" role={question.type === "single" ? "radiogroup" : "group"} aria-label="Answer options">
                  {question.options.map((option, optionIndex) => {
                    const chosen = question.type === "single" ? value === option.id : Array.isArray(value) && value.includes(option.id);
                    const pick = () => {
                      if (question.type === "single") answer(question.id, option.id);
                      else {
                        const current = Array.isArray(value) ? value : [];
                        answer(question.id, chosen ? current.filter((id) => id !== option.id) : [...current, option.id]);
                      }
                    };
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role={question.type === "single" ? "radio" : "checkbox"}
                        aria-checked={chosen}
                        onClick={pick}
                        className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${
                          chosen ? "border-primary bg-brand-indigo-light" : "border-border-default bg-surface-container-low hover:border-primary/40"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center font-label-md font-bold ${
                            question.type === "single" ? "rounded-full" : "rounded-lg"
                          } ${chosen ? "bg-primary text-on-primary" : "bg-surface-card text-text-secondary ring-1 ring-border-default"}`}
                        >
                          {chosen && question.type === "multiple" ? (
                            <span className="material-symbols-outlined text-[18px]">check</span>
                          ) : (
                            LETTERS[optionIndex]
                          )}
                        </span>
                        <span className="font-body-md text-on-surface">{option.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <textarea
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => answer(question.id, e.target.value)}
                    maxLength={TEXT_LIMIT[question.type]}
                    rows={question.type === "long" ? 10 : 4}
                    placeholder="Type your answer here"
                    aria-label="Your answer"
                    className="w-full resize-y rounded-2xl border border-border-default bg-surface-container-low p-4 font-body-md leading-relaxed text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="mt-1 text-right font-body-sm text-text-muted">
                    {(typeof value === "string" ? value.length : 0).toLocaleString()} / {TEXT_LIMIT[question.type].toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-space-md flex flex-wrap items-center gap-2 border-t border-border-default pt-space-md">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2.5 font-label-md font-semibold text-text-secondary hover:bg-surface-container disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                Previous
              </button>
              <button
                type="button"
                onClick={() => toggleFlag(question.id)}
                aria-pressed={flagged.has(question.id)}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-2.5 font-label-md font-semibold ${
                  flagged.has(question.id) ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "text-text-muted hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">flag</span>
                {flagged.has(question.id) ? "Flagged" : "Flag for review"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (last) {
                    flush();
                    setReviewing(true);
                  } else goTo(index + 1);
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary hover:bg-brand-indigo-dark"
              >
                {last ? "Review answers" : "Next"}
                <span className="material-symbols-outlined text-[18px]">{last ? "checklist" : "chevron_right"}</span>
              </button>
            </div>
          </section>
        )}

        {/* Navigator */}
        <aside className="order-first rounded-3xl border border-border-default bg-surface-card p-space-md shadow-sm lg:order-none lg:self-start">
          <p className="font-label-caps uppercase text-text-muted">Questions</p>
          <p className="mt-0.5 font-body-sm text-text-secondary">
            {answeredCount} of {questions.length} answered
          </p>
          <div className="mt-space-sm grid grid-cols-8 gap-1.5 lg:grid-cols-5">
            {questions.map((q, i) => {
              const done = isAnswered(q, answers[q.id]);
              const current = !reviewing && i === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flagged.has(q.id) ? ", flagged" : ""}`}
                  aria-current={current ? "step" : undefined}
                  className={`relative flex h-9 items-center justify-center rounded-lg font-label-md font-bold transition-colors ${
                    done ? "bg-primary text-on-primary" : "bg-surface-container text-text-secondary hover:bg-surface-container-high"
                  } ${current ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-card" : ""}`}
                >
                  {i + 1}
                  {flagged.has(q.id) && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-surface-card" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              flush();
              setReviewing(true);
            }}
            className="mt-space-sm w-full rounded-xl bg-surface-container px-3 py-2 font-label-md font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Review &amp; submit
          </button>
        </aside>
      </main>
    </div>
  );
};

export default TakeAssessment;
