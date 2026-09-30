import { useEffect, useRef } from "react";
import ScoreRing from "../../../components/ai/ScoreRing";
import AtsChecklist from "../../ResumeAnalyzer/components/AtsChecklist";

/**
 * The ATS check, run on the PDF itself: the API renders the CV, reads the file
 * back with the same extractor it uses for uploaded CVs, and scores what it
 * found. So a pass here means the downloaded file parses, not just the form.
 */
const AtsCheckDrawer = ({ open, onClose, loading, result, error, onRetry, onFullReview, reviewing, aiEnabled }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="ats-drawer-title">
      <button type="button" aria-label="Close the ATS check" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      <div className="animate-slide-in-right relative flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-default bg-surface-card px-5 py-4">
          <div>
            <h2 id="ats-drawer-title" className="font-headline-md font-bold text-text-primary">
              ATS check
            </h2>
            <p className="text-[12px] text-text-muted">Your PDF, read back the way an employer’s system reads it</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-container"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-[13px] font-bold text-text-primary">Rendering your PDF and reading it back…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="text-[13px] leading-5">{error}</p>
              <button type="button" onClick={onRetry} className="rounded-lg bg-amber-600 px-3 py-1.5 font-label-md font-bold text-white hover:bg-amber-700">
                Check again
              </button>
            </div>
          )}

          {!loading && result && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-brand-indigo-light/70 to-surface-container-low p-4">
                <ScoreRing score={result.atsScore} size={104} label="ATS" />
                <div className="min-w-0">
                  <p className="font-headline-sm font-bold text-text-primary">
                    {result.atsScore >= 90
                      ? "This CV will parse cleanly."
                      : result.atsScore >= 70
                        ? "Good — a few fixes will make it stronger."
                        : "Some important pieces are missing."}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                    {result.pageCount} page{result.pageCount === 1 ? "" : "s"} · {result.signals?.wordCount} words ·{" "}
                    {result.signals?.bulletCount} bullets. The template takes care of layout, so anything flagged
                    below is about what the CV says.
                  </p>
                </div>
              </div>

              <AtsChecklist checks={result.checks} signals={result.signals} />

              <details className="rounded-2xl border border-border-default bg-surface-card p-4">
                <summary className="cursor-pointer font-label-md font-bold text-text-primary">What an ATS reads from your file</summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-container-low p-3 font-mono text-[11px] leading-5 text-text-secondary">
                  {result.text}
                </pre>
              </details>

              <div className="rounded-2xl border border-border-default bg-surface-card p-4">
                <h3 className="font-headline-sm font-bold text-text-primary">Want a deeper review?</h3>
                <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                  The AI Resume Analyzer scores writing quality and grammar, finds missing skills, and matches you to open
                  jobs. It will use this CV and update your job matches.
                </p>
                <button
                  type="button"
                  onClick={onFullReview}
                  disabled={reviewing || !aiEnabled}
                  title={aiEnabled ? undefined : "AI review is not configured on this server"}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[18px] ${reviewing ? "animate-spin" : ""}`} aria-hidden="true">
                    {reviewing ? "progress_activity" : "auto_awesome"}
                  </span>
                  {reviewing ? "Analysing…" : "Get the full AI review"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AtsCheckDrawer;
