const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

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
            where: { companyId: employerId, isClosed: false },
        });

        const allJobs = await prisma.job.findMany({
            where: { companyId: employerId },
            select: { id: true },
        });
        const jobIds = allJobs.map((j) => j.id);

        const totalApplicants = await prisma.application.count({
            where: { jobId: { in: jobIds } },
        });

        const totalHired = await prisma.application.count({
            where: {
                jobId: { in: jobIds },
                status: "Offered",
            },
        });

        const hiringRate = totalApplicants > 0
            ? Math.round((totalHired / totalApplicants) * 100)
            : 0;

        // Recent jobs (last 5, newest first) 
        const recentJobs = await prisma.job.findMany({
            where: { companyId: employerId },
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
            status:    app.status,
            updatedAt: app.updatedAt,
        }));

        res.status(200).json({
            counts: {
                totalActiveJobs,
                totalApplicants,
                hiringRate,
                trends: { activeJobs: 0, applicants: 0, hiringRate: 0 },
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

        if (!job) {
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

        const statusBreakdown = statusGroups.map((g) => ({
            _id:   g.status,
            count: g._count._all,
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
        const totalJobs = await prisma.job.count({ where: { isClosed: false } });
        const totalApplications = await prisma.application.count();
        const companies = await prisma.job.groupBy({
            by: ["companyId"],
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
