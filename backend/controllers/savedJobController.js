const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc    Save a job
// @route   POST /api/saved-jobs/:jobId
// @access  Private (Jobseeker only)
const saveJob = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can save jobs" });
        }

        const job = await prisma.job.findUnique({
            where: { id: req.params.jobId },
        });

        if (!job || job.deletedAt) {
            return res.status(404).json({ message: "Job not found" });
        }

        // Prevent duplicate saves
        const alreadySaved = await prisma.savedJob.findUnique({
            where: {
                jobSeekerId_jobId: {
                    jobSeekerId: req.user._id,
                    jobId: req.params.jobId,
                },
            },
        });

        if (alreadySaved) {
            return res.status(400).json({ message: "You have already saved this job" });
        }

        const savedJob = await prisma.savedJob.create({
            data: {
                jobSeekerId: req.user._id,
                jobId: req.params.jobId,
            },
        });

        res.status(201).json({ message: "Job saved successfully", savedJob: toClient(savedJob) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all saved jobs for the logged-in jobseeker
// @route   GET /api/saved-jobs
// @access  Private (Jobseeker only)
const getSavedJobs = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can access saved jobs" });
        }

        const savedJobs = await prisma.savedJob.findMany({
            where: { jobSeekerId: req.user._id, job: { deletedAt: null } },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        category: true,
                        salaryMin: true,
                        salaryMax: true,
                        isClosed: true,
                        companyLogo: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                companyName: true,
                                companyLogo: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json(toClient(savedJobs));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Check if a specific job is saved by the logged-in jobseeker
// @route   GET /api/saved-jobs/check/:jobId
// @access  Private (Jobseeker only)
const checkIfJobSaved = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can access saved jobs" });
        }

        const savedJob = await prisma.savedJob.findUnique({
            where: {
                jobSeekerId_jobId: {
                    jobSeekerId: req.user._id,
                    jobId: req.params.jobId,
                },
            },
        });

        res.status(200).json({ isSaved: !!savedJob });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Unsave (remove) a saved job
// @route   DELETE /api/saved-jobs/:jobId
// @access  Private (Jobseeker only)
const unsaveJob = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can unsave jobs" });
        }

        const savedJob = await prisma.savedJob.findUnique({
            where: {
                jobSeekerId_jobId: {
                    jobSeekerId: req.user._id,
                    jobId: req.params.jobId,
                },
            },
        });

        if (!savedJob) {
            return res.status(404).json({ message: "Saved job not found" });
        }

        await prisma.savedJob.delete({
            where: {
                jobSeekerId_jobId: {
                    jobSeekerId: req.user._id,
                    jobId: req.params.jobId,
                },
            },
        });

        res.status(200).json({ message: "Job removed from saved list" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    saveJob,
    getSavedJobs,
    checkIfJobSaved,
    unsaveJob,
};
