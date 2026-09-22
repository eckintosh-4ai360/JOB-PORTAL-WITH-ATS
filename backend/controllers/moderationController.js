/**
 * Moderation queue.
 *
 * Every endpoint here is admin-only. The queue is the human half of the fraud
 * pipeline: automated screening opens cases, a reviewer decides them, and each
 * decision is written to an append-only event log so an enforcement action can
 * always be traced back to a person and a reason.
 */

const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const fraud = require("../services/fraudModerationService");

const CATEGORIES = ["fake_company", "duplicate_job", "spam_recruiter", "fake_resume"];
const STATES = ["open", "in_review", "actioned", "dismissed"];
const BANDS = ["low", "medium", "high", "critical"];

/** Reviewer actions and what each one enforces. */
const ACTIONS = {
    dismiss: { decision: "dismissed", state: "dismissed", label: "Dismissed as a false positive" },
    hide_job: { decision: "upheld", state: "actioned", label: "Job hidden" },
    restore_job: { decision: "dismissed", state: "dismissed", label: "Job restored" },
    suspend_recruiter: { decision: "upheld", state: "actioned", label: "Recruiter suspended" },
    reinstate_recruiter: { decision: "dismissed", state: "dismissed", label: "Recruiter reinstated" },
    flag_company: { decision: "upheld", state: "actioned", label: "Company flagged" },
    clear_company: { decision: "dismissed", state: "dismissed", label: "Company cleared" },
    reject_resume: { decision: "upheld", state: "actioned", label: "Resume rejected" },
    escalate: { decision: null, state: "in_review", label: "Escalated for a second opinion" },
};

/**
 * Load the thing a case is about.
 *
 * Cases point at an entity by type and id rather than through a foreign key,
 * because one queue spans four unrelated tables. That costs a lookup here and
 * buys a single uniform workflow.
 *
 * Soft-deleted jobs are loaded on purpose. A case raised against an advert the
 * employer has since taken down still has to open and resolve, or the queue
 * fills with entries no reviewer can ever clear.
 */
const loadSubject = async (entityType, entityId) => {
    try {
        if (entityType === "job") {
            return await prisma.job.findUnique({
                where: { id: entityId },
                select: {
                    id: true, title: true, description: true, requirements: true, location: true,
                    type: true, salaryMin: true, salaryMax: true, createdAt: true, isClosed: true,
                    moderationState: true, duplicateOfId: true, companyId: true,
                    company: { select: { id: true, name: true, email: true, companyName: true, trustState: true } },
                },
            });
        }
        if (entityType === "user") {
            return await prisma.user.findUnique({
                where: { id: entityId },
                select: {
                    id: true, name: true, email: true, role: true, companyName: true,
                    trustState: true, createdAt: true,
                    _count: { select: { postedJobs: true } },
                },
            });
        }
        if (entityType === "company") {
            return await prisma.company.findUnique({
                where: { id: entityId },
                select: {
                    id: true, name: true, legalName: true, registrationNumber: true, website: true,
                    hq: true, industry: true, description: true, contactName: true, contactEmail: true,
                    contactPhone: true, verified: true, trustState: true, createdAt: true,
                    user: { select: { id: true, email: true, name: true } },
                },
            });
        }
        if (entityType === "resume") {
            return await prisma.resumeAnalysis.findUnique({
                where: { id: entityId },
                select: {
                    id: true, fileName: true, overallScore: true, atsScore: true, qualityScore: true,
                    wordCount: true, profile: true, redFlags: true, createdAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            });
        }
    } catch (error) {
        console.warn(`Could not load ${entityType}:${entityId}:`, error.message);
    }
    return null;
};

// @desc    List moderation cases
// @route   GET /api/moderation/cases
// @access  Admin
const listCases = async (req, res) => {
    try {
        const { state, category, band, page = 1, limit = 20 } = req.query;

        const where = {};
        if (state && STATES.includes(state)) where.state = state;
        else if (!state) where.state = { in: ["open", "in_review"] };
        if (category && CATEGORIES.includes(category)) where.category = category;
        if (band && BANDS.includes(band)) where.band = band;

        const take = Math.min(100, Math.max(1, Number(limit) || 20));
        const skip = (Math.max(1, Number(page) || 1) - 1) * take;

        const [cases, total] = await Promise.all([
            prisma.moderationCase.findMany({
                where,
                include: { assessment: true },
                // Worst first: a critical case is worth more reviewer attention
                // than an older medium one.
                orderBy: [{ score: "desc" }, { createdAt: "desc" }],
                take,
                skip,
            }),
            prisma.moderationCase.count({ where }),
        ]);

        // Attach a light subject summary so the queue is readable without
        // opening every row.
        const withSubjects = await Promise.all(
            cases.map(async (item) => ({
                ...item,
                subject: await loadSubject(item.entityType, item.entityId),
            }))
        );

        res.status(200).json({
            cases: toClient(withSubjects),
            total,
            page: Number(page) || 1,
            pages: Math.ceil(total / take) || 1,
        });
    } catch (error) {
        console.error("listCases failed:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    One case with its full evidence and history
// @route   GET /api/moderation/cases/:id
// @access  Admin
const getCase = async (req, res) => {
    try {
        const item = await prisma.moderationCase.findUnique({
            where: { id: req.params.id },
            include: {
                assessment: true,
                events: { orderBy: { createdAt: "desc" } },
            },
        });
        if (!item) return res.status(404).json({ message: "Case not found" });

        const subject = await loadSubject(item.entityType, item.entityId);

        // Every assessment ever run on this entity, so a reviewer can see
        // whether the risk is rising or was already dismissed once.
        const history = await prisma.riskAssessment.findMany({
            where: { entityType: item.entityType, entityId: item.entityId },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        res.status(200).json({ case: toClient({ ...item, subject }), history: toClient(history) });
    } catch (error) {
        console.error("getCase failed:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** Carry out the enforcement half of a reviewer's decision. */
const enforce = async (action, item) => {
    switch (action) {
        case "hide_job":
            await prisma.job.update({ where: { id: item.entityId }, data: { moderationState: "hidden" } });
            return;
        case "restore_job":
            await prisma.job.update({
                where: { id: item.entityId },
                data: { moderationState: "clear", duplicateOfId: null },
            });
            return;
        case "suspend_recruiter":
            await prisma.user.update({
                where: { id: item.entityId },
                data: { trustState: "suspended", trustReviewedAt: new Date() },
            });
            await prisma.job.updateMany({
                where: { companyId: item.entityId, moderationState: { not: "hidden" } },
                data: { moderationState: "hidden" },
            });
            return;
        case "reinstate_recruiter":
            await prisma.user.update({
                where: { id: item.entityId },
                data: { trustState: "clear", trustReviewedAt: new Date() },
            });
            await prisma.job.updateMany({
                where: { companyId: item.entityId, moderationState: "hidden" },
                data: { moderationState: "clear" },
            });
            return;
        case "flag_company":
            await prisma.company.update({ where: { id: item.entityId }, data: { trustState: "flagged" } });
            return;
        case "clear_company":
            await prisma.company.update({
                where: { id: item.entityId },
                data: { trustState: "clear" },
            });
            return;
        default:
            // dismiss, escalate and reject_resume carry no automatic
            // enforcement. A rejected resume is recorded against the case and
            // acted on by a person — we never block a jobseeker automatically.
            return;
    }
};

// @desc    Decide a case
// @route   POST /api/moderation/cases/:id/decision
// @access  Admin
const decideCase = async (req, res) => {
    try {
        const { action, note } = req.body;
        const config = ACTIONS[action];
        if (!config) {
            return res.status(400).json({
                message: `Unknown action. Expected one of: ${Object.keys(ACTIONS).join(", ")}`,
            });
        }

        const item = await prisma.moderationCase.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ message: "Case not found" });
        if (item.state === "actioned" || item.state === "dismissed") {
            return res.status(409).json({ message: "This case has already been decided." });
        }

        await enforce(action, item);

        const updated = await prisma.moderationCase.update({
            where: { id: item.id },
            data: {
                state: config.state,
                decision: config.decision,
                decisionNote: note ? String(note).slice(0, 1000) : null,
                decidedById: config.decision ? req.user._id : null,
                decidedAt: config.decision ? new Date() : null,
            },
        });

        await prisma.moderationEvent.create({
            data: {
                caseId: item.id,
                action,
                note: note ? String(note).slice(0, 1000) : config.label,
                actorId: req.user._id,
                actorName: req.user.name || req.user.email,
            },
        });

        res.status(200).json({ message: config.label, case: toClient(updated) });
    } catch (error) {
        console.error("decideCase failed:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Re-run screening for an entity on demand
// @route   POST /api/moderation/rescan
// @access  Admin
const rescan = async (req, res) => {
    try {
        const { entityType, entityId } = req.body;
        if (!entityId) return res.status(400).json({ message: "entityId is required" });

        let result = null;
        if (entityType === "job") result = await fraud.screenJob(entityId);
        else if (entityType === "company") result = await fraud.screenCompany(entityId);
        else if (entityType === "resume") result = await fraud.screenResume(entityId);
        else return res.status(400).json({ message: "entityType must be job, company or resume" });

        if (!result) return res.status(404).json({ message: `${entityType} not found` });

        res.status(200).json({ message: "Rescan complete", result: toClient(result) });
    } catch (error) {
        console.error("rescan failed:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Queue headline numbers
// @route   GET /api/moderation/stats
// @access  Admin
const getStats = async (req, res) => {
    try {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

        const [byState, byCategory, byBand, hiddenJobs, suspendedRecruiters, recentAssessments] =
            await Promise.all([
                prisma.moderationCase.groupBy({ by: ["state"], _count: { _all: true } }),
                prisma.moderationCase.groupBy({
                    by: ["category"],
                    _count: { _all: true },
                    where: { state: { in: ["open", "in_review"] } },
                }),
                prisma.moderationCase.groupBy({
                    by: ["band"],
                    _count: { _all: true },
                    where: { state: { in: ["open", "in_review"] } },
                }),
                prisma.job.count({ where: { moderationState: "hidden", deletedAt: null } }),
                prisma.user.count({ where: { trustState: "suspended" } }),
                prisma.riskAssessment.count({ where: { createdAt: { gte: since } } }),
            ]);

        const tally = (rows, key) =>
            rows.reduce((acc, row) => ({ ...acc, [row[key]]: row._count._all }), {});

        // A queue that only ever upholds is not reviewing, it is rubber-stamping.
        const decided = await prisma.moderationCase.groupBy({
            by: ["decision"],
            _count: { _all: true },
            where: { decidedAt: { gte: since } },
        });
        const decisions = tally(decided, "decision");
        const upheld = decisions.upheld || 0;
        const dismissed = decisions.dismissed || 0;
        const falsePositiveRate = upheld + dismissed > 0
            ? Math.round((dismissed / (upheld + dismissed)) * 100)
            : null;

        res.status(200).json({
            openCases: (tally(byState, "state").open || 0) + (tally(byState, "state").in_review || 0),
            byState: tally(byState, "state"),
            byCategory: tally(byCategory, "category"),
            byBand: tally(byBand, "band"),
            hiddenJobs,
            suspendedRecruiters,
            assessmentsLast30Days: recentAssessments,
            falsePositiveRate,
            aiEnabled: require("../utils/groqClient").isConfigured(),
            thresholds: {
                caseMinScore: fraud.CASE_MIN_SCORE,
                aiReviewMinScore: fraud.AI_REVIEW_MIN_SCORE,
                autoActionMinScore: fraud.AUTO_ACTION_MIN_SCORE,
                aiMaxAdjustment: fraud.AI_MAX_ADJUSTMENT,
            },
        });
    } catch (error) {
        console.error("getStats failed:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    listCases,
    getCase,
    decideCase,
    rescan,
    getStats,
    ACTIONS,
    CATEGORIES,
};
