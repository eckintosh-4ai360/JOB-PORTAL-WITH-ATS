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
    sendShortlistedEmail,
    sendHiredEmail,
} = require("../utils/emailService");
const {
    CANDIDATE_PHASES,
    STAGE_TYPES,
    DEFAULT_STAGES,
    REJECTED_STAGE,
    LEGACY_STATUSES,
    normalizeStatus,
    findStage,
    validateStages,
    canTransition,
    toCandidateStatus,
    getEmployerStages,
    getStagesByEmployer,
} = require("../utils/hiringPipeline");
const { validateAnswers } = require("../utils/screeningQuestions");

// The pipeline only runs forwards (utils/hiringPipeline.canTransition). A
// candidate is emailed as they move through it, so walking a stage backwards
// would contradict something they have already been told.

/** The employer's view: the stage id, with legacy status names translated. */
const normalizeApplication = (application) => {
    const normalized  = toClient(application);
    if (normalized.status) normalized.status = normalizeStatus(normalized.status);

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

/**
 * The candidate's view of their own application. The employer's stage — and
 * anything that would reveal it, like the AI fit score or when the row last
 * changed — is removed, and replaced with the phase it maps to.
 */
const toCandidateApplication = (application, stages) => {
    const normalized = normalizeApplication(application);
    normalized.candidateStatus = toCandidateStatus(stages, normalized.status);

    delete normalized.status;
    delete normalized.aiScore;
    delete normalized.updatedAt;
    if (normalized.job) delete normalized.job.companyId;

    return normalized;
};

/**
 * Tell the candidate about a move — only when what they can see changes.
 * Screening to Longlisted says nothing; Longlisted to Shortlisted does. An
 * interview stage always sends its details, since a second interview is news
 * even though the phase is the same.
 */
const notifyCandidate = ({ application, stages, previousStatus, stage, interview }) => {
    const to = application.applicant?.email || application.guestEmail;
    if (!to) return;

    const payload = {
        to,
        applicantName: application.applicant?.name || application.guestName || "Applicant",
        jobTitle: application.job.title,
    };

    if (stage.type === "rejected") return sendRejectionEmail(payload);
    if (stage.type === "interview") return sendInterviewScheduledEmail({ ...payload, interview });
    if (stage.type === "offer") return sendOfferEmail(payload);
    if (stage.type === "hired") return sendHiredEmail(payload);

    const before = toCandidateStatus(stages, previousStatus);
    const after = toCandidateStatus(stages, stage.id);
    if (before.phase === after.phase) return;

    if (after.phase === "under_review") return sendUnderReviewEmail(payload);
    if (after.phase === "shortlisted") return sendShortlistedEmail(payload);
    return sendApplicationStatusUpdatedEmail({ ...payload, status: after.label });
};

/**
 * Whether a stored file belongs to this applicant — their profile resume, or
 * one of their own documents. An applicant may attach something they have
 * already uploaded rather than a fresh file, but the URL arrives from the
 * browser, so without this an application could cite anybody's document.
 */
const ownsStoredFile = async (userId, url) => {
    if (!userId || !url) return false;

    const [user, document] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { resume: true } }),
        prisma.document.findFirst({ where: { userId, url }, select: { id: true } }),
    ]);

    return user?.resume === url || Boolean(document);
};

/** Match a stage, including rows still holding its pre-pipeline name. */
const statusFilter = (status) => {
    const id = normalizeStatus(status);
    const legacy = Object.keys(LEGACY_STATUSES).filter((name) => LEGACY_STATUSES[name] === id);
    return { in: [id, ...legacy] };
};

const getEmployerJobIds = async (employerId) => {
    const jobs = await prisma.job.findMany({
        where: { companyId: employerId, deletedAt: null },
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

        if (!job || job.deletedAt) {
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

        // Screening answers are checked before any file is uploaded, so a
        // missed question does not leave an orphaned CV in storage.
        const questions = Array.isArray(job.screeningQuestions) ? job.screeningQuestions : [];
        const screening = validateAnswers(questions, req.body.screeningAnswers);
        if (screening.errors) {
            return res.status(422).json({
                message: "Answer the employer's screening questions before submitting.",
                errors: screening.errors,
            });
        }

        // New applications land in the first stage of the employer's pipeline.
        const [firstStage] = await getEmployerStages(job.companyId);

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

        // Reusing a stored file is only offered to signed-in applicants, so it
        // is only they who can be held to owning it.
        if (!resumeFile && isLoggedIn && !(await ownsStoredFile(req.user._id, resume))) {
            return res.status(403).json({ message: "That resume is not one of your saved documents." });
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
        } else if (req.body.coverLetterFile) {
            if (isLoggedIn && !(await ownsStoredFile(req.user._id, req.body.coverLetterFile))) {
                return res.status(403).json({ message: "That cover letter is not one of your saved documents." });
            }
            coverLetterFileUrl = req.body.coverLetterFile;
        }

        // Create application 
        const applicationData = {
            jobId: req.params.jobId,
            resume,
            coverLetter: req.body.coverLetter || "",
            coverLetterFile: coverLetterFileUrl || "",
            status: firstStage.id,
            screeningAnswers: screening.answers.length > 0 ? screening.answers : undefined,
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

        res.status(201).json({
            message: "Application submitted successfully",
            application: toCandidateApplication(application, [firstStage]),
        });
    } catch (error) {
        // The duplicate check above is a read followed by a write, so two
        // submits arriving together can both pass it. The unique index is what
        // actually stops the second one; translate it into the same answer the
        // check would have given rather than a bare 500.
        if (error?.code === "P2002") {
            return res.status(400).json({ message: "You have already applied for this job" });
        }

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
            },
            orderBy: { createdAt: "desc" },
        });

        const stagesFor = await getStagesByEmployer(applications.map((a) => a.job?.companyId));
        res.status(200).json(
            applications.map((application) => toCandidateApplication(application, stagesFor(application.job?.companyId)))
        );
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

        const stages = await getEmployerStages(req.user._id);
        if (status && !findStage(stages, status)) {
            return res.status(400).json({ message: "That is not a stage in your pipeline." });
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

        if (status) where.status = statusFilter(status);

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

        const stages = await getEmployerStages(req.user._id);
        if (status && !findStage(stages, status)) {
            return res.status(400).json({ message: "That is not a stage in your pipeline." });
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

        if (status) where.status = statusFilter(status);

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

        // A soft-deleted job is intentionally still readable here: people
        // applied to it, and the employer needs to finish reviewing or
        // responding to them after taking the advert down.
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

        if (isJobOwner) {
            return res.status(200).json(normalizeApplication(application));
        }

        const stages = await getEmployerStages(application.job.companyId);
        res.status(200).json(toCandidateApplication(application, stages));
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

        const { status: requested, interview } = req.body;

        const application = await prisma.application.findUnique({
            where: { id: req.params.id },
            include: {
                job: { select: { id: true, title: true, companyId: true } },
                applicant: { select: { id: true, name: true, email: true, avatar: true, resume: true } },
            },
        });

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (!application.job || application.job.companyId !== req.user._id) {
            return res.status(403).json({ message: "Not authorized to update this application" });
        }

        const stages = await getEmployerStages(req.user._id);
        const stage = findStage(stages, requested);
        if (!stage) {
            return res.status(400).json({ message: "That is not a stage in your pipeline." });
        }

        const current = normalizeStatus(application.status);
        const currentStage = findStage(stages, current);

        // Re-sending an interview stage the application is already in is a
        // reschedule, not a move — the one same-stage update worth accepting.
        const isReschedule = stage.id === current && stage.type === "interview";

        if (!isReschedule && !canTransition(stages, current, stage.id)) {
            const settled = currentStage?.type === "rejected" || currentStage?.type === "hired";
            return res.status(409).json({
                message: settled
                    ? `This application is settled as "${currentStage.name}" and can no longer be moved.`
                    : `An application cannot move from "${currentStage?.name || current}" back to "${stage.name}".`,
                currentStatus: current,
            });
        }

        const updateData = { status: stage.id };

        if (stage.type === "interview") {
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

        // Conditional on the stage it was read in, so two recruiters moving the
        // same applicant at once cannot both succeed and both email them.
        const { count } = await prisma.application.updateMany({
            where: { id: application.id, status: application.status },
            data: updateData,
        });
        if (count === 0) {
            return res.status(409).json({
                message: "Someone else moved this application a moment ago. Refresh to see where it is now.",
            });
        }

        const updatedApplication = await prisma.application.findUnique({
            where: { id: application.id },
            include: {
                job: { select: { id: true, title: true, location: true, type: true, isClosed: true } },
                applicant: { select: { id: true, name: true, email: true, avatar: true, resume: true } },
            },
        });

        notifyCandidate({
            application: updatedApplication,
            stages,
            previousStatus: current,
            stage,
            interview: {
                date: updateData.interviewDate,
                time: updateData.interviewTime,
                location: updateData.interviewLocation,
                notes: updateData.interviewNotes,
            },
        });

        res.status(200).json({ message: `Moved to ${stage.name}`, application: normalizeApplication(updatedApplication) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    The employer's pipeline stages, and what candidates see for each
// @route   GET /api/applications/pipeline
// @access  Private (Employer only)
const getPipeline = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can access this route" });
        }

        const stages = await getEmployerStages(req.user._id);
        res.status(200).json({
            stages,
            rejectedStage: REJECTED_STAGE,
            phases: CANDIDATE_PHASES,
            stageTypes: STAGE_TYPES,
            defaults: DEFAULT_STAGES,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Replace the employer's pipeline stages
// @route   PUT /api/applications/pipeline
// @access  Private (Employer only)
const updatePipeline = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can change their pipeline" });
        }

        const { stages, error } = validateStages(req.body?.stages);
        if (error) return res.status(400).json({ message: error });

        // A stage cannot disappear from under the applications sitting in it —
        // they would be in a stage nobody can see or move them out of.
        const current = await getEmployerStages(req.user._id);
        const kept = new Set(stages.map((stage) => stage.id));
        const removed = current.filter((stage) => !kept.has(stage.id));

        if (removed.length > 0) {
            const jobIds = await getEmployerJobIds(req.user._id);
            for (const stage of removed) {
                const inUse = await prisma.application.count({
                    where: { jobId: { in: jobIds }, status: statusFilter(stage.id) },
                });
                if (inUse > 0) {
                    const many = inUse !== 1;
                    return res.status(409).json({
                        message: `${inUse} application${many ? "s are" : " is"} in "${stage.name}". Move ${many ? "them" : "it"} to another stage before removing it.`,
                        stageId: stage.id,
                    });
                }
            }
        }

        await prisma.hiringPipeline.upsert({
            where: { employerId: req.user._id },
            create: { employerId: req.user._id, stages },
            update: { stages },
        });

        res.status(200).json({ message: "Pipeline saved", stages, rejectedStage: REJECTED_STAGE });
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
    getPipeline,
    updatePipeline,
};
