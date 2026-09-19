import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ScoreRing from "../../../components/ai/ScoreRing";
import DimensionBreakdown from "../../../components/ai/DimensionBreakdown";
import { formatSalary, scoreStyle } from "../../../components/ai/scoreUtils";

/**
 * Ranked job matches with an expandable score breakdown per job.
 *
 * The breakdown is the point: a percentage nobody can interrogate is a number
 * candidates learn to ignore. Every card can be opened to show which of the six
 * dimensions earned the score and what is missing.
 */
const FILTERS = [
  { id: "all", label: "All matches" },
  { id: "strong", label: "80%+" },
  { id: "remote", label: "Remote" },
];

const JobMatchList = ({ matches = [], isLoading, onRefresh, isRefreshing, needsProfile }) => {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "strong") return matches.filter((match) => match.matchScore >= 80);
    if (filter === "remote") {
      return matches.filter((match) => {
        const haystack = `${match.job?.location || ""} ${match.job?.workModel || ""} ${match.job?.type || ""}`;
        return /remote|anywhere|work from home/i.test(haystack);
      });
    }
    return matches;
  }, [matches, filter]);

  if (needsProfile) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-card p-space-lg text-center">
        <span className="material-symbols-outlined text-[42px] text-text-muted" aria-hidden="true">
          person_search
        </span>
        <h3 className="mt-2 font-headline-sm font-bold text-text-primary">
          Analyse your resume to see matches
        </h3>
        <p className="mx-auto mt-1 max-w-md font-body-sm text-text-muted">
          Once we know your skills, experience, and qualifications, every open role is scored against
          your profile on six dimensions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-col justify-between gap-space-sm rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_14px_30px_rgba(40,34,86,0.07)] sm:flex-row sm:items-center">
        <div>
          <h3 className="font-headline-sm font-bold text-on-surface">
            Your job matches {matches.length > 0 && `(${filtered.length})`}
          </h3>
          <p className="font-body-sm text-text-muted">
            Scored on skills, experience, education, certifications, location, and pay
          </p>
        </div>

        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-1 rounded-xl bg-surface-container p-1">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`rounded-lg px-3 py-1 font-label-md font-bold transition-colors ${
                  filter === option.id
                    ? "bg-surface-card text-primary shadow-xs"
                    : "text-text-secondary hover:text-on-surface"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Rescore every open job against your current profile"
              className="flex items-center gap-1 rounded-xl bg-surface-container px-3 py-2 font-label-md font-bold text-text-secondary transition-colors hover:text-on-surface disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[17px] ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                refresh
              </span>
              <span className="hidden sm:inline">{isRefreshing ? "Scoring…" : "Rescore"}</span>
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-border-default bg-surface-card py-space-xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-body-md font-semibold text-text-primary">
            Scoring open roles against your profile…
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border-default bg-surface-card p-space-lg text-center">
          <span className="material-symbols-outlined text-[42px] text-text-muted" aria-hidden="true">
            work_off
          </span>
          <p className="mt-2 font-body-md font-semibold text-text-primary">
            {matches.length === 0
              ? "No open roles to score yet"
              : "No matches meet this filter"}
          </p>
          <p className="mt-1 font-body-sm text-text-muted">
            {matches.length === 0
              ? "Check back as employers post new roles."
              : "Try 'All matches' to see every scored role."}
          </p>
          <Link
            to="/find-jobs"
            className="mt-space-md inline-block rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary"
          >
            Browse all jobs
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          {filtered.map((match) => {
            const job = match.job || {};
            const jobId = match.jobId || job._id || job.id;
            const isOpen = expanded === jobId;
            const style = scoreStyle(match.matchScore);

            return (
              <article
                key={jobId}
                className="overflow-hidden rounded-3xl border border-border-default bg-surface-card shadow-[0_12px_28px_rgba(40,34,86,0.07)] transition-all duration-300 hover:border-primary/35"
              >
                <div className="flex flex-col gap-space-md p-space-md sm:flex-row sm:items-start md:p-space-lg">
                  <ScoreRing score={match.matchScore} size={96} label="Match" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-label-md font-bold ${style.bg} ${style.text} ${style.border}`}
                      >
                        {match.verdict}
                      </span>
                      {match.aiAdjustment !== 0 && (
                        <span
                          className="rounded-full bg-surface-container px-2 py-0.5 font-label-caps uppercase text-text-muted"
                          title={`Rule-based score ${match.baseScore}, adjusted ${match.aiAdjustment > 0 ? "up" : "down"} by AI review`}
                        >
                          AI {match.aiAdjustment > 0 ? "+" : ""}
                          {match.aiAdjustment}
                        </span>
                      )}
                      <span className="font-body-sm text-text-muted">
                        {job.workModel || job.type || "Full-Time"}
                      </span>
                    </div>

                    <h4 className="mt-1 font-headline-md font-bold text-text-primary">
                      {job.title}
                    </h4>
                    <p className="font-body-sm text-text-muted">
                      {job.companyName || "Hiring Company"} · {job.location || "Ghana"}
                    </p>

                    {match.aiSummary && (
                      <p className="mt-space-sm rounded-xl border-l-2 border-primary bg-brand-indigo-light p-space-sm font-body-sm text-primary">
                        {match.aiSummary}
                      </p>
                    )}

                    {match.strengths?.length > 0 && (
                      <div className="mt-space-sm flex flex-wrap gap-1.5">
                        {match.strengths.slice(0, 3).map((strength) => (
                          <span
                            key={strength}
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-label-md font-semibold text-emerald-700"
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
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-label-caps uppercase text-text-muted">Missing:</span>
                        {match.missingSkills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 font-label-md font-semibold text-amber-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-space-md flex flex-col gap-space-sm border-t border-border-default pt-space-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="block font-label-caps uppercase tracking-wider text-text-muted">
                          Compensation
                        </span>
                        <span className="font-headline-sm font-bold text-salary-emerald">
                          {formatSalary(job.salaryMin, job.salaryMax)}
                          {(job.salaryMin || job.salaryMax) && (
                            <span className="font-body-sm font-normal text-text-secondary"> / mo</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-space-sm">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : jobId)}
                          aria-expanded={isOpen}
                          className="flex items-center gap-1 rounded-xl bg-surface-container px-3 py-2.5 font-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                            {isOpen ? "expand_less" : "analytics"}
                          </span>
                          {isOpen ? "Hide breakdown" : "Why this score"}
                        </button>

                        <Link
                          to={`/job/${jobId}`}
                          className="rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark"
                        >
                          View role
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border-default bg-surface-container-low p-space-md md:p-space-lg">
                    <div className="mb-space-sm flex flex-wrap items-baseline justify-between gap-2">
                      <h5 className="font-label-md font-bold uppercase tracking-wider text-text-secondary">
                        Score breakdown
                      </h5>
                      <span className="font-body-sm text-text-muted">
                        Rule-based {match.baseScore}
                        {match.aiAdjustment !== 0 && (
                          <>
                            {" "}
                            · AI review {match.aiAdjustment > 0 ? "+" : ""}
                            {match.aiAdjustment} · final {match.matchScore}
                          </>
                        )}
                      </span>
                    </div>

                    <DimensionBreakdown dimensions={match.dimensions} />

                    {match.gaps?.length > 0 && (
                      <div className="mt-space-md rounded-xl border border-amber-200 bg-amber-50 p-space-sm">
                        <span className="mb-1 block font-label-caps uppercase tracking-wider text-amber-700">
                          What is holding this score down
                        </span>
                        <ul className="flex flex-col gap-1">
                          {match.gaps.map((gap) => (
                            <li key={gap} className="flex gap-1.5 font-body-sm text-amber-900">
                              <span
                                className="material-symbols-outlined text-[15px] shrink-0"
                                aria-hidden="true"
                              >
                                arrow_right
                              </span>
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default JobMatchList;
