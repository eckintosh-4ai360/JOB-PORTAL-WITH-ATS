const prisma = require("../config/prisma");
const {
    CANDIDATE_PHASES,
    REJECTED_STAGE,
    normalizeStatus,
    getEmployerStages,
} = require("../utils/hiringPipeline");
const {
    validateCriteria,
    hasCriteria,
    evaluateCandidate,
    rankCandidates,
    shapeCandidate,
    toClientCandidate,
    loadJobCandidates,
    isSettled,
    cleanNote,
    reasonNote,
    CANDIDATE_INCLUDE,
    MAX_NOTE_LENGTH,
} = require("../services/shortlistService");
const { moveApplication } = require("../services/stageMoveService");

/**
 * The employer's shortlist. It is private and reversible: adding or removing
 * someone changes nothing a candidate can see. Moving shortlisted people to a
 * pipeline stage is the step that tells them, and it follows the pipeline's
 * usual rules (services/stageMoveService).
 */

const MAX_BATCH = 200;

const requireEmployer = (req, res) => {
    if (req.user.role !== "employer") {
        res.status(403).json({ message: "Shortlists are kept by employers." });
        return false;
    }
    return true;
};

const fail = (res, error, message) => {
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

/**
 * A job the employer owns. A soft-deleted job still loads, as it does for the
 * applicant view: the people who applied still need an answer.
 */
const loadOwnedJob = async (jobId, employerId) => {
    const job = await prisma.job.findUnique({
        where: { id: String(jobId || "") },
        select: {
            id: true,
            title: true,
            location: true,
            isClosed: true,
            deletedAt: true,
            companyId: true,
            screeningQuestions: true,
        },
    });
    if (!job || job.companyId !== employerId) return null;
    return job;
};

const questionsOf = (job) => (Array.isArray(job.screeningQuestions) ? job.screeningQuestions : []);

/** A list of ids from the body: strings, de-duplicated, capped. */
const readIds = (value) => {
    if (!Array.isArray(value)) return { error: "Choose at least one applicant." };
    const ids = [...new Set(value.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))];
    if (ids.length === 0) return { error: "Choose at least one applicant." };
    if (ids.length > MAX_BATCH) return { error: `Work with at most ${MAX_BATCH} applicants at a time.` };
    return { ids };
};

/** The employer's own applications among `ids`, with what the shortlist needs. */
const loadOwnedApplications = (ids, employerId) =>
    prisma.application.findMany({
        where: { id: { in: ids }, job: { companyId: employerId } },
        include: {
            ...CANDIDATE_INCLUDE,
            job: { select: { id: true, title: true, companyId: true } },
        },
    });

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// @desc    The employer's jobs, with how many applicants each has shortlisted
// @route   GET /api/shortlists
// @access  Private (Employer)
const getOverview = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const jobs = await prisma.job.findMany({
            where: { companyId: req.user._id, deletedAt: null },
            select: {
                id: true,
                title: true,
                location: true,
                isClosed: true,
                createdAt: true,
                _count: { select: { applications: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const shortlisted = jobs.length
            ? await prisma.application.groupBy({
                by: ["jobId"],
                where: { jobId: { in: jobs.map((job) => job.id) }, shortlistedAt: { not: null } },
                _count: { _all: true },
            })
            : [];
        const shortlistedByJob = new Map(shortlisted.map((row) => [row.jobId, row._count._all]));

        res.status(200).json({
            jobs: jobs.map((job) => ({
                id: job.id,
                _id: job.id,
                title: job.title,
                location: job.location,
                isClosed: job.isClosed,
                createdAt: job.createdAt,
                applicants: job._count.applications,
                shortlisted: shortlistedByJob.get(job.id) || 0,
            })),
        });
    } catch (error) {
        fail(res, error, "Could not load your shortlists.");
    }
};

// @desc    One job's shortlist, with the stages it can be moved to
// @route   GET /api/shortlists/:jobId
// @access  Private (Employer who owns the job)
const getJobShortlist = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const job = await loadOwnedJob(req.params.jobId, req.user._id);
        if (!job) return res.status(404).json({ message: "Job not found." });

        const stages = await getEmployerStages(req.user._id);
        const candidates = await loadJobCandidates(job.id, stages);
        const shortlist = candidates
            .filter((candidate) => candidate.shortlist)
            .sort((a, b) => new Date(a.shortlist.at) - new Date(b.shortlist.at));
        const open = candidates.filter((candidate) => !isSettled(candidate));

        res.status(200).json({
            job: {
                id: job.id,
                _id: job.id,
                title: job.title,
                location: job.location,
                isClosed: job.isClosed,
                deleted: Boolean(job.deletedAt),
                screeningQuestions: questionsOf(job),
            },
            stages,
            rejectedStage: REJECTED_STAGE,
            phases: CANDIDATE_PHASES,
            shortlist: shortlist.map(toClientCandidate),
            counts: {
                applicants: candidates.length,
                open: open.length,
                shortlisted: shortlist.length,
                // Open applicants the AI has not scored — assisted checks on fit,
                // skills and experience are unknown for them until it has.
                unscored: open.filter((candidate) => !candidate.fit).length,
            },
        });
    } catch (error) {
        fail(res, error, "Could not load this shortlist.");
    }
};

// @desc    Applicants who could be shortlisted — checked against criteria when given
// @route   POST /api/shortlists/:jobId/candidates
// @access  Private (Employer who owns the job)
const findCandidates = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const job = await loadOwnedJob(req.params.jobId, req.user._id);
        if (!job) return res.status(404).json({ message: "Job not found." });

        const questions = questionsOf(job);
        const { criteria, error } = validateCriteria(req.body?.criteria, questions);
        if (error) return res.status(400).json({ message: error });

        const stages = await getEmployerStages(req.user._id);
        const candidates = (await loadJobCandidates(job.id, stages))
            .filter((candidate) => !candidate.shortlist && !isSettled(candidate))
            .map((candidate) => ({ ...candidate, ...evaluateCandidate(candidate, criteria, questions) }));

        const ranked = rankCandidates(candidates);
        const count = (verdict) => ranked.filter((candidate) => candidate.verdict === verdict).length;

        res.status(200).json({
            criteria,
            assisted: hasCriteria(criteria),
            candidates: ranked.map(toClientCandidate),
            counts: {
                total: ranked.length,
                suggested: count("suggested"),
                needsData: count("needs_data"),
                notSuggested: count("not_suggested"),
                unscored: ranked.filter((candidate) => !candidate.fit).length,
            },
        });
    } catch (error) {
        fail(res, error, "Could not find candidates for this shortlist.");
    }
};

// @desc    Add applicants to the shortlist. With `assisted: { jobId, criteria }`
//          each is checked again here, and those who meet every criterion are
//          recorded as assisted picks with the reasons as their note.
// @route   POST /api/shortlists/add
// @access  Private (Employer)
const addToShortlist = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const { ids, error: idsError } = readIds(req.body?.applicationIds);
        if (idsError) return res.status(400).json({ message: idsError });

        if (String(req.body?.note ?? "").trim().length > MAX_NOTE_LENGTH) {
            return res.status(400).json({ message: `Keep the note under ${MAX_NOTE_LENGTH} characters.` });
        }
        const note = cleanNote(req.body?.note);

        const applications = await loadOwnedApplications(ids, req.user._id);
        if (applications.length !== ids.length) {
            return res.status(404).json({ message: "Some of those applications could not be found." });
        }

        const stages = await getEmployerStages(req.user._id);

        // Assisted picks are re-checked against the criteria rather than taking
        // the browser's word for why someone was suggested.
        let assisted = null;
        if (req.body?.assisted) {
            const job = await loadOwnedJob(req.body.assisted.jobId, req.user._id);
            if (!job) return res.status(404).json({ message: "Job not found." });
            if (applications.some((application) => application.jobId !== job.id)) {
                return res.status(400).json({ message: "Suggestions are added one job at a time." });
            }
            const questions = questionsOf(job);
            const { criteria, error } = validateCriteria(req.body.assisted.criteria, questions);
            if (error) return res.status(400).json({ message: error });
            assisted = { criteria, questions };
        }

        const skipped = [];
        const writes = [];

        for (const application of applications) {
            const candidate = shapeCandidate(application, stages);

            if (candidate.shortlist) {
                skipped.push({ id: candidate.id, name: candidate.name, reason: "Already on the shortlist" });
                continue;
            }
            if (isSettled(candidate)) {
                skipped.push({ id: candidate.id, name: candidate.name, reason: `Settled as ${candidate.stage.name}` });
                continue;
            }

            let source = "manual";
            let rowNote = note;
            if (assisted && hasCriteria(assisted.criteria)) {
                const result = evaluateCandidate(candidate, assisted.criteria, assisted.questions);
                if (result.verdict === "suggested") {
                    source = "assisted";
                    rowNote = note || reasonNote(result.checks);
                }
            }

            writes.push(
                prisma.application.updateMany({
                    // Only if nobody shortlisted them in the meantime.
                    where: { id: application.id, shortlistedAt: null },
                    data: {
                        shortlistedAt: new Date(),
                        shortlistedById: req.user._id,
                        shortlistSource: source,
                        shortlistNote: rowNote || null,
                    },
                })
            );
        }

        const results = writes.length ? await prisma.$transaction(writes) : [];
        const added = results.reduce((sum, result) => sum + result.count, 0);

        res.status(200).json({
            added,
            skipped,
            message: added
                ? `Added ${plural(added, "applicant")} to the shortlist.`
                : "Nobody new was added to the shortlist.",
        });
    } catch (error) {
        fail(res, error, "Could not add to the shortlist.");
    }
};

// @desc    Take applicants off the shortlist. Their stage is untouched.
// @route   POST /api/shortlists/remove
// @access  Private (Employer)
const removeFromShortlist = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const { ids, error } = readIds(req.body?.applicationIds);
        if (error) return res.status(400).json({ message: error });

        const { count } = await prisma.application.updateMany({
            where: { id: { in: ids }, job: { companyId: req.user._id }, shortlistedAt: { not: null } },
            data: { shortlistedAt: null, shortlistedById: null, shortlistSource: null, shortlistNote: null },
        });

        res.status(200).json({
            removed: count,
            message: count ? `Removed ${plural(count, "applicant")} from the shortlist.` : "Nobody was on the shortlist.",
        });
    } catch (error) {
        fail(res, error, "Could not update the shortlist.");
    }
};

// @desc    Change the note on a shortlisted applicant
// @route   PATCH /api/shortlists/note/:applicationId
// @access  Private (Employer)
const updateShortlistNote = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        if (String(req.body?.note ?? "").trim().length > MAX_NOTE_LENGTH) {
            return res.status(400).json({ message: `Keep the note under ${MAX_NOTE_LENGTH} characters.` });
        }
        const note = cleanNote(req.body?.note);

        const { count } = await prisma.application.updateMany({
            where: { id: req.params.applicationId, job: { companyId: req.user._id }, shortlistedAt: { not: null } },
            data: { shortlistNote: note || null },
        });
        if (count === 0) return res.status(404).json({ message: "That applicant is not on your shortlist." });

        res.status(200).json({ message: "Note saved.", note });
    } catch (error) {
        fail(res, error, "Could not save the note.");
    }
};

// @desc    Move shortlisted applicants to a pipeline stage — the step that tells them
// @route   POST /api/shortlists/:jobId/advance
// @access  Private (Employer who owns the job)
const advanceShortlist = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const job = await loadOwnedJob(req.params.jobId, req.user._id);
        if (!job) return res.status(404).json({ message: "Job not found." });

        const { ids, error } = readIds(req.body?.applicationIds);
        if (error) return res.status(400).json({ message: error });

        const stages = await getEmployerStages(req.user._id);
        // Only the employer's own stages: rejecting stays a one-at-a-time
        // decision in the applicant view, with its own confirmation.
        const stage = stages.find((entry) => entry.id === normalizeStatus(req.body?.stageId));
        if (!stage) return res.status(400).json({ message: "Choose a stage in your pipeline." });
        if (stage.type === "interview") {
            return res.status(400).json({
                message: `"${stage.name}" schedules an interview, which needs a date and place for each candidate. Schedule interviews from the applicant view.`,
            });
        }

        const applications = await prisma.application.findMany({
            where: { id: { in: ids }, jobId: job.id },
            include: {
                job: { select: { id: true, title: true, companyId: true } },
                applicant: { select: { id: true, name: true, email: true, avatar: true, resume: true } },
            },
        });
        if (applications.length !== ids.length) {
            return res.status(404).json({ message: "Some of those applications are not for this job." });
        }

        const moved = [];
        const skipped = [];

        // One at a time: each move is conditional on the stage it was read in
        // and emails its own candidate.
        for (const application of applications) {
            const name = application.applicant?.name || application.guestName || "Applicant";

            if (!application.shortlistedAt) {
                skipped.push({ id: application.id, name, reason: "Not on the shortlist" });
                continue;
            }
            if (normalizeStatus(application.status) === stage.id) {
                skipped.push({ id: application.id, name, reason: `Already in ${stage.name}` });
                continue;
            }

            const result = await moveApplication({ application, stages, stage });
            if (result.error) {
                skipped.push({ id: application.id, name, reason: result.error.message });
            } else {
                moved.push({ id: application.id, name, status: stage.id });
            }
        }

        res.status(200).json({
            moved,
            skipped,
            stage,
            message: moved.length
                ? `Moved ${plural(moved.length, "applicant")} to ${stage.name}.`
                : `Nobody was moved to ${stage.name}.`,
        });
    } catch (error) {
        fail(res, error, "Could not move the shortlist.");
    }
};

module.exports = {
    getOverview,
    getJobShortlist,
    findCandidates,
    addToShortlist,
    removeFromShortlist,
    updateShortlistNote,
    advanceShortlist,
};
