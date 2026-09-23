const prisma = require("../config/prisma");
const { findStage } = require("../utils/hiringPipeline");
const { promptKey } = require("../utils/screeningQuestions");

/**
 * The employer's private shortlist, and the assisted way of filling it.
 *
 * Assisted shortlisting never decides anything. It checks each applicant
 * against criteria the employer sets — AI fit, core skills, experience,
 * assessment score, answers to the job's screening questions — and reports
 * each check as met, unmet, or unknown (not scored yet, not answered). An
 * applicant is suggested only when every check is met; one with no misses but
 * missing data is shown as needing data rather than quietly passed or failed.
 * The employer adds people to the shortlist themselves.
 */

const RECOMMENDATIONS = ["shortlist", "interview", "hold", "reject"];
const RECOMMENDATION_LABELS = {
    shortlist: "Shortlist",
    interview: "Interview",
    hold: "Hold",
    reject: "Not a fit",
};
const MAX_SCREENING_RULES = 10;
const MAX_NOTE_LENGTH = 500;

// Everything a candidate row needs, read in one query per job.
const CANDIDATE_INCLUDE = {
    applicant: { select: { id: true, name: true, email: true, avatar: true } },
    aiScore: {
        select: {
            matchScore: true,
            verdict: true,
            recommendation: true,
            dimensions: true,
            degraded: true,
        },
    },
    assessmentAttempts: {
        select: {
            status: true,
            percent: true,
            passMark: true,
            dueAt: true,
            assessment: { select: { title: true } },
        },
    },
};

/**
 * An application's assessments in one line: the best scored result, and how
 * many are still out. "Expired" follows the assessment screens — an invite
 * past its due date that was never started.
 */
const summarizeAttempts = (attempts = [], now = new Date()) => {
    let best = null;
    let pending = 0;

    for (const attempt of attempts) {
        const status = attempt.status === "invited" && attempt.dueAt < now ? "expired" : attempt.status;
        if (status === "scored" && attempt.percent !== null && attempt.percent !== undefined) {
            if (!best || attempt.percent > best.percent) {
                best = {
                    percent: attempt.percent,
                    passed: attempt.percent >= attempt.passMark,
                    title: attempt.assessment?.title || "Assessment",
                };
            }
        } else if (status === "invited" || status === "in_progress" || status === "submitted") {
            pending += 1;
        }
    }

    return {
        sent: attempts.length,
        bestPercent: best ? best.percent : null,
        passed: best ? best.passed : null,
        bestTitle: best ? best.title : null,
        pending,
    };
};

const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
};

/**
 * Check and tidy the criteria suggestions are asked for. Anything the job's
 * questions cannot be checked against is dropped rather than refused, so a
 * saved set of criteria keeps working after a question is removed.
 * Returns `{ criteria }` or `{ error }`.
 */
const validateCriteria = (input, questions = []) => {
    const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const criteria = {};

    const minFit = numberOrNull(raw.minFit);
    if (Number.isNaN(minFit) || (minFit !== null && (minFit < 0 || minFit > 100))) {
        return { error: "The minimum AI fit must be between 0 and 100." };
    }
    if (minFit !== null) criteria.minFit = Math.round(minFit);

    if (Array.isArray(raw.recommendations)) {
        const recommendations = [...new Set(raw.recommendations.filter((r) => RECOMMENDATIONS.includes(r)))];
        if (recommendations.length) criteria.recommendations = recommendations;
    }

    if (raw.coreSkills === true) criteria.coreSkills = true;
    if (raw.meetsExperience === true) criteria.meetsExperience = true;

    const minAssessment = numberOrNull(raw.minAssessment);
    if (Number.isNaN(minAssessment) || (minAssessment !== null && (minAssessment < 0 || minAssessment > 100))) {
        return { error: "The minimum assessment score must be between 0 and 100." };
    }
    if (minAssessment !== null) criteria.minAssessment = Math.round(minAssessment);

    if (Array.isArray(raw.screening)) {
        const byId = new Map(questions.map((question) => [question.id, question]));
        const rules = [];

        for (const rule of raw.screening.slice(0, MAX_SCREENING_RULES)) {
            const question = byId.get(rule?.questionId);
            if (!question) continue;

            if (question.type === "yes_no") {
                if (rule.equals === true || rule.equals === false) {
                    rules.push({ questionId: question.id, equals: rule.equals });
                }
            } else if (question.type === "number" || question.type === "salary") {
                const min = numberOrNull(rule.min);
                const max = numberOrNull(rule.max);
                if (Number.isNaN(min) || Number.isNaN(max)) {
                    return { error: `Enter numbers for "${question.prompt}".` };
                }
                if (min !== null && max !== null && min > max) {
                    return { error: `The lowest answer for "${question.prompt}" is above the highest.` };
                }
                if (min !== null || max !== null) rules.push({ questionId: question.id, min, max });
            } else if (question.type === "choice") {
                const anyOf = (Array.isArray(rule.anyOf) ? rule.anyOf : [])
                    .filter((option) => question.options.includes(option));
                if (anyOf.length) rules.push({ questionId: question.id, anyOf: [...new Set(anyOf)] });
            }
            // Free text and dates have no answer that is simply right.
        }

        if (rules.length) criteria.screening = rules;
    }

    return { criteria };
};

const hasCriteria = (criteria) => Object.keys(criteria || {}).length > 0;

/** The answer an applicant gave to one of the job's questions, if any. */
const findAnswer = (answers, question) => {
    if (!Array.isArray(answers)) return null;
    // By id first; by wording for an answer given before the question was re-saved.
    return answers.find((entry) => entry.questionId === question.id)
        || answers.find((entry) => promptKey(entry.prompt) === promptKey(question.prompt))
        || null;
};

const formatAmount = (value, type) =>
    type === "salary" ? `GH₵ ${Number(value).toLocaleString("en-GB")}` : Number(value).toLocaleString("en-GB");

const describeRange = (rule, type) => {
    if (rule.min !== null && rule.max !== null) return `${formatAmount(rule.min, type)}–${formatAmount(rule.max, type)}`;
    if (rule.min !== null) return `at least ${formatAmount(rule.min, type)}`;
    return `at most ${formatAmount(rule.max, type)}`;
};

// `note` is how a met check reads in an assisted pick's shortlist note.
const check = (key, label, result, detail, note = detail) => ({ key, label, result, detail, note });

/** "Do you hold a licence? Yes" / "Expected salary: GH₵ 4,500" */
const answerNote = (question, answerText) =>
    /[?:]\s*$/.test(question.prompt) ? `${question.prompt} ${answerText}` : `${question.prompt}: ${answerText}`;

/**
 * Check one candidate (from shapeCandidate) against the criteria. Every check
 * says what it looked at, so an employer can see why someone is or is not
 * suggested rather than trusting a verdict.
 */
const evaluateCandidate = (candidate, criteria, questions = []) => {
    const checks = [];
    const fit = candidate.fitDetail;

    if (criteria.minFit !== undefined) {
        const label = `AI fit ${criteria.minFit}% or more`;
        checks.push(
            fit
                ? check("fit", label, fit.matchScore >= criteria.minFit ? "met" : "unmet", `${fit.matchScore}% fit`, `${fit.matchScore}% AI fit`)
                : check("fit", label, "unknown", "Not scored yet")
        );
    }

    if (criteria.recommendations) {
        const label = `AI recommends ${criteria.recommendations.map((r) => RECOMMENDATION_LABELS[r]).join(" or ")}`;
        checks.push(
            fit?.recommendation
                ? check(
                    "recommendation",
                    label,
                    criteria.recommendations.includes(fit.recommendation) ? "met" : "unmet",
                    `Recommends ${RECOMMENDATION_LABELS[fit.recommendation] || fit.recommendation}`,
                    `AI recommends ${RECOMMENDATION_LABELS[fit.recommendation] || fit.recommendation}`
                )
                : check("recommendation", label, "unknown", "Not scored yet")
        );
    }

    if (criteria.coreSkills) {
        const skills = fit?.dimensions?.skills;
        const label = "Has every core skill";
        if (!skills) {
            checks.push(check("coreSkills", label, "unknown", "Not scored yet"));
        } else {
            const missing = Array.isArray(skills.missing) ? skills.missing : [];
            checks.push(
                check(
                    "coreSkills",
                    label,
                    missing.length ? "unmet" : "met",
                    missing.length
                        ? `Missing ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`
                        : skills.label || "Covers the core skills"
                )
            );
        }
    }

    if (criteria.meetsExperience) {
        const experience = fit?.dimensions?.experience;
        const label = "Meets the experience asked for";
        if (!experience) {
            checks.push(check("experience", label, "unknown", "Not scored yet"));
        } else {
            const missing = Array.isArray(experience.missing) ? experience.missing : [];
            checks.push(
                check(
                    "experience",
                    label,
                    missing.length ? "unmet" : "met",
                    experience.label || "",
                    experience.label ? `${experience.label} experience` : "Meets the experience asked for"
                )
            );
        }
    }

    if (criteria.minAssessment !== undefined) {
        const assessment = candidate.assessment;
        const label = `Assessment ${criteria.minAssessment}% or more`;
        if (assessment.bestPercent !== null) {
            checks.push(
                check(
                    "assessment",
                    label,
                    assessment.bestPercent >= criteria.minAssessment ? "met" : "unmet",
                    `${assessment.bestPercent}% on ${assessment.bestTitle}`
                )
            );
        } else {
            checks.push(
                check(
                    "assessment",
                    label,
                    "unknown",
                    assessment.pending ? "Not finished or marked yet" : assessment.sent ? "No scored result" : "Not sent an assessment"
                )
            );
        }
    }

    for (const rule of criteria.screening || []) {
        const question = questions.find((q) => q.id === rule.questionId);
        if (!question) continue;
        const entry = findAnswer(candidate.screeningAnswers, question);
        const key = `screening:${question.id}`;

        if (question.type === "yes_no") {
            const label = `"${question.prompt}" — ${rule.equals ? "Yes" : "No"}`;
            if (!entry || typeof entry.answer !== "boolean") {
                checks.push(check(key, label, "unknown", "Not answered"));
            } else {
                const said = entry.answer ? "Yes" : "No";
                checks.push(check(key, label, entry.answer === rule.equals ? "met" : "unmet", `Answered ${said}`, answerNote(question, said)));
            }
        } else if (question.type === "number" || question.type === "salary") {
            const label = `"${question.prompt}" — ${describeRange(rule, question.type)}`;
            const value = entry ? Number(entry.answer) : NaN;
            if (!entry || !Number.isFinite(value)) {
                checks.push(check(key, label, "unknown", "Not answered"));
            } else {
                const within = (rule.min === null || value >= rule.min) && (rule.max === null || value <= rule.max);
                const said = formatAmount(value, question.type);
                checks.push(check(key, label, within ? "met" : "unmet", `Answered ${said}`, answerNote(question, said)));
            }
        } else if (question.type === "choice") {
            const label = `"${question.prompt}" — ${rule.anyOf.join(" or ")}`;
            if (!entry) {
                checks.push(check(key, label, "unknown", "Not answered"));
            } else {
                checks.push(
                    check(key, label, rule.anyOf.includes(entry.answer) ? "met" : "unmet", `Answered ${entry.answer}`, answerNote(question, entry.answer))
                );
            }
        }
    }

    const unmet = checks.filter((c) => c.result === "unmet").length;
    const unknown = checks.filter((c) => c.result === "unknown").length;

    return {
        checks,
        metCount: checks.length - unmet - unknown,
        verdict: unmet ? "not_suggested" : unknown ? "needs_data" : "suggested",
    };
};

const VERDICT_ORDER = { suggested: 0, needs_data: 1, not_suggested: 2 };

/** Suggested first, then those missing data, then the rest; best fit first within each. */
const rankCandidates = (candidates) => [...candidates].sort((a, b) => {
    const byVerdict = (VERDICT_ORDER[a.verdict] ?? 3) - (VERDICT_ORDER[b.verdict] ?? 3);
    if (byVerdict) return byVerdict;
    if (b.metCount !== a.metCount) return b.metCount - a.metCount;
    const fitA = a.fit?.matchScore ?? -1;
    const fitB = b.fit?.matchScore ?? -1;
    if (fitB !== fitA) return fitB - fitA;
    const testA = a.assessment.bestPercent ?? -1;
    const testB = b.assessment.bestPercent ?? -1;
    if (testB !== testA) return testB - testA;
    return new Date(a.appliedAt) - new Date(b.appliedAt);
});

/**
 * One applicant as the shortlist screens show them. `fitDetail` keeps the
 * score's dimensions for evaluateCandidate and is removed by `toClientCandidate`.
 */
const shapeCandidate = (application, stages) => {
    const stage = findStage(stages, application.status);
    const isGuest = !application.applicantId;
    const score = application.aiScore;

    return {
        id: application.id,
        _id: application.id,
        jobId: application.jobId,
        name: (isGuest ? application.guestName : application.applicant?.name) || "Applicant",
        email: (isGuest ? application.guestEmail : application.applicant?.email) || "",
        avatar: isGuest ? "" : application.applicant?.avatar || "",
        isGuest,
        stage: stage
            ? { id: stage.id, name: stage.name, phase: stage.phase, type: stage.type }
            : { id: application.status, name: application.status, phase: "received", type: "standard" },
        appliedAt: application.createdAt,
        fit: score
            ? {
                matchScore: score.matchScore,
                verdict: score.verdict,
                recommendation: score.recommendation || null,
                degraded: Boolean(score.degraded),
                skills: score.dimensions?.skills?.label || null,
                missingSkills: Array.isArray(score.dimensions?.skills?.missing) ? score.dimensions.skills.missing : [],
                experience: score.dimensions?.experience?.label || null,
            }
            : null,
        fitDetail: score || null,
        assessment: summarizeAttempts(application.assessmentAttempts),
        screeningAnswers: Array.isArray(application.screeningAnswers) ? application.screeningAnswers : [],
        shortlist: application.shortlistedAt
            ? {
                at: application.shortlistedAt,
                source: application.shortlistSource || "manual",
                note: application.shortlistNote || "",
            }
            : null,
    };
};

const toClientCandidate = (candidate) => {
    const { fitDetail, ...rest } = candidate;
    return rest;
};

/** Every application for a job, shaped for the shortlist screens. */
const loadJobCandidates = async (jobId, stages) => {
    const applications = await prisma.application.findMany({
        where: { jobId },
        include: CANDIDATE_INCLUDE,
        orderBy: { createdAt: "asc" },
    });
    return applications.map((application) => shapeCandidate(application, stages));
};

/** Settled applications (rejected or hired) are past shortlisting. */
const isSettled = (candidate) => candidate.stage.type === "rejected" || candidate.stage.type === "hired";

const cleanNote = (value) => String(value ?? "").trim().replace(/\s+\n/g, "\n").slice(0, MAX_NOTE_LENGTH);

/** The reasons an assisted pick was made, kept as its note. */
const reasonNote = (checks) => {
    const met = checks.filter((c) => c.result === "met").map((c) => c.note || c.detail).filter(Boolean);
    return met.length ? cleanNote(`Suggested: ${met.join("; ")}`) : "";
};

module.exports = {
    RECOMMENDATIONS,
    MAX_NOTE_LENGTH,
    CANDIDATE_INCLUDE,
    summarizeAttempts,
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
};
