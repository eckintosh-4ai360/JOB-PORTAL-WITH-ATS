const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");
const {
    sendApplicationSubmittedEmail,
    sendApplicationStatusUpdatedEmail,
    sendUnderReviewEmail,
    sendInterviewScheduledEmail,
    sendOfferEmail,
    sendRejectionEmail,
} = require("../utils/emailService");

const APPLICATION_STATUSES = ["Applied", "Under Review", "Interviewing", "Offered", "Rejected"];

const normalizeApplication = (application) => {
    const normalized  = toClient(application);

    const isGuest = !normalized.applicantId && !normalized.applicant;
    normalized.isGuest = isGuest;

    if (isGuest) {
        normalized.applicantName = normalized.guestName || "";
        normalized.applicantEmail = normalized.guestEmail || "";
        normalized.applicantPhone = normalized.guestPhone || "";
    } else if (normalized.applicant) {
        normalized.applicantName = normalized.applicant.name || "";
        normalized.applicantEmail = normalized.applicant.email || "";
        normalized.applicantPhone = normalized.applicant.phone || "";
    }

    if (normalized.interviewDate || normalized.interviewTime || normalized.interviewLocation || normalized.interviewNotes) {
        normalized.interview = {
            date: normalized.interviewDate,
            time: normalized.interviewTime,
            location: normalized.interviewLocation,
            notes: normalized.interviewNotes || "",
        };
    }

    return normalized;
};

const getEmployerJobIds = async (employerId) => {
    const jobs = await prisma.job.findMany({
        where: { companyId: employerId },
        select: { id: true },
    });
    return jobs.map((job) => job.id);
};

const getPagination = (query) => {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);

    return { page, limit, skip: (page - 1) * limit };
};

// @desc    Apply for a job (authenticated users OR guests)
// @route   POST /api/applications/:jobId
// @access  Public (optionalAuth — works with or without JWT)
const applyForJob = async (req, res) => {
    try {
        const job = await prisma.job.findUnique({
            where: { id: req.params.jobId },
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.isClosed) {
            return res.status(400).json({ message: "This job is no longer accepting applications" });
        }

        const isLoggedIn = !!req.user;

        // Role check (logged-in users only)     
        if (isLoggedIn && req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can apply for jobs" });
        }

        // Duplicate prevention  
        if (isLoggedIn) {
            const alreadyApplied = await prisma.application.findFirst({
                where: {
                    jobId: req.params.jobId,
                    applicantId: req.user._id,
                },
            });
            if (alreadyApplied) {
                return res.status(400).json({ message: "You have already applied for this job" });
            }
        } else {
            // Guest: require name & email
            const { guestName, guestEmail } = req.body;
            if (!guestName || !guestEmail) {
                return res.status(400).json({ message: "Name and email are required for guest applications" });
            }
            const cleanEmail = guestEmail.toLowerCase().trim();
            const alreadyApplied = await prisma.application.findFirst({
                where: {
                    jobId: req.params.jobId,
                    guestEmail: { equals: cleanEmail, mode: "insensitive" },
                },
            });
            if (alreadyApplied) {
                return res.status(400).json({ message: "An application with this email already exists for this job" });
            }
        }

        // Resume handling   
        const resumeFile = req.files?.resume?.[0];
        let resume = req.body.resume;
        if (resumeFile) {
            try {
                const result = await uploadToCloudinary(resumeFile.buffer, {
                    folder: "job-portal/resumes",
                    resource_type: "raw",
                });
                resume = result.secure_url;
            } catch (cloudinaryError) {
                console.warn("Cloudinary upload failed, falling back to local disk storage:", cloudinaryError.message || cloudinaryError);
                const filename = await uploadToLocalDisk(resumeFile.buffer, resumeFile.originalname);
                resume = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
            }
        }

        if (!resume) {
            return res.status(400).json({ message: "A resume (file or URL) is required" });
        }

        // Cover letter file handling 
        const coverLetterFileUpload = req.files?.coverLetterFile?.[0];
        let coverLetterFileUrl = "";
        if (coverLetterFileUpload) {
            try {
                const result = await uploadToCloudinary(coverLetterFileUpload.buffer, {
                    folder: "job-portal/cover-letters",
                    resource_type: "raw",
                });
                coverLetterFileUrl = result.secure_url;
            } catch (cloudinaryError) {
                console.warn("Cloudinary cover letter upload failed, falling back to local disk:", cloudinaryError.message || cloudinaryError);
                const filename = await uploadToLocalDisk(coverLetterFileUpload.buffer, coverLetterFileUpload.originalname);
                coverLetterFileUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
            }
        }

        // Create application 
        const applicationData = {
            jobId: req.params.jobId,
            resume,
            coverLetter: req.body.coverLetter || "",
            coverLetterFile: coverLetterFileUrl || "",
        };

        if (isLoggedIn) {
            applicationData.applicantId = req.user._id;
        } else {
            applicationData.guestName = req.body.guestName.trim();
            applicationData.guestEmail = req.body.guestEmail.toLowerCase().trim();
            applicationData.guestPhone = req.body.guestPhone?.trim() || "";
        }

        const application = await prisma.application.create({
            data: applicationData,
        });

        // Send confirmation email to applicant 
        const recipientEmail = isLoggedIn ? req.user.email : applicationData.guestEmail;
        const recipientName = isLoggedIn ? req.user.name : applicationData.guestName;

        sendApplicationSubmittedEmail({
            to: recipientEmail,
            applicantName: recipientName,
            jobTitle: job.title || "the position",
        });

        res.status(201).json({ message: "Application submitted successfully", application: normalizeApplication(application) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all applications submitted by the logged-in jobseeker
// @route   GET /api/applications/my-applications
// @access  Private (Jobseeker only)
const getMyApplications = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Only jobseekers can access this route" });
        }

        const applications = await prisma.application.findMany({
            where: { applicantId: req.user._id },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        isClosed: true,
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

        res.status(200).json(applications.map(normalizeApplication));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get every application submitted to the logged-in employer's jobs
// @route   GET /api/applications/employer
// @access  Private (Employer only)
const getEmployerApplications = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access this route" });
        }

        const { jobId, status } = req.query;
        const { page, limit, skip } = getPagination(req.query);

        if (status && !APPLICATION_STATUSES.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
            });
        }

        const employerJobIds = await getEmployerJobIds(req.user._id);
        const where = { jobId: { in: employerJobIds } };

        if (jobId) {
            const ownsJob = employerJobIds.includes(jobId);
            if (!ownsJob) {
                return res.status(403).json({ message: "Not authorized to view this job's applications" });
            }
            where.jobId = jobId;
        }

        if (status) where.status = status;

        const [total, applications] = await Promise.all([
            prisma.application.count({ where }),
            prisma.application.findMany({
                where,
                include: {
                    applicant: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            avatar: true,
                            resume: true,
                        },
                    },
                    job: {
                        select: {
                            id: true,
                            title: true,
                            location: true,
                            type: true,
                            isClosed: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);

        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit),
            applications: applications.map(normalizeApplication),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get unique applicants who applied to the logged-in employer's jobs
// @route   GET /api/applications/employer/applicants
// @access  Private (Employer only)
const getEmployerApplicants = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access this route" });
        }

        const { jobId, status } = req.query;

        if (status && !APPLICATION_STATUSES.includes(status)) {
            return res.status(400).json({
                message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
            });
        }

        const employerJobIds = await getEmployerJobIds(req.user._id);
        const where = { jobId: { in: employerJobIds } };

        if (jobId) {
            const ownsJob = employerJobIds.includes(jobId);
            if (!ownsJob) {
                return res.status(403).json({ message: "Not authorized to view this job's applicants" });
            }
            where.jobId = jobId;
        }

        if (status) where.status = status;

        const applications = await prisma.application.findMany({
            where,
            include: {
                applicant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        resume: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const applicants = new Map();

        for (const application of applications) {
            const isGuest = !application.applicant;
            const key = isGuest
                ? `guest:${application.guestEmail?.toLowerCase()}`
                : `user:${application.applicant.id}`;
            const existing = applicants.get(key);

            if (existing) {
                existing.applicationCount += 1;
                continue;
            }

            applicants.set(key, {
                _id: isGuest ? null : application.applicant.id,
                id: isGuest ? null : application.applicant.id,
                type: isGuest ? "guest" : "registered",
                name: isGuest ? application.guestName : application.applicant.name,
                email: isGuest ? application.guestEmail : application.applicant.email,
                phone: isGuest ? application.guestPhone || "" : "",
                avatar: isGuest ? "" : application.applicant.avatar || "",
                resume: isGuest ? application.resume : application.applicant.resume || application.resume,
                applicationCount: 1,
                latestApplicationAt: application.createdAt,
            });
        }

        res.status(200).json({
            total: applicants.size,
            applicants: Array.from(applicants.values()),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get all applications for a specific job (employer view)
// @route   GET /api/applications/job/:jobId
// @access  Private (Employer only — must own the job)
const getApplicationsForJob = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access this route" });
        }

        const job = await prisma.job.findUnique({
            where: { id: req.params.jobId },
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        if (job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to view applications for this job" });
        }

        const applications = await prisma.application.findMany({
            where: { jobId: req.params.jobId },
            include: {
                applicant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        resume: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.status(200).json(applications.map(normalizeApplication));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get a single application by ID
// @route   GET /api/applications/:id
// @access  Private (Owner applicant or job's employer)
const getApplicationById = async (req, res) => {
    try {
        const application = await prisma.application.findUnique({
            where: { id: req.params.id },
            include: {
                job: {
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        companyId: true,
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
                applicant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
            },
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        const isApplicant = application.applicantId && application.applicantId === req.user._id;
        const isJobOwner = application.job && application.job.companyId === req.user._id;

        if (!isApplicant && !isJobOwner) {
            return res.status(403).json({ message: "Not authorized to view this application" });
        }

        res.status(200).json(normalizeApplication(application));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Update application status (employer action)
// @route   PATCH /api/applications/:id/status
// @access  Private (Employer only — must own the job)
const updateApplicationStatus = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can update application status" });
        }

        const { status, interview } = req.body;
        const allowedStatuses = ["Applied", "Under Review", "Interviewing", "Offered", "Rejected"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(", ")}` });
        }

        const application = await prisma.application.findUnique({
            where: { id: req.params.id },
            include: {
                job: true,
                applicant: true,
            },
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (!application.job || application.job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to update this application" });
        }

        const updateData = { status };

        if (status === "Interviewing") {
            if (!application.applicantId) {
                return res.status(400).json({ message: "Interviews can only be scheduled for candidates with registered accounts." });
            }
            if (!interview || !interview.date || !interview.time || !interview.location) {
                return res.status(400).json({ message: "Interview date, time, and location/link are required when scheduling an interview." });
            }
            updateData.interviewDate = new Date(interview.date);
            updateData.interviewTime = interview.time;
            updateData.interviewLocation = interview.location;
            updateData.interviewNotes = interview.notes || "";
        }

        const updatedApplication = await prisma.application.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                job: true,
                applicant: true,
            },
        });

        // Send status notification email to applicant
        let recipientEmail, recipientName;

        if (updatedApplication.applicant) {
            recipientEmail = updatedApplication.applicant.email;
            recipientName = updatedApplication.applicant.name || "Applicant";
        } else {
            recipientEmail = updatedApplication.guestEmail;
            recipientName = updatedApplication.guestName || "Applicant";
        }

        if (recipientEmail) {
            const emailPayload = {
                to: recipientEmail,
                applicantName: recipientName,
                jobTitle: updatedApplication.job.title,
            };

            if (status === "Under Review") {
                sendUnderReviewEmail(emailPayload);
            } else if (status === "Interviewing") {
                sendInterviewScheduledEmail({
                    ...emailPayload,
                    interview: {
                        date: updateData.interviewDate,
                        time: updateData.interviewTime,
                        location: updateData.interviewLocation,
                        notes: updateData.interviewNotes,
                    },
                });
            } else if (status === "Offered") {
                sendOfferEmail(emailPayload);
            } else if (status === "Rejected") {
                sendRejectionEmail(emailPayload);
            } else {
                sendApplicationStatusUpdatedEmail({ ...emailPayload, status });
            }
        }

        res.status(200).json({ message: "Application status updated", application: normalizeApplication(updatedApplication) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Withdraw (delete) an application
// @route   DELETE /api/applications/:id
// @access  Private (Jobseeker — must be the applicant)
const withdrawApplication = async (req, res) => {
    try {
        const application = await prisma.application.findUnique({
            where: { id: req.params.id },
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (application.applicantId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to withdraw this application" });
        }

        await prisma.application.delete({
            where: { id: req.params.id },
        });

        res.status(200).json({ message: "Application withdrawn successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    applyForJob,
    getMyApplications,
    getEmployerApplications,
    getEmployerApplicants,
    getApplicationsForJob,
    getApplicationById,
    updateApplicationStatus,
    withdrawApplication,
};
