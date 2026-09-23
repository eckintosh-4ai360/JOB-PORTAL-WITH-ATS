/**
 * Natural-language search query parser.
 *
 * Turns a sentence a candidate would actually type —
 *
 *   "Senior Software Engineer in Accra with React experience at a series A/B
 *    company, remote, paying over GH₵8k, posted this week"
 *
 * — into the structured filters the search service runs, plus the leftover
 * words that describe the role itself.
 *
 * This is deliberately deterministic. An AI pass can refine it
 * (services/searchIntentService) but never gates it: parsing has to be instant,
 * free, and identical on every run, because the result is shown back to the
 * candidate as editable chips. A filter a person cannot see and remove is worse
 * than no filter at all.
 *
 * The method is span consumption. Every recognised phrase claims its characters
 * so nothing is counted twice, and whatever is left over is the role text.
 */

const {
    normalize,
    PLACES,
    WORK_MODELS,
    EMPLOYMENT_TYPES,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
    COMPANY_STAGES,
    INDUSTRIES,
    DATE_WINDOWS,
    STOP_WORDS,
} = require("./searchLexicon");
const { SKILL_ALIASES, canonicalSkill } = require("./matchEngine");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Words that only ever glue a query together. */
const CONNECTIVES = new Set([
    "in", "at", "near", "with", "using", "knowing", "and", "or", "for", "a",
    "an", "the", "of", "company", "companies", "employer", "employers", "firm",
    "startup", "startups", "based", "paying", "pays", "salary", "who", "that",
    "level", "stage", "years", "year", "yrs", "yr", "experience", "posted",
    "please", "show", "me", "find", "jobs", "job", "roles", "role",
]);

// ---------------------------------------------------------------------------
// Phrase table
//
// Built once at module load. Longest phrases first so "part time" is claimed
// before "time", and "greater accra" before "accra".
// ---------------------------------------------------------------------------

const buildPhraseTable = () => {
    const entries = [];

    const push = (type, key, label, phrase, extra = {}) => {
        const cleaned = normalize(phrase);
        if (cleaned) entries.push({ type, key, label, phrase: cleaned, ...extra });
    };

    for (const place of PLACES) {
        push("location", place.canonical, place.canonical, place.canonical, { region: place.region });
        for (const alias of place.aliases) {
            push("location", place.canonical, place.canonical, alias, { region: place.region });
        }
        if (place.region && place.region !== place.canonical) {
            push("location", place.canonical, place.canonical, place.region, { region: place.region });
        }
    }

    const simple = [
        ["workModel", WORK_MODELS],
        ["employmentType", EMPLOYMENT_TYPES],
        ["seniority", SENIORITY_LEVELS],
        ["education", EDUCATION_OPTIONS],
        ["companyStage", COMPANY_STAGES],
        ["industry", INDUSTRIES],
        ["datePosted", DATE_WINDOWS],
    ];

    for (const [type, list] of simple) {
        for (const item of list) {
            for (const pattern of item.patterns) push(type, item.key, item.label, pattern);
        }
    }

    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        push("skill", canonical, canonical, canonical);
        for (const alias of aliases) push("skill", canonical, canonical, alias);
    }

    push("verified", "verified", "Verified employers", "verified");
    push("verified", "verified", "Verified employers", "verified employer");
    push("verified", "verified", "Verified employers", "verified employers");
    push("verified", "verified", "Verified employers", "verified company");
    push("verified", "verified", "Verified employers", "verified companies");

    // Longest first, and stable for equal lengths so the table is deterministic.
    entries.sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));

    return entries.map((entry) => ({
        ...entry,
        // Lookarounds rather than \b: a skill like "c#" or "node.js" ends in a
        // character \b does not treat as a word boundary.
        matcher: new RegExp(`(?<![a-z0-9])${escapeRegex(entry.phrase)}(?![a-z0-9])`, "g"),
    }));
};

const PHRASE_TABLE = buildPhraseTable();

/**
 * A two-letter place name ("Ho", "Wa") is a coin flip inside a sentence, so it
 * only counts when a preposition puts it in a location slot or it is the whole
 * query. Getting this wrong sends a search for "ho ho ho" to the Volta Region.
 */
const needsLocationCue = (entry) => entry.type === "location" && entry.phrase.length <= 2;

// ---------------------------------------------------------------------------
// Amount and number helpers
// ---------------------------------------------------------------------------

/** "5k" → 5000, "1.5k" → 1500, "5,000" → 5000, "8m" → 8000000. */
const parseAmount = (raw) => {
    if (!raw) return null;
    const cleaned = String(raw).replace(/[,\s]/g, "").toLowerCase();
    const match = /^([\d.]+)([km])?$/.exec(cleaned);
    if (!match) return null;

    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    if (match[2] === "k") return Math.round(value * 1_000);
    if (match[2] === "m") return Math.round(value * 1_000_000);
    return Math.round(value);
};

/**
 * Salaries are stored per month on this portal, so an annual figure has to be
 * brought onto the same scale before it can be compared.
 */
const toMonthly = (amount, period) => {
    if (amount === null) return null;
    if (period === "year") return Math.round(amount / 12);
    if (period === "week") return Math.round(amount * 4.33);
    if (period === "day") return Math.round(amount * 22);
    if (period === "hour") return Math.round(amount * 173);
    return amount;
};

const periodFrom = (text) => {
    if (/\b(per\s*(annum|year)|annually|a\s*year|\/\s*year|yearly|pa)\b/.test(text)) return "year";
    if (/\b(per\s*week|weekly|a\s*week|\/\s*week)\b/.test(text)) return "week";
    if (/\b(per\s*day|daily|a\s*day|\/\s*day)\b/.test(text)) return "day";
    if (/\b(per\s*hour|hourly|an\s*hour|\/\s*hour)\b/.test(text)) return "hour";
    return "month";
};

const AMOUNT = String.raw`(?:gh[sc₵]?\s*)?([\d][\d,.]*\s*[km]?)`;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const emptyFilters = () => ({
    location: null,
    workModels: [],
    employmentTypes: [],
    seniority: [],
    education: null,
    industries: [],
    companyStages: [],
    skills: [],
    salaryMin: null,
    salaryMax: null,
    datePosted: null,
    verifiedOnly: false,
});

/**
 * Signals read out of a query that rank results without excluding any.
 *
 * Industry and skills are deliberately on this side of the line. "Software
 * engineer" implies technology, but a bank hiring a software engineer files the
 * posting under finance — as a hard filter that inference would delete exactly
 * the job the candidate wanted. The same words chosen from the filter rail are
 * a different matter: those the candidate asked for, so those do filter.
 */
const emptyBoosts = () => ({
    industries: [],
    skills: [],
    minYears: null,
});

/**
 * @param {string} raw the candidate's query
 * @returns {{
 *   raw: string, text: string, terms: string[], phrase: string,
 *   exactPhrases: string[], filters: object, interpreted: Array<object>
 * }}
 */
const parseQuery = (raw) => {
    const original = String(raw || "");
    const filters = emptyFilters();
    const boosts = emptyBoosts();
    const interpreted = [];
    const seen = new Set();

    const record = (type, key, label, detail = {}) => {
        const id = `${type}:${key}`;
        if (seen.has(id)) return false;
        seen.add(id);
        interpreted.push({ type, value: key, label, ...detail });
        return true;
    };

    // Quoted spans are an explicit "these exact words" instruction, so they are
    // lifted out before normalisation strips the quotes that carry the meaning.
    const exactPhrases = [];
    const withoutQuotes = original.replace(/"([^"]{2,80})"/g, (_, inner) => {
        const cleaned = normalize(inner);
        if (cleaned) exactPhrases.push(cleaned);
        return " ";
    });

    const text = normalize(withoutQuotes);
    if (!text) {
        return { raw: original, text: "", terms: [], phrase: "", exactPhrases, filters, boosts, interpreted };
    }

    const consumed = new Array(text.length).fill(false);
    const isFree = (start, end) => {
        for (let i = start; i < end; i += 1) if (consumed[i]) return false;
        return true;
    };
    const consume = (start, end) => {
        for (let i = start; i < end; i += 1) consumed[i] = true;
    };

    /** Claim every occurrence of a regex, handing each match to `onMatch`. */
    const claim = (pattern, onMatch) => {
        const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (!isFree(start, end)) continue;
            if (onMatch(match) !== false) consume(start, end);
        }
    };

    // --- Stage ranges: "series A/B", "series A or B", "seed to series B" -----
    // Written as one pass because the generic phrase table would only see the
    // first letter and drop the rest of the range on the floor.
    claim(/series\s*([a-e])(?:\s*(?:\/|,|or|to|-|and)\s*([a-e]))?(?:\s*(?:\/|,|or|to|-|and)\s*([a-e]))?/g, (match) => {
        const letters = [match[1], match[2], match[3]].filter(Boolean);
        for (const letter of letters) {
            const key = letter >= "c" ? "series-c" : `series-${letter}`;
            const stage = COMPANY_STAGES.find((s) => s.key === key);
            if (!stage || filters.companyStages.includes(stage.key)) continue;
            filters.companyStages.push(stage.key);
            record("companyStage", stage.key, stage.label);
        }
        return letters.length > 0;
    });

    // --- Salary ---------------------------------------------------------------
    const period = periodFrom(text);
    let salaryPeriodSeen = null;

    const setSalary = (min, max) => {
        if (min !== null) filters.salaryMin = toMonthly(min, period);
        if (max !== null) filters.salaryMax = toMonthly(max, period);
        salaryPeriodSeen = period;
    };

    // Ranges first — "between 5k and 10k", "5,000 - 10,000", "5k to 10k".
    claim(new RegExp(String.raw`(?:between\s+)?${AMOUNT}\s*(?:-|–|to|and)\s*${AMOUNT}`, "g"), (match) => {
        const min = parseAmount(match[1]);
        const max = parseAmount(match[2]);
        if (min === null || max === null || min > max) return false;
        // Two bare small numbers are far more likely to be "2 to 4 years" than
        // a pay range, so a range only counts once it looks like money.
        if (max < 100) return false;
        setSalary(min, max);
        return true;
    });

    claim(new RegExp(String.raw`(?:above|over|more than|at least|from|upwards of|minimum of|min)\s*${AMOUNT}`, "g"), (match) => {
        const min = parseAmount(match[1]);
        if (min === null || min < 100) return false;
        setSalary(min, null);
        return true;
    });

    claim(new RegExp(String.raw`(?:under|below|less than|up to|at most|maximum of|max)\s*${AMOUNT}`, "g"), (match) => {
        const max = parseAmount(match[1]);
        if (max === null || max < 100) return false;
        setSalary(null, max);
        return true;
    });

    claim(new RegExp(String.raw`(?:paying|pays|salary(?:\s*of)?|budget(?:\s*of)?|earning)\s*${AMOUNT}\+?`, "g"), (match) => {
        const amount = parseAmount(match[1]);
        if (amount === null || amount < 100) return false;
        setSalary(amount, null);
        return true;
    });

    // "GH₵8k+" on its own still reads as a floor.
    claim(new RegExp(String.raw`gh[sc₵]\s*${AMOUNT}\+?`, "g"), (match) => {
        const amount = parseAmount(match[1]);
        if (amount === null || amount < 100) return false;
        if (filters.salaryMin === null && filters.salaryMax === null) setSalary(amount, null);
        return true;
    });

    if (filters.salaryMin !== null || filters.salaryMax !== null) {
        const currency = "GH₵";
        const label = filters.salaryMax !== null && filters.salaryMin !== null
            ? `${currency}${filters.salaryMin.toLocaleString()} – ${currency}${filters.salaryMax.toLocaleString()}/mo`
            : filters.salaryMin !== null
                ? `${currency}${filters.salaryMin.toLocaleString()}+/mo`
                : `Up to ${currency}${filters.salaryMax.toLocaleString()}/mo`;
        record("salary", "salary", label, { statedPeriod: salaryPeriodSeen });
    }

    // --- Years of experience: "3+ years", "5 to 7 years" ----------------------
    claim(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d{1,2})?\s*(?:years?|yrs?)(?:\s*(?:of\s*)?experience)?/g, (match) => {
        const low = Number(match[1]);
        if (!Number.isFinite(low) || low > 40) return false;
        boosts.minYears = low;

        // Put the number on the seniority ladder so it filters something real.
        const band = SENIORITY_LEVELS.find((level) => low >= level.minYears && low < level.maxYears)
            || SENIORITY_LEVELS[SENIORITY_LEVELS.length - 1];
        if (band && !filters.seniority.includes(band.key)) {
            filters.seniority.push(band.key);
            record("seniority", band.key, band.label, { via: `${low}+ years` });
        }
        record("minYears", String(low), `${low}+ years experience`, { soft: true });
        return true;
    });

    // --- Date posted from a bare day count ------------------------------------
    claim(/(?:last|past|within(?:\s*the)?)\s*(\d{1,3})\s*days?/g, (match) => {
        const days = Number(match[1]);
        if (!Number.isFinite(days) || days < 1) return false;
        const window = DATE_WINDOWS.find((w) => w.days >= days) || DATE_WINDOWS[DATE_WINDOWS.length - 1];
        filters.datePosted = window.key;
        record("datePosted", window.key, window.label);
        return true;
    });

    // --- Unknown skills named explicitly --------------------------------------
    // "with Odoo experience", "using Laravel" — the lexicon cannot list every
    // tool in existence, so a stated skill is taken at its word.
    claim(/(?:with|using|skilled in|proficient in|knowledge of|experience in|experience with)\s+([a-z0-9+#.][a-z0-9+#.\s-]{1,28}?)(?:\s+(?:experience|skills?|background))?(?=\s*(?:,|\.|and|or|in|at|for|$))/g, (match) => {
        const candidate = normalize(match[1]);
        if (!candidate || candidate.length < 2) return false;

        const parts = candidate.split(/\s+(?:and|or|,)\s+/).map((part) => part.trim()).filter(Boolean);
        let added = false;
        for (const part of parts) {
            if (STOP_WORDS.has(part) || CONNECTIVES.has(part)) continue;
            const skill = canonicalSkill(part);
            if (!skill || boosts.skills.includes(skill)) continue;
            boosts.skills.push(skill);
            record("skill", skill, skill, { soft: true });
            added = true;
        }
        return added;
    });

    // --- Everything in the phrase table ---------------------------------------
    for (const entry of PHRASE_TABLE) {
        entry.matcher.lastIndex = 0;
        let match;
        while ((match = entry.matcher.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (!isFree(start, end)) continue;

            if (needsLocationCue(entry)) {
                const before = text.slice(Math.max(0, start - 12), start);
                const wholeQuery = start === 0 && end === text.length;
                if (!wholeQuery && !/\b(in|at|near|around|based)\s+$/.test(before)) continue;
            }

            switch (entry.type) {
                case "location":
                    if (filters.location) continue;
                    filters.location = entry.key;
                    record("location", entry.key, entry.label, { region: entry.region });
                    break;
                case "workModel":
                    if (filters.workModels.includes(entry.key)) break;
                    filters.workModels.push(entry.key);
                    record("workModel", entry.key, entry.label);
                    break;
                case "employmentType":
                    if (filters.employmentTypes.includes(entry.key)) break;
                    filters.employmentTypes.push(entry.key);
                    record("employmentType", entry.key, entry.label);
                    break;
                case "seniority":
                    // Filters, but does not consume: "manager" and "senior" are
                    // half the job title, and stripping them out of the role
                    // text would leave "product" to rank on its own.
                    if (!filters.seniority.includes(entry.key)) {
                        filters.seniority.push(entry.key);
                        record("seniority", entry.key, entry.label);
                    }
                    continue;
                case "education":
                    if (filters.education) continue;
                    filters.education = entry.key;
                    record("education", entry.key, entry.label);
                    break;
                case "industry":
                    // Never consumed: the word is usually part of the role text
                    // too ("software engineer"), where it earns its keep in
                    // relevance ranking.
                    if (!boosts.industries.includes(entry.key)) {
                        boosts.industries.push(entry.key);
                        record("industry", entry.key, entry.label, { soft: true });
                    }
                    continue;
                case "companyStage":
                    if (filters.companyStages.includes(entry.key)) break;
                    filters.companyStages.push(entry.key);
                    record("companyStage", entry.key, entry.label);
                    break;
                case "datePosted":
                    if (filters.datePosted) continue;
                    filters.datePosted = entry.key;
                    record("datePosted", entry.key, entry.label);
                    break;
                case "skill":
                    if (!boosts.skills.includes(entry.key)) {
                        boosts.skills.push(entry.key);
                        record("skill", entry.key, entry.label, { soft: true });
                    }
                    continue;
                case "verified":
                    filters.verifiedOnly = true;
                    record("verified", "verified", "Verified employers only");
                    break;
                default:
                    continue;
            }

            consume(start, end);
        }
    }

    // --- Whatever is left describes the role ----------------------------------
    let residual = "";
    for (let i = 0; i < text.length; i += 1) residual += consumed[i] ? " " : text[i];

    const terms = residual
        .split(/\s+/)
        .map((token) => token.replace(/^[-'/.]+|[-'/.]+$/g, ""))
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !CONNECTIVES.has(token));

    return {
        raw: original,
        text,
        terms,
        phrase: terms.join(" "),
        exactPhrases,
        filters,
        boosts,
        interpreted,
    };
};

/**
 * Whether a query is prose rather than a job title, and so worth the AI pass.
 *
 * The distinction matters more than it looks. "DevOps Cloud Infrastructure Lead
 * Engineer" is five words the lexicon handles perfectly, and handing it to a
 * model only invites it to summarise the role back as "engineer" — throwing
 * away the four words that made the search specific. "Something I can do from
 * my house a few days a week" is the opposite: almost nothing survives the
 * parser, and a model is the only thing that will make sense of it.
 *
 * So the test is how much of the query the lexicon could account for. A title
 * is short and almost entirely accounted for — every word is either a role word
 * or a recognised filter. A sentence is long and mostly scaffolding.
 */
const MIN_SENTENCE_WORDS = 6;
const ACCOUNTED_THRESHOLD = 0.6;

const hasUnresolvedIntent = (parsed) => {
    if (!parsed.text) return false;

    const words = parsed.text.split(" ").filter(Boolean);
    if (words.length < MIN_SENTENCE_WORDS) return false;

    const accounted = parsed.terms.length + parsed.interpreted.length;
    return accounted / words.length < ACCOUNTED_THRESHOLD;
};

module.exports = {
    parseQuery,
    hasUnresolvedIntent,
    parseAmount,
    toMonthly,
    emptyFilters,
    emptyBoosts,
    CONNECTIVES,
};
