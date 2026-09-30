import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Save the CV's PDF to Applications & Docs, where an application can attach
 * it. Saving again refreshes the same library entry rather than adding
 * another; applications already sent keep the version they were sent with.
 */
const SaveToDocumentsDialog = ({ open, onClose, onSave, saving, resume, hasPrimary }) => {
  const alreadySaved = Boolean(resume?.document);
  const [makePrimary, setMakePrimary] = useState(!hasPrimary || Boolean(resume?.isPrimary));
  const [done, setDone] = useState(false);
  const cancelRef = useRef(null);

  // Re-seed each time the dialog opens, adjusted during render so the first
  // frame is already right.
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setMakePrimary(!hasPrimary || Boolean(resume?.isPrimary));
      setDone(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (event) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (await onSave({ makePrimary })) setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="save-docs-title">
      <button type="button" aria-label="Close" onClick={() => !saving && onClose()} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md rounded-3xl border border-border-default bg-surface-card p-6 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                task_alt
              </span>
            </span>
            <h2 id="save-docs-title" className="font-headline-md font-bold text-text-primary">
              Saved to your documents
            </h2>
            <p className="text-[13px] leading-5 text-text-secondary">
              {resume?.isPrimary
                ? "It is your primary CV, so it is attached by default when you apply."
                : "You can choose it when you apply for a job."}
            </p>
            <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
              <Link
                to="/find-jobs"
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center font-label-md font-bold text-on-primary hover:bg-brand-indigo-dark"
              >
                Find jobs to apply for
              </Link>
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-surface-container px-4 py-2.5 font-label-md font-bold text-on-surface hover:bg-surface-container-high"
              >
                Keep editing
              </button>
            </div>
            <Link to="/applications" className="text-[12px] font-bold text-primary hover:underline">
              Open Applications &amp; Docs
            </Link>
          </div>
        ) : (
          <>
            <h2 id="save-docs-title" className="font-headline-md font-bold text-text-primary">
              {alreadySaved ? "Update the saved copy" : "Save to your documents"}
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-text-secondary">
              {alreadySaved
                ? "The PDF in Applications & Docs will be replaced with this version. Applications you have already sent keep the CV they went with."
                : "A PDF of this CV goes into Applications & Docs, ready to attach when you apply. If you change the CV later, save it again to update that copy."}
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-border-default p-3 hover:bg-surface-container-low">
              <input
                type="checkbox"
                checked={makePrimary}
                disabled={resume?.isPrimary}
                onChange={(event) => setMakePrimary(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-[13px] font-semibold text-text-primary">
                  {resume?.isPrimary ? "This is your primary CV" : "Make this my primary CV"}
                </span>
                <span className="block text-[11px] leading-4 text-text-muted">
                  Your primary CV is attached by default when you apply, and is the one the Resume Analyzer reads.
                </span>
              </span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl px-4 py-2.5 font-label-md font-bold text-text-secondary hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-label-md font-bold text-on-primary hover:bg-brand-indigo-dark disabled:opacity-60"
              >
                {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />}
                {saving ? "Saving…" : alreadySaved ? "Update saved copy" : "Save PDF"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SaveToDocumentsDialog;
