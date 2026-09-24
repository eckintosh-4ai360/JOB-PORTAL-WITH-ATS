/**
 * Salary insights, computed from the pay employers publish on their adverts.
 *
 * Every advert with a salary is a data point that already carries a location,
 * a seniority, an industry, a work model and a skill list, so the salaries page
 * can answer "what does a senior accountant in Kumasi earn" from the board
 * itself rather than from a table someone typed in once.
 *
 * Anonymous salary submissions are deliberately left out: nothing verifies
 * them yet, and the page presents its figures as verified.
 *
 * Pay is monthly GH₵, which is what the posting form asks for. An advert with a
 * range counts at its midpoint; one with only a floor or a ceiling counts at
 * that figure.
 */

const prisma = require("../config/prisma");
const { contentTokens, expandRole, normalize } = require("../utils/searchLexicon");
const {
    makeParams,
    locationPatterns,
    WORK_MODEL_BUCKET,
    INDUSTRY_BUCKET,
} = require("./jobSearchService");

const WINDOW_DAYS = 365;

// Below this many adverts a "median" is one or two employers' pay rather than
// a market figure, so it is reported as missing instead of shown.
const MIN_SAMPLE = 3;

const MAX_ROLES = 8;
const MAX_SKILLS = 6;
const MAX_POPULAR_ROLES = 5;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const payOf = (row) => {
    const min = Number(row.salaryMin) > 0 ? Number(row.salaryMin) : 0;
    const max = Number(row.salaryMax) > 0 ? Number(row.salaryMax) : 0;
    if (min && max) return (min + max) / 2;
    return min || max;
};

/** Linear-interpolated percentile of an ascending list. */
const percentile = (sorted, q) => {
    const position = (sorted.length - 1) * q;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** Quartiles and the 90th percentile, or null when the sample is too small. */
const distribution = (values) => {
    if (values.length < MIN_SAMPLE) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
        p25: Math.round(percentile(sorted, 0.25)),
        median: Math.round(percentile(sorted, 0.5)),
        p75: Math.round(percentile(sorted, 0.75)),
        p90: Math.round(percentile(sorted, 0.9)),
    };
};

const medianOf = (values) => distribution(values)?.median ?? null;

/** Percentage change from `before` to `after`, to one decimal place. */
const percentChange = (after, before) =>
    after && before ? Math.round(((after - before) / before) * 1000) / 10 : null;

/**
 * SQL that is true when an advert's title names the role asked for.
 *
 * Every word of the phrase has to appear in the title, so "Teacher" finds
 * "Mathematics Teacher". The role's family from the lexicon is tried as well,
 * so a search uses the same idea of "the same job" that job search does.
 */
const roleMatchSql = (role, p) => {
    const alternatives = [role, ...expandRole(role)]
        .map((phrase) => contentTokens(phrase))
        .filter((tokens) => tokens.length > 0)
        .map((tokens) =>
            `(${tokens.map((token) => `j."title" ~* ${p.add(`\\y${escapeRegex(token)}\\y`)}`).join(" AND ")})`
        );
    return alternatives.length ? alternatives.join(" OR ") : "TRUE";
};

/**
 * Adverts from the last two years in the requested slice: two years so this
 * year's pay can be compared with last year's.
 *
 * Closed adverts count. A role that was filled last month still tells you what
 * it paid; only removed and moderation-hidden adverts are excluded.
 */
const loadAdverts = async ({ role, location, seniority, industry }) => {
    const p = makeParams();
    const where = [
        `j."deletedAt" IS NULL`,
        `j."moderationState" <> 'hidden'`,
        `j."createdAt" >= now() - make_interval(days => ${p.add(WINDOW_DAYS * 2)}::int)`,
    ];

    // Unlike job search, a place filter does not let remote adverts through:
    // "pay in Tamale" should be what Tamale employers pay.
    if (location) {
        const patterns = locationPatterns(location);
        if (patterns.length) where.push(`j."location" ILIKE ANY(${p.add(patterns)}::text[])`);
    }
    if (seniority) where.push(`j."seniority" = ${p.add(seniority)}`);
    if (industry) where.push(`(${INDUSTRY_BUCKET}) = ${p.add(industry)}`);

    const roleMatch = role ? roleMatchSql(role, p) : "TRUE";

    return prisma.$queryRawUnsafe(
        `SELECT j."title", j."salaryMin", j."salaryMax", j."searchSkills",
                j."createdAt" >= now() - make_interval(days => ${p.add(WINDOW_DAYS)}::int) AS "isCurrent",
                (${WORK_MODEL_BUCKET}) AS "workModel",
                (${roleMatch}) AS "roleMatch"
         FROM "Job" j
         LEFT JOIN "Company" c ON c."id" = j."companyProfileId"
         WHERE ${where.join(" AND ")}`,
        ...p.values
    );
};

/** Group adverts by title, labelled with the spelling employers use most. */
const groupByTitle = (rows) => {
    const groups = new Map();
    for (const row of rows) {
        // Hyphens folded so "Full-Stack" and "Full Stack" are one role.
        const key = normalize(row.title).replace(/-/g, " ").replace(/\s+/g, " ").trim();
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, { rows: [], spellings: new Map() });
        const group = groups.get(key);
        const spelling = String(row.title).trim();
        group.rows.push(row);
        group.spellings.set(spelling, (group.spellings.get(spelling) || 0) + 1);
    }
    return [...groups.values()].map((group) => ({
        title: [...group.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
        rows: group.rows,
    }));
};

/** The most-advertised roles, ranked by median pay. */
const roleBreakdown = (paidRows) =>
    groupByTitle(paidRows)
        .filter((group) => group.rows.length >= MIN_SAMPLE)
        .sort((a, b) => b.rows.length - a.rows.length)
        .slice(0, MAX_ROLES)
        .map((group) => ({
            role: group.title,
            adverts: group.rows.length,
            ...distribution(group.rows.map((row) => row.pay)),
        }))
        .sort((a, b) => b.median - a.median);

/**
 * The skills adverts ask for most, with how their median pay compares to the
 * median of every advert in the same slice.
 */
const skillPremiums = (paidRows) => {
    const overall = medianOf(paidRows.map((row) => row.pay));
    if (!overall) return [];

    const bySkill = new Map();
    for (const row of paidRows) {
        for (const skill of new Set(row.searchSkills || [])) {
            if (!bySkill.has(skill)) bySkill.set(skill, []);
            bySkill.get(skill).push(row.pay);
        }
    }

    return [...bySkill.entries()]
        .filter(([, pays]) => pays.length >= MIN_SAMPLE)
        .map(([skill, pays]) => {
            const median = medianOf(pays);
            return { skill, adverts: pays.length, median, premium: percentChange(median, overall) };
        })
        .sort((a, b) => b.adverts - a.adverts || b.premium - a.premium)
        .slice(0, MAX_SKILLS);
};

/**
 * @param {{role?: string, location?: string, seniority?: string, industry?: string}} filters
 *        `seniority` and `industry` must already be lexicon keys.
 */
const computeSalaryInsights = async (filters) => {
    const rows = (await loadAdverts(filters)).map((row) => ({ ...row, pay: payOf(row) }));

    const current = rows.filter((row) => row.isCurrent);
    const previous = rows.filter((row) => !row.isCurrent);
    const paid = (list) => list.filter((row) => row.pay > 0);
    const pays = (list) => paid(list).map((row) => row.pay);

    // The headline cards answer for the role searched; the role table, skill
    // list and suggestions describe the whole slice around it.
    const matched = current.filter((row) => row.roleMatch);
    const pay = distribution(pays(matched));
    const lastYearMedian = medianOf(pays(previous.filter((row) => row.roleMatch)));

    const flexible = matched.filter((row) => row.workModel !== "onsite");
    const flexibleMedian = medianOf(pays(flexible));
    const onsiteMedian = medianOf(pays(matched.filter((row) => row.workModel === "onsite")));

    const currentPaid = paid(current);

    return {
        windowDays: WINDOW_DAYS,
        minSample: MIN_SAMPLE,
        dataPoints: currentPaid.length,
        summary: {
            adverts: matched.length,
            advertsWithPay: paid(matched).length,
            pay,
            yearOnYear: pay ? percentChange(pay.median, lastYearMedian) : null,
            flexible: {
                count: flexible.length,
                share: matched.length >= MIN_SAMPLE ? Math.round((flexible.length / matched.length) * 100) : null,
            },
            flexiblePay: {
                median: flexibleMedian,
                onsiteMedian,
                premium: percentChange(flexibleMedian, onsiteMedian),
            },
        },
        roles: roleBreakdown(currentPaid),
        skills: skillPremiums(currentPaid),
        popularRoles: groupByTitle(currentPaid)
            .filter((group) => group.rows.length >= MIN_SAMPLE)
            .sort((a, b) => b.rows.length - a.rows.length)
            .slice(0, MAX_POPULAR_ROLES)
            .map((group) => group.title),
    };
};

module.exports = {
    computeSalaryInsights,
    MIN_SAMPLE,
};
