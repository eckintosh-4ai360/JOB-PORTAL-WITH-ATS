const SavedJob = require("../models/SavedJob");
const Job = require("../models/Job");

// @desc    Save a job
// @route   POST /api/saved-jobs/:jobId
// @access  Private (Jobseeker only)
const saveJob = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can save jobs" });
        }

        const job = await Job.findById(req.params.jobId);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        // Prevent duplicate saves
        const alreadySaved = await SavedJob.findOne({
            jobSeeker: req.user._id,
            job: req.params.jobId,
        });

        if (alreadySaved) {
            return res.status(400).json({ message: "You have already saved this job" });
        }

        const savedJob = await SavedJob.create({
            jobSeeker: req.user._id,
            job: req.params.jobId,
        });

        res.status(201).json({ message: "Job saved successfully", savedJob });
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

        const savedJobs = await SavedJob.find({ jobSeeker: req.user._id })
            .populate({
                path: "job",
                select: "title location type category salaryMin salaryMax isClosed",
                populate: {
                    path: "company",
                    select: "name companyName companyLogo",
                },
            })
            .sort({ createdAt: -1 });

        res.status(200).json(savedJobs);
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

        const savedJob = await SavedJob.findOne({
            jobSeeker: req.user._id,
            job: req.params.jobId,
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

        const savedJob = await SavedJob.findOneAndDelete({
            jobSeeker: req.user._id,
            job: req.params.jobId,
        });

        if (!savedJob) {
            return res.status(404).json({ message: "Saved job not found" });
        }

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
