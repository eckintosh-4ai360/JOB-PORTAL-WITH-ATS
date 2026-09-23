/**
 * Advanced job search endpoints.
 *
 * The controller's job is narrow on purpose: read the request, hand it to the
 * search service, hand the answer back. Ranking lives in
 * services/jobSearchService, vocabulary in utils/searchLexicon, and neither
 * should have to be touched to change an HTTP detail.
 */

const { searchJobs, MAX_LIMIT, DEFAULT_LIMIT } = require("../services/jobSearchService");
const { suggest } = require("../services/searchVocabulary");
const { parseQuery, hasUnresolvedIntent } = require("../utils/queryParser");
const { readIntent, mergeIntent } = require("../services/searchIntentService");
const {
    WORK_MODELS,
    EMPLOYMENT_TYPES,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
    COMPANY_STAGES,
    INDUSTRIES,
    DATE_WINDOWS,
    PLACES,
} = require("../utils/searchLexicon");

/**
 * Fold `?type[]=a&type[]=b` onto plain `type`.
 *
 * Several HTTP clients — axios among them — serialise arrays with bracketed
 * keys, and this Express version's query parser keeps the brackets, so the
 * filter would arrive under a name nothing reads and be silently ignored. A
 * filter that quietly does nothing is worse than one that errors, so both
 * spellings are accepted.
 */
const normalizeQuery = (query) => {
    const normalized = { ...query };
    for (const [key, value] of Object.entries(query)) {
        if (!key.endsWith("[]")) continue;
        const plain = key.slice(0, -2);
        const existing = normalized[plain];
        normalized[plain] = existing
            ? [].concat(existing, value)
            : value;
    }
    return normalized;
};

/** `?type=full-time,contract` and `?type=full-time&type=contract` both work. */
const csv = (value) => {
    if (value === undefined || value === null) return [];
    const raw = Array.isArray(value) ? value : [value];
    return [...new Set(
        raw
            .flatMap((entry) => String(entry).split(","))
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
    )];
};

const number = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const flag = (value) => value === true || value === "true" || value === "1";

const only = (values, allowed) => values.filter((value) => allowed.has(value));

const keySet = (list) => new Set(list.map((item) => item.key));

const ALLOWED = {
    workModels: keySet(WORK_MODELS),
    employmentTypes: keySet(EMPLOYMENT_TYPES),
    seniority: keySet(SENIORITY_LEVELS),
    education: keySet(EDUCATION_OPTIONS),
    companyStages: keySet(COMPANY_STAGES),
    industries: keySet(INDUSTRIES),
    datePosted: keySet(DATE_WINDOWS),
};

const SORTS = new Set(["relevance", "newest", "oldest", "salary", "match"]);

/**
 * Read the filter set off the query string.
 *
 * Unknown values are dropped rather than rejected: a stale bookmark with a
 * filter that no longer exists should still return jobs.
 */
const readFilters = (query) => {
    const filters = {};

    if (query.location) filters.location = String(query.location).trim().slice(0, 80);

    const workModels = only(csv(query.workModel ?? query.workModels), ALLOWED.workModels);
    if (workModels.length) filters.workModels = workModels;

    const employmentTypes = only(csv(query.type ?? query.employmentType), ALLOWED.employmentTypes);
    if (employmentTypes.length) filters.employmentTypes = employmentTypes;

    const seniority = only(csv(query.experienceLevel ?? query.seniority), ALLOWED.seniority);
    if (seniority.length) filters.seniority = seniority;

    const education = only(csv(query.education), ALLOWED.education);
    if (education.length) filters.education = education[0];

    const industries = only(csv(query.industry ?? query.industries), ALLOWED.industries);
    if (industries.length) filters.industries = industries;

    const companyStages = only(csv(query.companyStage ?? query.stage), ALLOWED.companyStages);
    if (companyStages.length) filters.companyStages = companyStages;

    const skills = csv(query.skills ?? query.skill).slice(0, 20);
    if (skills.length) filters.skills = skills;

    const datePosted = only(csv(query.datePosted ?? query.posted), ALLOWED.datePosted);
    if (datePosted.length) filters.datePosted = datePosted[0];

    const salaryMin = number(query.salaryMin);
    if (salaryMin !== null && salaryMin > 0) filters.salaryMin = salaryMin;

    const salaryMax = number(query.salaryMax);
    if (salaryMax !== null && salaryMax > 0) filters.salaryMax = salaryMax;

    if (flag(query.verified ?? query.verifiedOnly)) filters.verifiedOnly = true;

    if (query.company) filters.companyId = String(query.company).trim().slice(0, 64);
    if (query.companyName && !filters.companyId) {
        filters.companyName = String(query.companyName).trim().slice(0, 120);
    }

    return filters;
};

// @desc    Search job listings with natural language, filters and ranking
// @route   GET /api/jobs/search
// @access  Public (personalised when signed in)
const searchJobsHandler = async (req, res) => {
    try {
        const query = normalizeQuery(req.query);
        const q = String(query.q || query.keyword || "").slice(0, 300);
        const filters = readFilters(query);
        const boosts = {};

        // The AI read only ever adds to what the lexicon already found, and only
        // for a query the lexicon could not fully account for.
        let aiApplied = [];
        let textOverride;
        if (q && query.ai !== "off") {
            const parsed = parseQuery(q);
            if (hasUnresolvedIntent(parsed)) {
                const intent = await readIntent(q);
                const merged = mergeIntent(parsed, intent);
                for (const [key, value] of Object.entries(merged.filters)) {
                    if (filters[key] === undefined) filters[key] = value;
                }
                Object.assign(boosts, merged.boosts);
                aiApplied = merged.applied;

                // Once the AI has turned a phrase into filters, those words
                // must stop being search terms too. "Somewhere I can work from
                // home" is a work-model filter; left in the text query it would
                // also demand a posting containing the word "home".
                if (aiApplied.length > 0) textOverride = intent?.role || "";
            }
        }

        const sortParam = String(query.sort || "relevance").toLowerCase();

        const results = await searchJobs({
            q,
            filters,
            boosts,
            sort: SORTS.has(sortParam) ? sortParam : "relevance",
            page: number(query.page) || 1,
            limit: Math.min(MAX_LIMIT, number(query.limit) || DEFAULT_LIMIT),
            viewerId: req.user?._id || null,
            withFacets: query.facets !== "off",
            textOverride,
            // Filters the candidate read in the chips and dismissed.
            exclude: csv(query.exclude).slice(0, 30),
        });

        res.status(200).json({ ...results, aiApplied });
    } catch (error) {
        console.error("Job search failed:", error);
        res.status(500).json({ message: "Search is temporarily unavailable", error: error.message });
    }
};

// @desc    Autocomplete suggestions and a live reading of the query
// @route   GET /api/jobs/search/suggest
// @access  Public
const suggestHandler = async (req, res) => {
    try {
        const q = String(req.query.q || "").slice(0, 120);
        if (!q.trim()) {
            return res.status(200).json({ suggestions: [], interpreted: [] });
        }

        // The last word is what someone is still typing, so that is what gets
        // completed; everything before it is read for filters instead.
        const parsed = parseQuery(q);
        const fragment = q.trim().split(/\s+/).pop();

        const suggestions = await suggest(fragment, 8);

        res.status(200).json({
            suggestions,
            interpreted: parsed.interpreted,
            terms: parsed.terms,
        });
    } catch (error) {
        console.error("Suggest failed:", error);
        res.status(200).json({ suggestions: [], interpreted: [] });
    }
};

// @desc    The filter vocabularies, so the client never hardcodes a copy
// @route   GET /api/jobs/search/options
// @access  Public
const searchOptionsHandler = async (_req, res) => {
    const strip = (list) => list.map(({ key, label }) => ({ key, label }));

    res.status(200).json({
        workModels: strip(WORK_MODELS),
        employmentTypes: strip(EMPLOYMENT_TYPES),
        seniority: strip(SENIORITY_LEVELS),
        education: strip(EDUCATION_OPTIONS),
        companyStages: strip(COMPANY_STAGES),
        industries: strip(INDUSTRIES),
        datePosted: strip(DATE_WINDOWS),
        locations: PLACES.map((place) => ({ key: place.canonical, label: place.canonical, region: place.region })),
        sorts: [
            { key: "relevance", label: "Best match" },
            { key: "match", label: "My AI match score" },
            { key: "newest", label: "Newest first" },
            { key: "salary", label: "Highest paying" },
        ],
    });
};

module.exports = {
    searchJobsHandler,
    suggestHandler,
    searchOptionsHandler,
};
