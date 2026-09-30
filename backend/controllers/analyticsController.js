const prisma = require("../config/prisma");
const { activeEmployerWhere } = require("../services/employerVisibility");
const { toClient } = require("../utils/prismaHelper");
const {
    LEGACY_STATUSES,
    normalizeStatus,
    findStage,
    getEmployerStages,
} = require("../utils/hiringPipeline");

// @desc    Get or generate analytics for the logged-in employer
// @route   GET /api/analytics
// @access  Private (Employer only)
const getEmployerAnalytics = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access analytics" });
        }

        const employerId = req.user._id;

        // Live counts 
        const totalActiveJobs = await prisma.job.count({
            where: { companyId: employerId, isClosed: false, deletedAt: null },
        });

        const allJobs = await prisma.job.findMany({
            where: { companyId: employerId, deletedAt: null },
            select: { id: true },
        });
        const jobIds = allJobs.map((j) => j.id);

        const totalApplicants = await prisma.application.count({
            where: { jobId: { in: jobIds } },
        });

        const stages = await getEmployerStages(employerId);
        // The first pipeline stage is where every new application lands. This
        // is the most immediately useful dashboard queue: candidates an
        // employer has not reviewed yet.
        const firstStageId = stages[0]?.id;
        const legacyFirstStageStatuses = firstStageId
            ? Object.entries(LEGACY_STATUSES)
                .filter(([, stageId]) => stageId === firstStageId)
                .map(([status]) => status)
            : [];
        const applicantsToReview = firstStageId
            ? await prisma.application.count({
                where: {
                    jobId: { in: jobIds },
                    status: { in: [firstStageId, ...legacyFirstStageStatuses] },
                },
            })
            : 0;

        // Recent jobs (last 5, newest first) 
        const recentJobs = await prisma.job.findMany({
            where: { companyId: employerId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                title: true,
                location: true,
                createdAt: true,
                isClosed: true,
                _count: {
                    select: { applications: true },
                },
            },
        });

        const recentJobsWithCount = recentJobs.map((job) => ({
            _id:            job.id,
            id:             job.id,
            title:          job.title,
            location:       job.location,
            createdAt:      job.createdAt,
            isActive:       !job.isClosed,
            isClosed:       job.isClosed,
            applicantCount: job._count.applications,
        }));

        // Recent applications (last 5)
        const recentApplications = await prisma.application.findMany({
            where: { jobId: { in: jobIds } },
            orderBy: { updatedAt: "desc" },
            take: 5,
            include: {
                applicant: { select: { name: true } },
                job: { select: { title: true } },
            },
        });

        const recentApplicationsMapped = recentApplications.map((app) => ({
            _id:       app.id,
            id:        app.id,
            applicant: app.applicant?.name || app.guestName || "Unknown",
            job:       { title: app.job?.title || "" },
            status:    findStage(stages, app.status)?.name || app.status,
            phase:     findStage(stages, app.status)?.phase || "received",
            stageType: findStage(stages, app.status)?.type || "standard",
            updatedAt: app.updatedAt,
        }));

        res.status(200).json({
            counts: {
                totalActiveJobs,
                totalApplicants,
                applicantsToReview,
                trends: { activeJobs: 0, applicants: 0 },
            },
            recentJobs:         recentJobsWithCount,
            recentApplications: recentApplicationsMapped,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get application status breakdown for a specific job
// @route   GET /api/analytics/job/:jobId
// @access  Private (Employer only — must own the job)
const getJobAnalytics = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access analytics" });
        }

        const job = await prisma.job.findUnique({
            where: { id: req.params.jobId },
        });

        if (!job || job.deletedAt) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to view analytics for this job" });
        }

        // Count applications per status
        const statusGroups = await prisma.application.groupBy({
            by: ["status"],
            where: { jobId: job.id },
            _count: { _all: true },
        });

        // Legacy names and their stage ids are the same stage, so fold them.
        const stages = await getEmployerStages(req.user._id);
        const byStage = new Map();
        for (const group of statusGroups) {
            const id = normalizeStatus(group.status);
            byStage.set(id, (byStage.get(id) || 0) + group._count._all);
        }
        const statusBreakdown = [...byStage].map(([id, count]) => ({
            _id:   id,
            name:  findStage(stages, id)?.name || id,
            count,
        }));

        const totalApplications = await prisma.application.count({
            where: { jobId: job.id },
        });

        res.status(200).json({
            job: { id: job.id, _id: job.id, title: job.title },
            totalApplications,
            statusBreakdown,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get platform-wide stats (admin use or public summary)
// @route   GET /api/analytics/summary
// @access  Public
const getPlatformSummary = async (req, res) => {
    try {
        const visibleJobs = {
            isClosed: false,
            deletedAt: null,
            moderationState: { not: "hidden" },
            company: activeEmployerWhere(),
        };
        const totalJobs = await prisma.job.count({ where: visibleJobs });
        const totalApplications = await prisma.application.count();
        const companies = await prisma.job.groupBy({
            by: ["companyId"],
            where: visibleJobs,
        });
        const totalEmployers = companies.length;

        res.status(200).json({
            totalActiveJobs: totalJobs,
            totalApplications,
            totalEmployers,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getEmployerAnalytics,
    getJobAnalytics,
    getPlatformSummary,
};
