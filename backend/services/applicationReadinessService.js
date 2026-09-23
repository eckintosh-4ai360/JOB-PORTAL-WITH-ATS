const prisma = require("../config/prisma");
const { promptKey } = require("../utils/screeningQuestions");

/**
 * Everything the apply screen shows before a candidate submits: how complete
 * their profile is, which CV will go with the application, and the employer's
 * screening questions with as many answers filled in as can honestly be known.
 *
 * Profile completeness counts only things the candidate can fix, and each gap
 * says where to fix it. It never blocks an application — a candidate at 60%
 * can still apply; they just see what an employer will find missing.
 */

// Weights sum to 100. The CV carries the most because it is what the employer
// actually reads; everything else sharpens matching and screening.
const PROFILE_CHECKS = [
    {
        key: "resume",
        label: "CV uploaded",
        weight: 25,
        fixPath: "/applications",
        done: ({ hasResume }) => hasResume,
    },
    {
        key: "analysis",
        label: "CV analysed",
        weight: 10,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => Boolean(profile?.profileSyncedAt),
    },
    {
        key: "skills",
        label: "Skills listed",
        weight: 15,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => (profile?.skills?.length || 0) >= 3,
    },
    {
        key: "experience",
        label: "Years of experience",
        weight: 10,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => profile?.yearsOfExperience !== null && profile?.yearsOfExperience !== undefined,
    },
    {
        key: "education",
        label: "Highest education",
        weight: 10,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => Boolean(profile?.highestEducationLevel),
    },
    {
        key: "location",
        label: "Location",
        weight: 10,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => Boolean(profile?.location?.trim()),
    },
    {
        key: "salary",
        label: "Expected salary",
        weight: 10,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => Boolean(profile?.expectedSalaryMin || profile?.expectedSalaryMax),
    },
    {
        key: "photo",
        label: "Profile photo",
        weight: 5,
        fixPath: "/profile",
        done: ({ user }) => Boolean(user?.avatar),
    },
    {
        key: "roles",
        label: "Target roles",
        weight: 5,
        fixPath: "/resume-analyzer",
        done: ({ profile }) => (profile?.targetRoles?.length || 0) > 0,
    },
];

const scoreProfile = (context) => {
    const checks = PROFILE_CHECKS.map((check) => ({
        key: check.key,
        label: check.label,
        weight: check.weight,
        fixPath: check.fixPath,
        done: check.done(context),
    }));
    const completeness = checks.reduce((sum, check) => sum + (check.done ? check.weight : 0), 0);
    return { completeness, checks };
};

/**
 * Answers a candidate would otherwise type again. Expected salary comes from
 * their profile; anything else only from an identically worded question they
 * answered on an earlier application. Dates are never carried over — "when can
 * you start" last month is not an answer today.
 */
const buildPrefill = (questions, profile, previousApplications) => {
    const prefill = {};
    if (!questions?.length) return prefill;

    const previous = new Map();
    for (const application of previousApplications) {
        for (const entry of Array.isArray(application.screeningAnswers) ? application.screeningAnswers : []) {
            const key = `${entry.type}:${promptKey(entry.prompt)}`;
            if (!previous.has(key)) previous.set(key, entry.answer);
        }
    }

    for (const question of questions) {
        if (question.type === "salary" && (profile?.expectedSalaryMin || profile?.expectedSalaryMax)) {
            prefill[question.id] = {
                answer: profile.expectedSalaryMin || profile.expectedSalaryMax,
                source: "profile",
            };
            continue;
        }
        if (question.type === "date") continue;

        const key = `${question.type}:${promptKey(question.prompt)}`;
        if (!previous.has(key)) continue;

        const answer = previous.get(key);
        // A choice only carries over if this employer offers the same option.
        if (question.type === "choice" && !question.options.includes(answer)) continue;
        prefill[question.id] = { answer, source: "previous" };
    }

    return prefill;
};

const getApplicationReadiness = async ({ user, job }) => {
    const [account, profile, resumeDocument, previousApplications, existing] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user._id },
            select: { name: true, avatar: true, resume: true },
        }),
        prisma.candidateProfile.findUnique({ where: { userId: user._id } }),
        prisma.document.findFirst({
            where: { userId: user._id, category: "Resume" },
            orderBy: { uploadedAt: "desc" },
            select: { name: true, url: true, uploadedAt: true },
        }),
        prisma.application.findMany({
            where: { applicantId: user._id },
            select: { screeningAnswers: true },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
        prisma.application.findFirst({
            where: { applicantId: user._id, jobId: job.id },
            select: { id: true },
        }),
    ]);

    const hasResume = Boolean(account?.resume || resumeDocument);
    const { completeness, checks } = scoreProfile({ user: account, profile, hasResume });
    const questions = Array.isArray(job.screeningQuestions) ? job.screeningQuestions : [];

    return {
        alreadyApplied: Boolean(existing),
        profile: { completeness, checks },
        cv: {
            onFile: hasResume,
            name: account?.resume ? "Primary resume" : resumeDocument?.name || null,
            analysed: Boolean(profile?.profileSyncedAt),
            analysedAt: profile?.profileSyncedAt || null,
        },
        questions,
        prefill: buildPrefill(questions, profile, previousApplications),
    };
};

module.exports = { getApplicationReadiness, scoreProfile, PROFILE_CHECKS };
