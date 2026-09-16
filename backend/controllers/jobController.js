const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer or Admin)
const createJob = async (req, res) => {
    try {
        const {
            title,
            description,
            requirements,
            location,
            latitude,
            longitude,
            category,
            customCategory,
            type,
            jobType,
            customJobType,
            salaryMin,
            salaryMax,
            companyLogo,
            deadline,
        } = req.body;

        if (req.user.role !== "employer" && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only employers and admins can post jobs" });
        }

        const effectiveType = type || jobType || "Full-Time";
        const effectiveLogo = companyLogo || req.user.companyLogo || "";

        // Check if employer has a dedicated Company profile
        let employerCompany = await prisma.company.findUnique({
            where: { userId: req.user._id }
        });

        // If no company profile exists yet, create one for this employer!
        if (!employerCompany) {
            const companyDisplayName = req.body.companyName || req.user.companyName || req.user.name || "Enterprise Company";
            try {
                employerCompany = await prisma.company.create({
                    data: {
                        userId: req.user._id,
                        name: companyDisplayName,
                        logo: effectiveLogo,
                        description: req.user.companyDescription || `${companyDisplayName} is hiring on SPG Talent Network.`,
                        hq: location || "Accra, Ghana",
                        stage: "Growth",
                        industry: category || "Technology",
                        employees: "20-100",
                        verified: true,
                        rating: 4.8,
                    }
                });

                if (!req.user.companyName) {
                    await prisma.user.update({
                        where: { id: req.user._id },
                        data: { companyName: companyDisplayName }
                    });
                }
            } catch (createCompErr) {
                console.warn("Could not auto-create company profile:", createCompErr.message);
            }
        }

        const job = await prisma.job.create({
            data: {
                title,
                description,
                requirements: requirements || description || "See job description for details.",
                location: location || "Remote",
                latitude: latitude ? Number(latitude) : undefined,
                longitude: longitude ? Number(longitude) : undefined,
                category: category || "Engineering",
                customCategory: category === "other" ? customCategory : undefined,
                type: effectiveType,
                jobType: effectiveType,
                customJobType: effectiveType === "Other" ? customJobType : undefined,
                deadline: deadline ? new Date(deadline) : undefined,
                salaryMin: salaryMin ? Number(salaryMin) : undefined,
                salaryMax: salaryMax ? Number(salaryMax) : undefined,
                companyLogo: effectiveLogo,
                companyId: req.user._id,
                companyProfileId: employerCompany ? employerCompany.id : undefined,
            },
            include: {
                company: {
                    select: { id: true, name: true, companyName: true, companyLogo: true, companyDescription: true }
                },
                companyProfile: true,
            }
        });

        const clientJob = toClient(job);
        clientJob.companyName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Company";
        clientJob.companyLogo = job.companyProfile?.logo || job.companyLogo || job.company?.companyLogo || "";

        res.status(201).json({ message: "Job created successfully", job: clientJob });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all registered companies / employers (public)
// @route   GET /api/jobs/companies
// @access  Public
const getCompanies = async (req, res) => {
    try {
        const employers = await prisma.user.findMany({
            where: {
                role: { in: ["employer", "admin"] },
            },
            select: {
                id: true,
                name: true,
                companyName: true,
                companyDescription: true,
                companyLogo: true,
                createdAt: true,
                postedJobs: {
                    where: { isClosed: false },
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        salaryMin: true,
                        salaryMax: true,
                        category: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const companies = employers.map((emp) => {
            const displayName = emp.companyName || emp.name || "Enterprise Employer";
            return {
                id: emp.id,
                _id: emp.id,
                name: displayName,
                companyName: displayName,
                description: emp.companyDescription || "Leading organization actively recruiting top talent through SPG Job Portal.",
                logo: emp.companyLogo || "",
                companyLogo: emp.companyLogo || "",
                hq: "Ghana / West Africa / Remote",
                stage: "Growth / Enterprise",
                industry: "Technology & Services",
                employees: "20-500",
                openRoles: emp.postedJobs.length,
                jobs: toClient(emp.postedJobs),
                stack: ["React", "Node.js", "PostgreSQL", "Cloud"],
                perks: ["Health Coverage", "Flexible Model", "Growth Budget", "Paid Time Off"],
                glassdoor: 4.8,
                createdAt: emp.createdAt,
            };
        });

        res.status(200).json({ companies: toClient(companies) });
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
        const { keyword, location, category, type, page = 1, limit = 50 } = req.query;

        const where = { isClosed: false };

        if (keyword) {
            where.OR = [
                { title: { contains: keyword, mode: "insensitive" } },
                { description: { contains: keyword, mode: "insensitive" } },
            ];
        }
        if (location) where.location = { contains: location, mode: "insensitive" };
        if (category) where.category = { contains: category, mode: "insensitive" };
        if (type) where.type = { contains: type, mode: "insensitive" };

        const skip = (Number(page) - 1) * Number(limit);
        const total = await prisma.job.count({ where });

        const jobs = await prisma.job.findMany({
            where,
            include: {
                company: {
                    select: { id: true, name: true, companyName: true, companyLogo: true, companyDescription: true }
                },
                companyProfile: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: Number(limit),
        });

        const mappedJobs = jobs.map((job) => {
            const clientJob = toClient(job);
            const compName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Verified Employer";
            const compLogo = job.companyProfile?.logo || job.companyLogo || job.company?.companyLogo || "";
            clientJob.companyName = compName;
            clientJob.companyLogo = compLogo;
            if (!clientJob.company) {
                clientJob.company = { companyName: compName, companyLogo: compLogo };
            } else {
                clientJob.company.companyName = compName;
                clientJob.company.companyLogo = compLogo;
            }
            return clientJob;
        });

        res.status(200).json({
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            jobs: mappedJobs,
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
                    select: { id: true, name: true, companyName: true, companyLogo: true, companyDescription: true, email: true }
                },
                companyProfile: true,
            }
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        const clientJob = toClient(job);
        const compName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Verified Employer";
        const compLogo = job.companyProfile?.logo || job.companyLogo || job.company?.companyLogo || "";
        clientJob.companyName = compName;
        clientJob.companyLogo = compLogo;
        if (!clientJob.company) {
            clientJob.company = { companyName: compName, companyLogo: compLogo };
        } else {
            clientJob.company.companyName = compName;
            clientJob.company.companyLogo = compLogo;
        }

        res.status(200).json(clientJob);
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
    getCompanies,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    closeJob,
    deleteJob,
};
