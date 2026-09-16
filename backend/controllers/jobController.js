const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer only)
const createJob = async (req, res) => {
    try {
        const { title, description, requirements, location, latitude, longitude, category, customCategory, type, customJobType, salaryMin, salaryMax, companyLogo, deadline } = req.body;

        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can post jobs" });
        }

        const job = await prisma.job.create({
            data: {
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
                deadline: deadline ? new Date(deadline) : undefined,
                salaryMin: salaryMin ? Number(salaryMin) : undefined,
                salaryMax: salaryMax ? Number(salaryMax) : undefined,
                companyLogo,
                companyId: req.user._id,
            }
        });

        res.status(201).json({ message: "Job created successfully", job: toClient(job) });
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

        const where = { isClosed: false };

        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: "insensitive" } },
                { description: { contains: keyword, mode: "insensitive" } },
            ];
        }
        if (location) where.location = { contains: location, mode: "insensitive" };
        if (category) where.category = { contains: category, mode: "insensitive" };
        if (type) where.type = type;

        const skip = (Number(page) - 1) * Number(limit);
        const total = await prisma.job.count({ where });

        const jobs = await prisma.job.findMany({
            where,
            include: {
                company: {
                    select: { id: true, name: true, companyName: true, companyLogo: true }
                }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: Number(limit),
        });

        res.status(200).json({
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            jobs: toClient(jobs),
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
        const job = await prisma.job.findUnique({
            where: { id: req.params.id },
            include: {
                company: {
                    select: { id: true, name: true, companyName: true, companyLogo: true, companyDescription: true }
                }
            }
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json(toClient(job));
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

        const jobs = await prisma.job.findMany({
            where: { companyId: req.user._id },
            include: {
                company: { select: { id: true, name: true } },
                _count: { select: { applications: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const jobsWithCount = jobs.map(job => ({
            ...toClient(job),
            applicantCount: job._count.applications,
        }));

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
        const job = await prisma.job.findUnique({ where: { id: req.params.id } });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to update this job" });
        }

        const { companyId, id, createdAt, updatedAt, ...updateData } = req.body;
        if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
        if (updateData.salaryMin) updateData.salaryMin = Number(updateData.salaryMin);
        if (updateData.salaryMax) updateData.salaryMax = Number(updateData.salaryMax);

        const updatedJob = await prisma.job.update({
            where: { id: req.params.id },
            data: updateData,
        });

        res.status(200).json({ message: "Job updated successfully", job: toClient(updatedJob) });
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
        const job = await prisma.job.findUnique({ where: { id: req.params.id } });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to close this job" });
        }

        const updatedJob = await prisma.job.update({
            where: { id: req.params.id },
            data: { isClosed: !job.isClosed },
        });

        res.status(200).json({
            message: updatedJob.isClosed ? "Job closed successfully" : "Job reopened successfully",
            job: toClient(updatedJob)
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
        const job = await prisma.job.findUnique({ where: { id: req.params.id } });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to delete this job" });
        }

        await prisma.job.delete({ where: { id: req.params.id } });

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
