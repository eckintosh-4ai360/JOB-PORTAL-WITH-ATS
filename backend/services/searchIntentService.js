/**
 * AI refinement of a search query.
 *
 * The deterministic parser (utils/queryParser) handles the overwhelming
 * majority of searches, and handles them instantly. This exists for the rest:
 * the phrasings a lexicon cannot anticipate — "somewhere I can work from home
 * three days a week", "a young company that just raised money", "roles that pay
 * better than teaching".
 *
 * Three rules keep it from making search worse:
 *
 *   1. It never blocks. The deterministic result is already complete; this runs
 *      against a short timeout and anything slower is simply dropped.
 *   2. It never overrides. It may only fill slots the parser left empty, so a
 *      model hallucinating "Kumasi" cannot move a search the candidate
 *      explicitly pointed at Accra.
 *   3. It never invents vocabulary. Every value is checked against the lexicon
 *      and discarded if it is not a key the rest of the system already knows.
 *
 * Results are cached by query text, because the same phrasings recur and a
 * search box should not bill a model call for every keystroke.
 */

const { chatJson, isConfigured } = require("../utils/groqClient");
const { normalize } = require("../utils/searchLexicon");
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

/** Long enough that a slow model is dropped, short enough not to be felt. */
const TIMEOUT_MS = Number(process.env.SEARCH_INTENT_TIMEOUT_MS || 3500);
const CACHE_TTL_MS = Number(process.env.SEARCH_INTENT_TTL_MS || 60 * 60 * 1000);
const CACHE_MAX = Number(process.env.SEARCH_INTENT_CACHE_MAX || 500);

const cache = new Map();

const keysOf = (list) => list.map((item) => item.key);

const VALID = {
    workModels: new Set(keysOf(WORK_MODELS)),
    employmentTypes: new Set(keysOf(EMPLOYMENT_TYPES)),
    seniority: new Set(keysOf(SENIORITY_LEVELS)),
    education: new Set(keysOf(EDUCATION_OPTIONS)),
    companyStages: new Set(keysOf(COMPANY_STAGES)),
    industries: new Set(keysOf(INDUSTRIES)),
    datePosted: new Set(keysOf(DATE_WINDOWS)),
    locations: new Set(PLACES.map((place) => place.canonical)),
};

const SCHEMA_HINT = `{
  "role": "the job title being searched for, or null",
  "skills": ["specific tools, technologies or competencies named"],
  "location": "one of: ${[...VALID.locations].join(", ")} — or null",
  "workModels": ["any of: ${[...VALID.workModels].join(", ")}"],
  "employmentTypes": ["any of: ${[...VALID.employmentTypes].join(", ")}"],
  "seniority": ["any of: ${[...VALID.seniority].join(", ")}"],
  "education": "one of: ${[...VALID.education].join(", ")} — or null",
  "industries": ["any of: ${[...VALID.industries].join(", ")}"],
  "companyStages": ["any of: ${[...VALID.companyStages].join(", ")}"],
  "salaryMin": "monthly floor in Ghana cedis as a number, or null",
  "salaryMax": "monthly ceiling in Ghana cedis as a number, or null",
  "datePosted": "one of: ${[...VALID.datePosted].join(", ")} — or null",
  "verifiedOnly": "true only if the candidate asked for verified employers"
}`;

const SYSTEM_PROMPT = `You read a job seeker's search query and extract the criteria in it.

This is a Ghanaian job board covering every sector — healthcare, education, trades, hospitality, agriculture, finance and technology alike. Do not assume a query is about technology.

Rules:
- Extract only what the query states or clearly implies. Leave a field null or empty rather than guessing.
- Salaries are monthly figures in Ghana cedis. Convert an annual figure by dividing by 12.
- "Series A", "seed", "scale-up" and similar describe the employer's funding stage, not the role.
- Use only the exact values listed for each field. Never invent a new one.
- "role" is the job title alone, with seniority, location and skills stripped out.`;

/** Cap the cache and drop what expired, so a long-running process stays flat. */
const remember = (key, value) => {
    cache.set(key, { value, at: Date.now() });
    if (cache.size <= CACHE_MAX) return;

    const now = Date.now();
    for (const [entryKey, entry] of cache) {
        if (now - entry.at > CACHE_TTL_MS) cache.delete(entryKey);
    }
    while (cache.size > CACHE_MAX) {
        // Map iterates in insertion order, so this drops the oldest.
        cache.delete(cache.keys().next().value);
    }
};

const recall = (key) => {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.at > CACHE_TTL_MS) {
        cache.delete(key);
        return undefined;
    }
    return entry.value;
};

const cleanList = (value, allowed) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .map((item) => normalize(item))
            .filter((item) => allowed.has(item))
    )];
};

const cleanOne = (value, allowed) => {
    const cleaned = normalize(value);
    return allowed.has(cleaned) ? cleaned : null;
};

const cleanAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
    return Math.round(amount);
};

/** Keep only values the rest of the system already understands. */
const sanitize = (raw) => {
    if (!raw || typeof raw !== "object") return null;

    const location = PLACES.find(
        (place) => normalize(place.canonical) === normalize(raw.location)
    );

    return {
        role: typeof raw.role === "string" ? normalize(raw.role).slice(0, 80) || null : null,
        skills: Array.isArray(raw.skills)
            ? [...new Set(raw.skills.map((skill) => normalize(skill)).filter((skill) => skill.length > 1 && skill.length < 40))].slice(0, 10)
            : [],
        location: location ? location.canonical : null,
        workModels: cleanList(raw.workModels, VALID.workModels),
        employmentTypes: cleanList(raw.employmentTypes, VALID.employmentTypes),
        seniority: cleanList(raw.seniority, VALID.seniority),
        education: cleanOne(raw.education, VALID.education),
        industries: cleanList(raw.industries, VALID.industries),
        companyStages: cleanList(raw.companyStages, VALID.companyStages),
        salaryMin: cleanAmount(raw.salaryMin),
        salaryMax: cleanAmount(raw.salaryMax),
        datePosted: cleanOne(raw.datePosted, VALID.datePosted),
        verifiedOnly: raw.verifiedOnly === true,
    };
};

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            const timer = setTimeout(() => reject(new Error("search intent timed out")), ms);
            if (typeof timer.unref === "function") timer.unref();
        }),
    ]);

/**
 * Read a query with the model.
 *
 * @param {string} query
 * @returns {Promise<object|null>} sanitised criteria, or null if unavailable
 */
const readIntent = async (query) => {
    const text = String(query || "").trim();
    if (!text || text.length < 8) return null;
    if (process.env.SEARCH_AI_INTENT_DISABLED === "true") return null;
    if (!isConfigured()) return null;

    const key = normalize(text);
    const cached = recall(key);
    if (cached !== undefined) return cached;

    try {
        const { data } = await withTimeout(
            chatJson({
                system: SYSTEM_PROMPT,
                user: `Search query: ${text}`,
                schemaHint: SCHEMA_HINT,
                temperature: 0,
                maxTokens: 700,
                reasoningEffort: "low",
            }),
            TIMEOUT_MS
        );

        const result = sanitize(data);
        remember(key, result);
        return result;
    } catch (error) {
        // A failed read is not a failed search — the deterministic parse stands.
        console.warn("Search intent read failed:", error.message);
        remember(key, null);
        return null;
    }
};

/**
 * Fill the gaps the deterministic parser left, and only those.
 *
 * @param {object} parsed  output of utils/queryParser
 * @param {object|null} intent  output of readIntent
 * @returns {{filters: object, boosts: object, applied: string[]}} additions only
 */
const mergeIntent = (parsed, intent) => {
    const filters = {};
    const boosts = {};
    const applied = [];

    if (!intent) return { filters, boosts, applied };

    const fillOne = (field, value) => {
        if (!value || parsed.filters[field]) return;
        filters[field] = value;
        applied.push(field);
    };

    const fillList = (field, values) => {
        if (!values?.length || parsed.filters[field]?.length) return;
        filters[field] = values;
        applied.push(field);
    };

    fillOne("location", intent.location);
    fillOne("education", intent.education);
    fillOne("datePosted", intent.datePosted);
    fillList("workModels", intent.workModels);
    fillList("employmentTypes", intent.employmentTypes);
    fillList("seniority", intent.seniority);
    fillList("companyStages", intent.companyStages);

    if (intent.salaryMin && !parsed.filters.salaryMin) {
        filters.salaryMin = intent.salaryMin;
        applied.push("salaryMin");
    }
    if (intent.salaryMax && !parsed.filters.salaryMax) {
        filters.salaryMax = intent.salaryMax;
        applied.push("salaryMax");
    }
    if (intent.verifiedOnly && !parsed.filters.verifiedOnly) {
        filters.verifiedOnly = true;
        applied.push("verifiedOnly");
    }

    // Skills and industries only ever rank, on the AI path as on the
    // deterministic one — an inferred sector must not delete results.
    if (intent.skills?.length) {
        boosts.skills = intent.skills;
        applied.push("skills");
    }
    if (intent.industries?.length) {
        boosts.industries = intent.industries;
        applied.push("industries");
    }

    return { filters, boosts, applied };
};

/** Test/ops helper. */
const resetIntentCache = () => cache.clear();

module.exports = {
    readIntent,
    mergeIntent,
    sanitize,
    resetIntentCache,
};
