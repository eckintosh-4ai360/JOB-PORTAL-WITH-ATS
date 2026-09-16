const Analytics = require("../models/Analytics");
const Job = require("../models/Job");
const Application = require("../models/Application");

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
        const totalActiveJobs = await Job.countDocuments({ company: employerId, isClosed: false });

        const allJobs     = await Job.find({ company: employerId }).select("_id");
        const jobIds      = allJobs.map((j) => j._id);

        const totalApplicants = await Application.countDocuments({ job: { $in: jobIds } });
        const totalHired      = await Application.countDocuments({
            job: { $in: jobIds },
            status: "Offered",
        });

        const hiringRate = totalApplicants > 0
            ? Math.round((totalHired / totalApplicants) * 100)
            : 0;

        // Recent jobs (last 5, newest first) 
        const recentJobs = await Job.find({ company: employerId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("title location createdAt isClosed");

        // Count applicants per job and attach
        const recentJobsWithCount = await Promise.all(
            recentJobs.map(async (job) => {
                const applicantCount = await Application.countDocuments({ job: job._id });
                return {
                    _id:            job._id,
                    title:          job.title,
                    location:       job.location,
                    createdAt:      job.createdAt,
                    isActive:       !job.isClosed,
                    isClosed:       job.isClosed,
                    applicantCount,
                };
            })
        );

        // Recent applications (last 5)
        const recentApplications = await Application.find({ job: { $in: jobIds } })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate("applicant", "name")   // applicant = User ref
            .populate("job", "title");

        const recentApplicationsMapped = recentApplications.map((app) => ({
            _id:       app._id,
            applicant: app.applicant?.name || "Unknown",
            job:       { title: app.job?.title || "" },
            status:    app.status,
            updatedAt: app.updatedAt,
        }));

        res.status(200).json({
            counts: {
                totalActiveJobs,
                totalApplicants,
                hiringRate,
                trends: { activeJobs: 0, applicants: 0, hiringRate: 0 }, // extend later
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

        const job = await Job.findById(req.params.jobId);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to view analytics for this job" });
        }

        // Count applications per status
        const statusBreakdown = await Application.aggregate([
            { $match: { job: job._id } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        const totalApplications = await Application.countDocuments({ job: job._id });

        res.status(200).json({
            job: { id: job._id, title: job.title },
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
        const totalJobs = await Job.countDocuments({ isClosed: false });
        const totalApplications = await Application.countDocuments();
        const totalEmployers = await Job.distinct("company").then((ids) => ids.length);

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
