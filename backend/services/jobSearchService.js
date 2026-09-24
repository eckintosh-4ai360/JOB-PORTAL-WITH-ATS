/**
 * Job search.
 *
 * Retrieval and ranking run in Postgres, in one pass, over a weighted
 * full-text document plus trigram similarity. Doing it in the database rather
 * than in Node is what lets the whole corpus be searched instead of the first
 * hundred rows that happened to be fetched, and what keeps filters, ranking,
 * facet counts and pagination consistent with each other.
 *
 * Three things combine to make a search find what a candidate meant:
 *
 *   1. Query parsing (utils/queryParser) pulls the filters out of the sentence,
 *      so "in Accra" becomes a location rather than three ranking tokens.
 *   2. Spell correction (services/searchVocabulary) repairs the words before
 *      they reach the ranking query, so a typo ranks like the word it meant.
 *   3. Semantic expansion (utils/searchLexicon) widens each role into the other
 *      titles that mean the same job, so "Software Engineer" finds "Backend
 *      Developer" without either posting containing the other's words.
 *
 * Ranking is a weighted sum, all terms normalised to 0..1, so every score is
 * explainable and a weight can be re-tuned without re-deriving anything.
 */

const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const { parseQuery, emptyFilters, emptyBoosts } = require("../utils/queryParser");
const { correctQuery } = require("./searchVocabulary");
const {
    PLACES,
    WORK_MODELS,
    EMPLOYMENT_TYPES,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
    COMPANY_STAGES,
    INDUSTRIES,
    DATE_WINDOWS,
    expandRole,
    normalize,
    contentTokens,
} = require("../utils/searchLexicon");

// ---------------------------------------------------------------------------
// Ranking weights
//
// They sum to 1 across the impersonal signals; personalisation is added on top
// so that turning it off cannot change the meaning of the other scores.
// ---------------------------------------------------------------------------

const WEIGHTS = {
    lexical: 0.36,      // weighted full-text rank on the words actually typed
    expansion: 0.08,    // a synonym of those words, worth less than the real thing
    strict: 0.13,       // every word of the query is present, not just some
    fuzzy: 0.11,        // trigram similarity, which survives a typo
    skills: 0.14,       // overlap with the skills named in the query
    industry: 0.05,     // the sector the query implied
    recency: 0.09,      // a fresh advert is a better answer than a stale one
    verified: 0.04,     // a reviewed employer, all else equal
    personal: 0.18,     // the signed-in candidate's own match score
};

/**
 * Where an expanded synonym is allowed to match: the title, tags and derived
 * skills, never the description.
 *
 * Expansion is a guess — the candidate typed "software engineer", not
 * "developer" — and a guess checked against a thousand words of prose finds
 * things it should not. English stemming makes this concrete: "developer" and
 * "develop" share a stem, so a nursing advert that says "develop patient care
 * plans" matches a search for software developers. Restricted to the title and
 * tags, an expansion only fires when the posting really is that kind of job.
 */
const EXPANSION_WEIGHTS = "'{a,b}'";

/** Half-life of the recency term, in days. */
const RECENCY_SCALE_DAYS = 30;

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 12;

// ---------------------------------------------------------------------------
// SQL fragments
// ---------------------------------------------------------------------------

/**
 * The searchable document for a posting: title and tags weighted highest, the
 * description lowest, so a match in the title outranks a passing mention.
 *
 * Postgres will not build an index on this expression directly. `array_to_string`
 * is only STABLE — in general an array's element type could have a non-immutable
 * output function — so the planner refuses it in an index. Wrapping it in a
 * function declared IMMUTABLE is the standard way out, and it is honest here
 * because every argument is text or text[], whose output is fixed.
 *
 * scripts/setupSearchIndexes.js creates the function and indexes it. The
 * inline form below stays as the fallback for a database where that script has
 * never been run: same document, same ranking, just without the index.
 */
const SEARCH_DOC_FUNCTION = "job_search_document";

const jobDocumentInline = (alias = "j.") => `(
    setweight(to_tsvector('english', coalesce(${alias}"title", '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(${alias}"tags", ' ')), 'A') ||
    setweight(to_tsvector('english', array_to_string(${alias}"searchSkills", ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(${alias}"location", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${alias}"category", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(${alias}"requirements", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(${alias}"description", '')), 'D')
)`;

/** The indexed form. Must match the index definition argument for argument. */
const jobDocumentIndexed = (alias = "j.") => `${SEARCH_DOC_FUNCTION}(
    ${alias}"title", ${alias}"tags", ${alias}"searchSkills",
    ${alias}"location", ${alias}"category", ${alias}"requirements", ${alias}"description"
)`;

/** Definition of that function, so the setup script and this file cannot drift. */
const SEARCH_DOC_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION ${SEARCH_DOC_FUNCTION}(
    title text,
    tags text[],
    skills text[],
    location text,
    category text,
    requirements text,
    description text
) RETURNS tsvector AS $func$
    SELECT setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'A') ||
           setweight(to_tsvector('english', coalesce(array_to_string(skills, ' '), '')), 'B') ||
           setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(category, '')), 'C') ||
           setweight(to_tsvector('english', coalesce(requirements, '')), 'C') ||
           setweight(to_tsvector('english', coalesce(description, '')), 'D')
$func$ LANGUAGE sql IMMUTABLE PARALLEL SAFE`;

/** Kept for callers that only need one form; the service picks per connection. */
const jobDocument = jobDocumentInline;

/** Whichever name the employer is known by. */
const COMPANY_NAME = `coalesce(c."name", u."companyName", u."name", '')`;

/** Live, publicly listable postings. Mirrors the rule in jobController. */
const BASE_PREDICATE = `j."isClosed" = false AND j."moderationState" <> 'hidden' AND j."deletedAt" IS NULL`;

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Does a free-text column contain this word?
 *
 * Matched on word boundaries rather than as a substring, because a substring
 * test on short words is catastrophic here: the technology pattern "it" is
 * inside "Remittance", "Hospitality" and "Recruitment", so every employer on
 * the board would be filed under technology.
 */
const containsWord = (expr, pattern) =>
    `${expr} ~* ${sqlString(`\\y${escapeRegex(pattern)}\\y`)}`;

/**
 * Build a CASE expression that buckets a free-text column into lexicon keys.
 *
 * Employers type "Fully remote", "Remote (Ghana)" and "WFH" into the same
 * field; every one of them has to land in the `remote` bucket or the facet
 * counts beside the filter will contradict the filter itself.
 */
const bucketCase = (expr, list, fallback = "NULL") => {
    const branches = list.map((item) => {
        const tests = item.patterns.map((pattern) => containsWord(expr, pattern)).join(" OR ");
        return `WHEN ${tests} THEN ${sqlString(item.key)}`;
    });
    return `CASE ${branches.join(" ")} ELSE ${fallback} END`;
};

/**
 * Work model needs its own bucketing: the field is often blank and the truth
 * is in the location ("Remote (Ghana)"), so both are consulted, and anything
 * that names neither is on-site by default.
 */
const WORK_MODEL_BUCKET = `CASE
    WHEN j."workModel" ILIKE '%remote%' OR j."location" ILIKE '%remote%' OR j."type" ILIKE '%remote%' THEN 'remote'
    WHEN j."workModel" ILIKE '%hybrid%' OR j."location" ILIKE '%hybrid%' THEN 'hybrid'
    ELSE 'onsite'
END`;

const EMPLOYMENT_BUCKET = bucketCase(
    `coalesce(j."type", j."jobType", '')`,
    // Narrower labels first: "part time" must not be claimed by a "time" rule,
    // and "national service" must not fall through to full-time.
    [
        EMPLOYMENT_TYPES.find((t) => t.key === "internship"),
        EMPLOYMENT_TYPES.find((t) => t.key === "temporary"),
        EMPLOYMENT_TYPES.find((t) => t.key === "volunteer"),
        EMPLOYMENT_TYPES.find((t) => t.key === "contract"),
        EMPLOYMENT_TYPES.find((t) => t.key === "part-time"),
        EMPLOYMENT_TYPES.find((t) => t.key === "full-time"),
    ].filter(Boolean),
    `'other'`
);

const STAGE_BUCKET = bucketCase(`coalesce(c."stage", '')`, COMPANY_STAGES);

/**
 * The order industries are tested in, which is not the order they are listed
 * in. Technology comes last on purpose: its patterns are the broadest ("data",
 * "engineering", "cloud"), so anything it would claim by accident — "Civil
 * Engineering", "Agricultural Data" — gets its proper sector first.
 */
const INDUSTRY_MATCH_ORDER = [
    "healthcare", "education", "agriculture", "energy", "construction",
    "transport", "hospitality", "finance", "government", "business",
    "sales", "technology",
];

const orderedIndustries = INDUSTRY_MATCH_ORDER
    .map((key) => INDUSTRIES.find((industry) => industry.key === key))
    .filter(Boolean);

/** Classify one free-text column into an industry key. */
const industryFrom = (expr, withCategoryKeys) => `CASE ${orderedIndustries.map((industry) => {
    const tests = [
        ...(withCategoryKeys
            ? industry.categories.map((category) => `lower(${expr}) = ${sqlString(category)}`)
            : []),
        ...industry.patterns.map((pattern) => containsWord(expr, pattern)),
    ].join(" OR ");
    return `WHEN ${tests} THEN ${sqlString(industry.key)}`;
}).join(" ")} ELSE NULL END`;

/**
 * A posting's sector.
 *
 * The job's own category is consulted first and the employer's industry only
 * as a fallback. They disagree more often than you would expect — a hospital
 * group registered as "Technology" still posts nursing roles — and when they
 * do, what the advert says about itself is the better answer.
 */
const INDUSTRY_BUCKET = `COALESCE(
    ${industryFrom(`coalesce(j."category", '')`, true)},
    ${industryFrom(`coalesce(c."industry", '')`, false)}
)`;

// ---------------------------------------------------------------------------
// tsquery construction
//
// Everything emitted here is drawn from [a-z0-9] lexemes joined by the tsquery
// operators, so a query string can never be malformed or injected.
// ---------------------------------------------------------------------------

const toLexeme = (word) => String(word || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** A phrase becomes an adjacency group: "data analyst" → (data <-> analyst). */
const phraseToTsQuery = (phrase) => {
    const words = String(phrase || "").split(/\s+/).map(toLexeme).filter(Boolean);
    if (words.length === 0) return null;
    if (words.length === 1) return words[0];
    return `(${words.join(" <-> ")})`;
};

const orTsQuery = (phrases) => {
    const parts = [...new Set(phrases.map(phraseToTsQuery).filter(Boolean))];
    return parts.length ? parts.join(" | ") : null;
};

const andTsQuery = (phrases) => {
    const parts = [...new Set(phrases.map(phraseToTsQuery).filter(Boolean))];
    return parts.length ? parts.join(" & ") : null;
};

/**
 * How many of the words a candidate typed a posting must actually contain.
 *
 * Matching on *any* of them is the wrong default, and cheap to demonstrate:
 * English stemming reduces "developer" and "develop" to one stem, so a nursing
 * advert that says "develop patient care plans" matches a search for "software
 * developer" on a single word, in the lowest-weight field, and lands in the
 * results next to the real thing.
 *
 * So short queries must match in full — "software developer" means both words.
 * Longer ones relax, because past three or four words a candidate is describing
 * a role rather than naming it, and demanding every word back would return
 * nothing at all.
 */
const requiredMatches = (groupCount) => {
    if (groupCount <= 2) return groupCount;
    if (groupCount === 3) return 2;
    return Math.ceil(groupCount * 0.6);
};

/**
 * Widen the role text into every phrase that means the same job.
 *
 * Both the whole phrase and its adjacent word pairs are looked up, so
 * "senior software engineer developer" still finds the software-engineer family
 * through the pair in the middle of it.
 */
const semanticExpansions = (terms) => {
    const phrases = new Set();
    const whole = terms.join(" ");

    const consider = (candidate) => {
        for (const sibling of expandRole(candidate)) phrases.add(sibling);
    };

    if (whole) consider(whole);
    for (const term of terms) consider(term);
    for (let i = 0; i < terms.length - 1; i += 1) consider(`${terms[i]} ${terms[i + 1]}`);
    for (let i = 0; i < terms.length - 2; i += 1) consider(`${terms[i]} ${terms[i + 1]} ${terms[i + 2]}`);

    return [...phrases];
};

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

let capabilities = null;

/**
 * What this particular database can do.
 *
 * Probed rather than assumed, so a database where scripts/setupSearchIndexes.js
 * has never been run still searches — without typo tolerance and without the
 * index, but without erroring either. Probed once per process.
 */
const loadCapabilities = async () => {
    if (capabilities !== null) return capabilities;

    const probe = async (sql) => {
        try {
            const rows = await prisma.$queryRawUnsafe(sql);
            return rows.length > 0;
        } catch (error) {
            console.warn("Search capability probe failed:", error.message);
            return false;
        }
    };

    const [trigram, indexedDoc] = await Promise.all([
        probe(`SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' LIMIT 1`),
        probe(`SELECT 1 FROM pg_proc WHERE proname = '${SEARCH_DOC_FUNCTION}' LIMIT 1`),
    ]);

    if (!trigram || !indexedDoc) {
        console.warn(
            `Job search is running degraded (typo tolerance: ${trigram ? "on" : "off"}, ` +
            `indexed document: ${indexedDoc ? "on" : "off"}). ` +
            "Run `npm run search:setup` in backend/ to enable both."
        );
    }

    capabilities = { trigram, indexedDoc };
    return capabilities;
};

// ---------------------------------------------------------------------------
// Parameter accumulator
// ---------------------------------------------------------------------------

const makeParams = () => {
    const values = [];
    return {
        values,
        add(value) {
            values.push(value);
            return `$${values.length}`;
        },
    };
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const lookup = (list, key) => list.find((item) => item.key === key);

/** Every spelling of a place, so a stored "Accra, Greater Accra" still matches. */
const locationPatterns = (location) => {
    const wanted = normalize(location);
    if (!wanted) return [];

    const place = PLACES.find(
        (candidate) =>
            normalize(candidate.canonical) === wanted ||
            candidate.aliases.some((alias) => normalize(alias) === wanted) ||
            normalize(candidate.region) === wanted
    );

    const terms = place
        ? [place.canonical, place.region, ...place.aliases]
        : [location];

    return [...new Set(terms.map((term) => `%${normalize(term)}%`))];
};

/**
 * Translate the filter set into SQL predicates.
 *
 * Returns one clause per active filter, keyed by filter name, so a zero-result
 * search can re-run the query with any single clause removed and tell the
 * candidate which filter is the one costing them the results.
 */
const buildFilterClauses = (filters, p) => {
    const clauses = {};

    if (filters.location) {
        const patterns = locationPatterns(filters.location);
        if (patterns.length) {
            // A remote posting is reachable from anywhere, so a place filter
            // must not hide it — someone in Tamale searching "Accra" is telling
            // us where they are, not that they refuse to work remotely.
            clauses.location = `(j."location" ILIKE ANY(${p.add(patterns)}::text[]) OR ${WORK_MODEL_BUCKET} = 'remote')`;
        }
    }

    if (filters.workModels?.length) {
        clauses.workModels = `${WORK_MODEL_BUCKET} = ANY(${p.add(filters.workModels)}::text[])`;
    }

    if (filters.employmentTypes?.length) {
        clauses.employmentTypes = `${EMPLOYMENT_BUCKET} = ANY(${p.add(filters.employmentTypes)}::text[])`;
    }

    if (filters.seniority?.length) {
        // Strict, including against postings whose level could not be derived.
        // The count shown beside this filter comes from the same expression, and
        // a filter that returns more than its own count promised is worse than
        // one that occasionally misses an advert that never stated its level.
        clauses.seniority = `j."seniority" = ANY(${p.add(filters.seniority)}::text[])`;
    }

    if (filters.education) {
        // "My highest qualification is X" — so show what X qualifies for, not
        // only the adverts that demand exactly X.
        const level = lookup(EDUCATION_OPTIONS, filters.education);
        const allowed = EDUCATION_OPTIONS.filter((option) => option.rank <= (level?.rank ?? 0)).map((o) => o.key);
        clauses.education = `(j."educationLevel" IS NULL OR j."educationLevel" = ANY(${p.add(allowed)}::text[]))`;
    }

    if (filters.industries?.length) {
        clauses.industries = `${INDUSTRY_BUCKET} = ANY(${p.add(filters.industries)}::text[])`;
    }

    if (filters.companyStages?.length) {
        clauses.companyStages = `${STAGE_BUCKET} = ANY(${p.add(filters.companyStages)}::text[])`;
    }

    if (filters.skills?.length) {
        clauses.skills = `j."searchSkills" && ${p.add(filters.skills)}::text[]`;
    }

    if (filters.companyId) {
        const id = p.add(filters.companyId);
        clauses.company = `(j."companyId" = ${id} OR j."companyProfileId" = ${id})`;
    } else if (filters.companyName) {
        clauses.company = `${COMPANY_NAME} ILIKE ${p.add(`%${filters.companyName}%`)}`;
    }

    if (Number.isFinite(filters.salaryMin)) {
        // Compared against the top of the advertised band: a job paying
        // "GH₵4,000 – 9,000" does answer a search for GH₵8,000+.
        clauses.salaryMin = `coalesce(j."salaryMax", j."salaryMin") >= ${p.add(filters.salaryMin)}`;
    }

    if (Number.isFinite(filters.salaryMax)) {
        clauses.salaryMax = `coalesce(j."salaryMin", j."salaryMax") <= ${p.add(filters.salaryMax)}`;
    }

    if (filters.datePosted) {
        const window = lookup(DATE_WINDOWS, filters.datePosted);
        if (window) {
            clauses.datePosted = `j."createdAt" >= now() - make_interval(days => ${p.add(window.days)}::int)`;
        }
    }

    if (filters.verifiedOnly) {
        clauses.verifiedOnly = `c."verified" = true`;
    }

    return clauses;
};

// ---------------------------------------------------------------------------
// Query assembly
// ---------------------------------------------------------------------------

/**
 * Everything the SQL needs, derived once so the results query, the count and
 * the facet query all rank and filter identically.
 */
/**
 * Drop the filters a candidate has dismissed.
 *
 * A chip read out of the sentence cannot be removed by clearing a URL
 * parameter, because there is no parameter — the words are the filter, and the
 * next search would read them again. So a dismissal is recorded explicitly, and
 * subtracted here from what the parser produced.
 *
 * Only the parse is affected. A filter the candidate then ticks in the rail is
 * an explicit choice and still wins, and the dismissed words go on contributing
 * to relevance — "stop filtering on this" is not "pretend I never typed it".
 */
const applyExclusions = (parsed, exclude) => {
    if (!exclude || exclude.size === 0) return parsed;

    // Compared case-insensitively: a place key is capitalised ("Accra") while
    // every other key is lower case, and a dismissal arriving over the query
    // string should match either way.
    const dismissed = new Set([...exclude].map((entry) => String(entry).toLowerCase()));
    const keep = (type, value) => !dismissed.has(`${type}:${value}`.toLowerCase());
    const filters = { ...parsed.filters };
    const boosts = { ...parsed.boosts };

    if (filters.location && !keep("location", filters.location)) filters.location = null;
    if (filters.education && !keep("education", filters.education)) filters.education = null;
    if (filters.datePosted && !keep("datePosted", filters.datePosted)) filters.datePosted = null;
    if (filters.verifiedOnly && !keep("verified", "verified")) filters.verifiedOnly = false;
    if (!keep("salary", "salary")) {
        filters.salaryMin = null;
        filters.salaryMax = null;
    }

    filters.workModels = filters.workModels.filter((value) => keep("workModel", value));
    filters.employmentTypes = filters.employmentTypes.filter((value) => keep("employmentType", value));
    filters.seniority = filters.seniority.filter((value) => keep("seniority", value));
    filters.companyStages = filters.companyStages.filter((value) => keep("companyStage", value));
    filters.industries = filters.industries.filter((value) => keep("industry", value));
    filters.skills = filters.skills.filter((value) => keep("skill", value));

    boosts.skills = (boosts.skills || []).filter((value) => keep("skill", value));
    boosts.industries = (boosts.industries || []).filter((value) => keep("industry", value));

    return {
        ...parsed,
        filters,
        boosts,
        interpreted: parsed.interpreted.filter((chip) => keep(chip.type, chip.value)),
    };
};

const prepare = async ({ q, filters, boosts, viewerId, textOverride, exclude }) => {
    const parsed = applyExclusions(parseQuery(q || ""), exclude);

    /**
     * The words that describe the role, as opposed to the criteria around it.
     *
     * Normally these are whatever the parser could not account for. When the AI
     * intent pass has read the sentence, though, it hands back the role it
     * found and `textOverride` replaces them — because the words it turned into
     * filters ("from my house a few days a week") are still sitting in the
     * residual, and requiring a posting to contain them would rule out every
     * job on the board. An empty override means the sentence was all criteria
     * and there is no role text to match at all.
     */
    const roleTerms = textOverride === undefined || textOverride === null
        ? parsed.terms
        : contentTokens(textOverride);
    const rolePhrase = roleTerms.join(" ");

    // Filters passed explicitly always win over ones read out of the sentence:
    // the candidate touched a control, which is a clearer statement of intent
    // than a phrase we inferred.
    const merged = { ...emptyFilters(), ...parsed.filters };
    for (const [key, value] of Object.entries(filters || {})) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        merged[key] = value;
    }
    merged.companyId = filters?.companyId || null;
    merged.companyName = filters?.companyName || null;

    const mergedBoosts = { ...emptyBoosts(), ...parsed.boosts };
    for (const [key, value] of Object.entries(boosts || {})) {
        if (Array.isArray(value) && value.length) {
            mergedBoosts[key] = [...new Set([...(mergedBoosts[key] || []), ...value])];
        }
    }

    // Skills chosen in the filter rail are a filter; skills read out of the
    // sentence only rank. Either way they should raise the jobs that have them.
    const rankingSkills = [...new Set([...(mergedBoosts.skills || []), ...(merged.skills || [])])];

    const caps = await loadCapabilities();
    const spelling = await correctQuery(roleTerms);
    const expansions = semanticExpansions(spelling.terms);

    // One group per word the candidate typed, each holding that word and its
    // correction if we made one — so a misspelling and its repair count as the
    // single word they are, not as two separate requirements.
    const termGroups = roleTerms
        .map((term) => {
            const fix = spelling.corrections.find((correction) => correction.from === term);
            return orTsQuery(fix ? [term, fix.to] : [term]);
        })
        .filter(Boolean);

    // Used for ranking, where partial credit is the point: a posting matching
    // one of two words should still score, it just should not qualify.
    const recall = orTsQuery([...spelling.terms, ...rankingSkills]);
    // Synonyms search only the title and tags — see EXPANSION_WEIGHTS.
    const recallExpanded = orTsQuery(expansions);

    // The strict test uses the best guess at what was meant — a corrected word
    // where we corrected one, the original everywhere else.
    const strictTerms = roleTerms.map((term) => {
        const fix = spelling.corrections.find((correction) => correction.from === term);
        return fix ? fix.to : term;
    });
    const strict = andTsQuery(strictTerms);
    const exact = andTsQuery(parsed.exactPhrases);

    return {
        parsed,
        filters: merged,
        boosts: mergedBoosts,
        rankingSkills,
        spelling,
        expansions,
        recall,
        recallExpanded,
        termGroups,
        requiredMatches: requiredMatches(termGroups.length),
        strict,
        exact,
        phrase: rolePhrase,
        terms: roleTerms,
        viewerId: viewerId || null,
        trigram: caps.trigram,
        // Chosen once per search so every query in it ranks over the same
        // document — the ranking query, the facet counts and the relaxation
        // counts must not disagree about what "matching" means.
        doc: caps.indexedDoc ? jobDocumentIndexed() : jobDocumentInline(),
    };
};

/** The FROM/JOIN block, shared by every query in a search. */
const fromClause = (ctx, p) => {
    const personal = ctx.viewerId
        ? `LEFT JOIN "JobMatch" m ON m."jobId" = j."id" AND m."userId" = ${p.add(ctx.viewerId)}`
        : "";
    return `FROM "Job" j
        LEFT JOIN "Company" c ON c."id" = j."companyProfileId"
        LEFT JOIN "User" u ON u."id" = j."companyId"
        ${personal}`;
};

/**
 * The WHERE block.
 *
 * @param {object} ctx        prepared search context
 * @param {object} p          parameter accumulator
 * @param {string|null} skip  name of one filter to leave out, for relaxation
 */
const whereClause = (ctx, p, skip = null) => {
    const parts = [BASE_PREDICATE];

    const clauses = buildFilterClauses(ctx.filters, p);
    for (const [name, clause] of Object.entries(clauses)) {
        if (name !== skip) parts.push(clause);
    }

    if (ctx.exact) {
        parts.push(`${ctx.doc} @@ to_tsquery('english', ${p.add(ctx.exact)})`);
    }

    if ((ctx.termGroups.length || ctx.recallExpanded) && skip !== "query") {
        const alternatives = [];

        if (ctx.termGroups.length) {
            // Counted rather than AND-ed, so the threshold can sit anywhere
            // between "any word" and "every word" as the query gets longer.
            const matched = ctx.termGroups
                .map((group) => `(CASE WHEN ${ctx.doc} @@ to_tsquery('english', ${p.add(group)}) THEN 1 ELSE 0 END)`)
                .join(" + ");
            alternatives.push(`(${matched}) >= ${ctx.requiredMatches}`);
        }
        if (ctx.recallExpanded) {
            alternatives.push(
                `ts_filter(${ctx.doc}, ${EXPANSION_WEIGHTS}) @@ to_tsquery('english', ${p.add(ctx.recallExpanded)})`
            );
        }

        if (ctx.trigram && ctx.phrase) {
            const phrase = p.add(ctx.phrase);
            alternatives.push(`similarity(j."title", ${phrase}) > 0.28`);
            alternatives.push(`word_similarity(${phrase}, j."title") > 0.5`);
            alternatives.push(`similarity(${COMPANY_NAME}, ${phrase}) > 0.32`);
        }

        if (ctx.rankingSkills.length) {
            alternatives.push(`j."searchSkills" && ${p.add(ctx.rankingSkills)}::text[]`);
        }

        parts.push(`(${alternatives.join(" OR ")})`);
    }

    return parts.join("\n        AND ");
};

/** The scoring expression, and the component columns behind it. */
const scoreColumns = (ctx, p) => {
    const lexical = ctx.recall
        ? `coalesce(ts_rank_cd(${ctx.doc}, to_tsquery('english', ${p.add(ctx.recall)}), 32), 0)`
        : `0::float`;

    const expansion = ctx.recallExpanded
        ? `coalesce(ts_rank_cd(ts_filter(${ctx.doc}, ${EXPANSION_WEIGHTS}), to_tsquery('english', ${p.add(ctx.recallExpanded)}), 32), 0)`
        : `0::float`;

    const strict = ctx.strict
        ? `(CASE WHEN ${ctx.doc} @@ to_tsquery('english', ${p.add(ctx.strict)}) THEN 1 ELSE 0 END)::float`
        : `0::float`;

    let fuzzy = `0::float`;
    if (ctx.trigram && ctx.phrase) {
        const phrase = p.add(ctx.phrase);
        fuzzy = `GREATEST(
            similarity(j."title", ${phrase}),
            word_similarity(${phrase}, j."title"),
            similarity(${COMPANY_NAME}, ${phrase})
        )::float`;
    }

    let skills = `0::float`;
    if (ctx.rankingSkills.length) {
        const wanted = p.add(ctx.rankingSkills);
        skills = `(
            cardinality(ARRAY(SELECT unnest(j."searchSkills") INTERSECT SELECT unnest(${wanted}::text[])))::float
            / GREATEST(cardinality(${wanted}::text[]), 1)
        )`;
    }

    const industries = ctx.boosts.industries || [];
    const industry = industries.length
        ? `(CASE WHEN ${INDUSTRY_BUCKET} = ANY(${p.add(industries)}::text[]) THEN 1 ELSE 0 END)::float`
        : `0::float`;

    const recency = `exp(- GREATEST(EXTRACT(EPOCH FROM (now() - j."createdAt")) / 86400.0, 0) / ${RECENCY_SCALE_DAYS}.0)`;
    const verified = `(CASE WHEN c."verified" THEN 1 ELSE 0 END)::float`;
    const personal = ctx.viewerId ? `(coalesce(m."matchScore", 0) / 100.0)::float` : `0::float`;

    const score = [
        `${WEIGHTS.lexical} * (${lexical})`,
        `${WEIGHTS.expansion} * (${expansion})`,
        `${WEIGHTS.strict} * (${strict})`,
        `${WEIGHTS.fuzzy} * (${fuzzy})`,
        `${WEIGHTS.skills} * (${skills})`,
        `${WEIGHTS.industry} * (${industry})`,
        `${WEIGHTS.recency} * (${recency})`,
        `${WEIGHTS.verified} * (${verified})`,
        `${WEIGHTS.personal} * (${personal})`,
    ].join(" + ");

    return { lexical, expansion, strict, fuzzy, skills, industry, recency, verified, personal, score };
};

const ORDERINGS = {
    relevance: `score DESC, "createdAt" DESC`,
    newest: `"createdAt" DESC`,
    oldest: `"createdAt" ASC`,
    salary: `coalesce("salaryMax", "salaryMin") DESC NULLS LAST, "createdAt" DESC`,
    match: `personal DESC, score DESC, "createdAt" DESC`,
};

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

const FACET_BUCKETS = [
    ["workModel", WORK_MODEL_BUCKET],
    ["employmentType", EMPLOYMENT_BUCKET],
    ["seniority", `j."seniority"`],
    ["education", `j."educationLevel"`],
    ["industry", INDUSTRY_BUCKET],
    ["companyStage", STAGE_BUCKET],
    ["verified", `CASE WHEN c."verified" THEN 'verified' ELSE 'unverified' END`],
    ["company", COMPANY_NAME],
];

/**
 * Counts for every filter value, over the jobs the current search matched.
 *
 * Shown next to each filter so the rail stops being a guess: a candidate can
 * see that "Remote" holds 14 of the 62 results before spending a click on it.
 */
const loadFacets = async (ctx) => {
    const p = makeParams();
    const from = fromClause(ctx, p);
    const where = whereClause(ctx, p);

    // Every branch casts to text: a UNION whose first branch selects an
    // untyped literal cannot always resolve a common type on its own.
    const buckets = FACET_BUCKETS.map(
        ([name, expr]) => `SELECT ${sqlString(name)}::text AS facet, (${expr})::text AS value, count(*)::int AS count
            FROM matched j
            LEFT JOIN "Company" c ON c."id" = j."companyProfileId"
            LEFT JOIN "User" u ON u."id" = j."companyId"
            WHERE (${expr}) IS NOT NULL AND (${expr})::text <> ''
            GROUP BY 2`
    );

    // Skills are an array column, so they are counted by unnesting rather than
    // grouping — and capped, because the long tail is noise in a filter list.
    // Parenthesised because a UNION branch cannot carry its own ORDER BY/LIMIT.
    const skillBucket = `(
        SELECT 'skill'::text AS facet, skill::text AS value, count(*)::int AS count
        FROM matched j, unnest(j."searchSkills") AS skill
        GROUP BY 2
        ORDER BY 3 DESC
        LIMIT 30
    )`;

    const sql = `
        WITH matched AS (
            SELECT j.* ${from} WHERE ${where}
        )
        ${[...buckets, skillBucket].join("\n        UNION ALL\n        ")}
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...p.values);

    const facets = {};
    for (const row of rows) {
        if (!row.value) continue;
        if (!facets[row.facet]) facets[row.facet] = [];
        facets[row.facet].push({ value: String(row.value), count: Number(row.count) });
    }

    for (const list of Object.values(facets)) {
        list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }

    // Company and skill lists are open-ended; the rest are closed vocabularies
    // whose order should follow the lexicon, not the counts.
    const order = {
        workModel: WORK_MODELS,
        employmentType: EMPLOYMENT_TYPES,
        seniority: SENIORITY_LEVELS,
        education: EDUCATION_OPTIONS,
        industry: INDUSTRIES,
        companyStage: COMPANY_STAGES,
    };
    for (const [facet, list] of Object.entries(order)) {
        if (!facets[facet]) continue;
        const rank = new Map(list.map((item, index) => [item.key, index]));
        facets[facet].sort((a, b) => (rank.get(a.value) ?? 99) - (rank.get(b.value) ?? 99));
        for (const entry of facets[facet]) {
            entry.label = list.find((item) => item.key === entry.value)?.label || entry.value;
        }
    }

    if (facets.company) facets.company = facets.company.slice(0, 20);

    return facets;
};

/**
 * When a search finds nothing, work out which filter is responsible.
 *
 * Re-runs the count with each active filter dropped in turn, so the empty state
 * can say "12 jobs match if you allow On-site" instead of shrugging. Only worth
 * doing on an empty result, which is exactly when the extra queries are cheap.
 */
const findRelaxations = async (ctx) => {
    const p0 = makeParams();
    const active = Object.keys(buildFilterClauses(ctx.filters, p0));
    const candidates = ctx.termGroups.length || ctx.recallExpanded ? [...active, "query"] : active;
    if (candidates.length === 0 || candidates.length > 8) return [];

    const results = await Promise.all(
        candidates.map(async (name) => {
            const p = makeParams();
            const sql = `SELECT count(*)::int AS count ${fromClause(ctx, p)} WHERE ${whereClause(ctx, p, name)}`;
            try {
                const rows = await prisma.$queryRawUnsafe(sql, ...p.values);
                return { filter: name, count: Number(rows[0]?.count || 0) };
            } catch (error) {
                console.warn(`Relaxation count failed for ${name}:`, error.message);
                return { filter: name, count: 0 };
            }
        })
    );

    return results.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count);
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run a search.
 *
 * @param {object} options
 * @param {string} [options.q]           the natural-language query
 * @param {object} [options.filters]     explicit filters, which override parsed ones
 * @param {object} [options.boosts]      explicit ranking hints
 * @param {string} [options.sort]        relevance | newest | oldest | salary | match
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {string} [options.viewerId]    signed-in candidate, for personalisation
 * @param {boolean} [options.withFacets]
 * @returns {Promise<object>} jobs, paging, the interpreted query, and facets
 */
const searchJobs = async ({
    q = "",
    filters = {},
    boosts = {},
    sort = "relevance",
    page = 1,
    limit = DEFAULT_LIMIT,
    viewerId = null,
    withFacets = true,
    textOverride,
    exclude = [],
} = {}) => {
    const ctx = await prepare({
        q,
        filters,
        boosts,
        viewerId,
        textOverride,
        exclude: new Set(exclude),
    });

    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    const ordering = ORDERINGS[sort] || ORDERINGS.relevance;

    const p = makeParams();
    const from = fromClause(ctx, p);
    const scores = scoreColumns(ctx, p);
    const where = whereClause(ctx, p);

    const sql = `
        SELECT * FROM (
            SELECT
                j."id" AS id,
                j."createdAt" AS "createdAt",
                j."salaryMin" AS "salaryMin",
                j."salaryMax" AS "salaryMax",
                (${scores.score}) AS score,
                (${scores.lexical}) AS lexical,
                (${scores.fuzzy}) AS fuzzy,
                (${scores.personal}) AS personal,
                (count(*) OVER ())::int AS total
            ${from}
            WHERE ${where}
        ) ranked
        ORDER BY ${ordering}
        LIMIT ${p.add(safeLimit)} OFFSET ${p.add(offset)}
    `;

    // Facet counts depend on the filters, not on the ranking, so the two go out
    // together rather than one after the other. Against a remote database that
    // is a whole round trip saved on every keystroke. The catch is attached
    // here, not at the await, so an early rejection is never unhandled.
    const facetsPromise = withFacets
        ? loadFacets(ctx).catch((error) => {
            // Facet counts are decoration; results are the product.
            console.warn("Facet counts failed:", error.message);
            return {};
        })
        : Promise.resolve({});

    const ranked = await prisma.$queryRawUnsafe(sql, ...p.values);
    const total = ranked.length ? Number(ranked[0].total) : 0;

    const [hydrated, facets, relaxations] = await Promise.all([
        hydrate(ranked),
        facetsPromise,
        // Only worth asking what went wrong when nothing came back.
        total === 0 ? findRelaxations(ctx).catch(() => []) : Promise.resolve([]),
    ]);

    return {
        jobs: hydrated,
        total,
        page: safePage,
        pages: Math.max(1, Math.ceil(total / safeLimit)),
        limit: safeLimit,
        sort: ORDERINGS[sort] ? sort : "relevance",
        interpreted: ctx.parsed.interpreted,
        filters: ctx.filters,
        boosts: ctx.boosts,
        terms: ctx.terms,
        didYouMean: ctx.spelling.corrected,
        corrections: ctx.spelling.corrections,
        expandedWith: ctx.expansions.slice(0, 12),
        typoTolerance: ctx.trigram,
        facets,
        relaxations,
    };
};

/**
 * Turn ranked ids into full job records.
 *
 * Done through Prisma rather than by widening the ranking query: the relations
 * and the client shape are already defined there, and the ranking query should
 * stay a ranking query.
 */
const hydrate = async (ranked) => {
    if (ranked.length === 0) return [];

    const ids = ranked.map((row) => row.id);
    const jobs = await prisma.job.findMany({
        where: { id: { in: ids } },
        include: {
            company: {
                select: { id: true, name: true, companyName: true, companyLogo: true, companyDescription: true },
            },
            companyProfile: {
                select: {
                    id: true, name: true, logo: true, industry: true, stage: true,
                    employees: true, hq: true, verified: true, website: true,
                },
            },
        },
    });

    const byId = new Map(jobs.map((job) => [job.id, job]));

    return ranked
        .map((row) => {
            const job = byId.get(row.id);
            if (!job) return null;

            const client = toClient(job);
            const companyName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Hiring Company";
            const companyLogo = job.companyProfile?.logo || job.companyLogo || job.company?.companyLogo || "";

            client.companyName = companyName;
            client.companyLogo = companyLogo;
            client.company = { ...(client.company || {}), companyName, companyLogo };
            client.verified = Boolean(job.companyProfile?.verified);
            client.companyStage = job.companyProfile?.stage || null;
            client.companyIndustry = job.companyProfile?.industry || null;

            // Kept on the record so a "why am I seeing this?" panel, or anyone
            // debugging a ranking complaint, has the numbers to hand.
            client.relevance = {
                score: Number(row.score) || 0,
                lexical: Number(row.lexical) || 0,
                fuzzy: Number(row.fuzzy) || 0,
                personal: Number(row.personal) || 0,
            };

            return client;
        })
        .filter(Boolean);
};

module.exports = {
    searchJobs,
    // Shared with salary insights, so a salary figure for "Accra" or "Hybrid"
    // is drawn from the same adverts job search files under that label.
    makeParams,
    locationPatterns,
    WORK_MODEL_BUCKET,
    INDUSTRY_BUCKET,
    jobDocument,
    jobDocumentIndexed,
    EXPANSION_WEIGHTS,
    SEARCH_DOC_FUNCTION_SQL,
    SEARCH_DOC_FUNCTION,
    WEIGHTS,
    MAX_LIMIT,
    DEFAULT_LIMIT,
};
