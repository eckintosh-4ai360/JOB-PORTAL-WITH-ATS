/**
 * AI endpoints — resume analysis and job matching.
 *
 * Layout:
 *   Resume analysis   analyzeResume, getLatestAnalysis, getAnalysisHistory
 *   Match profile     getMatchProfile, updateMatchProfile
 *   Candidate match   getJobMatches, getJobMatch
 *   Employer match    getScoredApplicants, rescoreApplicants, getJobSpecForEmployer
 *   Status            getAiStatus
 */

const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const fraud = require("../services/fraudModerationService");
const { fingerprintInBackground } = require("../services/duplicateDetectionService");
const groq = require("../utils/groqClient");
const { analyzeResume } = require("../services/resumeAnalysisService");
const matchService = require("../services/jobMatchService");
const {
    extractFromBuffer,
    extractFromUrl,
    ResumeExtractionError,
} = require("../utils/resumeTextExtractor");

const MAX_MATCH_JOBS = Number(process.env.AI_MAX_MATCH_JOBS || 40);

/** Uniform error responses, with AI failures separated from user mistakes. */
const sendError = (res, error, fallbackMessage) => {
    if (error instanceof ResumeExtractionError) {
        return res.status(error.status || 400).json({ message: error.message });
    }
    if (error instanceof groq.GroqError) {
        const status = error.status === 503 ? 503 : 502;
        return res.status(status).json({
            message:
                error.status === 503
                    ? "AI features are not configured on this server yet."
                    : "The AI service is busy right now. Please try again in a moment.",
            detail: error.message,
        });
    }
    console.error(fallbackMessage, error);
    return res.status(500).json({ message: fallbackMessage, error: error.message });
};

// ---------------------------------------------------------------------------
// Resume text resolution
// ---------------------------------------------------------------------------

/**
 * Work out which document to analyse, in priority order:
 *   1. a file uploaded with this request
 *   2. resumeText pasted into the request body
 *   3. an explicit resumeUrl
 *   4. a saved Document the user owns (documentId)
 *   5. the resume already on the user's profile
 */
const resolveResumeSource = async (req) => {
    if (req.file) {
        const extracted = await extractFromBuffer(req.file.buffer, {
            mimetype: req.file.mimetype,
            filename: req.file.originalname,
        });
        return { ...extracted, fileName: req.file.originalname, resumeUrl: null };
    }

    const pasted = String(req.body?.resumeText || "").trim();
    if (pasted) {
        if (pasted.split(/\s+/).length < 40) {
            throw new ResumeExtractionError(
                "That is too short to analyse. Paste your full resume, or upload the file."
            );
        }
        const wordCount = pasted.split(/\s+/).filter(Boolean).length;
        return {
            text: pasted,
            wordCount,
            pageCount: Math.max(1, Math.round(wordCount / 500)),
            multiColumn: false,
            source: "pasted",
            fileName: "Pasted resume",
            resumeUrl: null,
        };
    }

    if (req.body?.documentId) {
        if (!req.user?._id) {
            throw new ResumeExtractionError("Sign in to analyse a saved document", { status: 401 });
        }
        const doc = await prisma.document.findFirst({
            where: { id: String(req.body.documentId), userId: req.user._id },
        });
        if (!doc) {
            throw new ResumeExtractionError("That document was not found in your library", { status: 404 });
        }
        const extracted = await extractFromUrl(doc.url);
        return { ...extracted, fileName: doc.name, resumeUrl: doc.url };
    }

    const url = String(req.body?.resumeUrl || "").trim() || (req.user?.resume || "").trim();
    if (url) {
        const extracted = await extractFromUrl(url);
        return {
            ...extracted,
            fileName: decodeURIComponent(url.split("/").pop() || "Resume"),
            resumeUrl: url,
        };
    }

    throw new ResumeExtractionError(
        "No resume found. Upload a file, paste your resume text, or add a resume to your profile."
    );
};

/** A job posting rendered as prompt context, so analysis can be job-specific. */
const loadJobContext = async (jobId) => {
    if (!jobId) return { context: "", job: null };

    const job = await prisma.job.findUnique({
        where: { id: String(jobId) },
        include: { company: { select: { companyName: true, name: true } } },
    });
    if (!job || job.deletedAt) return { context: "", job: null };

    return {
        job,
        context: [
            `Title: ${job.title}`,
            `Company: ${job.company?.companyName || job.company?.name || "Not specified"}`,
            `Location: ${job.location || "Not specified"}`,
            `Type: ${job.type || "Not specified"}`,
            `Description:\n${job.description || ""}`,
            `Requirements:\n${job.requirements || ""}`,
        ].join("\n"),
    };
};

// ---------------------------------------------------------------------------
// Resume analysis
// ---------------------------------------------------------------------------

/**
 * @desc   Analyse a resume — ATS score, quality score, grammar, missing skills, suggestions
 * @route  POST /api/ai/resume/analyze
 * @access Private
 */
const analyzeResumeHandler = async (req, res) => {
    try {
        const source = await resolveResumeSource(req);
        const targetRole = String(req.body?.targetRole || "").trim().slice(0, 160);
        const { context: jobContext, job } = await loadJobContext(req.body?.jobId);

        const analysis = await analyzeResume({
            resumeText: source.text,
            layout: {
                wordCount: source.wordCount,
                pageCount: source.pageCount,
                multiColumn: source.multiColumn,
                source: source.source,
            },
            targetRole: targetRole || (job ? job.title : ""),
            jobContext,
        });

        const resumeHash = matchService.sha(source.text);

        const saved = await prisma.resumeAnalysis.create({
            data: {
                userId: req.user._id,
                fileName: source.fileName,
                resumeUrl: source.resumeUrl,
                resumeHash,
                targetRole: targetRole || null,
                targetJobId: job?.id || null,
                overallScore: analysis.overallScore,
                atsScore: analysis.atsScore,
                qualityScore: analysis.quality.score,
                grammarScore: analysis.grammar.score,
                wordCount: source.wordCount,
                pageCount: source.pageCount,
                multiColumn: Boolean(source.multiColumn),
                profile: analysis.profile,
                atsChecks: analysis.atsChecks,
                atsSections: analysis.atsSections,
                atsSignals: analysis.atsSignals,
                quality: analysis.quality,
                grammar: analysis.grammar,
                missingSkills: analysis.missingSkills,
                suggestions: analysis.suggestions,
                keywords: analysis.keywords,
                redFlags: analysis.redFlags,
                resumeText: source.text.slice(0, 40000),
                model: analysis.model,
                degraded: Boolean(analysis.degraded),
            },
        });

        fraud.screenInBackground(`resume:${saved.id}`, () => fraud.screenResume(saved.id));
        // The text is already here, so fingerprinting it costs no download.
        fingerprintInBackground({ key: `analysis:${saved.id}`, text: source.text });

        // Feed the parsed profile into the matching profile so job matches
        // improve immediately after an analysis.
        await syncCandidateProfileFromAnalysis(req.user._id, analysis, saved.id);

        // The candidate's skills changed, so cached match scores are stale.
        await prisma.jobMatch.deleteMany({ where: { userId: req.user._id } }).catch(() => {});

        res.status(200).json({
            analysis: { ...analysis, id: saved.id, fileName: source.fileName },
            saved: true,
            analysisId: saved.id,
        });
    } catch (error) {
        sendError(res, error, "Resume analysis failed");
    }
};

/**
 * Copy the AI-parsed profile onto CandidateProfile. Candidate-entered
 * preferences (pay, mobility) are never overwritten — only the resume-derived
 * snapshot is, and only with non-empty values.
 */
const syncCandidateProfileFromAnalysis = async (userId, analysis, analysisId) => {
    const p = analysis.profile || {};

    const snapshot = {
        skills: p.skills?.length ? p.skills : undefined,
        softSkills: p.softSkills?.length ? p.softSkills : undefined,
        certifications: p.certifications?.length ? p.certifications : undefined,
        industries: p.industries?.length ? p.industries : undefined,
        yearsOfExperience: p.yearsOfExperience || undefined,
        // "none" means "no qualification found in this document", not "this
        // candidate has none". Analysing a cover letter must not erase a degree
        // that an earlier resume analysis established.
        highestEducationLevel:
            p.highestEducationLevel && p.highestEducationLevel !== "none"
                ? p.highestEducationLevel
                : undefined,
        seniority: p.seniority || undefined,
        headline: p.headline || undefined,
        targetRoles: p.targetRoles?.length ? p.targetRoles : undefined,
        resumeAnalysisId: analysisId,
        profileSyncedAt: new Date(),
    };

    // Only fill location from the resume when the candidate has not set one.
    const existing = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!existing?.location && p.location) snapshot.location = p.location;

    const defined = Object.fromEntries(
        Object.entries(snapshot).filter(([, v]) => v !== undefined)
    );

    try {
        return await prisma.candidateProfile.upsert({
            where: { userId },
            create: { userId, ...defined },
            update: defined,
        });
    } catch (error) {
        console.error("Could not sync candidate profile:", error.message);
        return null;
    }
};

/**
 * @desc   Most recent stored analysis for the signed-in user
 * @route  GET /api/ai/resume/analysis
 * @access Private
 */
const getLatestAnalysis = async (req, res) => {
    try {
        const analysis = await prisma.resumeAnalysis.findFirst({
            where: { userId: req.user._id },
            orderBy: { createdAt: "desc" },
        });

        if (!analysis) {
            return res.status(200).json({ analysis: null });
        }

        // resumeText is stored for rescoring, not for display.
        const { resumeText, ...safe } = analysis;
        res.status(200).json({ analysis: toClient(safe) });
    } catch (error) {
        sendError(res, error, "Could not load your resume analysis");
    }
};

/**
 * @desc   Score history, for the progress chart
 * @route  GET /api/ai/resume/history
 * @access Private
 */
const getAnalysisHistory = async (req, res) => {
    try {
        const history = await prisma.resumeAnalysis.findMany({
            where: { userId: req.user._id },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                fileName: true,
                targetRole: true,
                overallScore: true,
                atsScore: true,
                qualityScore: true,
                grammarScore: true,
                createdAt: true,
            },
        });

        res.status(200).json({ history: toClient(history) });
    } catch (error) {
        sendError(res, error, "Could not load your analysis history");
    }
};

// ---------------------------------------------------------------------------
// Match profile
// ---------------------------------------------------------------------------

/**
 * @desc   The candidate's matching profile
 * @route  GET /api/ai/match/profile
 * @access Private
 */
const getMatchProfile = async (req, res) => {
    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId: req.user._id },
        });

        res.status(200).json({
            profile: profile ? toClient(profile) : null,
            // Tells the UI whether matching can produce a meaningful score yet.
            ready: Boolean(profile?.skills?.length || profile?.yearsOfExperience),
        });
    } catch (error) {
        sendError(res, error, "Could not load your match profile");
    }
};

const asFloat = (value) => {
    if (value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * @desc   Update candidate-controlled matching preferences
 * @route  PUT /api/ai/match/profile
 * @access Private
 */
const updateMatchProfile = async (req, res) => {
    try {
        const body = req.body || {};
        const data = {};

        if (body.location !== undefined) data.location = String(body.location).trim().slice(0, 160);
        if (body.willingToRelocate !== undefined) data.willingToRelocate = Boolean(body.willingToRelocate);
        if (body.openToRemote !== undefined) data.openToRemote = Boolean(body.openToRemote);
        if (body.salaryPeriod !== undefined) {
            data.salaryPeriod = ["month", "year"].includes(body.salaryPeriod) ? body.salaryPeriod : "month";
        }

        const min = asFloat(body.expectedSalaryMin);
        const max = asFloat(body.expectedSalaryMax);
        if (min !== undefined) data.expectedSalaryMin = min;
        if (max !== undefined) data.expectedSalaryMax = max;

        if (
            data.expectedSalaryMin != null &&
            data.expectedSalaryMax != null &&
            data.expectedSalaryMin > data.expectedSalaryMax
        ) {
            return res.status(400).json({
                message: "Your minimum salary expectation cannot be above your maximum",
            });
        }

        const asList = (value, limit) =>
            Array.isArray(value)
                ? [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, limit)
                : undefined;

        const targetRoles = asList(body.targetRoles, 8);
        if (targetRoles) data.targetRoles = targetRoles;

        // Candidates can correct the AI's skill extraction by hand.
        const skills = asList(body.skills, 60);
        if (skills) data.skills = skills;

        const certifications = asList(body.certifications, 20);
        if (certifications) data.certifications = certifications;

        if (body.yearsOfExperience !== undefined) {
            const years = Number(body.yearsOfExperience);
            if (Number.isFinite(years) && years >= 0 && years <= 60) {
                data.yearsOfExperience = Math.round(years * 10) / 10;
            }
        }

        if (body.highestEducationLevel !== undefined) {
            const allowed = ["none", "secondary", "certificate", "diploma", "bachelor", "master", "doctorate"];
            if (allowed.includes(String(body.highestEducationLevel))) {
                data.highestEducationLevel = String(body.highestEducationLevel);
            }
        }

        // Talent Search visibility. Opt-in only, and only the candidate can set it.
        const scoringFields = Object.keys(data);
        if (body.discoverable !== undefined) {
            data.discoverable = body.discoverable === true;
            data.discoverableAt = data.discoverable ? new Date() : null;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "No valid fields were provided" });
        }

        const existing = await prisma.candidateProfile.findUnique({ where: { userId: req.user._id } });
        // Turning visibility on again keeps the date it was first switched on.
        if (data.discoverable && existing?.discoverable) delete data.discoverableAt;

        const profile = await prisma.candidateProfile.upsert({
            where: { userId: req.user._id },
            create: { userId: req.user._id, ...data },
            update: data,
        });

        // Preferences feed directly into scoring, so drop the cached matches —
        // but only when one actually changed. The editor sends every field on
        // each save, and toggling Talent Search visibility alone must not
        // throw away scored matches.
        const scoringChanged = scoringFields.some(
            (field) => JSON.stringify(existing?.[field] ?? null) !== JSON.stringify(profile[field] ?? null)
        );
        if (!existing || scoringChanged) {
            await prisma.jobMatch.deleteMany({ where: { userId: req.user._id } }).catch(() => {});
        }

        res.status(200).json({ profile: toClient(profile), message: "Match preferences updated" });
    } catch (error) {
        sendError(res, error, "Could not update your match profile");
    }
};

// ---------------------------------------------------------------------------
// Candidate-facing matching
// ---------------------------------------------------------------------------

/** Load the matching profile plus the resume text that backs it. */
const loadCandidateContext = async (userId) => {
    const [profile, latestAnalysis] = await Promise.all([
        prisma.candidateProfile.findUnique({ where: { userId } }),
        prisma.resumeAnalysis.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: { id: true, resumeText: true, profile: true, createdAt: true },
        }),
    ]);

    return { profile, latestAnalysis, resumeText: latestAnalysis?.resumeText || "" };
};

/**
 * A fingerprint of everything that affects a score. When it changes, cached
 * matches are stale.
 */
const profileKeyFor = (profile) =>
    matchService.sha(
        JSON.stringify({
            skills: (profile?.skills || []).slice().sort(),
            certs: (profile?.certifications || []).slice().sort(),
            years: profile?.yearsOfExperience,
            edu: profile?.highestEducationLevel,
            loc: profile?.location,
            remote: profile?.openToRemote,
            relocate: profile?.willingToRelocate,
            min: profile?.expectedSalaryMin,
            max: profile?.expectedSalaryMax,
        })
    );

/**
 * @desc   Ranked job matches for the signed-in candidate
 * @route  GET /api/ai/match/jobs
 * @access Private
 * @query  limit, minScore, refresh, keyword, location, category
 */
const getJobMatches = async (req, res) => {
    try {
        const { profile, resumeText } = await loadCandidateContext(req.user._id);

        if (!profile || (!profile.skills?.length && !profile.yearsOfExperience)) {
            return res.status(200).json({
                matches: [],
                needsProfile: true,
                message:
                    "Analyse your resume first so we know your skills, experience, and qualifications.",
            });
        }

        const limit = Math.min(Number(req.query.limit) || 20, MAX_MATCH_JOBS);
        const minScore = Number(req.query.minScore) || 0;
        const refresh = req.query.refresh === "true";
        const profileKey = profileKeyFor(profile);

        const where = { isClosed: false, deletedAt: null };
        if (req.query.keyword) {
            where.OR = [
                { title: { contains: String(req.query.keyword), mode: "insensitive" } },
                { description: { contains: String(req.query.keyword), mode: "insensitive" } },
            ];
        }
        if (req.query.location) {
            where.location = { contains: String(req.query.location), mode: "insensitive" };
        }
        if (req.query.category) {
            where.category = { contains: String(req.query.category), mode: "insensitive" };
        }

        const jobs = await prisma.job.findMany({
            where,
            include: {
                company: { select: { id: true, name: true, companyName: true, companyLogo: true } },
                companyProfile: { select: { id: true, name: true, logo: true, industry: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_MATCH_JOBS,
        });

        if (jobs.length === 0) {
            return res.status(200).json({ matches: [], total: 0, needsProfile: false });
        }

        // Serve cached scores when the profile has not changed, so opening the
        // page repeatedly does not re-bill every job.
        if (!refresh) {
            const cached = await prisma.jobMatch.findMany({
                where: { userId: req.user._id, jobId: { in: jobs.map((j) => j.id) }, profileKey },
            });

            if (cached.length === jobs.length) {
                const byJob = new Map(cached.map((c) => [c.jobId, c]));
                const matches = jobs
                    .map((job) => shapeMatchForClient(job, byJob.get(job.id)))
                    .filter((m) => m.matchScore >= minScore)
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, limit);

                return res.status(200).json({
                    matches,
                    total: matches.length,
                    cached: true,
                    aiEnabled: groq.isConfigured(),
                });
            }
        }

        const { matches, aiRefined } = await matchService.matchCandidateToJobs({
            candidateProfile: profile,
            jobs,
            resumeText,
            useAi: true,
            refineTop: Math.min(limit, 10),
        });

        await matchService.cacheJobMatches({ userId: req.user._id, matches, profileKey });

        const payload = matches
            .filter((m) => m.matchScore >= minScore)
            .slice(0, limit)
            .map((m) => shapeMatchForClient(m.job, m));

        res.status(200).json({
            matches: payload,
            total: payload.length,
            cached: false,
            aiRefined,
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not generate your job matches");
    }
};

/** One consistent match shape for the client, from a fresh or cached score. */
const shapeMatchForClient = (job, match) => {
    const companyName =
        job?.companyProfile?.name || job?.company?.companyName || job?.company?.name || "Hiring Company";
    const companyLogo = job?.companyProfile?.logo || job?.companyLogo || job?.company?.companyLogo || "";

    return {
        jobId: job.id,
        _id: job.id,
        matchScore: match?.matchScore ?? 0,
        baseScore: match?.baseScore ?? match?.matchScore ?? 0,
        aiAdjustment: match?.aiAdjustment ?? 0,
        verdict: match?.verdict || "",
        dimensions: match?.dimensions || {},
        strengths: match?.strengths || [],
        gaps: match?.gaps || [],
        missingSkills: match?.missingSkills || [],
        aiSummary: match?.aiSummary || "",
        job: {
            _id: job.id,
            id: job.id,
            title: job.title,
            description: job.description,
            location: job.location,
            category: job.category,
            type: job.type,
            workModel: job.workModel,
            tags: job.tags || [],
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            createdAt: job.createdAt,
            companyName,
            companyLogo,
            company: { companyName, companyLogo },
        },
    };
};

/**
 * @desc   Match breakdown for one job
 * @route  GET /api/ai/match/job/:jobId
 * @access Private
 */
const getJobMatch = async (req, res) => {
    try {
        const job = await prisma.job.findUnique({
            where: { id: req.params.jobId },
            include: {
                company: { select: { id: true, name: true, companyName: true, companyLogo: true } },
                companyProfile: { select: { id: true, name: true, logo: true } },
            },
        });
        if (!job || job.deletedAt) return res.status(404).json({ message: "Job not found" });

        const { profile, resumeText } = await loadCandidateContext(req.user._id);
        if (!profile || (!profile.skills?.length && !profile.yearsOfExperience)) {
            return res.status(200).json({
                match: null,
                needsProfile: true,
                message: "Analyse your resume to see how well you match this role.",
            });
        }

        const profileKey = profileKeyFor(profile);

        if (req.query.refresh !== "true") {
            const cached = await prisma.jobMatch.findUnique({
                where: { userId_jobId: { userId: req.user._id, jobId: job.id } },
            });
            if (cached && cached.profileKey === profileKey) {
                return res.status(200).json({
                    match: shapeMatchForClient(job, cached),
                    cached: true,
                });
            }
        }

        const match = await matchService.matchCandidateToJob({
            candidateProfile: profile,
            job,
            resumeText,
            useAi: true,
        });

        if (!match) return res.status(500).json({ message: "Could not score this job" });

        await matchService.cacheJobMatches({
            userId: req.user._id,
            matches: [match],
            profileKey,
        });

        res.status(200).json({
            match: shapeMatchForClient(job, match),
            cached: false,
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not score this job");
    }
};

// ---------------------------------------------------------------------------
// Employer-facing matching
// ---------------------------------------------------------------------------

/**
 * The employer must own the job before seeing or scoring its applicants. A
 * soft-deleted job still passes: taking the advert down does not end the
 * employer's need to review the people who already applied to it.
 */
const assertJobOwnership = async (jobId, user) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { error: { status: 404, message: "Job not found" } };
    if (job.companyId !== user._id && user.role !== "admin") {
        return { error: { status: 403, message: "You do not have access to this job's applicants" } };
    }
    return { job };
};

/**
 * @desc   Applicants for a job, ranked by AI match score
 * @route  GET /api/ai/match/applicants/:jobId
 * @access Private (employer who owns the job, or admin)
 * @query  refresh=true to rescore every applicant
 */
const getScoredApplicants = async (req, res) => {
    try {
        const { job, error } = await assertJobOwnership(req.params.jobId, req.user);
        if (error) return res.status(error.status).json({ message: error.message });

        const applications = await prisma.application.findMany({
            where: { jobId: job.id },
            include: {
                applicant: { select: { id: true, name: true, email: true, avatar: true, resume: true } },
                aiScore: true,
            },
            orderBy: { createdAt: "desc" },
        });

        if (applications.length === 0) {
            return res.status(200).json({ applicants: [], total: 0 });
        }

        const refresh = req.query.refresh === "true";
        const spec = await matchService.getJobSpec(job);

        // Score only what is missing, unless a refresh was asked for. Scoring
        // is the expensive path — one Groq call per applicant.
        const toScore = refresh ? applications : applications.filter((a) => !a.aiScore);
        const scoredById = new Map(
            applications.filter((a) => a.aiScore).map((a) => [a.id, a.aiScore])
        );

        for (const application of toScore) {
            try {
                const resumeText = await loadApplicantResumeText(application);
                if (!resumeText) continue;

                const profile = await loadApplicantProfile(application);
                const score = await matchService.scoreApplicant({
                    application,
                    job,
                    resumeText,
                    profile,
                    spec,
                });

                const saved = await matchService.cacheApplicantScore(score);
                scoredById.set(application.id, saved || score);
            } catch (scoreError) {
                console.error(`Could not score application ${application.id}:`, scoreError.message);
            }
        }

        const applicants = applications
            .map((application) => {
                const score = scoredById.get(application.id);
                const { aiScore, ...rest } = application;
                return {
                    ...toClient(rest),
                    aiScore: score
                        ? {
                            matchScore: score.matchScore,
                            verdict: score.verdict,
                            dimensions: score.dimensions,
                            strengths: score.strengths || [],
                            gaps: score.gaps || [],
                            aiSummary: score.aiSummary || "",
                            recommendation: score.recommendation || null,
                            interviewFocus: score.interviewFocus || [],
                            degraded: Boolean(score.degraded),
                        }
                        : null,
                };
            })
            // Unscored applicants sort last rather than being hidden.
            .sort((a, b) => (b.aiScore?.matchScore ?? -1) - (a.aiScore?.matchScore ?? -1));

        res.status(200).json({
            applicants,
            total: applicants.length,
            scored: scoredById.size,
            jobSpec: {
                requiredSkills: spec.requiredSkills || [],
                preferredSkills: spec.preferredSkills || [],
                requiredYears: spec.requiredYears ?? null,
                requiredEducationLevel: spec.requiredEducationLevel || null,
                workModel: spec.workModel || null,
            },
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not score the applicants for this job");
    }
};

/** Best available resume text for an applicant. */
const loadApplicantResumeText = async (application) => {
    // A registered applicant may already have an analysis with stored text.
    if (application.applicantId) {
        const analysis = await prisma.resumeAnalysis.findFirst({
            where: { userId: application.applicantId },
            orderBy: { createdAt: "desc" },
            select: { resumeText: true },
        });
        if (analysis?.resumeText) return analysis.resumeText;
    }

    const url = application.resume || application.applicant?.resume;
    if (!url) return "";

    try {
        const extracted = await extractFromUrl(url);
        return extracted.text;
    } catch (error) {
        console.warn(`Could not read resume for application ${application.id}:`, error.message);
        return "";
    }
};

/** Parsed profile for an applicant, when one exists. */
const loadApplicantProfile = async (application) => {
    if (!application.applicantId) return null;

    const [candidateProfile, analysis] = await Promise.all([
        prisma.candidateProfile.findUnique({ where: { userId: application.applicantId } }),
        prisma.resumeAnalysis.findFirst({
            where: { userId: application.applicantId },
            orderBy: { createdAt: "desc" },
            select: { profile: true },
        }),
    ]);

    if (candidateProfile?.skills?.length) return candidateProfile;
    return analysis?.profile || null;
};

/**
 * @desc   Force a rescore of every applicant for a job
 * @route  POST /api/ai/match/applicants/:jobId/rescore
 * @access Private (employer who owns the job, or admin)
 */
const rescoreApplicants = async (req, res) => {
    req.query.refresh = "true";
    return getScoredApplicants(req, res);
};

/**
 * @desc   What the AI reads a posting as asking for — lets an employer see and
 *         fix a vague job description before candidates are matched against it
 * @route  GET /api/ai/match/job-spec/:jobId
 * @access Private (employer who owns the job, or admin)
 */
const getJobSpecForEmployer = async (req, res) => {
    try {
        const { job, error } = await assertJobOwnership(req.params.jobId, req.user);
        if (error) return res.status(error.status).json({ message: error.message });

        const spec = await matchService.getJobSpec(job, {
            forceRefresh: req.query.refresh === "true",
        });

        // Flag a posting too vague to match well against.
        const warnings = [];
        if (!spec.requiredSkills?.length) {
            warnings.push(
                "No specific skills could be extracted from this posting. Candidates cannot be matched accurately on skills — list the required skills explicitly."
            );
        } else if (spec.requiredSkills.length < 3) {
            warnings.push("Only a couple of skills were found. More detail will improve match quality.");
        }
        if (spec.requiredYears === null || spec.requiredYears === undefined) {
            warnings.push("No experience requirement was stated, so experience is scored neutrally.");
        }
        if (!job.salaryMin && !job.salaryMax) {
            warnings.push("No salary range is published, so pay alignment cannot be scored.");
        }

        res.status(200).json({
            spec: {
                requiredSkills: spec.requiredSkills || [],
                preferredSkills: spec.preferredSkills || [],
                requiredCertifications: spec.requiredCertifications || [],
                keyResponsibilities: spec.keyResponsibilities || [],
                requiredYears: spec.requiredYears ?? null,
                requiredEducationLevel: spec.requiredEducationLevel || null,
                seniority: spec.seniority || null,
                workModel: spec.workModel || null,
            },
            warnings,
            cached: Boolean(spec.cached),
            aiEnabled: groq.isConfigured(),
        });
    } catch (error) {
        sendError(res, error, "Could not read this job's requirements");
    }
};

/**
 * @desc   Whether AI features are available, and which model is in use
 * @route  GET /api/ai/status
 * @access Public
 */
const getAiStatus = (req, res) => {
    res.status(200).json({
        enabled: groq.isConfigured(),
        model: groq.isConfigured() ? groq.GROQ_MODEL : null,
        features: {
            resumeAnalysis: true,
            atsScoring: true,
            grammarCheck: groq.isConfigured(),
            jobMatching: true,
            applicantScoring: true,
        },
    });
};

module.exports = {
    analyzeResume: analyzeResumeHandler,
    getLatestAnalysis,
    getAnalysisHistory,
    getMatchProfile,
    updateMatchProfile,
    getJobMatches,
    getJobMatch,
    getScoredApplicants,
    rescoreApplicants,
    getJobSpecForEmployer,
    getAiStatus,
};
