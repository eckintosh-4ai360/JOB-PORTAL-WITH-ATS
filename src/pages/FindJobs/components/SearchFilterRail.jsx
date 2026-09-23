import { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";

/**
 * The filter rail.
 *
 * Two decisions shape it. First, the vocabularies come from the server
 * (`/api/jobs/search/options`) rather than being written out here, so the list
 * of work models the candidate can tick is by construction the same list the
 * ranking engine understands.
 *
 * Second, every option carries the number of results behind it, recounted with
 * each search. A filter list without counts is a list of guesses; with them, a
 * candidate can see that "Remote" holds four of sixty roles before spending a
 * click to find out.
 */

const FilterSection = ({ icon, title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-t border-border-default pt-space-md first:border-t-0 first:pt-0">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
                className="mb-2 flex w-full items-center justify-between gap-2 cursor-pointer"
            >
                <span className="flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-text-muted">
                    <span className="material-symbols-outlined text-[16px] text-primary">{icon}</span>
                    {title}
                </span>
                <span className={`material-symbols-outlined text-[18px] text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    expand_more
                </span>
            </button>
            {isOpen && <div className="pb-1">{children}</div>}
        </div>
    );
};

/**
 * One checkbox row.
 *
 * An option with no results is shown but disabled rather than hidden: a
 * candidate looking for the "Internship" filter needs to find it and learn
 * there are none, not wonder whether the site has the concept at all.
 */
const CheckRow = ({ label, count, checked, onChange }) => {
    const empty = !checked && count === 0;

    return (
        <label
            className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                empty ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-surface-container"
            }`}
        >
            <span className="flex min-w-0 items-center gap-2">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={empty}
                    onChange={onChange}
                    className="h-4 w-4 shrink-0 accent-[#6933c5] cursor-pointer disabled:cursor-not-allowed"
                />
                <span className={`truncate font-body-md capitalize ${checked ? "font-bold text-primary" : "text-text-secondary"}`}>
                    {label}
                </span>
            </span>
            <span className="shrink-0 font-numeric-metric text-[11px] text-text-muted">{count ?? 0}</span>
        </label>
    );
};

/** Turn the facet rows for one filter into a lookup of value → count. */
const countsFor = (facets, key) => {
    const map = new Map();
    for (const entry of facets?.[key] || []) map.set(entry.value, entry.count);
    return map;
};

const SearchFilterRail = ({
    facets = {},
    filters = {},
    activeFilterCount = 0,
    onToggle,
    onCommit,
    onClear,
    readList,
}) => {
    const [options, setOptions] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axiosInstance
            .get(API_PATHS.JOBS.SEARCH_OPTIONS)
            .then((response) => {
                if (!cancelled) setOptions(response.data);
            })
            .catch(() => {
                // Without the vocabularies the rail cannot render meaningfully;
                // the search box and the results still work on their own.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const counts = useMemo(
        () => ({
            workModel: countsFor(facets, "workModel"),
            employmentType: countsFor(facets, "employmentType"),
            seniority: countsFor(facets, "seniority"),
            education: countsFor(facets, "education"),
            industry: countsFor(facets, "industry"),
            companyStage: countsFor(facets, "companyStage"),
            verified: countsFor(facets, "verified"),
        }),
        [facets]
    );

    const topSkills = (facets.skill || []).slice(0, 12);
    const selectedSkills = readList("skills");
    const salaryMin = Number(filters.salaryMin) || 0;

    if (!options) {
        return (
            <div className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-xs">
                <div className="h-5 w-32 animate-pulse rounded bg-surface-container" />
                <div className="mt-4 flex flex-col gap-3">
                    {[0, 1, 2, 3, 4].map((row) => (
                        <div key={row} className="h-8 animate-pulse rounded bg-surface-container" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-3xl border border-[#e9ddfb] bg-surface-card shadow-[0_16px_38px_rgba(79,43,139,0.10)] dark:border-gray-800 dark:shadow-[0_16px_38px_rgba(0,0,0,0.38)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#5120ae] to-[#9c55dc] p-space-md text-white">
                <div className="absolute -right-7 -top-9 h-24 w-24 rounded-full border-[14px] border-white/20" />
                <div className="flex items-center gap-space-xs">
                    <span className="relative material-symbols-outlined text-[21px]">tune</span>
                    <h2 className="relative font-headline-sm font-bold">Refine results</h2>
                    {activeFilterCount > 0 && (
                        <span className="relative rounded-full bg-white/20 px-2 py-0.5 font-label-caps font-bold text-white">
                            {activeFilterCount} active
                        </span>
                    )}
                </div>
                <p className="relative mt-1 font-body-sm text-white/75">
                    Counts update with every search.
                </p>
            </div>

            <div className="flex flex-col gap-space-md p-space-md">
                <div className="flex items-center justify-between">
                    <span className="font-label-md text-text-secondary">Your filters</span>
                    <button
                        type="button"
                        onClick={onClear}
                        disabled={activeFilterCount === 0}
                        className="rounded-lg px-2 py-1 font-label-md text-primary transition hover:bg-brand-indigo-light hover:text-brand-indigo-dark disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                        Reset all
                    </button>
                </div>

                <FilterSection icon="location_on" title="Location">
                    <select
                        value={filters.location || ""}
                        onChange={(event) => onCommit({ location: event.target.value })}
                        aria-label="Filter by location"
                        className="w-full cursor-pointer rounded-xl border border-border-default bg-surface-container-low px-3 py-2 font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Anywhere in Ghana</option>
                        {options.locations.map((place) => (
                            <option key={place.key} value={place.key}>
                                {place.key}
                                {place.region && place.region !== place.key ? ` — ${place.region}` : ""}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1.5 font-body-sm text-text-muted">
                        Remote roles are always included.
                    </p>
                </FilterSection>

                <FilterSection icon="home_work" title="Work model">
                    {options.workModels.map((model) => (
                        <CheckRow
                            key={model.key}
                            label={model.label}
                            count={counts.workModel.get(model.key)}
                            checked={readList("workModel").includes(model.key)}
                            onChange={() => onToggle("workModel", model.key)}
                        />
                    ))}
                </FilterSection>

                <FilterSection icon="work" title="Employment type">
                    {options.employmentTypes.map((type) => (
                        <CheckRow
                            key={type.key}
                            label={type.label}
                            count={counts.employmentType.get(type.key)}
                            checked={readList("type").includes(type.key)}
                            onChange={() => onToggle("type", type.key)}
                        />
                    ))}
                </FilterSection>

                <FilterSection icon="military_tech" title="Experience level">
                    {options.seniority.map((level) => (
                        <CheckRow
                            key={level.key}
                            label={level.label}
                            count={counts.seniority.get(level.key)}
                            checked={readList("experienceLevel").includes(level.key)}
                            onChange={() => onToggle("experienceLevel", level.key)}
                        />
                    ))}
                </FilterSection>

                <FilterSection icon="school" title="Your highest qualification" defaultOpen={false}>
                    <select
                        value={filters.education || ""}
                        onChange={(event) => onCommit({ education: event.target.value })}
                        aria-label="Filter by your highest qualification"
                        className="w-full cursor-pointer rounded-xl border border-border-default bg-surface-container-low px-3 py-2 font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="">Any qualification</option>
                        {options.education.map((level) => (
                            <option key={level.key} value={level.key}>
                                {level.label}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1.5 font-body-sm text-text-muted">
                        Shows roles you qualify for, not only those asking for exactly this.
                    </p>
                </FilterSection>

                <FilterSection icon="domain" title="Industry" defaultOpen={false}>
                    {options.industries.map((industry) => (
                        <CheckRow
                            key={industry.key}
                            label={industry.label}
                            count={counts.industry.get(industry.key)}
                            checked={readList("industry").includes(industry.key)}
                            onChange={() => onToggle("industry", industry.key)}
                        />
                    ))}
                </FilterSection>

                <FilterSection icon="trending_up" title="Company stage" defaultOpen={false}>
                    {options.companyStages.map((stage) => (
                        <CheckRow
                            key={stage.key}
                            label={stage.label}
                            count={counts.companyStage.get(stage.key)}
                            checked={readList("companyStage").includes(stage.key)}
                            onChange={() => onToggle("companyStage", stage.key)}
                        />
                    ))}
                </FilterSection>

                {topSkills.length > 0 && (
                    <FilterSection icon="bolt" title="Skills">
                        <div className="flex flex-wrap gap-1.5">
                            {topSkills.map((skill) => {
                                const active = selectedSkills.includes(skill.value);
                                return (
                                    <button
                                        key={skill.value}
                                        type="button"
                                        onClick={() => onToggle("skills", skill.value)}
                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-label-md capitalize transition-colors cursor-pointer ${
                                            active
                                                ? "bg-primary text-on-primary"
                                                : "bg-surface-container text-on-surface-variant hover:bg-brand-indigo-light hover:text-primary"
                                        }`}
                                    >
                                        {skill.value}
                                        <span className="opacity-70">{skill.count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </FilterSection>
                )}

                <FilterSection icon="schedule" title="Date posted">
                    <div className="grid grid-cols-2 gap-2">
                        {[{ key: "", label: "Any time" }, ...options.datePosted].map((window) => (
                            <button
                                key={window.key || "any"}
                                type="button"
                                onClick={() => onCommit({ datePosted: window.key })}
                                className={`rounded-xl border px-2 py-2 font-label-md font-semibold transition-all cursor-pointer ${
                                    (filters.datePosted || "") === window.key
                                        ? "border-primary bg-brand-indigo-light text-primary shadow-sm"
                                        : "border-border-default bg-surface-container-low text-text-secondary hover:border-primary/40"
                                }`}
                            >
                                {window.label}
                            </button>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection icon="payments" title="Salary floor">
                    <div className="rounded-2xl bg-[#effaf5] p-3 dark:bg-emerald-950/30">
                        <div className="flex items-center justify-between">
                            <span className="font-label-caps uppercase tracking-wider text-text-muted">
                                Minimum monthly pay
                            </span>
                            <span className="font-numeric-metric text-sm text-salary-emerald">
                                {salaryMin > 0 ? `GH₵ ${(salaryMin / 1000).toFixed(0)}k` : "Any"}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="50000"
                            step="1000"
                            value={salaryMin}
                            aria-label="Minimum monthly salary"
                            onChange={(event) => {
                                const next = Number(event.target.value);
                                onCommit({ salaryMin: next > 0 ? next : null });
                            }}
                            className="mt-3 w-full cursor-pointer accent-[#6933c5]"
                        />
                        <div className="flex justify-between font-body-sm text-[11px] text-text-muted">
                            <span>GH₵ 0</span>
                            <span>GH₵ 50k+</span>
                        </div>
                        <p className="mt-1 font-body-sm text-text-muted">
                            Roles that do not state a salary are hidden while this is set.
                        </p>
                    </div>
                </FilterSection>

                <FilterSection icon="verified" title="Employer">
                    <CheckRow
                        label="Verified employers only"
                        count={counts.verified.get("verified")}
                        checked={filters.verified === "true"}
                        onChange={() =>
                            onCommit({ verified: filters.verified === "true" ? null : "true" })
                        }
                    />
                </FilterSection>
            </div>
        </div>
    );
};

export default SearchFilterRail;
