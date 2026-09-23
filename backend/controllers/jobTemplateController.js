const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const { MAX_TEMPLATES, validateTemplate, templateFromJob } = require("../utils/jobTemplates");

/**
 * Job templates: an employer's reusable adverts. Private to the employer who
 * saved them; a posting started from one is an ordinary job.
 */

const requireEmployer = (req, res) => {
    if (req.user.role !== "employer") {
        res.status(403).json({ message: "Job templates are for employer accounts." });
        return false;
    }
    return true;
};

const fail = (res, error, message) => {
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

const loadOwned = async (id, employerId) => {
    const template = await prisma.jobTemplate.findUnique({ where: { id: String(id || "") } });
    return template && template.employerId === employerId ? template : null;
};

/** Another of the employer's templates already using this name, ignoring case. */
const nameTaken = (employerId, name, exceptId = null) =>
    prisma.jobTemplate.findFirst({
        where: {
            employerId,
            name: { equals: name, mode: "insensitive" },
            ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { id: true },
    });

// Most recently used first, then most recently changed — the ones an
// employer reaches for sit at the top.
const byUsefulness = (a, b) => {
    const usedA = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const usedB = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    if (usedB !== usedA) return usedB - usedA;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
};

// @desc    The employer's job templates
// @route   GET /api/job-templates?q=
// @access  Private (Employer)
const listTemplates = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const q = String(req.query.q || "").trim().slice(0, 100);
        const templates = await prisma.jobTemplate.findMany({
            where: {
                employerId: req.user._id,
                ...(q
                    ? {
                        OR: [
                            { name: { contains: q, mode: "insensitive" } },
                            { title: { contains: q, mode: "insensitive" } },
                            { category: { contains: q, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
        });

        res.status(200).json({
            templates: toClient(templates.sort(byUsefulness)),
            total: templates.length,
            limit: MAX_TEMPLATES,
        });
    } catch (error) {
        fail(res, error, "Could not load your job templates.");
    }
};

// @desc    One job template
// @route   GET /api/job-templates/:id
// @access  Private (Employer who saved it)
const getTemplate = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const template = await loadOwned(req.params.id, req.user._id);
        if (!template) return res.status(404).json({ message: "Template not found." });

        res.status(200).json({ template: toClient(template) });
    } catch (error) {
        fail(res, error, "Could not load this template.");
    }
};

// @desc    Save a job template — from the fields given, or from one of the
//          employer's own adverts with `{ fromJobId, name }`
// @route   POST /api/job-templates
// @access  Private (Employer)
const createTemplate = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        let input = req.body;
        if (req.body?.fromJobId) {
            const job = await prisma.job.findUnique({ where: { id: String(req.body.fromJobId) } });
            if (!job || job.companyId !== req.user._id) {
                return res.status(404).json({ message: "Job not found." });
            }
            input = templateFromJob(job, req.body.name);
        }

        const { data, error } = validateTemplate(input);
        if (error) return res.status(400).json({ message: error });

        const count = await prisma.jobTemplate.count({ where: { employerId: req.user._id } });
        if (count >= MAX_TEMPLATES) {
            return res.status(400).json({
                message: `You have ${MAX_TEMPLATES} templates, the most you can keep. Delete one you no longer use first.`,
            });
        }

        if (await nameTaken(req.user._id, data.name)) {
            return res.status(409).json({ message: `You already have a template called "${data.name}". Choose another name.` });
        }

        const template = await prisma.jobTemplate.create({
            data: { ...data, employerId: req.user._id },
        });

        res.status(201).json({ message: `Saved "${template.name}" as a template.`, template: toClient(template) });
    } catch (error) {
        fail(res, error, "Could not save the template.");
    }
};

// @desc    Replace a job template's fields
// @route   PUT /api/job-templates/:id
// @access  Private (Employer who saved it)
const updateTemplate = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const existing = await loadOwned(req.params.id, req.user._id);
        if (!existing) return res.status(404).json({ message: "Template not found." });

        const { data, error } = validateTemplate(req.body);
        if (error) return res.status(400).json({ message: error });

        if (await nameTaken(req.user._id, data.name, existing.id)) {
            return res.status(409).json({ message: `You already have a template called "${data.name}". Choose another name.` });
        }

        const template = await prisma.jobTemplate.update({ where: { id: existing.id }, data });
        res.status(200).json({ message: "Template saved.", template: toClient(template) });
    } catch (error) {
        fail(res, error, "Could not save the template.");
    }
};

// @desc    Delete a job template. Jobs posted from it are unaffected.
// @route   DELETE /api/job-templates/:id
// @access  Private (Employer who saved it)
const deleteTemplate = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const { count } = await prisma.jobTemplate.deleteMany({
            where: { id: String(req.params.id || ""), employerId: req.user._id },
        });
        if (count === 0) return res.status(404).json({ message: "Template not found." });

        res.status(200).json({ message: "Template deleted." });
    } catch (error) {
        fail(res, error, "Could not delete the template.");
    }
};

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
};
