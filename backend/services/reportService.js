const prisma = require("../config/prisma");
const {
    REJECTED_STAGE,
    findStage,
    normalizeStatus,
    toCandidateStatus,
    getEmployerStages,
} = require("../utils/hiringPipeline");
const { buildApplicationWhere, dateRange } = require("../utils/applicationFilters");
const { summarizeAttempts } = require("./shortlistService");

/**
 * Employer reports: the same data the dashboard screens show, as tables that
 * can be previewed or written to CSV, Excel or PDF (utils/reportWriters).
 *
 * Every report is one shape — columns, rows, a few summary figures, and a line
 * saying which filters produced it — so each writer handles all of them. A
 * column's `pdf` weight is its share of the page width in a PDF; 0 leaves it
 * out there, where a landscape page cannot hold everything a spreadsheet can.
 */

const MAX_ROWS = 5000;

const REPORTS = {
    applicants: {
        title: "Applicants",
        description: "Every application with its stage, AI fit, assessment result and shortlist status.",
        filters: ["jobId", "from", "to", "status", "shortlisted"],
        orientation: "landscape",
    },
    shortlist: {
        title: "Shortlist",
        description: "The applicants on your shortlists, with how they got there and your notes.",
        filters: ["jobId", "from", "to", "status"],
        orientation: "landscape",
    },
    pipeline: {
        title: "Pipeline summary",
        description: "How many applicants sit at each stage of your pipeline right now.",
        filters: ["jobId", "from", "to"],
        orientation: "portrait",
    },
    jobs: {
        title: "Jobs summary",
        description: "Each job with its applicants at every step, outcomes and average AI fit.",
        filters: ["jobId", "from", "to"],
        orientation: "landscape",
    },
    assessments: {
        title: "Assessment results",
        description: "Every assessment sent to your applicants, with scores and pass or fail.",
        filters: ["jobId", "from", "to"],
        orientation: "landscape",
    },
};

const RECOMMENDATION_LABELS = { shortlist: "Shortlist", interview: "Interview", hold: "Hold", reject: "Not a fit" };
const ATTEMPT_STATUS_LABELS = {
    invited: "Not started",
    in_progress: "In progress",
    submitted: "Awaiting marking",
    scored: "Scored",
    expired: "Expired",
};

const col = (key, label, type, width, pdf) => ({ key, label, type, width, pdf });

const average = (values) => {
    const list = values.filter((value) => typeof value === "number" && Number.isFinite(value));
    return list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : null;
};

const percentOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayLabel = (date) => DAY_FORMAT.format(date);

/** What candidates see for a stage, outcome included: "Decision · Hired". */
const candidateSees = (stages, status) => {
    const seen = toCandidateStatus(stages, status);
    return seen.outcomeLabel ? `${seen.label} · ${seen.outcomeLabel}` : seen.label;
};

const nameOf = (application) =>
    (application.applicantId ? application.applicant?.name : application.guestName) || "Applicant";
const emailOf = (application) =>
    (application.applicantId ? application.applicant?.email : application.guestEmail) || "";

const assessmentResult = (summary) => {
    if (summary.bestPercent !== null) return summary.passed ? "Passed" : "Below pass mark";
    if (summary.pending) return "Awaiting result";
    return summary.sent ? "No result" : "";
};

/**
 * The filters as words, for the line under a report's title. Also checks the
 * job belongs to the employer, so a report never names someone else's job.
 */
const describeFilters = async ({ employerId, query, stages, type }) => {
    const parts = [];

    if (query.jobId) {
        const job = await prisma.job.findUnique({
            where: { id: String(query.jobId) },
            select: { title: true, companyId: true, deletedAt: true },
        });
        if (!job || job.companyId !== employerId || job.deletedAt) return { error: "Job not found." };
        parts.push(job.title);
    } else {
        parts.push("All jobs");
    }

    const { range, error } = dateRange(query);
    if (error) return { error };
    if (range) {
        const verb = type === "assessments" ? "Sent" : "Applied";
        const to = range.lt ? new Date(range.lt.getTime() - 24 * 60 * 60 * 1000) : null;
        if (range.gte && to) parts.push(`${verb} ${dayLabel(range.gte)} – ${dayLabel(to)}`);
        else if (range.gte) parts.push(`${verb} since ${dayLabel(range.gte)}`);
        else parts.push(`${verb} up to ${dayLabel(to)}`);
    }

    if (query.status && REPORTS[type].filters.includes("status")) {
        const stage = findStage(stages, query.status);
        if (stage) parts.push(`Stage: ${stage.name}`);
    }
    if (query.shortlisted === "true" && type === "applicants") parts.push("On the shortlist only");

    // The applicant list's own filters, so its export says what it holds.
    if (type === "applicants" || type === "shortlist") {
        if (query.source === "guest") parts.push("Guests only");
        else if (query.source === "registered") parts.push("Registered applicants only");
        const q = String(query.q || "").trim().slice(0, 100);
        if (q) parts.push(`Matching "${q}"`);
    }

    return { subtitle: parts.join(" · ") };
};

// ---------------------------------------------------------------------------
// Applicants and shortlist
// ---------------------------------------------------------------------------

const APPLICATION_INCLUDE = {
    applicant: { select: { name: true, email: true } },
    job: { select: { id: true, title: true } },
    aiScore: { select: { matchScore: true, recommendation: true } },
    assessmentAttempts: {
        select: {
            status: true,
            percent: true,
            passMark: true,
            dueAt: true,
            assessment: { select: { title: true } },
        },
    },
};

const loadApplications = async ({ employerId, query, stages, maxRows, orderBy }) => {
    const { where, error } = buildApplicationWhere({ employerId, query, stages });
    if (error) return { error };

    const [total, applications] = await Promise.all([
        prisma.application.count({ where }),
        prisma.application.findMany({ where, include: APPLICATION_INCLUDE, orderBy, take: maxRows }),
    ]);
    return { total, applications };
};

const applicantsReport = async ({ employerId, query, stages, maxRows }) => {
    const { total, applications, error } = await loadApplications({
        employerId,
        query,
        stages,
        maxRows,
        orderBy: { createdAt: "desc" },
    });
    if (error) return { error };

    const rows = applications.map((application) => {
        const stage = findStage(stages, application.status);
        const assessment = summarizeAttempts(application.assessmentAttempts);
        const interviewDay = application.interviewDate ? application.interviewDate.toISOString().slice(0, 10) : "";
        return {
            name: nameOf(application),
            email: emailOf(application),
            phone: application.applicantId ? "" : application.guestPhone || "",
            account: application.applicantId ? "Registered" : "Guest",
            job: application.job?.title || "",
            stage: stage?.name || normalizeStatus(application.status),
            sees: candidateSees(stages, application.status),
            appliedAt: application.createdAt,
            updatedAt: application.updatedAt,
            fit: application.aiScore?.matchScore ?? null,
            recommendation: RECOMMENDATION_LABELS[application.aiScore?.recommendation] || "",
            assessment: assessment.bestPercent,
            assessmentResult: assessmentResult(assessment),
            shortlisted: application.shortlistedAt ? "Yes" : "",
            shortlistNote: application.shortlistNote || "",
            interview: [interviewDay, application.interviewTime].filter(Boolean).join(" "),
        };
    });

    const hired = applications.filter((a) => findStage(stages, a.status)?.type === "hired").length;

    return {
        total,
        rows,
        columns: [
            col("name", "Applicant", "text", 26, 2.6),
            col("email", "Email", "text", 30, 3),
            col("phone", "Phone", "text", 16, 0),
            col("account", "Account", "text", 11, 0),
            col("job", "Job", "text", 30, 2.8),
            col("stage", "Stage", "text", 18, 1.8),
            col("sees", "Candidate sees", "text", 24, 0),
            col("appliedAt", "Applied", "date", 12, 1.4),
            col("updatedAt", "Last updated", "date", 13, 0),
            col("fit", "AI fit (%)", "percent", 10, 1),
            col("recommendation", "AI recommends", "text", 14, 1.4),
            col("assessment", "Best assessment (%)", "percent", 12, 1.3),
            col("assessmentResult", "Assessment result", "text", 17, 1.6),
            col("shortlisted", "On shortlist", "text", 12, 1.1),
            col("shortlistNote", "Shortlist note", "text", 40, 0),
            col("interview", "Interview", "text", 17, 0),
        ],
        summary: [
            { label: "Applicants", value: total },
            { label: "On shortlist", value: applications.filter((a) => a.shortlistedAt).length },
            { label: "Average AI fit", value: formatAverage(average(rows.map((row) => row.fit))) },
            { label: "Average best assessment", value: formatAverage(average(rows.map((row) => row.assessment))) },
            { label: "Hired", value: hired },
        ],
    };
};

const shortlistReport = async ({ employerId, query, stages, maxRows }) => {
    const { total, applications, error } = await loadApplications({
        employerId,
        query: { ...query, shortlisted: "true" },
        stages,
        maxRows,
        orderBy: [{ job: { title: "asc" } }, { shortlistedAt: "asc" }],
    });
    if (error) return { error };

    const rows = applications.map((application) => {
        const assessment = summarizeAttempts(application.assessmentAttempts);
        return {
            name: nameOf(application),
            email: emailOf(application),
            job: application.job?.title || "",
            stage: findStage(stages, application.status)?.name || normalizeStatus(application.status),
            fit: application.aiScore?.matchScore ?? null,
            assessment: assessment.bestPercent,
            shortlistedAt: application.shortlistedAt,
            source: application.shortlistSource === "assisted" ? "Assisted" : "Manual",
            note: application.shortlistNote || "",
        };
    });

    return {
        total,
        rows,
        columns: [
            col("name", "Applicant", "text", 26, 2.4),
            col("email", "Email", "text", 30, 2.8),
            col("job", "Job", "text", 30, 2.6),
            col("stage", "Stage", "text", 18, 1.7),
            col("fit", "AI fit (%)", "percent", 10, 1),
            col("assessment", "Best assessment (%)", "percent", 12, 1.3),
            col("shortlistedAt", "Added", "date", 12, 1.3),
            col("source", "How", "text", 10, 1.1),
            col("note", "Note", "text", 50, 4),
        ],
        summary: [
            { label: "On shortlist", value: total },
            { label: "Assisted picks", value: rows.filter((row) => row.source === "Assisted").length },
            { label: "Manual picks", value: rows.filter((row) => row.source === "Manual").length },
            { label: "Average AI fit", value: formatAverage(average(rows.map((row) => row.fit))) },
        ],
    };
};

// ---------------------------------------------------------------------------
// Pipeline and jobs
// ---------------------------------------------------------------------------

const pipelineReport = async ({ employerId, query, stages }) => {
    const { where, error } = buildApplicationWhere({
        employerId,
        query: { jobId: query.jobId, from: query.from, to: query.to },
        stages,
    });
    if (error) return { error };

    const [all, shortlisted] = await Promise.all([
        prisma.application.groupBy({ by: ["status"], where, _count: { _all: true } }),
        prisma.application.groupBy({
            by: ["status"],
            where: { ...where, shortlistedAt: { not: null } },
            _count: { _all: true },
        }),
    ]);

    const tally = (groups) => {
        const counts = new Map();
        for (const group of groups) {
            const id = normalizeStatus(group.status);
            counts.set(id, (counts.get(id) || 0) + group._count._all);
        }
        return counts;
    };
    const counts = tally(all);
    const shortlistCounts = tally(shortlisted);
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

    const known = [...stages, REJECTED_STAGE];
    const rows = known.map((stage) => ({
        stage: stage.name,
        sees: candidateSees(stages, stage.id),
        applicants: counts.get(stage.id) || 0,
        share: percentOf(counts.get(stage.id) || 0, total),
        shortlisted: shortlistCounts.get(stage.id) || 0,
    }));

    // Rows in a stage that is no longer in the pipeline still count.
    const knownIds = new Set(known.map((stage) => stage.id));
    const other = [...counts.entries()].filter(([id]) => !knownIds.has(id));
    if (other.length) {
        const n = other.reduce((sum, [, count]) => sum + count, 0);
        rows.push({
            stage: "Other (not in your pipeline)",
            sees: "",
            applicants: n,
            share: percentOf(n, total),
            shortlisted: other.reduce((sum, [id]) => sum + (shortlistCounts.get(id) || 0), 0),
        });
    }

    const countType = (type) => known
        .filter((stage) => stage.type === type)
        .reduce((sum, stage) => sum + (counts.get(stage.id) || 0), 0);
    const hired = countType("hired");
    const rejected = countType("rejected");

    return {
        total: rows.length,
        rows,
        columns: [
            col("stage", "Stage", "text", 26, 3),
            col("sees", "Candidates see", "text", 30, 3.2),
            col("applicants", "Applicants", "number", 12, 1.4),
            col("share", "Share (%)", "percent", 10, 1.2),
            col("shortlisted", "On shortlist", "number", 13, 1.4),
        ],
        summary: [
            { label: "Applicants", value: total },
            { label: "Still open", value: total - hired - rejected },
            { label: "Hired", value: hired },
            { label: "Rejected", value: rejected },
            { label: "Hire rate", value: `${percentOf(hired, total)}%` },
        ],
    };
};

const jobsReport = async ({ employerId, query, stages }) => {
    const jobs = await prisma.job.findMany({
        where: {
            companyId: employerId,
            deletedAt: null,
            ...(query.jobId ? { id: String(query.jobId) } : {}),
        },
        select: { id: true, title: true, isClosed: true, createdAt: true, deadline: true },
        orderBy: { createdAt: "desc" },
    });

    const { range, error } = dateRange(query);
    if (error) return { error };

    const applications = jobs.length
        ? await prisma.application.findMany({
            where: { jobId: { in: jobs.map((job) => job.id) }, ...(range ? { createdAt: range } : {}) },
            select: {
                jobId: true,
                status: true,
                shortlistedAt: true,
                aiScore: { select: { matchScore: true } },
            },
        })
        : [];

    // Candidate phases for the steps before an outcome, then the outcomes.
    const bucketOf = (status) => {
        const stage = findStage(stages, status);
        if (!stage) return "received";
        if (stage.type === "rejected" || stage.type === "offer" || stage.type === "hired") return stage.type;
        return stage.phase;
    };

    const byJob = new Map(jobs.map((job) => [job.id, []]));
    for (const application of applications) byJob.get(application.jobId)?.push(application);

    const rows = jobs.map((job) => {
        const list = byJob.get(job.id) || [];
        const buckets = {};
        for (const application of list) {
            const bucket = bucketOf(application.status);
            buckets[bucket] = (buckets[bucket] || 0) + 1;
        }
        return {
            job: job.title,
            status: job.isClosed ? "Closed" : "Open",
            postedAt: job.createdAt,
            deadline: job.deadline,
            applicants: list.length,
            received: buckets.received || 0,
            underReview: buckets.under_review || 0,
            shortlistedPhase: buckets.shortlisted || 0,
            interview: buckets.interview || 0,
            decision: buckets.decision || 0,
            offer: buckets.offer || 0,
            hired: buckets.hired || 0,
            rejected: buckets.rejected || 0,
            onShortlist: list.filter((application) => application.shortlistedAt).length,
            avgFit: average(list.map((application) => application.aiScore?.matchScore)),
        };
    });

    const sum = (key) => rows.reduce((total, row) => total + row[key], 0);

    return {
        total: rows.length,
        rows,
        columns: [
            col("job", "Job", "text", 32, 3.4),
            col("status", "Status", "text", 9, 1),
            col("postedAt", "Posted", "date", 12, 1.3),
            col("deadline", "Deadline", "date", 12, 0),
            col("applicants", "Applicants", "number", 11, 1.2),
            col("received", "Received", "number", 10, 1.1),
            col("underReview", "Under review", "number", 12, 1.1),
            col("shortlistedPhase", "Shortlisted", "number", 11, 1.1),
            col("interview", "Interview", "number", 10, 1.1),
            col("decision", "Awaiting decision", "number", 16, 0),
            col("offer", "Offers", "number", 8, 1),
            col("hired", "Hired", "number", 8, 1),
            col("rejected", "Rejected", "number", 10, 1.1),
            col("onShortlist", "On your shortlist", "number", 15, 1.3),
            col("avgFit", "Average AI fit (%)", "percent", 16, 1.3),
        ],
        summary: [
            { label: "Jobs", value: rows.length },
            { label: "Open", value: rows.filter((row) => row.status === "Open").length },
            { label: "Applicants", value: sum("applicants") },
            { label: "Offers", value: sum("offer") },
            { label: "Hired", value: sum("hired") },
        ],
    };
};

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

const assessmentsReport = async ({ employerId, query, maxRows }) => {
    const { range, error } = dateRange(query);
    if (error) return { error };

    const where = {
        assessment: { employerId },
        application: {
            job: { companyId: employerId, deletedAt: null },
            ...(query.jobId ? { jobId: String(query.jobId) } : {}),
        },
        ...(range ? { invitedAt: range } : {}),
    };

    const [total, attempts] = await Promise.all([
        prisma.assessmentAttempt.count({ where }),
        prisma.assessmentAttempt.findMany({
            where,
            include: {
                assessment: { select: { title: true } },
                candidate: { select: { name: true, email: true } },
                application: { select: { job: { select: { title: true } } } },
            },
            orderBy: { invitedAt: "desc" },
            take: maxRows,
        }),
    ]);

    const now = new Date();
    const rows = attempts.map((attempt) => {
        const status = attempt.status === "invited" && attempt.dueAt < now ? "expired" : attempt.status;
        const finished = status === "submitted" || status === "scored";
        const scored = status === "scored" && attempt.percent !== null;
        const minutes = attempt.startedAt && attempt.submittedAt
            ? Math.max(1, Math.round((attempt.submittedAt - attempt.startedAt) / 60000))
            : null;
        return {
            candidate: attempt.candidate?.name || "Candidate",
            email: attempt.candidate?.email || "",
            job: attempt.application?.job?.title || "",
            assessment: attempt.assessment?.title || "",
            status: ATTEMPT_STATUS_LABELS[status] || status,
            score: finished && attempt.score !== null ? `${round1(attempt.score)} / ${round1(attempt.maxScore)}` : "",
            percent: scored ? attempt.percent : null,
            passMark: attempt.passMark,
            result: scored ? (attempt.percent >= attempt.passMark ? "Passed" : "Below pass mark") : "",
            invitedAt: attempt.invitedAt,
            dueAt: attempt.dueAt,
            submittedAt: attempt.submittedAt,
            timeTaken: minutes ? `${minutes} min` : "",
        };
    });

    const scoredRows = rows.filter((row) => row.percent !== null);

    return {
        total,
        rows,
        columns: [
            col("candidate", "Candidate", "text", 24, 2.4),
            col("email", "Email", "text", 28, 0),
            col("job", "Job", "text", 28, 2.4),
            col("assessment", "Assessment", "text", 28, 2.4),
            col("status", "Status", "text", 16, 1.5),
            col("score", "Score", "text", 11, 1.1),
            col("percent", "Percent (%)", "percent", 11, 1),
            col("passMark", "Pass mark (%)", "percent", 13, 1.1),
            col("result", "Result", "text", 15, 1.4),
            col("invitedAt", "Sent", "date", 12, 1.2),
            col("dueAt", "Due", "date", 12, 0),
            col("submittedAt", "Submitted", "date", 12, 1.2),
            col("timeTaken", "Time taken", "text", 11, 0),
        ],
        summary: [
            { label: "Sent", value: total },
            { label: "Completed", value: rows.filter((row) => row.status === "Scored" || row.status === "Awaiting marking").length },
            { label: "Awaiting marking", value: rows.filter((row) => row.status === "Awaiting marking").length },
            { label: "Average score", value: formatAverage(average(scoredRows.map((row) => row.percent))) },
            {
                label: "Pass rate",
                value: scoredRows.length ? `${percentOf(scoredRows.filter((row) => row.result === "Passed").length, scoredRows.length)}%` : "—",
            },
        ],
    };
};

function round1(value) {
    return Math.round(Number(value || 0) * 10) / 10;
}

function formatAverage(value) {
    return value === null ? "—" : `${value}%`;
}

const BUILDERS = {
    applicants: applicantsReport,
    shortlist: shortlistReport,
    pipeline: pipelineReport,
    jobs: jobsReport,
    assessments: assessmentsReport,
};

/**
 * Build one report for an employer. Returns the report, or `{ error }` for a
 * filter that cannot be read. Summary figures come from every row read, so a
 * PDF that prints only the first rows still totals all of them. `truncated`
 * is set when there were more than MAX_ROWS rows; `total` counts them all.
 */
const buildReport = async (type, { employerId, query = {} }) => {
    const maxRows = MAX_ROWS;
    const definition = REPORTS[type];
    if (!definition) return { error: "There is no report of that kind.", status: 404 };

    const stages = await getEmployerStages(employerId);
    const filters = await describeFilters({ employerId, query, stages, type });
    if (filters.error) return { error: filters.error };

    const built = await BUILDERS[type]({ employerId, query, stages, maxRows });
    if (built.error) return { error: built.error };

    const [company, user] = await Promise.all([
        prisma.company.findUnique({ where: { userId: employerId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: employerId }, select: { companyName: true, name: true } }),
    ]);

    return {
        type,
        title: definition.title,
        description: definition.description,
        orientation: definition.orientation,
        company: company?.name || user?.companyName || user?.name || "",
        subtitle: filters.subtitle,
        generatedAt: new Date(),
        columns: built.columns,
        rows: built.rows,
        total: built.total,
        truncated: built.rows.length < built.total && built.total > maxRows,
        summary: built.summary,
    };
};

module.exports = {
    REPORTS,
    MAX_ROWS,
    buildReport,
};
