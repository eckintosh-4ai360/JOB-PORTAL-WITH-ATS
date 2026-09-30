/**
 * The resume builder: CVs a candidate writes on the platform rather than
 * uploads. See utils/resumeContent for the CV's shape,
 * services/resumePdfService for the PDF, and services/resumeWriterService for
 * the AI writing help.
 */

const prisma = require("../config/prisma");
const groq = require("../utils/groqClient");
const { toClient } = require("../utils/prismaHelper");
const {
    TEMPLATES,
    ACCENTS,
    sanitizeContent,
    sanitizeDraft,
    prefillContent,
    toPlainText,
} = require("../utils/resumeContent");
const { renderResumePdf, pdfFileName } = require("../services/resumePdfService");
const { assistResume, ResumeWriterError } = require("../services/resumeWriterService");
const { extractFromBuffer, ResumeExtractionError } = require("../utils/resumeTextExtractor");
const { runAtsChecks } = require("../utils/atsChecks");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");

// Enough for a CV per kind of role someone applies for, without letting one
// account fill the table.
const MAX_RESUMES = 20;

const isCandidate = (user) => user?.role === "jobseeker";

const forbidden = (res) => res.status(403).json({ message: "The CV builder is for candidate accounts." });

const clipTitle = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);

const withDocument = { document: { select: { id: true, name: true, url: true, uploadedAt: true } } };

/** One CV as the client sees it. `isPrimary`: its saved copy is the profile CV. */
const shape = (resume, primaryUrl) => toClient({
    id: resume.id,
    title: resume.title,
    template: resume.template,
    accent: resume.accent,
    content: sanitizeDraft(resume.content),
    documentId: resume.documentId,
    document: resume.document || null,
    isPrimary: Boolean(resume.document?.url && resume.document.url === primaryUrl),
    savedAt: resume.savedAt,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
});

const loadOwned = async (id, userId) => {
    const resume = await prisma.builtResume.findUnique({ where: { id: String(id) }, include: withDocument });
    return resume && resume.userId === userId ? resume : null;
};

const primaryResumeOf = async (userId) =>
    (await prisma.user.findUnique({ where: { id: userId }, select: { resume: true } }))?.resume || "";

const sendError = (res, error, fallback) => {
    if (error instanceof ResumeWriterError || error instanceof ResumeExtractionError) {
        return res.status(error.status || 400).json({ message: error.message });
    }
    if (error instanceof groq.GroqError) {
        const unconfigured = error.status === 503;
        return res.status(unconfigured ? 503 : 502).json({
            message: unconfigured
                ? "AI writing help is not configured on this server yet."
                : "The AI service is busy right now. Please try again in a moment.",
        });
    }
    console.error(fallback, error);
    return res.status(500).json({ message: fallback, error: error.message });
};

// @desc    The candidate's CVs, newest first
// @route   GET /api/resume-builder
// @access  Private (Jobseeker)
const listResumes = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);

        const [resumes, latestAnalysis] = await Promise.all([
            prisma.builtResume.findMany({
                where: { userId: req.user._id },
                orderBy: { updatedAt: "desc" },
                include: withDocument,
            }),
            prisma.resumeAnalysis.findFirst({
                where: { userId: req.user._id },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true, fileName: true },
            }),
        ]);

        const primary = req.user.resume || "";
        res.status(200).json({
            resumes: resumes.map((resume) => shape(resume, primary)),
            limit: MAX_RESUMES,
            // Tells the "new CV" screen whether starting from the candidate's
            // analysed CV would fill in more than their name.
            latestAnalysis: latestAnalysis || null,
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not load your CVs");
    }
};

// @desc    Start a new CV, blank or from what the platform knows already
// @route   POST /api/resume-builder
// @access  Private (Jobseeker)
// @body    { source?: "profile" | "blank", title?: string }
const createResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const userId = req.user._id;

        const count = await prisma.builtResume.count({ where: { userId } });
        if (count >= MAX_RESUMES) {
            return res.status(400).json({
                message: `You can keep up to ${MAX_RESUMES} CVs. Delete one you no longer use to start another.`,
            });
        }

        let content;
        if (req.body?.source === "profile") {
            const [candidateProfile, analysis] = await Promise.all([
                prisma.candidateProfile.findUnique({ where: { userId } }),
                prisma.resumeAnalysis.findFirst({
                    where: { userId },
                    orderBy: { createdAt: "desc" },
                    select: { profile: true },
                }),
            ]);
            content = prefillContent({
                user: req.user,
                candidateProfile,
                analysisProfile: analysis?.profile || null,
            });
        } else {
            content = sanitizeContent({ personal: { fullName: req.user.name, email: req.user.email } });
        }

        const resume = await prisma.builtResume.create({
            data: {
                userId,
                title: clipTitle(req.body?.title) || (count === 0 ? "My CV" : `My CV ${count + 1}`),
                content,
            },
            include: withDocument,
        });

        res.status(201).json({ resume: shape(resume, req.user.resume) });
    } catch (error) {
        sendError(res, error, "Could not start a new CV");
    }
};

// @desc    One CV
// @route   GET /api/resume-builder/:id
// @access  Private (Jobseeker, owner)
const getResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        res.status(200).json({ resume: shape(resume, req.user.resume), aiEnabled: groq.isConfigured() });
    } catch (error) {
        sendError(res, error, "Could not load this CV");
    }
};

// @desc    Save changes. Any of title, template, accent and content.
// @route   PUT /api/resume-builder/:id
// @access  Private (Jobseeker, owner)
const updateResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        const body = req.body || {};
        const data = {};
        if (body.title !== undefined) data.title = clipTitle(body.title) || resume.title;
        if (body.template !== undefined && TEMPLATES.includes(body.template)) data.template = body.template;
        if (body.accent !== undefined && ACCENTS.includes(body.accent)) data.accent = body.accent;
        if (body.content !== undefined) data.content = sanitizeDraft(body.content);

        const updated = await prisma.builtResume.update({
            where: { id: resume.id },
            data,
            select: { id: true, title: true, template: true, accent: true, updatedAt: true },
        });

        // The editor keeps its own copy of the content, so only what the
        // server may have changed goes back.
        res.status(200).json({ resume: toClient(updated) });
    } catch (error) {
        sendError(res, error, "Could not save this CV");
    }
};

// @desc    Delete a CV. Its saved copy stays in the document library, since
//          applications may already have gone out with it.
// @route   DELETE /api/resume-builder/:id
// @access  Private (Jobseeker, owner)
const deleteResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        await prisma.builtResume.delete({ where: { id: resume.id } });
        res.status(200).json({ deleted: true, id: resume.id });
    } catch (error) {
        sendError(res, error, "Could not delete this CV");
    }
};

// @desc    Copy a CV — the usual start for a version tailored to one job
// @route   POST /api/resume-builder/:id/duplicate
// @access  Private (Jobseeker, owner)
const duplicateResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        const count = await prisma.builtResume.count({ where: { userId: req.user._id } });
        if (count >= MAX_RESUMES) {
            return res.status(400).json({
                message: `You can keep up to ${MAX_RESUMES} CVs. Delete one you no longer use to make a copy.`,
            });
        }

        // The copy starts unsaved: it is a new CV, not a second link to the
        // same library entry.
        const copy = await prisma.builtResume.create({
            data: {
                userId: req.user._id,
                title: clipTitle(`Copy of ${resume.title}`),
                template: resume.template,
                accent: resume.accent,
                content: sanitizeDraft(resume.content),
            },
            include: withDocument,
        });

        res.status(201).json({ resume: shape(copy, req.user.resume) });
    } catch (error) {
        sendError(res, error, "Could not copy this CV");
    }
};

// @desc    The CV as a PDF
// @route   GET /api/resume-builder/:id/pdf  (?inline=1 to view rather than save)
// @access  Private (Jobseeker, owner)
const downloadPdf = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        const { buffer } = await renderResumePdf(resume);
        const disposition = req.query.inline === "1" ? "inline" : "attachment";

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${disposition}; filename="${pdfFileName(resume)}"`);
        res.setHeader("Cache-Control", "no-store");
        res.status(200).send(buffer);
    } catch (error) {
        sendError(res, error, "Could not create the PDF");
    }
};

// @desc    Run the ATS checks on the PDF exactly as an employer's system
//          would receive it: rendered, then read back as text
// @route   POST /api/resume-builder/:id/check
// @access  Private (Jobseeker, owner)
const checkResume = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const resume = await loadOwned(req.params.id, req.user._id);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        // Under this, the extractor would report the file as a scanned image
        // — true of a file, misleading about a CV that is just not written yet.
        if (toPlainText(resume.content).split(/\s+/).filter(Boolean).length < 60) {
            return res.status(400).json({
                message: "There is not enough in this CV to check yet. Add your experience, education and skills first.",
            });
        }

        const { buffer, pageCount } = await renderResumePdf(resume);
        const extracted = await extractFromBuffer(buffer, { mimetype: "application/pdf", filename: "cv.pdf" });
        const ats = runAtsChecks(extracted.text, {
            wordCount: extracted.wordCount,
            pageCount,
            multiColumn: extracted.multiColumn,
            source: "pdf",
        });

        res.status(200).json({
            atsScore: ats.atsScore,
            checks: ats.checks,
            signals: ats.signals,
            sections: ats.sections,
            pageCount,
            // What a parser reads, shown so the candidate can see it for themselves.
            text: extracted.text.slice(0, 20000),
        });
    } catch (error) {
        sendError(res, error, "Could not check this CV");
    }
};

/**
 * Store a rendered PDF where uploaded documents go. Cloudinary serves a raw
 * file without an extension unless its id carries one, and the resume reader
 * decides a file's type from its name, so the id ends in ".pdf".
 */
const storePdf = async (buffer, fileName, req) => {
    try {
        const result = await uploadToCloudinary(buffer, {
            folder: "job-portal/documents",
            resource_type: "raw",
            public_id: `${fileName.replace(/\.pdf$/i, "")}-${Date.now()}.pdf`,
        });
        return { url: result.secure_url, publicId: result.public_id, resourceType: "raw" };
    } catch (cloudinaryError) {
        console.warn("Cloudinary upload failed, falling back to local disk storage:", cloudinaryError.message || cloudinaryError);
        const filename = await uploadToLocalDisk(buffer, fileName);
        return { url: `${req.protocol}://${req.get("host")}/uploads/${filename}`, publicId: null, resourceType: "raw" };
    }
};

// @desc    Save the CV's PDF to the document library, where applications can
//          attach it. Saving again refreshes the same library entry.
// @route   POST /api/resume-builder/:id/document
// @access  Private (Jobseeker, owner)
// @body    { makePrimary?: boolean }
const saveToDocuments = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const userId = req.user._id;
        const resume = await loadOwned(req.params.id, userId);
        if (!resume) return res.status(404).json({ message: "CV not found" });

        const { buffer } = await renderResumePdf(resume);
        const fileName = pdfFileName(resume);
        const stored = await storePdf(buffer, fileName, req);
        const name = `${clipTitle(resume.title) || "CV"}.pdf`;
        const fileData = {
            name,
            url: stored.url,
            fileType: "application/pdf",
            size: buffer.length,
            publicId: stored.publicId,
            resourceType: stored.resourceType,
            uploadedAt: new Date(),
        };

        const primaryBefore = await primaryResumeOf(userId);
        const previous = resume.document;

        // The library entry is written through the CV, so the two change
        // together. The previous file is left in storage: any application sent
        // with it points at that URL, and an employer opening it later must
        // still find the CV the candidate actually sent.
        const writes = [
            prisma.builtResume.update({
                where: { id: resume.id },
                data: {
                    savedAt: new Date(),
                    document: previous
                        ? { update: fileData }
                        : { create: { userId, category: "Resume", ...fileData } },
                },
                include: withDocument,
            }),
        ];

        // Keep the profile CV pointing at this one if it already did, and make
        // it the profile CV when asked — or when there is none at all, which is
        // what uploading a first CV does too.
        const wasPrimary = Boolean(previous) && primaryBefore === previous.url;
        const primary = wasPrimary || req.body?.makePrimary === true || !primaryBefore ? stored.url : primaryBefore;
        if (primary !== primaryBefore) {
            writes.push(prisma.user.update({ where: { id: userId }, data: { resume: primary } }));
        }

        const [fresh] = await prisma.$transaction(writes);
        res.status(200).json({
            resume: shape(fresh, primary),
            document: toClient(fresh.document),
            primaryResume: primary,
        });
    } catch (error) {
        sendError(res, error, "Could not save this CV to your documents");
    }
};

// @desc    AI writing help: a summary, better bullets for one role, or skills
// @route   POST /api/resume-builder/assist
// @access  Private (Jobseeker)
// @body    { kind, content, index?, notes?, targetRole? }
const assist = async (req, res) => {
    try {
        if (!isCandidate(req.user)) return forbidden(res);
        const body = req.body || {};
        const result = await assistResume({
            kind: body.kind,
            content: body.content,
            index: body.index,
            notes: body.notes,
            targetRole: body.targetRole,
        });
        res.status(200).json(result);
    } catch (error) {
        sendError(res, error, "Could not get writing help");
    }
};

module.exports = {
    listResumes,
    createResume,
    getResume,
    updateResume,
    deleteResume,
    duplicateResume,
    downloadPdf,
    checkResume,
    saveToDocuments,
    assist,
};
