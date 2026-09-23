import { useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * AI help writing the advert, inside the posting form.
 *
 * The employer stays the author: a suggestion is shown next to their draft and
 * applied one section at a time, and each applied section can be undone. The
 * checks on their own wording (age limits, gendered language, a missing salary)
 * appear whether or not AI is available.
 */

const SEVERITY_STYLE = {
  high: "bg-error-container text-on-error-container",
  medium: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  low: "bg-surface-container text-text-secondary",
};

const bullets = (items, prefix = "") => items.map((item) => `• ${prefix}${item}`).join("\n");

const lowerFirst = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

/** Overview paragraph, then one line per responsibility. JobDetails splits them back apart. */
const draftDescription = (draft) =>
  [draft.summary, bullets(draft.responsibilities)].filter(Boolean).join("\n\n");

const draftRequirements = (draft) =>
  [
    bullets(draft.requirements),
    bullets(draft.niceToHave.map(lowerFirst), "Nice to have: "),
  ]
    .filter(Boolean)
    .join("\n");

const Section = ({ title, children, action }) => (
  <div className="rounded-xl border border-border-default bg-surface-card p-3">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <p className="font-label-caps uppercase text-text-muted">{title}</p>
      {action}
    </div>
    {children}
  </div>
);

const JobDescriptionAssistant = ({ context, onApply }) => {
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  // What each section held before a suggestion replaced it, for undo.
  const [previous, setPrevious] = useState({});

  const hasDraft = `${context.description || ""}${context.requirements || ""}`.trim().length >= 80;

  const run = async () => {
    if (!context.title?.trim()) {
      toast.error("Add a job title in step 1 first — the assistant writes for a specific role.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await axiosInstance.post(API_PATHS.AI.JOB_DESCRIPTION_ASSIST, { ...context, notes });
      setResult(res.data);
      setPrevious({});
      if (!res.data.aiEnabled) toast("AI drafting is not set up on this server — showing the wording checks only.");
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error("You've used the assistant a lot this hour. Try again shortly.");
      } else {
        toast.error(err.response?.data?.message || "The assistant could not write a draft just now.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const apply = (section, value) => {
    setPrevious((current) => ({ ...current, [section]: context[section] }));
    onApply({ [section]: value });
  };

  const undo = (section) => {
    onApply({ [section]: previous[section] ?? "" });
    setPrevious((current) => {
      const next = { ...current };
      delete next[section];
      return next;
    });
  };

  const draft = result?.draft;
  const newSkills = draft
    ? draft.skills.filter((skill) => !(context.tags || []).some((tag) => tag.toLowerCase() === skill.toLowerCase()))
    : [];

  const sectionAction = (section, value) =>
    section in previous ? (
      <button
        type="button"
        onClick={() => undo(section)}
        className="inline-flex items-center gap-1 font-label-md font-semibold text-text-secondary hover:text-on-surface"
      >
        <span className="material-symbols-outlined text-[16px]">undo</span>
        Undo
      </button>
    ) : (
      <button
        type="button"
        onClick={() => apply(section, value)}
        className="inline-flex items-center gap-1 font-label-md font-bold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-[16px]">check</span>
        Use this
      </button>
    );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-brand-indigo-light/40 p-space-md">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[22px] text-primary">auto_awesome</span>
        <div className="min-w-0 flex-1">
          <h4 className="font-label-lg font-bold text-on-surface">Job description assistant</h4>
          <p className="font-body-sm text-text-secondary">
            {hasDraft
              ? "Tightens your draft, flags wording that puts candidates off, and suggests skills. Nothing changes until you choose it."
              : "Writes a first draft from your job details. It only uses what you tell it — add anything important below."}
          </p>
        </div>
      </div>

      <textarea
        rows={2}
        maxLength={1500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional: anything the advert should say — who the role reports to, shift pattern, tools used, what success looks like…"
        className="w-full resize-y rounded-xl border border-border-default bg-surface-card p-3 font-body-md text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <button
        type="button"
        onClick={run}
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-primary px-4 py-2.5 font-label-md font-bold text-on-primary shadow-sm transition-colors hover:bg-brand-indigo-dark disabled:opacity-60"
      >
        <span className={`material-symbols-outlined text-[18px] ${isLoading ? "animate-spin" : ""}`}>
          {isLoading ? "progress_activity" : "edit_note"}
        </span>
        {isLoading ? "Writing…" : result ? "Try again" : hasDraft ? "Improve my draft" : "Draft with AI"}
      </button>

      {result?.issues?.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-label-caps uppercase text-text-muted">
            {hasDraft ? "In your current draft" : "Before you publish"}
          </p>
          {result.issues.map((issue, index) => (
            <p
              key={index}
              className={`flex items-start gap-2 rounded-xl px-3 py-2 font-body-sm ${SEVERITY_STYLE[issue.severity]}`}
            >
              <span className="material-symbols-outlined mt-px text-[16px]">
                {issue.severity === "high" ? "error" : issue.severity === "medium" ? "warning" : "info"}
              </span>
              <span>{issue.message}</span>
            </p>
          ))}
        </div>
      )}

      {draft && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-label-caps uppercase text-text-muted">Suggested advert</p>
            <button
              type="button"
              onClick={() => {
                apply("description", draftDescription(draft));
                apply("requirements", draftRequirements(draft));
                if (newSkills.length) onApply({ addTags: newSkills });
                toast.success("Suggestion applied — review it before publishing.");
              }}
              className="font-label-md font-bold text-primary hover:underline"
            >
              Use all
            </button>
          </div>

          <Section title="Overview & responsibilities" action={sectionAction("description", draftDescription(draft))}>
            {draft.summary && <p className="font-body-sm text-on-surface">{draft.summary}</p>}
            {draft.responsibilities.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 font-body-sm text-text-secondary">
                {draft.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Requirements" action={sectionAction("requirements", draftRequirements(draft))}>
            <ul className="list-disc space-y-0.5 pl-5 font-body-sm text-text-secondary">
              {draft.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {draft.niceToHave.length > 0 && (
              <>
                <p className="mt-2 font-label-md font-semibold text-text-muted">Nice to have</p>
                <ul className="list-disc space-y-0.5 pl-5 font-body-sm text-text-secondary">
                  {draft.niceToHave.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {draft.skills.length > 0 && (
            <Section
              title="Suggested skills"
              action={
                newSkills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onApply({ addTags: newSkills })}
                    className="inline-flex items-center gap-1 font-label-md font-bold text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add {newSkills.length}
                  </button>
                )
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {draft.skills.map((skill) => (
                  <span
                    key={skill}
                    className={`rounded-lg px-2.5 py-0.5 font-label-md ${
                      newSkills.includes(skill) ? "bg-surface-container text-on-surface" : "bg-salary-surface text-salary-emerald"
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <p className="font-body-sm text-text-muted">
            AI can get details wrong. Check every line — it will be published under your company&apos;s name.
          </p>
        </div>
      )}
    </section>
  );
};

export default JobDescriptionAssistant;
