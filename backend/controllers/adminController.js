const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const {
    sendCompanyUnderReviewEmail,
    sendCompanyApprovedEmail,
    sendCompanyRejectedEmail,
} = require("../utils/emailService");

// pending = submitted and queued, in_review = a reviewer has picked it up.
const APPROVAL_STATES = ["pending", "in_review", "approved", "rejected"];

// The hiring contact is who asked to be reviewed, but fall back to the account
// holder so a company never moves state without hearing about it.
const reviewRecipient = (company) => ({
    to: company.contactEmail || company.user?.email || null,
    contactName: company.contactName || company.user?.name,
});

const getPagination = (query) => {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);

    return { page, limit, skip: (page - 1) * limit };
};

const companyDetailSelect = {
    id: true, userId: true, name: true, legalName: true, organizationType: true,
    registrationNumber: true, description: true, logo: true, hq: true, industry: true,
    employees: true, website: true, stage: true,
    contactName: true, contactTitle: true, contactEmail: true, contactPhone: true,
    authorityConfirmedAt: true, termsAcceptedAt: true, hiringPolicyAcceptedAt: true,
    registrationDocUrl: true, registrationDocName: true,
    approvalState: true, approvalNote: true, reviewedAt: true, reviewedById: true,
    submittedForReviewAt: true, verified: true, trustState: true, rating: true,
    createdAt: true, updatedAt: true,
    user: { select: { id: true, name: true, email: true, role: true, trustState: true, createdAt: true } },
    _count: { select: { jobs: true } },
};

// @desc    Counts for the admin dashboard
// @route   GET /api/admin/overview
// @access  Private (Admin only)
const getOverview = async (req, res) => {
    try {
        const [byState, totalCompanies, employers, jobseekers, liveJobs, hiddenJobs, applications, awaitingSetup] =
            await Promise.all([
                prisma.company.groupBy({ by: ["approvalState"], _count: { _all: true } }),
                prisma.company.count(),
                prisma.user.count({ where: { role: "employer" } }),
                prisma.user.count({ where: { role: "jobseeker" } }),
                prisma.job.count({ where: { deletedAt: null, isClosed: false } }),
                prisma.job.count({ where: { deletedAt: null, moderationState: "hidden" } }),
                prisma.application.count(),
                // An employer who started but never finished onboarding has no
                // company row at all, so there is no state to group them by.
                prisma.user.count({
                    where: { role: "employer", employerOnboardingComplete: false, company: { is: null } },
                }),
            ]);

        const tally = APPROVAL_STATES.reduce((acc, state) => {
            acc[state] = byState.find((row) => row.approvalState === state)?._count?._all || 0;
            return acc;
        }, {});

        res.status(200).json({
            companies: { total: totalCompanies, ...tally, awaitingSetup },
            people: { employers, jobseekers },
            jobs: { live: liveJobs, hidden: hiddenJobs },
            applications,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Every company on the platform, for review
// @route   GET /api/admin/companies
// @access  Private (Admin only)
const listCompanies = async (req, res) => {
    try {
        const { state, search } = req.query;
        const { page, limit, skip } = getPagination(req.query);

        const where = {};
        if (state && APPROVAL_STATES.includes(state)) where.approvalState = state;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { legalName: { contains: search, mode: "insensitive" } },
                { registrationNumber: { contains: search, mode: "insensitive" } },
                { user: { email: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [total, companies] = await Promise.all([
            prisma.company.count({ where }),
            prisma.company.findMany({
                where,
                select: companyDetailSelect,
                // Pending first: the queue is the reason this screen exists.
                orderBy: [{ approvalState: "asc" }, { createdAt: "desc" }],
                skip,
                take: limit,
            }),
        ]);

        // Employers who never finished onboarding have no company row, so they
        // would be invisible here — which is exactly when an admin wants to see
        // them. Listed on the first page only, since they are not paginated.
        let incomplete = [];
        if (page === 1 && (!state || state === "pending")) {
            const stalled = await prisma.user.findMany({
                where: { role: "employer", employerOnboardingComplete: false, company: { is: null } },
                select: { id: true, name: true, email: true, companyName: true, createdAt: true },
                orderBy: { createdAt: "desc" },
            });
            incomplete = stalled.map((user) => ({
                id: `setup_${user.id}`,
                userId: user.id,
                name: user.companyName || user.name,
                approvalState: "setup_incomplete",
                verified: false,
                user: { id: user.id, name: user.name, email: user.email },
                createdAt: user.createdAt,
                _count: { jobs: 0 },
            }));
        }

        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            companies: toClient(companies),
            incompleteSetups: toClient(incomplete),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    One company, with everything a reviewer needs to decide
// @route   GET /api/admin/companies/:id
// @access  Private (Admin only)
const getCompany = async (req, res) => {
    try {
        const company = await prisma.company.findUnique({
            where: { id: req.params.id },
            select: {
                ...companyDetailSelect,
                jobs: {
                    where: { deletedAt: null },
                    select: { id: true, title: true, isClosed: true, moderationState: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
            },
        });

        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        res.status(200).json({ company: toClient(company) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Pick up a submitted company for review
// @route   POST /api/admin/companies/:id/review
// @access  Private (Admin only)
const startCompanyReview = async (req, res) => {
    try {
        // Conditional on the current state, so two reviewers opening the same
        // company at once send the employer one email, not two.
        const { count } = await prisma.company.updateMany({
            where: { id: req.params.id, approvalState: "pending" },
            data: { approvalState: "in_review", reviewedById: req.user._id },
        });

        const updated = await prisma.company.findUnique({
            where: { id: req.params.id },
            select: companyDetailSelect,
        });

        if (!updated) {
            return res.status(404).json({ message: "Company not found" });
        }

        if (count === 0) {
            return res.status(409).json({
                message: "Only a submitted company can be moved into review.",
                company: toClient(updated),
            });
        }

        const { to, contactName } = reviewRecipient(updated);
        if (to) {
            // Not awaited: a mail outage must not undo a state already written.
            sendCompanyUnderReviewEmail({ to, contactName, companyName: updated.name });
        }

        res.status(200).json({
            message: `${updated.name} is now under review.`,
            emailedTo: to,
            company: toClient(updated),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Approve or reject a company
// @route   POST /api/admin/companies/:id/decision
// @access  Private (Admin only)
const decideCompany = async (req, res) => {
    try {
        const { decision, note } = req.body;

        if (!["approved", "rejected"].includes(decision)) {
            return res.status(400).json({ message: "Decision must be approved or rejected." });
        }

        // A rejection the employer cannot act on is just a dead end.
        if (decision === "rejected" && !String(note || "").trim()) {
            return res.status(400).json({
                message: "Give a reason when rejecting, so the employer knows what to fix.",
            });
        }

        const company = await prisma.company.findUnique({
            where: { id: req.params.id },
            select: { id: true, name: true, approvalState: true },
        });

        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        // Every company passes through review before a decision, so the
        // employer always gets the under-review email before the outcome.
        if (company.approvalState === "pending") {
            return res.status(409).json({
                message: "Start the review before approving or rejecting this company.",
            });
        }

        const updated = await prisma.company.update({
            where: { id: req.params.id },
            data: {
                approvalState: decision,
                approvalNote: String(note || "").trim() || null,
                reviewedAt: new Date(),
                reviewedById: req.user._id,
                // The badge is the public face of this decision, so it moves with it.
                verified: decision === "approved",
            },
            select: companyDetailSelect,
        });

        // Tell the employer. Not awaited: a mail outage must not lose a decision
        // that is already written.
        const { to: recipient, contactName } = reviewRecipient(updated);
        if (recipient) {
            if (decision === "approved") {
                sendCompanyApprovedEmail({
                    to: recipient,
                    contactName,
                    companyName: updated.name,
                    note: updated.approvalNote,
                });
            } else {
                sendCompanyRejectedEmail({
                    to: recipient,
                    contactName,
                    companyName: updated.name,
                    reason: updated.approvalNote,
                });
            }
        }

        res.status(200).json({
            message: decision === "approved"
                ? `${updated.name} approved and can now post jobs.`
                : `${updated.name} rejected.`,
            emailedTo: recipient || null,
            company: toClient(updated),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Every account on the platform
// @route   GET /api/admin/accounts
// @access  Private (Admin only)
const listAccounts = async (req, res) => {
    try {
        const { role, trustState, search } = req.query;
        const { page, limit, skip } = getPagination(req.query);

        const where = {};
        if (role && ["jobseeker", "employer", "admin"].includes(role)) where.role = role;
        if (trustState && ["clear", "flagged", "suspended"].includes(trustState)) where.trustState = trustState;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                select: {
                    id: true, name: true, email: true, role: true, avatar: true,
                    companyName: true, trustState: true, employerOnboardingComplete: true, createdAt: true,
                    company: { select: { id: true, name: true, approvalState: true } },
                    _count: { select: { postedJobs: true, applications: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            accounts: toClient(users),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Every posting on the platform, soft-deleted ones included
// @route   GET /api/admin/jobs
// @access  Private (Admin only)
const listJobs = async (req, res) => {
    try {
        const { status, search } = req.query;
        const { page, limit, skip } = getPagination(req.query);

        // Soft-deleted postings are hidden by default but reachable, since the
        // whole point of keeping the row is that somebody can still look at it.
        const where = { deletedAt: null };
        if (status === "hidden") where.moderationState = "hidden";
        if (status === "flagged") where.moderationState = "flagged";
        if (status === "closed") where.isClosed = true;
        if (status === "live") {
            where.isClosed = false;
            where.moderationState = { not: "hidden" };
        }
        if (status === "deleted") {
            delete where.deletedAt;
            where.NOT = { deletedAt: null };
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, jobs] = await Promise.all([
            prisma.job.count({ where }),
            prisma.job.findMany({
                where,
                select: {
                    id: true, title: true, location: true, type: true, category: true,
                    isClosed: true, moderationState: true, deletedAt: true, createdAt: true,
                    company: { select: { id: true, name: true, companyName: true, email: true } },
                    companyProfile: { select: { id: true, name: true, approvalState: true, verified: true } },
                    _count: { select: { applications: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            jobs: toClient(jobs),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getOverview,
    listCompanies,
    getCompany,
    startCompanyReview,
    decideCompany,
    listAccounts,
    listJobs,
};
