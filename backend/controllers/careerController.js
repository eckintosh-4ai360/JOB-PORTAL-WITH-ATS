const prisma = require("../config/prisma");
const groq = require("../utils/groqClient");
const career = require("../services/careerPathService");

/**
 * Career recommendations for the signed-in candidate. See
 * services/careerPathService.
 */

const shape = async (plan, context, viewerId) => ({
    summary: plan.paths?.summary || "",
    paths: await career.enrichPaths(plan.paths?.paths || [], viewerId),
    generatedAt: plan.updatedAt,
    stale: plan.profileKey !== career.profileKeyOf(context),
    degraded: plan.degraded,
});

const save = async (userId, context, result) => {
    const data = {
        profileKey: career.profileKeyOf(context),
        paths: { summary: result.summary, paths: result.paths },
        model: result.model,
        degraded: result.degraded,
    };
    return prisma.careerPlan.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
    });
};

// @desc    The candidate's saved career paths, if any
// @route   GET /api/ai/career-paths
// @access  Private (Jobseeker)
const getCareerPaths = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Career paths are for candidates." });
        }
        const { context, ready } = await career.loadCareerContext(req.user._id);
        const plan = await prisma.careerPlan.findUnique({ where: { userId: req.user._id } });

        res.status(200).json({
            ready,
            aiEnabled: groq.isConfigured(),
            plan: plan ? await shape(plan, context, req.user._id) : null,
        });
    } catch (error) {
        console.error("Could not load career paths:", error);
        res.status(500).json({ message: "Could not load your career paths", error: error.message });
    }
};

// @desc    Write (or rewrite) the candidate's career paths from their profile
// @route   POST /api/ai/career-paths
// @access  Private (Jobseeker)
const createCareerPaths = async (req, res) => {
    try {
        if (req.user.role !== "jobseeker") {
            return res.status(403).json({ message: "Career paths are for candidates." });
        }
        const { context, ready } = await career.loadCareerContext(req.user._id);
        if (!ready) {
            return res.status(400).json({
                message: "Analyse your CV first — career paths are built from your skills and experience.",
            });
        }

        const result = await career.generatePlan(context);
        if (result.paths.length === 0) {
            return res.status(422).json({
                message: "We could not suggest paths from your profile yet. Add your current role or target roles and try again.",
            });
        }

        const plan = await save(req.user._id, context, result);
        res.status(200).json({ ready, aiEnabled: groq.isConfigured(), plan: await shape(plan, context, req.user._id) });
    } catch (error) {
        console.error("Could not write career paths:", error);
        res.status(500).json({ message: "Could not write your career paths", error: error.message });
    }
};

module.exports = { getCareerPaths, createCareerPaths };
