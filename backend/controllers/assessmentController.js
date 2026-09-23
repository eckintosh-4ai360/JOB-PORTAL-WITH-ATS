const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const groq = require("../utils/groqClient");
const matchService = require("../services/jobMatchService");
const { generateAssessmentQuestions } = require("../services/assessmentGeneratorService");
const { getEmployerStages, findStage } = require("../utils/hiringPipeline");
const { sendAssessmentInviteEmail } = require("../utils/emailService");
const {
    validateAssessment,
    maxScoreOf,
    forCandidate,
    cleanAnswers,
    markAnswers,
    summarize,
    LIMITS,
} = require("../utils/assessmentQuestions");

/**
 * Assessments: employers build a test, send it to applicants, and mark it;
 * candidates sit it.
 *
 * Every attempt carries its own copy of the questions from the moment it was
 * sent, answer key included. The candidate-facing handlers never return that
 * key, the scoring guidance, or a score — candidates learn how they did from
 * the employer, not from the platform.
 */

// Answers saved this long after the clock runs out still count: the last
// autosave of a slow connection should not be lost to a network hop.
const GRACE_MS = 60 * 1000;
const STATUSES = ["invited", "in_progress", "submitted", "scored", "expired"];

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

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

const requireEmployer = (req, res) => {
    if (req.user.role !== "employer") {
        res.status(403).json({ message: "Assessments are managed by employers." });
        return false;
    }
    return true;
};

// ---------------------------------------------------------------------------
// Attempt lifecycle
// ---------------------------------------------------------------------------

/** When a started attempt must be finished by: its time limit, or the due date if untimed. */
const deadlineOf = (attempt) => {
    if (!attempt.startedAt) return null;
    if (attempt.timeLimitMinutes) return new Date(attempt.startedAt.getTime() + attempt.timeLimitMinutes * 60 * 1000);
    return attempt.dueAt;
};

const effectiveStatus = (attempt, now = new Date()) =>
    attempt.status === "invited" && attempt.dueAt < now ? "expired" : attempt.status;

const valuesOf = (answers) =>
    Object.fromEntries(Object.entries(answers || {}).map(([id, entry]) => [id, entry?.value ?? null]));

/** Answers as saved mid-attempt: values only, nothing marked yet. */
const progressEntries = (values) =>
    Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value, autoPoints: null, points: null, note: "" }]));

/**
 * Close an attempt: mark the choice questions, total up, and decide whether
 * anything still needs the employer. Conditional on the attempt still being in
 * progress, so a submit racing the clock cannot finalise it twice.
 */
const finalize = async (attempt, include) => {
    const questions = attempt.questions;
    const marked = markAnswers(questions, valuesOf(attempt.answers));
    const summary = summarize(questions, marked, attempt.passMark);
    const now = new Date();

    await prisma.assessmentAttempt.updateMany({
        where: { id: attempt.id, status: "in_progress" },
        data: {
            answers: marked,
            status: summary.complete ? "scored" : "submitted",
            submittedAt: now,
            score: summary.score,
            percent: summary.complete ? summary.percent : null,
            scoredAt: summary.complete ? now : null,
        },
    });

    return prisma.assessmentAttempt.findUnique({ where: { id: attempt.id }, include });
};

/** A timed attempt whose clock ran out while the candidate was away is closed here. */
const settleOverdue = async (attempt, include) => {
    if (attempt.status !== "in_progress") return attempt;
    const deadline = deadlineOf(attempt);
    if (!deadline || Date.now() <= deadline.getTime() + GRACE_MS) return attempt;
    return finalize(attempt, include);
};

const settleAll = (attempts, include) => Promise.all(attempts.map((attempt) => settleOverdue(attempt, include)));

const employerRow = (attempt, stages) => {
    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    const summary = summarize(questions, attempt.answers, attempt.passMark);
    const status = effectiveStatus(attempt);
    const finished = status === "submitted" || status === "scored";
    return {
        id: attempt.id,
        assessmentId: attempt.assessmentId,
        assessmentTitle: attempt.assessment?.title,
        applicationId: attempt.applicationId,
        candidateId: attempt.candidateId,
        candidateName: attempt.candidate?.name || attempt.application?.applicant?.name || "Candidate",
        candidateAvatar: attempt.candidate?.avatar || "",
        jobId: attempt.application?.jobId,
        jobTitle: attempt.application?.job?.title || "",
        stage: stages && attempt.application ? findStage(stages, attempt.application.status)?.name || null : null,
        status,
        invitedAt: attempt.invitedAt,
        dueAt: attempt.dueAt,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeTakenSeconds: attempt.startedAt && attempt.submittedAt
            ? Math.round((attempt.submittedAt - attempt.startedAt) / 1000)
            : null,
        score: finished ? summary.score : null,
        maxScore: attempt.maxScore,
        percent: status === "scored" ? attempt.percent : null,
        passMark: attempt.passMark,
        passed: status === "scored" ? attempt.percent >= attempt.passMark : null,
        awaitingMarking: status === "submitted" ? summary.pending : 0,
    };
};

const ROW_INCLUDE = {
    assessment: { select: { id: true, title: true } },
    candidate: { select: { id: true, name: true, avatar: true } },
    application: {
        select: {
            id: true,
            jobId: true,
            status: true,
            job: { select: { title: true } },
            applicant: { select: { name: true } },
        },
    },
};

// ---------------------------------------------------------------------------
// Employer: assessments
// ---------------------------------------------------------------------------

const statsFor = (attempts) => {
    const statuses = attempts.map((attempt) => effectiveStatus(attempt));
    const scored = attempts.filter((attempt, i) => statuses[i] === "scored");
    const average = scored.length
        ? Math.round(scored.reduce((sum, attempt) => sum + (attempt.percent || 0), 0) / scored.length)
        : null;
    return {
        sent: attempts.length,
        completed: statuses.filter((s) => s === "submitted" || s === "scored").length,
        awaitingMarking: statuses.filter((s) => s === "submitted").length,
        inProgress: statuses.filter((s) => s === "in_progress").length,
        averagePercent: average,
        passRate: scored.length
            ? Math.round((scored.filter((attempt) => attempt.percent >= attempt.passMark).length / scored.length) * 100)
            : null,
    };
};

const shapeAssessment = (assessment, { withQuestions = false } = {}) => {
    const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
    return {
        id: assessment.id,
        _id: assessment.id,
        title: assessment.title,
        instructions: assessment.instructions || "",
        jobId: assessment.jobId,
        jobTitle: assessment.job?.title || null,
        timeLimitMinutes: assessment.timeLimitMinutes,
        passMark: assessment.passMark,
        defaultDueDays: assessment.defaultDueDays,
        status: assessment.status,
        questionCount: questions.length,
        totalPoints: maxScoreOf(questions),
        autoMarked: questions.every((q) => q.type === "single" || q.type === "multiple"),
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        stats: assessment.attempts ? statsFor(assessment.attempts) : undefined,
        ...(withQuestions ? { questions } : {}),
    };
};

const loadOwnedAssessment = async (id, employerId) => {
    const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: { job: { select: { id: true, title: true } } },
    });
    if (!assessment || assessment.employerId !== employerId) return null;
    return assessment;
};

const checkJob = async (jobId, employerId) => {
    if (!jobId) return { jobId: null };
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, companyId: true } });
    if (!job || job.companyId !== employerId) return { error: "That job is not one of yours." };
    return { jobId: job.id };
};

// @desc    The employer's assessments, with completion and score stats
// @route   GET /api/assessments
const listAssessments = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const assessments = await prisma.assessment.findMany({
            where: { employerId: req.user._id },
            include: {
                job: { select: { id: true, title: true } },
                attempts: { select: { status: true, percent: true, passMark: true, dueAt: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        res.status(200).json({ assessments: assessments.map((a) => shapeAssessment(a)) });
    } catch (error) {
        sendError(res, error, "Could not load assessments");
    }
};

// @desc    Create an assessment
// @route   POST /api/assessments
const createAssessment = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const { data, error } = validateAssessment(req.body);
        if (error) return res.status(400).json({ message: error });

        const job = await checkJob(req.body.jobId, req.user._id);
        if (job.error) return res.status(400).json({ message: job.error });

        const assessment = await prisma.assessment.create({
            data: {
                ...data,
                jobId: job.jobId,
                employerId: req.user._id,
                status: req.body.status === "active" ? "active" : "draft",
            },
            include: { job: { select: { id: true, title: true } } },
        });
        res.status(201).json({ assessment: shapeAssessment(assessment, { withQuestions: true }) });
    } catch (error) {
        sendError(res, error, "Could not create the assessment");
    }
};

// @desc    One assessment with its questions and every candidate's result
// @route   GET /api/assessments/:id
const getAssessment = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const assessment = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!assessment) return res.status(404).json({ message: "Assessment not found" });

        const [attempts, stages] = await Promise.all([
            prisma.assessmentAttempt.findMany({
                where: { assessmentId: assessment.id },
                include: ROW_INCLUDE,
                orderBy: { invitedAt: "desc" },
            }).then((rows) => settleAll(rows, ROW_INCLUDE)),
            getEmployerStages(req.user._id),
        ]);

        res.status(200).json({
            assessment: { ...shapeAssessment({ ...assessment, attempts }, { withQuestions: true }) },
            candidates: attempts.map((attempt) => employerRow(attempt, stages)),
        });
    } catch (error) {
        sendError(res, error, "Could not load the assessment");
    }
};

// @desc    Update an assessment. Attempts already sent keep their own copy.
// @route   PUT /api/assessments/:id
const updateAssessment = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const existing = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!existing) return res.status(404).json({ message: "Assessment not found" });

        const { data, error } = validateAssessment(req.body);
        if (error) return res.status(400).json({ message: error });

        const job = await checkJob(req.body.jobId, req.user._id);
        if (job.error) return res.status(400).json({ message: job.error });

        const status = ["draft", "active", "archived"].includes(req.body.status) ? req.body.status : existing.status;
        const assessment = await prisma.assessment.update({
            where: { id: existing.id },
            data: { ...data, jobId: job.jobId, status },
            include: { job: { select: { id: true, title: true } } },
        });
        res.status(200).json({ assessment: shapeAssessment(assessment, { withQuestions: true }) });
    } catch (error) {
        sendError(res, error, "Could not save the assessment");
    }
};

// @desc    Archive or reactivate without touching the questions
// @route   PATCH /api/assessments/:id/status
const setAssessmentStatus = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const existing = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!existing) return res.status(404).json({ message: "Assessment not found" });
        if (!["draft", "active", "archived"].includes(req.body?.status)) {
            return res.status(400).json({ message: "Status must be draft, active or archived." });
        }
        await prisma.assessment.update({ where: { id: existing.id }, data: { status: req.body.status } });
        res.status(200).json({ status: req.body.status });
    } catch (error) {
        sendError(res, error, "Could not update the assessment");
    }
};

// @desc    Delete an assessment nobody has been sent
// @route   DELETE /api/assessments/:id
const deleteAssessment = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const existing = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!existing) return res.status(404).json({ message: "Assessment not found" });

        const sent = await prisma.assessmentAttempt.count({ where: { assessmentId: existing.id } });
        if (sent > 0) {
            return res.status(409).json({
                message: "This assessment has been sent to candidates, so its results are kept. Archive it instead.",
            });
        }
        await prisma.assessment.delete({ where: { id: existing.id } });
        res.status(200).json({ message: "Assessment deleted" });
    } catch (error) {
        sendError(res, error, "Could not delete the assessment");
    }
};

// @desc    Applicants this assessment can be sent to
// @route   GET /api/assessments/:id/eligible
const getEligible = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const assessment = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!assessment) return res.status(404).json({ message: "Assessment not found" });

        const [applications, stages] = await Promise.all([
            prisma.application.findMany({
                where: {
                    job: { companyId: req.user._id },
                    ...(assessment.jobId ? { jobId: assessment.jobId } : {}),
                },
                select: {
                    id: true,
                    jobId: true,
                    status: true,
                    applicantId: true,
                    guestName: true,
                    createdAt: true,
                    job: { select: { title: true } },
                    applicant: { select: { name: true } },
                    assessmentAttempts: {
                        where: { assessmentId: assessment.id },
                        select: { status: true, dueAt: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            getEmployerStages(req.user._id),
        ]);

        res.status(200).json({
            applicants: applications.map((application) => {
                const attempt = application.assessmentAttempts[0];
                const attemptStatus = attempt ? effectiveStatus(attempt) : null;
                const stage = findStage(stages, application.status);
                return {
                    applicationId: application.id,
                    name: application.applicant?.name || application.guestName || "Applicant",
                    jobTitle: application.job?.title || "",
                    stage: stage?.name || application.status,
                    rejected: stage?.type === "rejected",
                    appliedAt: application.createdAt,
                    attemptStatus,
                    // A guest has no account to sit the assessment in; a started
                    // or finished attempt cannot be replaced.
                    eligible: Boolean(application.applicantId)
                        && (!attemptStatus || attemptStatus === "invited" || attemptStatus === "expired"),
                    reason: !application.applicantId
                        ? "Applied as a guest — no account to take it in"
                        : attemptStatus && !["invited", "expired"].includes(attemptStatus)
                            ? "Already started or finished"
                            : null,
                };
            }),
        });
    } catch (error) {
        sendError(res, error, "Could not load applicants");
    }
};

// @desc    Send the assessment to applicants (resending re-opens an unstarted one)
// @route   POST /api/assessments/:id/send
const sendAssessment = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const assessment = await loadOwnedAssessment(req.params.id, req.user._id);
        if (!assessment) return res.status(404).json({ message: "Assessment not found" });
        if (assessment.status === "archived") {
            return res.status(400).json({ message: "Reactivate this assessment before sending it." });
        }

        const ids = Array.isArray(req.body?.applicationIds) ? [...new Set(req.body.applicationIds)].slice(0, 200) : [];
        if (ids.length === 0) return res.status(400).json({ message: "Choose at least one applicant." });

        const dueInDays = Math.round(Number(req.body?.dueInDays ?? assessment.defaultDueDays));
        if (!Number.isFinite(dueInDays) || dueInDays < 1 || dueInDays > 30) {
            return res.status(400).json({ message: "Give candidates between 1 and 30 days." });
        }
        const dueAt = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

        const [applications, company] = await Promise.all([
            prisma.application.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    jobId: true,
                    applicantId: true,
                    job: { select: { title: true, companyId: true } },
                    applicant: { select: { name: true, email: true } },
                    assessmentAttempts: { where: { assessmentId: assessment.id } },
                },
            }),
            prisma.company.findUnique({ where: { userId: req.user._id }, select: { name: true } }),
        ]);
        const companyName = company?.name || req.user.companyName || req.user.name;

        const questions = assessment.questions;
        const sent = [];
        const skipped = [];

        for (const id of ids) {
            const application = applications.find((entry) => entry.id === id);
            if (!application || application.job?.companyId !== req.user._id) {
                skipped.push({ applicationId: id, reason: "Not one of your applications" });
                continue;
            }
            if (assessment.jobId && application.jobId !== assessment.jobId) {
                skipped.push({ applicationId: id, reason: "Applied for a different job" });
                continue;
            }
            if (!application.applicantId) {
                skipped.push({ applicationId: id, reason: "Applied as a guest" });
                continue;
            }

            const snapshot = {
                questions,
                timeLimitMinutes: assessment.timeLimitMinutes,
                passMark: assessment.passMark,
                maxScore: maxScoreOf(questions),
                dueAt,
                invitedAt: new Date(),
            };

            const existing = application.assessmentAttempts[0];
            let attempt;
            if (existing) {
                if (existing.status !== "invited") {
                    skipped.push({ applicationId: id, reason: "Already started or finished" });
                    continue;
                }
                // Not started yet, so it can take the latest questions and a new deadline.
                attempt = await prisma.assessmentAttempt.update({
                    where: { id: existing.id },
                    data: snapshot,
                });
            } else {
                attempt = await prisma.assessmentAttempt.create({
                    data: {
                        ...snapshot,
                        assessmentId: assessment.id,
                        applicationId: application.id,
                        candidateId: application.applicantId,
                    },
                });
            }

            sent.push(id);
            if (application.applicant?.email) {
                sendAssessmentInviteEmail({
                    to: application.applicant.email,
                    candidateName: application.applicant.name,
                    companyName,
                    jobTitle: application.job.title,
                    assessmentTitle: assessment.title,
                    dueAt,
                    timeLimitMinutes: assessment.timeLimitMinutes,
                    assessmentUrl: `${frontendUrl()}/assessment/${attempt.id}`,
                });
            }
        }

        if (sent.length > 0 && assessment.status === "draft") {
            await prisma.assessment.update({ where: { id: assessment.id }, data: { status: "active" } });
        }

        res.status(200).json({
            message: sent.length
                ? `Sent to ${sent.length} candidate${sent.length === 1 ? "" : "s"}.`
                : "Nobody was sent the assessment.",
            sent: sent.length,
            skipped,
        });
    } catch (error) {
        sendError(res, error, "Could not send the assessment");
    }
};

// @desc    Draft questions for a job with AI
// @route   POST /api/assessments/generate
const generateQuestions = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const { jobId, title, count, mix, focus } = req.body || {};

        let job;
        let spec = null;
        if (jobId) {
            job = await prisma.job.findUnique({ where: { id: jobId } });
            if (!job || job.companyId !== req.user._id) return res.status(404).json({ message: "Job not found" });
            spec = await matchService.getJobSpec(job);
        } else if (String(title || "").trim().length >= 3) {
            job = { title: String(title).trim(), description: "", requirements: "" };
        } else {
            return res.status(400).json({ message: "Pick a job, or give the assessment a title, so questions fit the role." });
        }

        const { questions } = await generateAssessmentQuestions({ job, spec, count, mix, focus });
        if (questions.length === 0) {
            return res.status(502).json({ message: "The AI did not return usable questions. Try again." });
        }
        res.status(200).json({ questions });
    } catch (error) {
        sendError(res, error, "Could not generate questions");
    }
};

// ---------------------------------------------------------------------------
// Employer: results and marking
// ---------------------------------------------------------------------------

// @desc    Every candidate's attempt across the employer's assessments
// @route   GET /api/assessments/attempts?assessmentId=&jobId=&status=&applicationId=
const listAttempts = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const { assessmentId, jobId, status, applicationId } = req.query;

        const where = { assessment: { employerId: req.user._id } };
        if (assessmentId) where.assessmentId = String(assessmentId);
        if (applicationId) where.applicationId = String(applicationId);
        if (jobId) where.application = { jobId: String(jobId) };

        const [attempts, stages] = await Promise.all([
            prisma.assessmentAttempt.findMany({
                where,
                include: ROW_INCLUDE,
                orderBy: { invitedAt: "desc" },
                take: 1000,
            }).then((rows) => settleAll(rows, ROW_INCLUDE)),
            getEmployerStages(req.user._id),
        ]);

        let rows = attempts.map((attempt) => employerRow(attempt, stages));
        if (status && STATUSES.includes(status)) rows = rows.filter((row) => row.status === status);

        res.status(200).json({ attempts: rows });
    } catch (error) {
        sendError(res, error, "Could not load results");
    }
};

const loadOwnedAttempt = async (attemptId, employerId) => {
    const attempt = await prisma.assessmentAttempt.findUnique({
        where: { id: attemptId },
        include: {
            ...ROW_INCLUDE,
            assessment: { select: { id: true, title: true, employerId: true } },
            candidate: { select: { id: true, name: true, email: true, avatar: true } },
        },
    });
    if (!attempt || attempt.assessment.employerId !== employerId) return null;
    return attempt;
};

const reviewPayload = (attempt, stages) => ({
    attempt: employerRow(attempt, stages),
    candidate: toClient(attempt.candidate),
    questions: attempt.questions,
    answers: attempt.answers || {},
});

// @desc    One attempt, question by question, with the answer key
// @route   GET /api/assessments/attempts/:attemptId
const getAttempt = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        let attempt = await loadOwnedAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Result not found" });

        if (attempt.status === "in_progress") {
            await settleOverdue(attempt);
            attempt = await loadOwnedAttempt(attempt.id, req.user._id);
        }

        res.status(200).json(reviewPayload(attempt, await getEmployerStages(req.user._id)));
    } catch (error) {
        sendError(res, error, "Could not load this result");
    }
};

// @desc    Mark written answers, or adjust any mark, with an optional note each
// @route   PUT /api/assessments/attempts/:attemptId/score
// @body    { points: { [questionId]: number }, notes: { [questionId]: string } }
const scoreAttempt = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const attempt = await loadOwnedAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Result not found" });
        if (!["submitted", "scored"].includes(attempt.status)) {
            return res.status(409).json({ message: "Only a submitted assessment can be marked." });
        }

        const points = req.body?.points || {};
        const notes = req.body?.notes || {};
        const answers = { ...(attempt.answers || {}) };

        for (const question of attempt.questions) {
            const entry = { ...(answers[question.id] || { value: null, autoPoints: null, points: null, note: "" }) };

            if (question.id in points) {
                const given = points[question.id];
                if (given === null || given === "") {
                    entry.points = null;
                } else {
                    // Half marks are allowed; anything else is rounded to one.
                    const value = Math.round(Number(given) * 2) / 2;
                    if (!Number.isFinite(value) || value < 0 || value > question.points) {
                        return res.status(400).json({
                            message: `A mark for "${question.prompt.slice(0, 60)}" must be between 0 and ${question.points}.`,
                        });
                    }
                    entry.points = value;
                }
            }
            if (question.id in notes) entry.note = String(notes[question.id] ?? "").slice(0, LIMITS.note);
            answers[question.id] = entry;
        }

        const summary = summarize(attempt.questions, answers, attempt.passMark);
        const now = new Date();
        await prisma.assessmentAttempt.update({
            where: { id: attempt.id },
            data: {
                answers,
                score: summary.score,
                status: summary.complete ? "scored" : "submitted",
                percent: summary.complete ? summary.percent : null,
                scoredAt: summary.complete ? now : null,
                scoredById: req.user._id,
            },
        });

        const updated = await loadOwnedAttempt(attempt.id, req.user._id);
        res.status(200).json({
            message: summary.complete ? `Marked: ${summary.percent}%` : `Saved — ${summary.pending} answer${summary.pending === 1 ? "" : "s"} still to mark`,
            ...reviewPayload(updated, await getEmployerStages(req.user._id)),
        });
    } catch (error) {
        sendError(res, error, "Could not save the marks");
    }
};

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

const CANDIDATE_INCLUDE = {
    assessment: { select: { title: true, instructions: true } },
    application: {
        select: {
            job: {
                select: {
                    title: true,
                    companyProfile: { select: { name: true, logo: true } },
                    company: { select: { companyName: true, name: true, companyLogo: true } },
                },
            },
        },
    },
};

/** Never the answer key, the guidance or a score. */
const candidateView = (attempt) => {
    const status = effectiveStatus(attempt);
    const job = attempt.application?.job;
    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    const inProgress = status === "in_progress";
    return {
        id: attempt.id,
        status,
        title: attempt.assessment?.title || "Assessment",
        instructions: attempt.assessment?.instructions || "",
        jobTitle: job?.title || "",
        companyName: job?.companyProfile?.name || job?.company?.companyName || job?.company?.name || "",
        companyLogo: job?.companyProfile?.logo || job?.company?.companyLogo || "",
        timeLimitMinutes: attempt.timeLimitMinutes,
        questionCount: questions.length,
        invitedAt: attempt.invitedAt,
        dueAt: attempt.dueAt,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        deadline: inProgress ? deadlineOf(attempt) : null,
        serverNow: new Date(),
        questions: inProgress ? forCandidate(questions) : [],
        answers: inProgress ? valuesOf(attempt.answers) : {},
    };
};

const loadOwnAttempt = (attemptId, candidateId) =>
    prisma.assessmentAttempt.findFirst({ where: { id: attemptId, candidateId }, include: CANDIDATE_INCLUDE });

// @desc    The candidate's assessments
// @route   GET /api/assessments/mine
const myAssessments = async (req, res) => {
    try {
        const attempts = await prisma.assessmentAttempt
            .findMany({ where: { candidateId: req.user._id }, include: CANDIDATE_INCLUDE, orderBy: { invitedAt: "desc" } })
            .then((rows) => settleAll(rows, CANDIDATE_INCLUDE));
        res.status(200).json({
            assessments: attempts.map((attempt) => {
                const view = candidateView(attempt);
                delete view.questions;
                delete view.answers;
                return view;
            }),
        });
    } catch (error) {
        sendError(res, error, "Could not load your assessments");
    }
};

// @desc    Open an assessment to take it
// @route   GET /api/assessments/take/:attemptId
const getTake = async (req, res) => {
    try {
        let attempt = await loadOwnAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Assessment not found" });
        if (attempt.status === "in_progress") attempt = await settleOverdue(attempt, CANDIDATE_INCLUDE);
        res.status(200).json({ assessment: candidateView(attempt) });
    } catch (error) {
        sendError(res, error, "Could not open the assessment");
    }
};

// @desc    Start the clock
// @route   POST /api/assessments/take/:attemptId/start
const startTake = async (req, res) => {
    try {
        const now = new Date();
        // Conditional, so a double click cannot restart the clock.
        const { count } = await prisma.assessmentAttempt.updateMany({
            where: { id: req.params.attemptId, candidateId: req.user._id, status: "invited", dueAt: { gt: now } },
            data: { status: "in_progress", startedAt: now },
        });
        const attempt = await loadOwnAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Assessment not found" });
        if (count === 0 && attempt.status !== "in_progress") {
            const status = effectiveStatus(attempt);
            return res.status(409).json({
                message: status === "expired"
                    ? "The deadline for this assessment has passed."
                    : "This assessment has already been completed.",
                assessment: candidateView(attempt),
            });
        }
        res.status(200).json({ assessment: candidateView(attempt) });
    } catch (error) {
        sendError(res, error, "Could not start the assessment");
    }
};

/** Save answers if the clock allows; returns the attempt, finalised if time ran out. */
const saveProgress = async (attempt, rawAnswers) => {
    const deadline = deadlineOf(attempt);
    if (deadline && Date.now() > deadline.getTime() + GRACE_MS) {
        return { attempt: await finalize(attempt), late: true };
    }
    const values = { ...valuesOf(attempt.answers), ...cleanAnswers(attempt.questions, rawAnswers) };
    await prisma.assessmentAttempt.updateMany({
        where: { id: attempt.id, status: "in_progress" },
        data: { answers: progressEntries(values) },
    });
    return { attempt: { ...attempt, answers: progressEntries(values) }, late: false };
};

// @desc    Autosave answers
// @route   PUT /api/assessments/take/:attemptId/answers
const saveAnswers = async (req, res) => {
    try {
        const attempt = await loadOwnAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Assessment not found" });
        if (attempt.status !== "in_progress") {
            return res.status(409).json({ message: "This assessment is no longer open.", assessment: candidateView(attempt) });
        }

        const { late } = await saveProgress(attempt, req.body?.answers);
        if (late) {
            const closed = await loadOwnAttempt(attempt.id, req.user._id);
            return res.status(409).json({
                message: "Time is up — the answers you had saved were submitted.",
                assessment: candidateView(closed),
            });
        }
        res.status(200).json({ savedAt: new Date() });
    } catch (error) {
        sendError(res, error, "Could not save your answers");
    }
};

// @desc    Submit the assessment
// @route   POST /api/assessments/take/:attemptId/submit
const submitTake = async (req, res) => {
    try {
        const attempt = await loadOwnAttempt(req.params.attemptId, req.user._id);
        if (!attempt) return res.status(404).json({ message: "Assessment not found" });
        if (attempt.status !== "in_progress") {
            return res.status(200).json({ assessment: candidateView(attempt) });
        }

        const { attempt: saved, late } = await saveProgress(attempt, req.body?.answers);
        if (!late) await finalize(saved);

        const closed = await loadOwnAttempt(attempt.id, req.user._id);
        res.status(200).json({ assessment: candidateView(closed), late });
    } catch (error) {
        sendError(res, error, "Could not submit the assessment");
    }
};

module.exports = {
    listAssessments,
    createAssessment,
    getAssessment,
    updateAssessment,
    setAssessmentStatus,
    deleteAssessment,
    getEligible,
    sendAssessment,
    generateQuestions,
    listAttempts,
    getAttempt,
    scoreAttempt,
    myAssessments,
    getTake,
    startTake,
    saveAnswers,
    submitTake,
    // Exported for tests
    _internal: { deadlineOf, effectiveStatus, finalize, settleOverdue, employerRow, candidateView },
};
