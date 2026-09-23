/**
 * Employer AI tools: the job description assistant.
 */

const groq = require("../utils/groqClient");
const { assistJobDescription } = require("../services/jobDescriptionService");

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

module.exports = {
    assistWithJobDescription,
};
