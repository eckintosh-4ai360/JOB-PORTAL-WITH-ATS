import { Link } from "react-router-dom";
import MatchBadge from "../../../components/ai/MatchBadge";

/**
 * One job in the results list.
 *
 * Extracted from the page so the search shell stays readable, and so the card
 * can show what search now knows about a posting — its derived experience
 * level, the employer's stage, whether the employer has been verified — without
 * that detail crowding the page component.
 */

const SENIORITY_LABELS = {
    intern: "Intern",
    entry: "Entry level",
    mid: "Mid level",
    senior: "Senior",
    lead: "Lead / Manager",
    executive: "Executive",
};

const salaryText = (job) => {
    const { salaryMin, salaryMax } = job;
    if (!salaryMin && !salaryMax) return "Not disclosed";

    const short = (value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`);
    if (salaryMin && salaryMax) return `${short(salaryMin)} – ${short(salaryMax)}`;
    return short(salaryMin || salaryMax);
};

const postedAgo = (createdAt) => {
    if (!createdAt) return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
    if (Number.isNaN(days)) return null;
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
};

const JobResultCard = ({
    job,
    isSaved,
    match,
    canApply,
    hasApplied,
    onToggleSave,
    onQuickApply,
    onSkillClick,
}) => {
    const jobId = job._id || job.id;
    const companyName = job.companyName || job.company?.companyName || "Hiring Company";
    const logo = job.companyLogo || job.company?.companyLogo;
    const posted = postedAgo(job.createdAt);

    return (
        <article className="group relative overflow-hidden rounded-2xl border border-border-default bg-surface-card p-space-md shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md md:p-space-lg">
            <div className="flex flex-col items-start justify-between gap-space-md md:flex-row">
                <div className="flex flex-1 items-start gap-space-md">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-default bg-surface-container shadow-inner">
                        {logo ? (
                            <img src={logo} alt={companyName} className="h-full w-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-[28px] text-primary">business</span>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="mb-1 flex flex-wrap items-center gap-space-xs">
                            <span className="font-label-lg font-bold text-text-primary">{companyName}</span>
                            {job.verified && (
                                <span
                                    className="material-symbols-outlined text-[18px] text-verified-badge"
                                    title="Verified employer"
                                >
                                    verified
                                </span>
                            )}
                            {job.companyStage && (
                                <>
                                    <span className="text-text-muted">•</span>
                                    <span className="font-body-sm capitalize text-text-muted">{job.companyStage}</span>
                                </>
                            )}
                            {posted && (
                                <>
                                    <span className="text-text-muted">•</span>
                                    <span className="font-body-sm text-text-muted">{posted}</span>
                                </>
                            )}
                        </div>

                        <Link
                            to={`/job/${jobId}`}
                            className="block truncate font-headline-md text-headline-md font-bold text-text-primary transition-colors hover:text-primary"
                        >
                            {job.title}
                        </Link>

                        {match && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-space-xs">
                                <MatchBadge score={match.matchScore} verdict={match.verdict} size="sm" />
                                {match.missingSkills?.length > 0 && (
                                    <span className="font-body-sm text-text-muted">
                                        Missing{" "}
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                                            {match.missingSkills.slice(0, 2).join(", ")}
                                        </span>
                                        {match.missingSkills.length > 2 && ` +${match.missingSkills.length - 2}`}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-text-secondary">
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px] text-text-muted">location_on</span>
                                {job.location || "Ghana"}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px] text-text-muted">schedule</span>
                                {job.type}
                            </span>
                            {job.workModel && (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px] text-text-muted">home_work</span>
                                    {job.workModel}
                                </span>
                            )}
                            {job.seniority && (
                                <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px] text-text-muted">military_tech</span>
                                    {SENIORITY_LABELS[job.seniority] || job.seniority}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-space-xs self-end md:self-start">
                    <button
                        onClick={(event) => onToggleSave(event, jobId)}
                        type="button"
                        title={isSaved ? "Saved" : "Save job"}
                        aria-label={isSaved ? "Remove bookmark" : "Save job"}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all cursor-pointer ${
                            isSaved
                                ? "bg-brand-indigo-light font-bold text-primary shadow-xs"
                                : "bg-surface-container text-text-muted hover:bg-brand-indigo-light hover:text-primary"
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">bookmark</span>
                    </button>
                </div>
            </div>

            {Array.isArray(job.searchSkills) && job.searchSkills.length > 0 && (
                <div className="my-space-md flex flex-wrap gap-1.5">
                    {job.searchSkills.slice(0, 8).map((skill) => (
                        <button
                            key={skill}
                            type="button"
                            onClick={() => onSkillClick?.(skill)}
                            className="rounded-lg bg-surface-container px-2.5 py-1 font-label-md capitalize text-on-surface-variant transition-colors hover:bg-brand-indigo-light hover:text-primary cursor-pointer"
                        >
                            {skill}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col justify-between gap-space-sm border-t border-border-default pt-space-sm sm:flex-row sm:items-center">
                <div>
                    <span className="block font-label-caps uppercase tracking-wider text-text-muted">
                        Compensation
                    </span>
                    <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="font-headline-sm font-bold text-salary-emerald">
                            {job.salaryMin || job.salaryMax ? "GH₵ " : ""}
                            {salaryText(job)}
                        </span>
                        {(job.salaryMin || job.salaryMax) && (
                            <span className="font-body-sm text-text-secondary">/ month</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-space-sm">
                    {canApply &&
                        (hasApplied ? (
                            <span className="inline-flex items-center justify-center gap-1 rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-text-secondary">
                                <span className="material-symbols-outlined text-[16px] text-primary">task_alt</span>
                                <span>Applied</span>
                            </span>
                        ) : (
                            <button
                                onClick={() => onQuickApply(job)}
                                type="button"
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-indigo-light px-space-md py-2.5 font-label-md font-bold text-primary transition-colors hover:bg-brand-indigo-subtle cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">bolt</span>
                                <span>Quick Apply</span>
                            </button>
                        ))}

                    <Link
                        to={`/job/${jobId}`}
                        className="inline-flex items-center justify-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-2.5 font-label-lg text-on-primary shadow-sm transition-all hover:bg-brand-indigo-dark hover:shadow"
                    >
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default JobResultCard;
