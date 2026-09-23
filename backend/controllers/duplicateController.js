const prisma = require("../config/prisma");
const duplicates = require("../services/duplicateDetectionService");
const { getEmployerStages, findStage } = require("../utils/hiringPipeline");

/**
 * Duplicate candidate detection, for admins (every jobseeker account) and for
 * employers (their own applicants only). See services/duplicateDetectionService.
 */

// CVs downloaded per request. Admin scans run until the backlog is empty.
const ADMIN_LIST_BUDGET = 0;
const ADMIN_SCAN_BUDGET = 30;
const EMPLOYER_BUDGET = 15;

const VIEWS = ["open", "confirmed", "dismissed"];
const KEY_PATTERN = /^(user:[\w-]+|guest:[^\s|]+|guest-application:[\w-]+)$/;

const shapePair = (pair) => ({
    a: pair.a,
    b: pair.b,
    score: pair.score,
    confidence: pair.confidence,
    evidence: pair.evidence,
    decision: pair.decision,
});

/**
 * Groups for one review state, shaped for a list page, with the counts for
 * every state. `member` turns an identity into what the page shows about it.
 */
const groupsFor = (pairs, view, member) => {
    const grouped = duplicates.groupByDecision(pairs);
    const decisionOf = { open: null, confirmed: "same", dismissed: "distinct" };

    const groups = grouped[view]
        .map((cluster) => ({
            id: [...cluster.members].sort().join(","),
            confidence: cluster.pairs.some((pair) => pair.confidence === "high") ? "high" : "medium",
            score: Math.max(...cluster.pairs.map((pair) => pair.score)),
            decision: decisionOf[view],
            members: [...cluster.members].map(member),
            pairs: cluster.pairs.map(shapePair),
        }))
        .sort((a, b) => (a.confidence === b.confidence ? b.score - a.score : a.confidence === "high" ? -1 : 1));

    return {
        groups,
        counts: { open: grouped.open.length, confirmed: grouped.confirmed.length, dismissed: grouped.dismissed.length },
    };
};

const validKeys = (keys) =>
    Array.isArray(keys) && keys.length >= 2 && keys.length <= 12 && keys.every((key) => typeof key === "string" && KEY_PATTERN.test(key));

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// @desc    Jobseeker accounts that look like the same person
// @route   GET /api/admin/duplicates?view=open|confirmed|dismissed
// @access  Private (Admin)
const listPlatformDuplicates = async (req, res) => {
    try {
        const view = VIEWS.includes(req.query.view) ? req.query.view : "open";
        const subjects = await duplicates.loadPlatformSubjects();
        const result = await duplicates.detect({ subjects, scope: duplicates.PLATFORM_SCOPE, budget: ADMIN_LIST_BUDGET });

        const { groups, counts } = groupsFor(result.pairs, view, (key) => {
            const subject = result.subjects.get(key);
            return {
                key,
                userId: subject.userId,
                name: subject.name,
                email: subject.rawEmails[0] || "",
                avatar: subject.avatar,
                trustState: subject.trustState,
                joinedAt: subject.createdAt,
                applicationCount: subject.applications.length,
                cvCount: subject.readableCvs,
                lastAppliedAt: subject.applications[0]?.appliedAt || null,
            };
        });

        res.status(200).json({
            clusters: groups,
            counts,
            accountsChecked: subjects.length,
            pendingCvs: result.pending,
        });
    } catch (error) {
        console.error("Duplicate detection failed:", error);
        res.status(500).json({ message: "Could not check for duplicate accounts", error: error.message });
    }
};

// @desc    Read CVs that have not been fingerprinted yet
// @route   POST /api/admin/duplicates/scan
// @access  Private (Admin)
const scanPlatform = async (req, res) => {
    try {
        const subjects = await duplicates.loadPlatformSubjects();
        const sources = await duplicates.withAnalysisText(subjects.flatMap((subject) => subject.sources));
        const { processed, pending } = await duplicates.ensureFingerprints(sources, { budget: ADMIN_SCAN_BUDGET });
        res.status(200).json({ processed, pending });
    } catch (error) {
        console.error("Duplicate scan failed:", error);
        res.status(500).json({ message: "Could not scan CVs", error: error.message });
    }
};

// @desc    Decide whether a group of accounts is one person
// @route   POST /api/admin/duplicates/review
// @body    { keys: ["user:…", …], decision: "same" | "distinct", note? }
// @access  Private (Admin)
const reviewPlatform = async (req, res) => {
    try {
        const { keys, decision, note } = req.body || {};
        if (!validKeys(keys)) return res.status(400).json({ message: "Choose at least two accounts." });
        if (!["same", "distinct"].includes(decision)) {
            return res.status(400).json({ message: "Decision must be same or distinct." });
        }
        const pairs = await duplicates.recordDecision({
            scope: duplicates.PLATFORM_SCOPE,
            keys,
            decision,
            note: String(note || "").trim().slice(0, 500),
            decidedById: req.user._id,
        });
        res.status(200).json({
            message: decision === "same" ? "Marked as the same person" : "Marked as different people",
            pairs,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not save the decision", error: error.message });
    }
};

// ---------------------------------------------------------------------------
// Employer
// ---------------------------------------------------------------------------

const requireEmployer = (req, res) => {
    if (req.user.role !== "employer") {
        res.status(403).json({ message: "Only employers can access this route" });
        return false;
    }
    return true;
};

/** Detection over one employer's applicants; the given job's are read first. */
const detectForEmployer = async (employerId, jobId) => {
    let subjects = await duplicates.loadEmployerSubjects(employerId);
    if (jobId) {
        const inJob = (subject) => subject.applications.some((app) => app.jobId === jobId);
        subjects = [...subjects.filter(inJob), ...subjects.filter((subject) => !inJob(subject))];
    }
    const [result, stages] = await Promise.all([
        duplicates.detect({ subjects, scope: duplicates.employerScope(employerId), budget: EMPLOYER_BUDGET }),
        getEmployerStages(employerId),
    ]);

    const describeApplications = (subject) => subject.applications.map((app) => ({
        applicationId: app.id,
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        stage: findStage(stages, app.status)?.name || app.status,
        appliedAt: app.appliedAt,
    }));

    return { result, subjectsCount: subjects.length, describeApplications };
};

// @desc    Applicants who look like another of this employer's applicants,
//          keyed by application — for flagging them on the applicant screen
// @route   GET /api/applications/duplicates?jobId=
// @access  Private (Employer)
const listEmployerDuplicates = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;

        const { jobId } = req.query;
        if (jobId) {
            const job = await prisma.job.findUnique({ where: { id: String(jobId) }, select: { companyId: true } });
            if (!job || job.companyId !== req.user._id) return res.status(404).json({ message: "Job not found" });
        }

        const { result, describeApplications } = await detectForEmployer(req.user._id, jobId);

        const matches = {};
        for (const pair of result.pairs) {
            if (pair.decision === "distinct") continue;
            for (const [self, other] of [[pair.a, pair.b], [pair.b, pair.a]]) {
                const subject = result.subjects.get(self);
                const otherSubject = result.subjects.get(other);
                for (const app of subject.applications) {
                    if (jobId && app.jobId !== jobId) continue;
                    if (!matches[app.id]) matches[app.id] = [];
                    matches[app.id].push({
                        key: self,
                        otherKey: other,
                        otherName: otherSubject.name,
                        otherIsGuest: otherSubject.kind === "guest",
                        otherApplications: describeApplications(otherSubject),
                        score: pair.score,
                        confidence: pair.confidence,
                        evidence: pair.evidence,
                        decision: pair.decision,
                    });
                }
            }
        }

        res.status(200).json({ matches, pendingCvs: result.pending });
    } catch (error) {
        console.error("Employer duplicate check failed:", error);
        res.status(500).json({ message: "Could not check for duplicate applicants", error: error.message });
    }
};

// @desc    Groups of this employer's applicants that look like one person,
//          across all their jobs — for the Duplicates page
// @route   GET /api/applications/duplicates/groups?view=open|confirmed|dismissed
// @access  Private (Employer)
const listEmployerDuplicateGroups = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const view = VIEWS.includes(req.query.view) ? req.query.view : "open";

        const { result, subjectsCount, describeApplications } = await detectForEmployer(req.user._id);

        const { groups, counts } = groupsFor(result.pairs, view, (key) => {
            const subject = result.subjects.get(key);
            return {
                key,
                name: subject.name,
                email: subject.rawEmails[0] || "",
                avatar: subject.avatar,
                isGuest: subject.kind === "guest",
                applications: describeApplications(subject),
            };
        });

        res.status(200).json({
            groups,
            counts,
            applicantsChecked: subjectsCount,
            pendingCvs: result.pending,
        });
    } catch (error) {
        console.error("Employer duplicate groups failed:", error);
        res.status(500).json({ message: "Could not check for duplicate applicants", error: error.message });
    }
};

// @desc    Mark a group of the employer's applicants as the same or different people
// @route   POST /api/applications/duplicates/review
// @body    { keys: [identityKey, …], decision: "same" | "distinct" }
// @access  Private (Employer)
const reviewEmployer = async (req, res) => {
    try {
        if (!requireEmployer(req, res)) return;
        const { keys, decision } = req.body || {};
        if (!validKeys(keys)) return res.status(400).json({ message: "Choose at least two applicants." });
        if (!["same", "distinct"].includes(decision)) {
            return res.status(400).json({ message: "Decision must be same or distinct." });
        }

        // Only identities in this employer's own pool can be decided on.
        const subjects = await duplicates.loadEmployerSubjects(req.user._id);
        const own = new Set(subjects.map((subject) => subject.key));
        if (!keys.every((key) => own.has(key))) return res.status(404).json({ message: "Applicant not found" });

        await duplicates.recordDecision({
            scope: duplicates.employerScope(req.user._id),
            keys,
            decision,
            decidedById: req.user._id,
        });
        res.status(200).json({ message: decision === "same" ? "Marked as the same person" : "Marked as different people" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not save the decision", error: error.message });
    }
};

module.exports = {
    listPlatformDuplicates,
    scanPlatform,
    reviewPlatform,
    listEmployerDuplicates,
    listEmployerDuplicateGroups,
    reviewEmployer,
};
