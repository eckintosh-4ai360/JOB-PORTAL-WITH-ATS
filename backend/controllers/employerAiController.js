/**
 * Employer AI tools: the job description assistant and the interview
 * question generator. Talent Search has its own controller.
 */

const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const groq = require("../utils/groqClient");
const matchService = require("../services/jobMatchService");
const { assistJobDescription } = require("../services/jobDescriptionService");
const { generateInterviewQuestions } = require("../services/interviewQuestionService");

const isEmployer = (user) => user?.role === "employer" || user?.role === "admin";

/** AI failures are the service's problem, not the employer's input. */
const sendError = (res, error, fallbackMessage) => {
    if (error instanceof groq.GroqError) {
        const unconfigured = error.status === 503;
        return res.status(unconfigured ? 503 : 502).json({
            message: unconfigured
                ? "AI features are not configured on this server yet."
                : "The AI service is busy right now. Please try again in a moment.",
        });
    }
    console.error(error);
    return res.status(500).json({ message: fallbackMessage, error: error.message });
};

/**
 * @desc   Draft or improve a job advert from what is on the posting form
 * @route  POST /api/ai/job-description
 * @access Private (Employer or Admin)
 */
const assistWithJobDescription = async (req, res) => {
    try {
        if (!isEmployer(req.user)) {
            return res.status(403).json({ message: "Only employers can use the job description assistant." });
        }

        const body = req.body || {};
        if (String(body.title || "").trim().length < 2) {
            return res.status(400).json({ message: "Add a job title first — the assistant writes for a specific role." });
        }

        const result = await assistJobDescription({
            title: body.title,
            category: body.category,
            type: body.type,
            workModel: body.workModel,
            location: body.location,
            experienceLevel: body.experienceLevel,
            salaryMin: body.salaryMin,
            salaryMax: body.salaryMax,
            currency: body.currency,
            tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
            description: body.description,
            requirements: body.requirements,
            notes: body.notes,
        });

        res.status(200).json(result);
    } catch (error) {
        sendError(res, error, "Could not draft the job description");
    }
};

/** The application, if this employer owns the job it was made to. */
const loadOwnedApplication = async (applicationId, user) => {
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
            job: true,
            aiScore: true,
            interviewGuide: true,
        },
    });
    if (!application) return { error: { status: 404, message: "Application not found" } };
    if (application.job.companyId !== user._id && user.role !== "admin") {
        return { error: { status: 403, message: "You do not have access to this application" } };
    }
    return { application };
};

const shapeGuide = (guide) => (guide
    ? toClient({
        id: guide.id,
        questions: Array.isArray(guide.questions) ? guide.questions : [],
        tailored: guide.tailored,
        degraded: guide.degraded,
        updatedAt: guide.updatedAt,
    })
    : null);

/**
 * @desc   The saved interview guide for an application, if there is one
 * @route  GET /api/ai/interview-questions/:applicationId
 * @access Private (Employer who owns the job, or Admin)
 */
const getInterviewGuide = async (req, res) => {
    try {
        const { application, error } = await loadOwnedApplication(req.params.applicationId, req.user);
        if (error) return res.status(error.status).json({ message: error.message });

        res.status(200).json({
            guide: shapeGuide(application.interviewGuide),
            canTailor: Boolean(application.applicantId),
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not load the interview questions");
    }
};

/**
 * @desc   Generate (or regenerate) interview questions for an application
 * @route  POST /api/ai/interview-questions/:applicationId
 * @access Private (Employer who owns the job, or Admin)
 * @body   { tailor?: boolean } — use the applicant's profile and fit gaps
 */
const createInterviewGuide = async (req, res) => {
    try {
        const { application, error } = await loadOwnedApplication(req.params.applicationId, req.user);
        if (error) return res.status(error.status).json({ message: error.message });

        const tailor = req.body?.tailor !== false;
        const [spec, profile] = await Promise.all([
            matchService.getJobSpec(application.job),
            application.applicantId
                ? prisma.candidateProfile.findUnique({ where: { userId: application.applicantId } })
                : null,
        ]);

        const result = await generateInterviewQuestions({
            job: application.job,
            spec,
            profile,
            assessment: application.aiScore,
            screeningAnswers: application.screeningAnswers,
            tailor,
        });

        const data = {
            questions: result.questions,
            tailored: result.tailored,
            degraded: result.degraded,
            model: result.model,
        };
        const guide = await prisma.interviewGuide.upsert({
            where: { applicationId: application.id },
            create: { applicationId: application.id, ...data },
            update: data,
        });

        res.status(200).json({ guide: shapeGuide(guide), aiEnabled: groq.isConfigured() });
    } catch (error) {
        sendError(res, error, "Could not generate interview questions");
    }
};

module.exports = {
    assistWithJobDescription,
    getInterviewGuide,
    createInterviewGuide,
};
