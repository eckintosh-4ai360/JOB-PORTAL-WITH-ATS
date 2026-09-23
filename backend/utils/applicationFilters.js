const { LEGACY_STATUSES, normalizeStatus, findStage } = require("./hiringPipeline");

/**
 * The filters the all-applicants list and the reports share, so an export
 * always holds exactly the applicants the list showed.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A YYYY-MM-DD day as a UTC instant (Ghana keeps GMT all year). `endOfDay`
 * gives the start of the next day, for an inclusive "to" date. Returns null
 * when absent and NaN when unreadable.
 */
const parseDay = (value, endOfDay = false) => {
    if (value === undefined || value === null || value === "") return null;
    if (!DAY.test(String(value))) return NaN;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return NaN;
    if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
    return date;
};

/** Match a stage, including rows still holding its pre-pipeline name. */
const statusFilter = (status) => {
    const id = normalizeStatus(status);
    const legacy = Object.keys(LEGACY_STATUSES).filter((name) => LEGACY_STATUSES[name] === id);
    return { in: [id, ...legacy] };
};

/**
 * A date range on one column from `from`/`to` query values.
 * Returns `{ range }` (possibly undefined) or `{ error }`.
 */
const dateRange = (query) => {
    const from = parseDay(query.from);
    const to = parseDay(query.to, true);
    if (Number.isNaN(from) || Number.isNaN(to)) return { error: "Dates must be written like 2026-09-23." };
    if (from && to && from >= to) return { error: "The start date is after the end date." };
    if (!from && !to) return { range: undefined };
    return { range: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } };
};

/**
 * Prisma `where` for an employer's applications from query values:
 * jobId, status (a stage id), from/to (applied dates), shortlisted=true,
 * source=registered|guest, q (name or email). Applications to deleted jobs are
 * left out, as they are from the jobs list.
 *
 * Returns `{ where }` or `{ error }`.
 */
const buildApplicationWhere = ({ employerId, query = {}, stages }) => {
    const where = { job: { companyId: employerId, deletedAt: null } };

    if (query.jobId) where.jobId = String(query.jobId);

    if (query.status) {
        if (!findStage(stages, query.status)) return { error: "That is not a stage in your pipeline." };
        where.status = statusFilter(query.status);
    }

    const { range, error } = dateRange(query);
    if (error) return { error };
    if (range) where.createdAt = range;

    if (query.shortlisted === "true") where.shortlistedAt = { not: null };

    if (query.source === "guest") where.applicantId = null;
    else if (query.source === "registered") where.applicantId = { not: null };

    const q = String(query.q || "").trim().slice(0, 100);
    if (q) {
        const contains = { contains: q, mode: "insensitive" };
        where.OR = [
            { applicant: { name: contains } },
            { applicant: { email: contains } },
            { guestName: contains },
            { guestEmail: contains },
        ];
    }

    return { where };
};

module.exports = {
    parseDay,
    statusFilter,
    dateRange,
    buildApplicationWhere,
};
