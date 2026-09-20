import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import ScoreRing from "./ScoreRing";
import DimensionBreakdown from "./DimensionBreakdown";
import { scoreStyle } from "./scoreUtils";

/**
 * "How well do I match this job?" panel for a single job page.
 *
 * Self-contained: fetches its own score so a job page does not need to know
 * anything about matching. Renders a sign-in or analyse-your-resume prompt when
 * the score cannot be produced yet, because an empty panel teaches the user
 * nothing about what to do next.
 */
const JobMatchPanel = ({ jobId, isAuthenticated }) => {
  const [match, setMatch] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fetchMatch = async ({ refresh = false } = {}) => {
    if (!jobId || !isAuthenticated) return;

    refresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.AI.GET_JOB_MATCH(jobId), {
        params: refresh ? { refresh: "true" } : {},
      });
      setMatch(res.data?.match || null);
      setNeedsProfile(Boolean(res.data?.needsProfile));
      if (refresh) toast.success("Match rescored");
    } catch {
      // A failed score should not intrude on the job page.
      setMatch(null);
    } finally {
      refresh ? setIsRefreshing(false) : setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!jobId || !isAuthenticated) return;
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(API_PATHS.AI.GET_JOB_MATCH(jobId));
        if (cancelled) return;
        setMatch(res.data?.match || null);
        setNeedsProfile(Boolean(res.data?.needsProfile));
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [jobId, isAuthenticated]);

  // --- Prompts -----------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-brand-indigo-light p-space-md">
        <h3 className="flex items-center gap-1.5 font-headline-sm font-bold text-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            join_inner
          </span>
          Your match score
        </h3>
        <p className="mt-1 font-body-sm text-text-secondary">
          Sign in and analyse your resume to see how well you fit this role on skills, experience,
          education, certifications, location, and pay.
        </p>
        <Link
          to="/login"
          className="mt-space-sm inline-block rounded-xl bg-primary px-space-md py-2 font-label-md font-bold text-on-primary"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-brand-indigo-light p-space-md">
        <h3 className="flex items-center gap-1.5 font-headline-sm font-bold text-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            auto_awesome
          </span>
          Your match score
        </h3>
        <p className="mt-1 font-body-sm text-text-secondary">
          Analyse your resume once and we can score this role — and every other open role — against
          your profile.
        </p>
        <Link
          to="/resume-analyzer"
          className="mt-space-sm inline-block rounded-xl bg-primary px-space-md py-2 font-label-md font-bold text-on-primary"
        >
          Analyse my resume
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-space-sm rounded-2xl border border-border-default bg-surface-card p-space-md">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <span className="font-body-sm text-text-secondary">Scoring your fit for this role…</span>
      </div>
    );
  }

  if (!match) return null;

  const style = scoreStyle(match.matchScore);

  return (
    <div className="flex flex-col gap-space-md rounded-2xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)]">
      <div className="flex items-start justify-between gap-space-sm">
        <h3 className="font-headline-sm font-bold text-text-primary">Your match score</h3>
        <button
          type="button"
          onClick={() => fetchMatch({ refresh: true })}
          disabled={isRefreshing}
          title="Rescore with your current profile"
          className="rounded-lg p-1 text-text-muted transition-colors hover:text-primary disabled:opacity-50"
          aria-label="Rescore this job"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            refresh
          </span>
        </button>
      </div>

      <div className="flex items-center gap-space-md">
        <ScoreRing score={match.matchScore} size={92} label="Match" />
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 font-label-md font-bold ${style.bg} ${style.text} ${style.border}`}
          >
            {match.verdict}
          </span>
          {match.aiSummary && (
            <p className="mt-1.5 font-body-sm text-text-secondary">{match.aiSummary}</p>
          )}
        </div>
      </div>

      {match.strengths?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {match.strengths.slice(0, 3).map((strength) => (
            <span
              key={strength}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-label-md font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-300"
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                check
              </span>
              {strength}
            </span>
          ))}
        </div>
      )}

      {match.missingSkills?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-space-sm dark:bg-amber-500/10 dark:border-amber-500/25">
          <span className="mb-1 block font-label-caps uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Skills this role wants that you have not shown
          </span>
          <div className="flex flex-wrap gap-1.5">
            {match.missingSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-lg bg-white/70 px-2 py-0.5 font-label-md font-semibold text-amber-800 dark:bg-white/10 dark:text-amber-300"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowBreakdown((value) => !value)}
        aria-expanded={showBreakdown}
        className="flex items-center gap-1 self-start font-label-md font-bold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
          {showBreakdown ? "expand_less" : "analytics"}
        </span>
        {showBreakdown ? "Hide breakdown" : "Why this score?"}
      </button>

      {showBreakdown && (
        <div className="border-t border-border-default pt-space-sm">
          <DimensionBreakdown dimensions={match.dimensions} />
          {match.aiAdjustment !== 0 && (
            <p className="mt-space-sm font-body-sm text-text-muted">
              Rule-based score {match.baseScore}, adjusted {match.aiAdjustment > 0 ? "up" : "down"} by{" "}
              {Math.abs(match.aiAdjustment)} after AI review of transferable experience.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default JobMatchPanel;
