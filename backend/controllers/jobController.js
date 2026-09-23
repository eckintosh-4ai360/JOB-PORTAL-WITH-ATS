const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const fraud = require("../services/fraudModerationService");
const { deriveJobFacets } = require("../utils/jobFacets");
const { validateQuestions } = require("../utils/screeningQuestions");
const { recordTemplateUse } = require("../utils/jobTemplates");

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
            workModel,
            customJobType,
            salaryMin,
            salaryMax,
            companyLogo,
            deadline,
            tags,
            screeningQuestions,
            templateId,
        } = req.body;

        const screening = validateQuestions(screeningQuestions);
        if (screening.error) {
            return res.status(400).json({ message: screening.error });
        }

        if (req.user.role !== "employer" && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only employers and admins can post jobs" });
        }

        if (req.user.role === "employer" && req.user.employerOnboardingComplete !== true) {
            return res.status(403).json({
                code: "EMPLOYER_SETUP_REQUIRED",
                message: "Complete your company setup before posting a job.",
            });
        }

        // A recruiter suspended by moderation cannot publish while under review.
        const poster = await prisma.user.findUnique({
            where: { id: req.user._id },
            select: { trustState: true },
        });
        if (poster?.trustState === "suspended") {
            return res.status(403).json({
                code: "ACCOUNT_UNDER_REVIEW",
                message: "This account is under review and cannot publish jobs. Contact support.",
            });
        }

        // A company publishes only once a reviewer has checked its registration
        // details. Admins are exempt — they are the reviewers. An employer with
        // no company profile has nothing to have been reviewed.
        if (req.user.role === "employer") {
            const reviewed = await prisma.company.findUnique({
                where: { userId: req.user._id },
                select: { approvalState: true, approvalNote: true },
            });

            if (!reviewed) {
                return res.status(403).json({
                    code: "EMPLOYER_SETUP_REQUIRED",
                    message: "Complete your company setup before posting a job.",
                });
            }

            if (reviewed.approvalState !== "approved") {
                return res.status(403).json({
                    code: reviewed.approvalState === "rejected"
                        ? "COMPANY_REJECTED"
                        : "COMPANY_PENDING_REVIEW",
                    message: reviewed.approvalState === "rejected"
                        ? `Your company was not approved${reviewed.approvalNote ? `: ${reviewed.approvalNote}` : "."} Update your details and resubmit for review.`
                        : reviewed.approvalState === "in_review"
                            ? "Your company is under review. You can post jobs once it has been approved."
                            : "Your company is awaiting review. You can post jobs once it has been approved.",
                });
            }
        }

        const effectiveType = type || jobType || "Full-Time";
        const effectiveLogo = companyLogo || req.user.companyLogo || "";

        // Check if employer has a dedicated Company profile
        let employerCompany = await prisma.company.findUnique({
            where: { userId: req.user._id }
        });

        // Legacy completed employers may not have a dedicated Company record yet.
        // Never create or mark a profile as verified for an unfinished employer.
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
                        industry: category || "General Services",
                        employees: "20-100",
                        verified: false,
                        rating: 0,
                        stack: [],
                        perks: [],
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

        const effectiveRequirements = requirements || description || "See job description for details.";
        const effectiveTags = Array.isArray(tags) ? tags.filter(Boolean) : [];

        // Experience level, education and skills are read out of the advert
        // rather than asked for, so search can filter on them exactly.
        const facets = deriveJobFacets({
            title,
            description,
            requirements: effectiveRequirements,
            tags: effectiveTags,
        });

        const job = await prisma.job.create({
            data: {
                title,
                description,
                requirements: effectiveRequirements,
                location: location || "Remote (Ghana)",
                latitude: latitude ? Number(latitude) : undefined,
                longitude: longitude ? Number(longitude) : undefined,
                category: category || "Other",
                customCategory: category === "other" ? customCategory : undefined,
                tags: effectiveTags,
                ...facets,
                type: effectiveType,
                jobType: effectiveType,
                workModel: workModel || undefined,
                customJobType: effectiveType === "Other" ? customJobType : undefined,
                deadline: deadline ? new Date(deadline) : undefined,
                salaryMin: salaryMin ? Number(salaryMin) : undefined,
                salaryMax: salaryMax ? Number(salaryMax) : undefined,
                companyLogo: effectiveLogo,
                companyId: req.user._id,
                companyProfileId: employerCompany ? employerCompany.id : undefined,
                screeningQuestions: screening.questions.length > 0 ? screening.questions : undefined,
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

        // Screening is advisory and can call out to Groq, so it runs after the
        // response rather than making an employer wait on it.
        fraud.screenInBackground(`job:${job.id}`, () => fraud.screenJob(job.id));
        recordTemplateUse(templateId, req.user._id);

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
                employerOnboardingComplete: true,
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
                hq: "Ghana / Remote",
                stage: "Growth / Enterprise",
                industry: "General Services",
                employees: "20-500",
                openRoles: emp.postedJobs.length,
                jobs: toClient(emp.postedJobs),
                stack: [],
                perks: [],
                verified: false,
                glassdoor: 0,
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

        // `hidden` is set by moderation; `flagged` stays visible on purpose so a
        // false positive never silently removes a real advert.
        const where = { isClosed: false, moderationState: { not: "hidden" }, deletedAt: null };

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
            const compName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Hiring Company";
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

        if (!job || job.deletedAt) {
            return res.status(404).json({ message: "Job not found" });
        }

        // A hidden job stays reachable for the employer who owns it and for
        // admins reviewing the case, but not for the public it was pulled from.
        if (job.moderationState === "hidden") {
            const viewerId = req.user?._id;
            const privileged = viewerId && (viewerId === job.companyId || req.user.role === "admin");
            if (!privileged) {
                return res.status(404).json({ message: "Job not found" });
            }
        }

        const clientJob = toClient(job);
        const compName = job.companyProfile?.name || job.company?.companyName || job.company?.name || "Hiring Company";
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
            where: { companyId: req.user._id, deletedAt: null },
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

        if (!job || job.deletedAt) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to update this job" });
        }

        const { companyId, id, createdAt, updatedAt, ...updateData } = req.body;

        // Stored as-is otherwise, so questions go through the same checks as
        // on create. An empty list clears them.
        if (updateData.screeningQuestions !== undefined) {
            const screening = validateQuestions(updateData.screeningQuestions);
            if (screening.error) {
                return res.status(400).json({ message: screening.error });
            }
            updateData.screeningQuestions = screening.questions.length > 0 ? screening.questions : null;
        }
        if (updateData.deadline) updateData.deadline = new Date(updateData.deadline);
        if (updateData.salaryMin) updateData.salaryMin = Number(updateData.salaryMin);
        if (updateData.salaryMax) updateData.salaryMax = Number(updateData.salaryMax);

        // An edited advert can mean something different — a title going from
        // "Engineer" to "Senior Engineer" changes which searches should find
        // it — so the search facets are read again from the merged posting.
        const touchesText = ["title", "description", "requirements", "tags"]
            .some((field) => updateData[field] !== undefined);
        if (touchesText) {
            Object.assign(updateData, deriveJobFacets({
                title: updateData.title ?? job.title,
                description: updateData.description ?? job.description,
                requirements: updateData.requirements ?? job.requirements,
                tags: updateData.tags ?? job.tags,
            }));
        }

        const updatedJob = await prisma.job.update({
            where: { id: req.params.id },
            data: updateData,
        });

        fraud.screenInBackground(`job:${updatedJob.id}`, () => fraud.screenJob(updatedJob.id));

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

        if (!job || job.deletedAt) {
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

// @desc    Soft delete a job posting — the row is kept, not removed
// @route   DELETE /api/jobs/:id
// @access  Private (Employer only — must be the owner)
const deleteJob = async (req, res) => {
    try {
        const job = await prisma.job.findUnique({ where: { id: req.params.id } });

        if (!job || job.deletedAt) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to delete this job" });
        }

        // Stamping `deletedAt` rather than deleting the row: every dependent
        // record cascades on delete, so removing the job would take its
        // applications, saved-job entries and match history with it.
        await prisma.job.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });

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
