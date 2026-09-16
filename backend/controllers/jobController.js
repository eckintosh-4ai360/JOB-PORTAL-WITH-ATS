const Job = require("../models/Job");

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer only)
const createJob = async (req, res) => {
    try {
        const { title, description, requirements, location, latitude, longitude, category, customCategory, type, customJobType, salaryMin, salaryMax, companyLogo, deadline } = req.body;

        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can post jobs" });
        }

        const job = await Job.create({
            title,
            description,
            requirements,
            location,
            latitude: latitude ? Number(latitude) : undefined,
            longitude: longitude ? Number(longitude) : undefined,
            category,
            customCategory: category === "other" ? customCategory : undefined,
            type,
            customJobType: type === "Other" ? customJobType : undefined,
            deadline: deadline || undefined,
            salaryMin,
            salaryMax,
            companyLogo,
            company: req.user._id,
        });

        res.status(201).json({ message: "Job created successfully", job });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all open job listings (with optional filters)
// @route   GET /api/jobs
// @access  Public
const getAllJobs = async (req, res) => {
    try {
        const { keyword, location, category, type, page = 1, limit = 10 } = req.query;

        const filter = { isClosed: false };

        if (keyword) {
            filter.$or = [
                { title: { $regex: keyword, $options: "i" } },
                { description: { $regex: keyword, $options: "i" } },
            ];
        }
        if (location) filter.location = { $regex: location, $options: "i" };
        if (category) filter.category = { $regex: category, $options: "i" };
        if (type) filter.type = type;

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Job.countDocuments(filter);

        const jobs = await Job.find(filter)
            .populate("company", "name companyName companyLogo")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.status(200).json({
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            jobs,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get a single job by ID
// @route   GET /api/jobs/:id
// @access  Public
const getJobById = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate(
            "company",
            "name companyName companyLogo companyDescription"
        );

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json(job);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all jobs posted by the logged-in employer
// @route   GET /api/jobs/my-jobs
// @access  Private (Employer only)
const getMyJobs = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access this route" });
        }

        const jobs = await Job.find({ company: req.user._id })
            .populate("company", "name")
            .sort({ createdAt: -1 });

        const jobsWithCount = await Promise.all(
            jobs.map(async (job) => {
                const Application = require("../models/Application"); // local import to avoid circular dependency issues if any
                const applicantCount = await Application.countDocuments({ job: job._id });
                return {
                    ...job.toObject(),
                    applicantCount,
                };
            })
        );

        res.status(200).json(jobsWithCount);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Update a job posting
// @route   PUT /api/jobs/:id
// @access  Private (Employer only — must be the owner)
const updateJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to update this job" });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            { ...req.body },
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: "Job updated successfully", job: updatedJob });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Close a job posting (mark as closed without deleting)
// @route   PATCH /api/jobs/:id/close
// @access  Private (Employer only — must be the owner)
const closeJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to close this job" });
        }

        job.isClosed = !job.isClosed;
        await job.save();

        res.status(200).json({
            message: job.isClosed ? "Job closed successfully" : "Job reopened successfully",
            job
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Delete a job posting
// @route   DELETE /api/jobs/:id
// @access  Private (Employer only — must be the owner)
const deleteJob = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.company.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized to delete this job" });
        }

        await job.deleteOne();

        res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    createJob,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    closeJob,
    deleteJob,
};
