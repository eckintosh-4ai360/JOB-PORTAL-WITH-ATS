import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import AttachmentPicker from "./AttachmentPicker";
import {
  useSavedAttachments,
  emptyAttachment,
  defaultAttachment,
} from "../../hooks/useSavedAttachments";

/**
 * The whole application, in one drawer: the candidate's profile and CV are
 * checked, the employer's screening questions are asked, and they submit.
 *
 * Built to be fast. The newest CV is already selected, answers the candidate
 * has given before (or their stated salary expectation) are already filled in,
 * and profile gaps are shown as information, never as a gate — someone at 60%
 * can still apply today.
 */

const PREFILL_SOURCE = {
  profile: "From your profile",
  previous: "From a previous application",
};

const inputClass =
  "w-full p-3 rounded-xl bg-surface-container-low border font-body-md text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20";

const todayIso = () => new Date().toISOString().slice(0, 10);

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

const ProfileCheck = ({ readiness, onNavigate }) => {
  const { completeness, checks } = readiness.profile;
  const missing = checks.filter((check) => !check.done);
  const tone =
    completeness >= 80 ? "bg-salary-emerald" : completeness >= 50 ? "bg-amber-500" : "bg-error";

  return (
    <section className="rounded-2xl border border-border-default bg-surface-container-low p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-label-caps uppercase text-text-muted">Profile completeness</p>
        <span className="font-headline-sm font-bold text-on-surface">{completeness}%</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuenow={completeness}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completeness"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${completeness}%` }} />
      </div>

      <p className="mt-3 flex items-center gap-2 font-body-sm text-text-secondary">
        <span
          className={`material-symbols-outlined text-[18px] ${
            readiness.cv.onFile ? "text-salary-emerald" : "text-amber-500"
          }`}
        >
          {readiness.cv.onFile ? "task" : "warning"}
        </span>
        {readiness.cv.onFile
          ? `CV on file${readiness.cv.analysed ? " and analysed" : " — not analysed yet"}`
          : "No CV on file yet — attach one below."}
      </p>

      {missing.length > 0 && (
        <>
          <p className="mt-3 font-body-sm text-text-muted">
            Employers see these gaps. You can still apply now and fill them in later.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((check) => (
              <Link
                key={check.key}
                to={check.fixPath}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 rounded-full bg-surface-card px-2.5 py-1 font-label-md text-primary ring-1 ring-border-default hover:bg-brand-indigo-light"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                {check.label}
                <span className="text-text-muted">+{check.weight}%</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

const QuestionField = ({ question, value, onChange, error, prefillSource }) => {
  const id = `screening-${question.id}`;
  const borderClass = error ? "border-error" : "border-border-default";

  let control;
  if (question.type === "yes_no") {
    control = (
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={`${id}-label`}>
        {[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ].map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border p-3 font-label-md font-semibold transition-colors ${
                active
                  ? "border-primary bg-brand-indigo-light text-primary"
                  : `${borderClass} bg-surface-container-low text-text-secondary hover:bg-surface-container`
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  } else if (question.type === "choice") {
    control = (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${id}-label`}>
        {question.options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option)}
              className={`rounded-xl border px-4 py-2.5 font-label-md font-semibold transition-colors ${
                active
                  ? "border-primary bg-brand-indigo-light text-primary"
                  : `${borderClass} bg-surface-container-low text-text-secondary hover:bg-surface-container`
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  } else if (question.type === "text") {
    control = (
      <textarea
        id={id}
        rows={2}
        maxLength={1000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${borderClass} resize-y`}
      />
    );
  } else if (question.type === "date") {
    control = (
      <input
        id={id}
        type="date"
        min={todayIso()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${borderClass}`}
      />
    );
  } else {
    // number and salary
    control = (
      <div className="relative">
        {question.type === "salary" && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body-md text-text-muted">
            GH₵
          </span>
        )}
        <input
          id={id}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} ${borderClass} ${question.type === "salary" ? "pl-14" : ""}`}
        />
        {question.type === "salary" && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-body-sm text-text-muted">
            per month
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-question={question.id}>
      <label id={`${id}-label`} htmlFor={id} className="font-label-md font-semibold text-on-surface">
        {question.prompt}
        {question.required ? (
          <span className="text-error"> *</span>
        ) : (
          <span className="font-normal text-text-muted"> (optional)</span>
        )}
      </label>
      {control}
      {prefillSource && !error && (
        <p className="flex items-center gap-1 font-body-sm text-text-muted">
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          {PREFILL_SOURCE[prefillSource]} — check it is still right
        </p>
      )}
      {error && <p className="font-body-sm text-error">{error}</p>}
    </div>
  );
};

const ApplyDrawer = ({ job, onClose, onApplied }) => {
  const jobId = job?._id || job?.id;
  const companyName = job?.companyName || job?.company?.companyName || job?.companyProfile?.name || "the employer";

  const [readiness, setReadiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeAttachment, setResumeAttachment] = useState(emptyAttachment);
  const [coverAttachment, setCoverAttachment] = useState(emptyAttachment);
  const [note, setNote] = useState("");
  // Only what the candidate has typed or picked. Prefills show through until
  // they touch a field, so a late-arriving prefill never overwrites an edit.
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bodyRef = useRef(null);

  const { resumeOptions, coverLetterOptions } = useSavedAttachments(true);

  const resumeChoice = resumeAttachment.url || resumeAttachment.file
    ? resumeAttachment
    : defaultAttachment(resumeOptions);
  const coverChoice = coverAttachment.url || coverAttachment.file
    ? coverAttachment
    : defaultAttachment(coverLetterOptions);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;

    axiosInstance
      .get(API_PATHS.APPLICATIONS.GET_READINESS(jobId))
      .then((res) => {
        if (!cancelled) setReadiness(res.data);
      })
      .catch(() => {
        // The checks are guidance. If they fail, fall back to the questions
        // on the job itself so applying still works.
        if (!cancelled) {
          setReadiness({
            alreadyApplied: false,
            profile: null,
            cv: null,
            questions: Array.isArray(job?.screeningQuestions) ? job.screeningQuestions : [],
            prefill: {},
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, job?.screeningQuestions]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const questions = readiness?.questions || [];
  const prefill = readiness?.prefill || {};

  const valueFor = (question) => {
    if (question.id in answers) return answers[question.id];
    const suggested = prefill[question.id]?.answer;
    if (suggested === undefined || suggested === null) return "";
    if (question.type === "yes_no") return suggested ? "yes" : "no";
    return String(suggested);
  };

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) setErrors((prev) => ({ ...prev, [questionId]: undefined }));
  };

  const scrollToQuestion = (questionId) => {
    bodyRef.current
      ?.querySelector(`[data-question="${questionId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!resumeChoice.url && !resumeChoice.file) {
      toast.error("Please attach a resume or pick one you have already uploaded.");
      return;
    }

    const payload = {};
    const missing = {};
    for (const question of questions) {
      const value = valueFor(question);
      if (isBlank(value)) {
        if (question.required) missing[question.id] = "This question needs an answer.";
        continue;
      }
      payload[question.id] = value;
    }

    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      scrollToQuestion(Object.keys(missing)[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      // A saved file travels as its URL; a fresh one as the file itself.
      formData.append("resume", resumeChoice.file || resumeChoice.url);
      if (coverChoice.file || coverChoice.url) {
        formData.append("coverLetterFile", coverChoice.file || coverChoice.url);
      }
      if (note.trim()) formData.append("coverLetter", note.trim());
      if (questions.length > 0) formData.append("screeningAnswers", JSON.stringify(payload));

      await axiosInstance.post(API_PATHS.APPLICATIONS.APPLY_FOR_JOB(jobId), formData);
      toast.success(`Application sent to ${companyName}!`);
      onApplied?.(jobId);
      onClose();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (err.response?.status === 422 && serverErrors) {
        setErrors(serverErrors);
        scrollToQuestion(Object.keys(serverErrors)[0]);
      }
      toast.error(err.response?.data?.message || "Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = questions.filter((question) => !isBlank(valueFor(question))).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-drawer-title"
        className="animate-slide-in-right ml-auto flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-2xl md:w-1/2"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-5 md:px-8 md:py-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-light text-primary">
              <span className="material-symbols-outlined text-[26px]">send</span>
            </div>
            <div className="min-w-0">
              <h3 id="apply-drawer-title" className="truncate font-headline-md font-bold text-on-surface">
                Apply for {job?.title}
              </h3>
              <p className="truncate font-body-md text-text-secondary">{companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close application form"
            className="shrink-0 cursor-pointer rounded-lg p-1 text-text-muted hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-body-md text-text-muted">Checking your profile and CV…</p>
          </div>
        ) : readiness?.alreadyApplied || readiness?.isClosed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-primary">
              {readiness.alreadyApplied ? "task_alt" : "event_busy"}
            </span>
            <p className="font-headline-sm font-bold text-on-surface">
              {readiness.alreadyApplied ? "You have already applied" : "This role is no longer accepting applications"}
            </p>
            {readiness.alreadyApplied && (
              <Link to="/applications" onClick={onClose} className="font-body-md text-primary hover:underline">
                Track your application
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div ref={bodyRef} className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
              {readiness?.profile && <ProfileCheck readiness={readiness} onNavigate={onClose} />}

              <AttachmentPicker
                label="Resume / CV"
                required
                options={resumeOptions}
                value={resumeChoice}
                onChange={setResumeAttachment}
              />

              {questions.length > 0 && (
                <section className="flex flex-col gap-5">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border-default pb-2">
                    <h4 className="font-headline-sm font-bold text-on-surface">Questions from {companyName}</h4>
                    <span className="shrink-0 font-body-sm text-text-muted">
                      {answeredCount} of {questions.length} answered
                    </span>
                  </div>
                  {questions.map((question) => (
                    <QuestionField
                      key={question.id}
                      question={question}
                      value={valueFor(question)}
                      onChange={(value) => setAnswer(question.id, value)}
                      error={errors[question.id]}
                      prefillSource={!(question.id in answers) ? prefill[question.id]?.source : null}
                    />
                  ))}
                </section>
              )}

              {coverLetterOptions.length > 0 && (
                <AttachmentPicker
                  label="Cover letter document (optional)"
                  options={coverLetterOptions}
                  value={coverChoice}
                  onChange={setCoverAttachment}
                />
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="apply-note" className="font-label-caps uppercase text-text-muted">
                  Why are you a strong fit? (Optional)
                </label>
                <textarea
                  id="apply-note"
                  rows="3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="A short note, or a link to your portfolio, GitHub or LinkedIn…"
                  className={`${inputClass} border-border-default min-h-28 resize-y`}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border-default px-6 py-5 sm:flex-row sm:items-center sm:justify-end md:px-8">
              <button
                type="button"
                onClick={onClose}
                className="w-full cursor-pointer rounded-xl px-4 py-3 font-label-md text-text-secondary hover:bg-surface-container sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary-container px-space-lg py-3 font-label-md font-bold text-on-primary shadow-sm hover:bg-brand-indigo-dark disabled:opacity-50 sm:w-auto"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ApplyDrawer;
