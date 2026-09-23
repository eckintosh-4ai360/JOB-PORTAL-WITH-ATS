/**
 * What the search engine understood, shown back to the candidate.
 *
 * A sentence like "Senior nurse in Kumasi, full time" quietly becomes three
 * filters. Showing them as removable chips is what keeps that from being magic:
 * the candidate can see that "Kumasi" was read as a place, and take it off if
 * it was not what they meant. A filter nobody can see is a filter nobody can
 * correct.
 */

const CHIP_ICONS = {
    location: "location_on",
    workModel: "home_work",
    employmentType: "work",
    seniority: "military_tech",
    education: "school",
    industry: "domain",
    companyStage: "trending_up",
    skill: "bolt",
    datePosted: "schedule",
    verified: "verified",
    salary: "payments",
    minYears: "timeline",
};

const QueryUnderstanding = ({
    interpreted = [],
    didYouMean,
    corrections = [],
    expandedWith = [],
    aiApplied = [],
    onRemove,
    onAcceptSpelling,
}) => {
    const hasChips = interpreted.length > 0;
    if (!hasChips && !didYouMean) return null;

    return (
        <div className="flex flex-col gap-space-sm rounded-2xl border border-border-default bg-surface-card p-space-md shadow-xs">
            {didYouMean && (
                <p className="font-body-md text-text-secondary">
                    {corrections.length === 1 ? "Searching for" : "Searching for"}{" "}
                    <button
                        type="button"
                        onClick={() => onAcceptSpelling?.(didYouMean)}
                        className="font-bold text-primary underline underline-offset-2 hover:text-brand-indigo-dark cursor-pointer"
                    >
                        {didYouMean}
                    </button>
                    {" — we corrected "}
                    <span className="italic">{corrections.map((c) => c.from).join(", ")}</span>.
                </p>
            )}

            {hasChips && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 font-label-caps uppercase tracking-wider text-text-muted">
                        <span className="material-symbols-outlined text-[15px] text-primary">auto_awesome</span>
                        We read your search as
                    </span>

                    {interpreted.map((chip) => (
                        <span
                            key={`${chip.type}:${chip.value}`}
                            title={
                                chip.soft
                                    ? "Used to rank results, not to exclude any"
                                    : "Filtering results"
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-md font-semibold capitalize ${
                                chip.soft
                                    ? "border border-dashed border-primary/40 bg-transparent text-text-secondary"
                                    : "bg-brand-indigo-light text-primary"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[14px]">
                                {CHIP_ICONS[chip.type] || "filter_alt"}
                            </span>
                            {chip.label}
                            <button
                                type="button"
                                onClick={() => onRemove?.(chip)}
                                aria-label={`Remove ${chip.label}`}
                                className="text-current opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {(expandedWith.length > 0 || aiApplied.length > 0) && (
                <p className="font-body-sm text-text-muted">
                    {expandedWith.length > 0 && (
                        <>
                            Also matching similar titles:{" "}
                            <span className="capitalize">{expandedWith.slice(0, 5).join(", ")}</span>
                            {expandedWith.length > 5 ? ` +${expandedWith.length - 5} more` : ""}.
                        </>
                    )}
                    {aiApplied.length > 0 && (
                        <>
                            {expandedWith.length > 0 ? " " : ""}
                            AI read your phrasing for {aiApplied.join(", ")}.
                        </>
                    )}
                </p>
            )}
        </div>
    );
};

export default QueryUnderstanding;
