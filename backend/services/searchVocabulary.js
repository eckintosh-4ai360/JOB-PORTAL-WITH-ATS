/**
 * The words this job board actually contains, and the spell-checker built on
 * top of them.
 *
 * Typo tolerance is done here rather than left to Postgres trigram matching
 * alone, because the two solve different halves of the problem. Trigram
 * similarity can tell you "Sofware Enginer" resembles a stored title, but it
 * cannot feed a corrected word into the ranking query — so the mistyped search
 * still ranks badly even when it matches. Correcting the term first means the
 * rest of the engine never knows there was a typo, and the candidate gets told
 * what we searched for instead.
 *
 * The vocabulary is drawn from live postings, so it learns the words this site
 * uses — including company names and niche tools no dictionary would carry —
 * and never suggests a word that would return nothing.
 */

const prisma = require("../config/prisma");
const { normalize, STOP_WORDS } = require("../utils/searchLexicon");

/** How long a built vocabulary is trusted before it is rebuilt. */
const TTL_MS = Number(process.env.SEARCH_VOCAB_TTL_MS || 10 * 60 * 1000);

/** Upper bound on rows read to build it; a job board this size never hits it. */
const SOURCE_LIMIT = Number(process.env.SEARCH_VOCAB_LIMIT || 5000);

let cache = null;
let building = null;

/**
 * Damerau-Levenshtein distance with an early exit.
 *
 * Bounded because the answer is only ever compared against a small threshold:
 * once every cell in a row exceeds `max`, no completion can come back under it,
 * so the remaining rows are wasted work.
 */
const editDistance = (a, b, max = 2) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prevPrev = [];
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let current = [];

    for (let i = 1; i <= a.length; i += 1) {
        current = new Array(b.length + 1);
        current[0] = i;
        let rowMin = current[0];

        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(
                current[j - 1] + 1,
                prev[j] + 1,
                prev[j - 1] + cost
            );

            // Transposition — "recieve" for "receive" is one mistake, not two.
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, prevPrev[j - 2] + 1);
            }

            current[j] = value;
            if (value < rowMin) rowMin = value;
        }

        if (rowMin > max) return max + 1;

        prevPrev = prev;
        prev = current;
    }

    return prev[b.length];
};

/** Words too short to correct safely — one edit away from a dozen others. */
const MIN_CORRECTABLE = 4;

const thresholdFor = (term) => {
    if (term.length < MIN_CORRECTABLE) return 0;
    if (term.length <= 6) return 1;
    return 2;
};

const addToken = (counts, token) => {
    if (!token || token.length < 2 || STOP_WORDS.has(token)) return;
    counts.set(token, (counts.get(token) || 0) + 1);
};

const addPhrase = (counts, phrases, value, weight = 1) => {
    const cleaned = normalize(value);
    if (!cleaned) return;

    for (const token of cleaned.split(" ")) addToken(counts, token);

    // Whole titles and skills are kept intact as well, so suggestions can come
    // back as something a person would recognise ("registered nurse") rather
    // than a bag of corrected words.
    if (cleaned.length >= 3 && cleaned.split(" ").length <= 5) {
        phrases.set(cleaned, (phrases.get(cleaned) || 0) + weight);
    }
};

/** Read the live corpus and index it by length, so lookups stay cheap. */
const build = async () => {
    const counts = new Map();
    const phrases = new Map();

    const [jobs, companies] = await Promise.all([
        prisma.job.findMany({
            where: { isClosed: false, deletedAt: null, moderationState: { not: "hidden" } },
            select: { title: true, tags: true, searchSkills: true, location: true, category: true },
            orderBy: { createdAt: "desc" },
            take: SOURCE_LIMIT,
        }),
        prisma.company.findMany({
            select: { name: true, industry: true, hq: true },
            take: SOURCE_LIMIT,
        }),
    ]);

    for (const job of jobs) {
        addPhrase(counts, phrases, job.title, 3);
        for (const tag of job.tags || []) addPhrase(counts, phrases, tag, 2);
        for (const skill of job.searchSkills || []) addPhrase(counts, phrases, skill, 2);
        addPhrase(counts, phrases, job.location, 1);
        addPhrase(counts, phrases, job.category, 1);
    }

    for (const company of companies) {
        addPhrase(counts, phrases, company.name, 2);
        addPhrase(counts, phrases, company.industry, 1);
        addPhrase(counts, phrases, company.hq, 1);
    }

    // Bucketing by length turns correction from a scan of every known word into
    // a scan of the few that could possibly be within the edit threshold.
    const byLength = new Map();
    for (const token of counts.keys()) {
        if (!byLength.has(token.length)) byLength.set(token.length, []);
        byLength.get(token.length).push(token);
    }

    return {
        counts,
        phrases,
        byLength,
        builtAt: Date.now(),
        size: counts.size,
    };
};

/**
 * The current vocabulary, rebuilding it if stale.
 *
 * A failed rebuild keeps serving the previous copy. Search degrading to "no
 * typo correction" is a far better outcome than search failing outright, and a
 * transient database hiccup should not take the feature down.
 */
const getVocabulary = async () => {
    const fresh = cache && Date.now() - cache.builtAt < TTL_MS;
    if (fresh) return cache;

    if (!building) {
        building = build()
            .then((next) => {
                cache = next;
                return next;
            })
            .catch((error) => {
                console.warn("Search vocabulary rebuild failed:", error.message);
                return cache;
            })
            .finally(() => {
                building = null;
            });
    }

    // A stale copy is still useful, so only a cold start waits on the rebuild.
    if (cache) return cache;
    return building;
};

/**
 * The closest known word to `term`, or null when it is already a real word or
 * nothing is close enough.
 *
 * Ties break on corpus frequency: if "enginer" is one edit from both "engineer"
 * and "engines", the one that appears in more postings is the better guess.
 */
const correctTerm = (vocabulary, term) => {
    if (!vocabulary) return null;

    const token = normalize(term);
    if (!token || vocabulary.counts.has(token)) return null;

    const max = thresholdFor(token);
    if (max === 0) return null;

    let best = null;
    let bestDistance = max + 1;
    let bestCount = 0;

    for (let length = token.length - max; length <= token.length + max; length += 1) {
        for (const candidate of vocabulary.byLength.get(length) || []) {
            // A shared first letter is the cheapest possible filter and holds
            // for the overwhelming majority of real typos.
            if (candidate[0] !== token[0] && length !== token.length) continue;

            const distance = editDistance(token, candidate, max);
            if (distance > max) continue;

            const count = vocabulary.counts.get(candidate) || 0;
            if (distance < bestDistance || (distance === bestDistance && count > bestCount)) {
                best = candidate;
                bestDistance = distance;
                bestCount = count;
            }
        }
    }

    return best;
};

/**
 * Spell-check a whole query.
 *
 * @returns {{terms: string[], corrections: Array<{from: string, to: string}>, corrected: string|null}}
 *   `terms` is every term worth searching — originals plus corrections, since a
 *   word we thought was a typo may simply be new. `corrected` is the query as
 *   we would rewrite it, for a "showing results for…" line.
 */
const correctQuery = async (terms) => {
    const list = Array.isArray(terms) ? terms.filter(Boolean) : [];
    if (list.length === 0) return { terms: [], corrections: [], corrected: null };

    const vocabulary = await getVocabulary().catch(() => null);
    if (!vocabulary) return { terms: list, corrections: [], corrected: null };

    const corrections = [];
    const expanded = [];
    const rewritten = [];

    for (const term of list) {
        expanded.push(term);
        const fix = correctTerm(vocabulary, term);
        if (fix && fix !== term) {
            corrections.push({ from: term, to: fix });
            expanded.push(fix);
            rewritten.push(fix);
        } else {
            rewritten.push(term);
        }
    }

    return {
        terms: [...new Set(expanded)],
        corrections,
        corrected: corrections.length ? rewritten.join(" ") : null,
    };
};

/**
 * Autocomplete. Prefix matches first — they are what someone mid-word wants —
 * then whole phrases containing the fragment, then near-misses for a fragment
 * that was mistyped.
 */
const suggest = async (fragment, limit = 8) => {
    const query = normalize(fragment);
    if (!query || query.length < 2) return [];

    const vocabulary = await getVocabulary().catch(() => null);
    if (!vocabulary) return [];

    const prefix = [];
    const contains = [];

    for (const [phrase, weight] of vocabulary.phrases) {
        if (phrase === query) continue;
        if (phrase.startsWith(query)) prefix.push({ phrase, weight });
        else if (phrase.includes(query)) contains.push({ phrase, weight });
        if (prefix.length > 200 && contains.length > 200) break;
    }

    const rank = (list) => list.sort((a, b) => b.weight - a.weight || a.phrase.length - b.phrase.length);
    const results = [...rank(prefix), ...rank(contains)].slice(0, limit).map((item) => item.phrase);

    if (results.length === 0) {
        const fix = correctTerm(vocabulary, query);
        if (fix) results.push(fix);
    }

    return results;
};

/** Test/ops helper — forces the next read to rebuild. */
const resetVocabulary = () => {
    cache = null;
};

module.exports = {
    getVocabulary,
    correctQuery,
    correctTerm,
    suggest,
    editDistance,
    resetVocabulary,
};
