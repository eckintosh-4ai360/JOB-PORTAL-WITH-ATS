/**
 * Search facets derived from a job posting.
 *
 * Employers do not fill in an "experience level" box, and asking them to would
 * add a field to a form they already abandon. The information is in the advert
 * anyway — "Senior", "3+ years", "BSc required" — so it is read out once, when
 * the posting is written, and stored on the row.
 *
 * Deriving at write time rather than at query time is the whole point: a filter
 * can only be fast and exact if the value it filters on is a column. Postings
 * created before this existed are filled in by scripts/backfillJobFacets.js.
 */

const {
    normalize,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
} = require("./searchLexicon");
const {
    SKILL_ALIASES,
    canonicalSkill,
    educationLevelFromText,
    requiredYearsFromText,
} = require("./matchEngine");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const boundary = (phrase) =>
    new RegExp(`(?<![a-z0-9])${escapeRegex(normalize(phrase))}(?![a-z0-9])`);

/** Seniority patterns, longest first so "team lead" beats "lead". */
const SENIORITY_MATCHERS = SENIORITY_LEVELS
    .flatMap((level) => level.patterns.map((pattern) => ({ level, pattern: normalize(pattern) })))
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .map((entry) => ({ ...entry, matcher: boundary(entry.pattern) }));

/** Canonical skill → every spelling of it, longest first. */
const SKILL_MATCHERS = Object.entries(SKILL_ALIASES)
    .flatMap(([canonical, aliases]) =>
        [canonical, ...aliases].map((phrase) => ({ canonical, phrase: normalize(phrase) }))
    )
    .filter((entry) => entry.phrase.length >= 2)
    .sort((a, b) => b.phrase.length - a.phrase.length)
    .map((entry) => ({ ...entry, matcher: boundary(entry.phrase) }));

/** How many skills are worth storing before the list stops being a signal. */
const MAX_SEARCH_SKILLS = 40;

/**
 * Place a posting on the seniority ladder.
 *
 * The title is read first and wins outright — an employer who wrote "Senior"
 * there meant it, whatever the description goes on to say. Only when the title
 * is silent does a stated number of years decide, and only then the body text,
 * which is the least reliable of the three because it often describes the team
 * rather than the role.
 */
const deriveSeniority = ({ title = "", description = "", requirements = "" } = {}) => {
    const titleText = normalize(title);

    // Several bands can appear in one title ("Senior Manager"); the most senior
    // reading is the right one.
    let best = null;
    for (const entry of SENIORITY_MATCHERS) {
        if (!entry.matcher.test(titleText)) continue;
        if (!best || entry.level.rank > best.rank) best = entry.level;
    }
    if (best) return best.key;

    const bodyText = `${requirements} ${description}`;
    const years = requiredYearsFromText(bodyText);
    if (years !== null && years !== undefined) {
        const band = SENIORITY_LEVELS.find((level) => years >= level.minYears && years < level.maxYears);
        if (band) return band.key;
        return SENIORITY_LEVELS[SENIORITY_LEVELS.length - 1].key;
    }

    const normalizedBody = normalize(bodyText);
    for (const entry of SENIORITY_MATCHERS) {
        if (entry.matcher.test(normalizedBody)) return entry.level.key;
    }

    return null;
};

/**
 * The minimum qualification a posting asks for, as one of the keys shared with
 * matchEngine. Returns null when the advert does not say, which is different
 * from saying "none required" and is filtered differently.
 */
const deriveEducationLevel = ({ description = "", requirements = "" } = {}) => {
    const level = educationLevelFromText(`${requirements} ${description}`);
    if (!level || level.key === "none") return null;
    return EDUCATION_OPTIONS.some((option) => option.key === level.key) ? level.key : null;
};

/**
 * Canonical skills mentioned anywhere in a posting.
 *
 * Tags come first and are kept even when the lexicon has never heard of them —
 * an employer typing a skill into the tags field is the most direct statement
 * of what the job needs, and a search for a niche tool should still find it.
 */
const deriveSearchSkills = ({ title = "", description = "", requirements = "", tags = [] } = {}) => {
    const skills = [];
    const seen = new Set();

    const add = (value) => {
        const skill = canonicalSkill(value);
        if (!skill || skill.length < 2 || seen.has(skill)) return;
        seen.add(skill);
        skills.push(skill);
    };

    for (const tag of Array.isArray(tags) ? tags : []) add(tag);

    const haystack = normalize(`${title} ${requirements} ${description}`);
    if (haystack) {
        for (const entry of SKILL_MATCHERS) {
            if (seen.has(entry.canonical)) continue;
            if (entry.matcher.test(haystack)) add(entry.canonical);
            if (skills.length >= MAX_SEARCH_SKILLS) break;
        }
    }

    return skills.slice(0, MAX_SEARCH_SKILLS);
};

/**
 * Every derived search column for a posting, ready to spread into a Prisma
 * create or update.
 *
 * @param {{title?: string, description?: string, requirements?: string, tags?: string[]}} job
 * @returns {{seniority: string|null, educationLevel: string|null, searchSkills: string[]}}
 */
const deriveJobFacets = (job = {}) => ({
    seniority: deriveSeniority(job),
    educationLevel: deriveEducationLevel(job),
    searchSkills: deriveSearchSkills(job),
});

module.exports = {
    deriveJobFacets,
    deriveSeniority,
    deriveEducationLevel,
    deriveSearchSkills,
};
