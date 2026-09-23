/**
 * Talent Search — natural-language candidate search for employers.
 *
 * "React developers in Accra with 3+ years, open to remote" is read into
 * criteria the same way a job search is: the deterministic parser first, and a
 * model only for queries written as prose (utils/queryParser.hasUnresolvedIntent),
 * where it may fill slots the parser left empty but never override one.
 *
 * Who can be found is the important part:
 *   - an employer's own applicants, across all of their jobs — people who
 *     already chose to share their application with this employer;
 *   - candidates who opted in to Talent Search (CandidateProfile.discoverable),
 *     and only by employers whose company has been verified.
 * Nobody else. Applying to one employer never makes a candidate findable by
 * another, and a search result carries no email, phone number or CV.
 *
 * Matching follows the job search rule that a result must match the words it
 * was given: named skills gate (all of one or two, two of three, 60% beyond),
 * a role gates when no skills were named, and stated requirements — years,
 * location, education, seniority, remote — exclude a candidate only when their
 * profile contradicts them. Missing data never hides anyone; it ranks lower.
 */

const prisma = require("../config/prisma");
const { chatJson, isConfigured } = require("../utils/groqClient");
const { parseQuery, hasUnresolvedIntent } = require("../utils/queryParser");
const {
    normalize,
    tokenize,
    STOP_WORDS,
    PLACES,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
    expandRole,
} = require("../utils/searchLexicon");
const { canonicalSkill, skillsMatch, skillInText } = require("../utils/matchEngine");
const { getEmployerStages, findStage } = require("../utils/hiringPipeline");

const PAGE_SIZE = 20;
const MAX_POOL = 3000;
const INTENT_TIMEOUT_MS = Number(process.env.TALENT_INTENT_TIMEOUT_MS || 5000);
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 300;

// Words that describe the search, not the person.
const TALENT_STOP = new Set([
    "candidate", "candidates", "people", "person", "someone", "somebody", "anyone",
    "profile", "profiles", "talent", "talents", "applicant", "applicants", "open",
    "available", "who", "has", "have", "had", "knows", "know", "knowing", "can",
    "able", "good", "strong", "great", "worked", "working", "works", "plus",
    "years", "year", "yrs", "remote", "relocate", "relocation", "willing",
    // Seniority adjectives only. "Manager" and "lead" are half of a job title
    // ("project manager"), so they stay in the role text.
    "senior", "snr", "sr", "junior", "jr", "mid", "intermediate", "entry",
    "level", "experienced", "beginner",
]);

// Seniority a recruiter can require as a minimum — only when they say so in
// as many words. The job-search lexicon reads "experienced", "specialist" and
// "manager" as seniority too, which is right for adverts but would filter out
// people here: "IT specialist" is a title, and "experienced" is not a level.
const SENIORITY_FLOORS = new Set(["mid", "senior"]);
const SENIORITY_WORDS = [
    { key: "senior", pattern: /(?<![a-z0-9])(?:senior|snr|sr)(?![a-z0-9])/ },
    { key: "mid", pattern: /(?<![a-z0-9])(?:mid[- ]?level|intermediate)(?![a-z0-9])/ },
];

const EDUCATION_RANK = Object.fromEntries(EDUCATION_OPTIONS.map((option) => [option.key, option.rank]));
EDUCATION_RANK.none = 0;
const SENIORITY_RANK = Object.fromEntries(SENIORITY_LEVELS.map((level) => [level.key, level.rank]));

/** "nurses" and "nurse", "developers" and "developer", are the same search. */
const stem = (word) => {
    if (word.length <= 3) return word;
    if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
    if (/(?:ss|us|is)$/.test(word)) return word;
    if (/(?:ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith("s")) return word.slice(0, -1);
    return word;
};

// ---------------------------------------------------------------------------
// Reading the query
// ---------------------------------------------------------------------------

const emptyCriteria = () => ({
    roleText: "",
    roleTerms: [],
    skills: [],
    minYears: null,
    location: null,
    remote: false,
    education: null,
    seniority: null,
});

const parseTalentQuery = (query) => {
    const parsed = parseQuery(query);
    const criteria = emptyCriteria();

    criteria.skills = [...new Set([...parsed.boosts.skills, ...parsed.filters.skills].map(canonicalSkill).filter(Boolean))];
    criteria.minYears = parsed.boosts.minYears ?? null;
    criteria.location = parsed.filters.location && parsed.filters.location !== "Ghana" ? parsed.filters.location : null;
    criteria.remote = parsed.filters.workModels.includes("remote");
    criteria.education = parsed.filters.education || null;

    // Only a seniority the recruiter said, never one inferred from "3+ years" —
    // the years are already a criterion of their own.
    const text = normalize(query);
    criteria.seniority = SENIORITY_WORDS.find((word) => word.pattern.test(text))?.key || null;

    const skillWords = new Set(criteria.skills.flatMap((skill) => tokenize(skill)));
    criteria.roleTerms = [...new Set(
        parsed.terms
            .map((term) => normalize(term))
            .filter((term) => term.length > 1 && !STOP_WORDS.has(term) && !TALENT_STOP.has(term) && !skillWords.has(term))
            .filter((term) => !SENIORITY_WORDS.some((word) => word.pattern.test(term)))
            .map(stem)
    )];
    criteria.roleText = criteria.roleTerms.join(" ");

    return { criteria, parsed };
};

// --- AI reading, for prose only ----------------------------------------------

const cache = new Map();
const recall = (key) => {
    const entry = cache.get(key);
    if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return undefined;
    return entry.value;
};
const remember = (key, value) => {
    cache.set(key, { value, at: Date.now() });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
};

const INTENT_SYSTEM = `You read a recruiter's search for candidates and extract the criteria in it.

This is a Ghanaian hiring platform covering every sector — healthcare, education, trades, hospitality, agriculture, finance and technology alike. Do not assume a search is about technology.

Rules:
- Extract only what the search states or clearly implies. Leave a field null or empty rather than guessing.
- "role" is the job title or occupation alone, without seniority, location or skills.
- "skills" are specific skills, tools, licences or certifications the candidate must have.
- Use only the exact values listed for each field. Never invent a new one.`;

const INTENT_SCHEMA = `{
  "role": "occupation or job title, or null",
  "skills": ["specific skills, tools, licences or certifications"],
  "minYears": "minimum years of experience as a number, or null",
  "location": "one of: ${PLACES.map((place) => place.canonical).join(", ")} — or null",
  "remote": "true only if the recruiter wants people open to remote work",
  "education": "one of: ${EDUCATION_OPTIONS.map((option) => option.key).join(", ")} — or null",
  "seniority": "senior or mid, only when the recruiter explicitly asks for that level — otherwise null"
}`;

const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("talent intent timed out")), ms);
        if (typeof timer.unref === "function") timer.unref();
    }),
]);

const sanitizeIntent = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const place = PLACES.find((entry) => normalize(entry.canonical) === normalize(raw.location));
    const years = Number(raw.minYears);
    return {
        role: typeof raw.role === "string" ? normalize(raw.role).slice(0, 80) : "",
        skills: Array.isArray(raw.skills)
            ? [...new Set(raw.skills.map(canonicalSkill).filter((skill) => skill.length > 1 && skill.length < 40))].slice(0, 8)
            : [],
        minYears: Number.isFinite(years) && years > 0 && years <= 40 ? Math.round(years) : null,
        location: place && place.canonical !== "Ghana" ? place.canonical : null,
        remote: raw.remote === true,
        education: EDUCATION_RANK[raw.education] ? raw.education : null,
        seniority: SENIORITY_FLOORS.has(raw.seniority) ? raw.seniority : null,
    };
};

const readTalentIntent = async (query) => {
    if (!isConfigured() || process.env.TALENT_AI_INTENT_DISABLED === "true") return null;
    const key = normalize(query);
    const cached = recall(key);
    if (cached !== undefined) return cached;

    try {
        const { data } = await withTimeout(chatJson({
            system: INTENT_SYSTEM,
            user: `Recruiter's search: ${String(query).slice(0, 400)}`,
            schemaHint: INTENT_SCHEMA,
            temperature: 0,
            maxTokens: 600,
            reasoningEffort: "low",
        }), INTENT_TIMEOUT_MS);
        const intent = sanitizeIntent(data);
        remember(key, intent);
        return intent;
    } catch (error) {
        // A failed read is not a failed search — the parser's reading stands.
        console.warn("Talent intent read failed:", error.message);
        remember(key, null);
        return null;
    }
};

/**
 * Fill only what the parser left empty. The one exception is the role: in a
 * prose query the leftover words are scaffolding ("someone who has worked…"),
 * so a role the model named replaces them rather than joining them.
 */
const mergeIntent = (criteria, intent) => {
    if (!intent) return criteria;
    const merged = { ...criteria };

    if (intent.role) {
        merged.roleText = intent.role;
        merged.roleTerms = [...new Set(tokenize(intent.role).filter((t) => !STOP_WORDS.has(t) && !TALENT_STOP.has(t)).map(stem))];
    } else {
        // The model read the sentence and found no occupation in it, so the
        // leftover words are its scaffolding, not a title to match.
        merged.roleText = "";
        merged.roleTerms = [];
    }
    if (intent.skills.length) {
        merged.skills = [...new Set([...criteria.skills, ...intent.skills])].slice(0, 8);
    }
    if (merged.minYears == null && intent.minYears) merged.minYears = intent.minYears;
    if (!merged.location && intent.location) merged.location = intent.location;
    if (!merged.remote && intent.remote) merged.remote = true;
    if (!merged.education && intent.education) merged.education = intent.education;
    if (!merged.seniority && intent.seniority) merged.seniority = intent.seniority;
    return merged;
};

const readQuery = async (query) => {
    const text = String(query || "").trim().slice(0, 400);
    if (!text) return emptyCriteria();

    const { criteria, parsed } = parseTalentQuery(text);
    if (!hasUnresolvedIntent(parsed)) return criteria;
    return mergeIntent(criteria, await readTalentIntent(text));
};

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** All of one or two, two of three, 60% beyond — the job search rule. */
const needed = (count) => (count <= 2 ? count : count === 3 ? 2 : Math.ceil(count * 0.6));

const placeFor = (canonical) => PLACES.find((place) => place.canonical === canonical);

const wordIn = (needle, haystack) =>
    new RegExp(`(?<![a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(haystack);

const locationFit = (profile, criteria) => {
    if (!criteria.location) return null;
    const where = normalize(profile.location);
    if (!where) return "unknown";

    const place = placeFor(criteria.location);
    const names = [place.canonical, place.region, ...place.aliases].filter(Boolean).map(normalize);
    if (names.some((name) => wordIn(name, where))) return "match";
    if (profile.willingToRelocate) return "relocate";
    if (criteria.remote && profile.openToRemote !== false) return "remote";
    return "mismatch";
};

const roleFit = (profile, criteria) => {
    if (!criteria.roleTerms.length) return null;

    const haystack = normalize([
        ...(profile.targetRoles || []),
        profile.headline || "",
        ...(profile.skills || []),
        ...(profile.industries || []),
    ].join(" | "));
    const words = new Set(tokenize(haystack).map(stem));

    const phrases = [criteria.roleText, ...expandRole(criteria.roleText)].map(normalize).filter(Boolean);
    if (phrases.some((phrase) => haystack.includes(phrase))) return 1;

    const hits = criteria.roleTerms.filter((term) => words.has(term)).length;
    return hits >= needed(criteria.roleTerms.length) ? hits / criteria.roleTerms.length : 0;
};

/**
 * Score one candidate against the criteria, or return null when they do not
 * qualify. Weights only count for criteria the recruiter actually gave, so a
 * skills-only search is not diluted by location it never asked about.
 */
const scoreCandidate = (profile, criteria) => {
    const haveSkills = [...(profile.skills || []), ...(profile.certifications || []), ...(profile.softSkills || [])];
    const headline = normalize(profile.headline);

    const matchedSkills = criteria.skills.filter((wanted) =>
        haveSkills.some((have) => skillsMatch(have, wanted)) || (headline && skillInText(wanted, headline)));
    const missingSkills = criteria.skills.filter((wanted) => !matchedSkills.includes(wanted));
    const role = roleFit(profile, criteria);

    // Relevance gate.
    if (criteria.skills.length) {
        if (matchedSkills.length < needed(criteria.skills.length)) return null;
    } else if (role !== null && role === 0) {
        return null;
    }

    // Stated requirements exclude only on contradicting data.
    const years = profile.yearsOfExperience;
    if (criteria.minYears != null && years != null && years < criteria.minYears) return null;

    const location = locationFit(profile, criteria);
    if (location === "mismatch") return null;

    if (criteria.remote && profile.openToRemote === false) return null;

    const education = profile.highestEducationLevel;
    if (criteria.education && education && (EDUCATION_RANK[education] ?? 0) < EDUCATION_RANK[criteria.education]) return null;

    const seniority = profile.seniority;
    if (criteria.seniority && seniority && SENIORITY_RANK[seniority] !== undefined
        && SENIORITY_RANK[seniority] < SENIORITY_RANK[criteria.seniority]) return null;

    let earned = 0;
    let possible = 0;
    const add = (weight, fraction) => {
        possible += weight;
        earned += weight * fraction;
    };

    if (criteria.skills.length) add(45, matchedSkills.length / criteria.skills.length);
    if (role !== null) add(25, role);
    if (criteria.minYears != null) add(10, years != null ? 1 : 0.5);
    if (location) add(10, { match: 1, relocate: 0.7, remote: 0.7, unknown: 0.4 }[location]);
    if (criteria.remote) add(5, profile.openToRemote ? 1 : 0.5);
    if (criteria.education) add(5, education ? 1 : 0.5);
    if (criteria.seniority) add(5, seniority ? 1 : 0.5);
    // A profile built from an analysed CV is better evidence than a blank one.
    add(5, profile.profileSyncedAt ? 1 : 0.3);

    return {
        score: Math.round((earned / possible) * 100),
        matchedSkills,
        missingSkills,
        locationFit: location,
    };
};

// ---------------------------------------------------------------------------
// The pool
// ---------------------------------------------------------------------------

const isVerifiedEmployer = async (employerId) => {
    const company = await prisma.company.findUnique({
        where: { userId: employerId },
        select: { approvalState: true },
    });
    return company?.approvalState === "approved";
};

const PROFILE_FIELDS = {
    userId: true,
    headline: true,
    location: true,
    skills: true,
    softSkills: true,
    certifications: true,
    industries: true,
    targetRoles: true,
    yearsOfExperience: true,
    highestEducationLevel: true,
    seniority: true,
    openToRemote: true,
    willingToRelocate: true,
    discoverable: true,
    profileSyncedAt: true,
    updatedAt: true,
    user: { select: { id: true, name: true, avatar: true, role: true, trustState: true } },
};

const loadPool = async ({ employerId, includeApplicants, includeOpen }) => {
    const applications = includeApplicants
        ? await prisma.application.findMany({
            where: { applicantId: { not: null }, job: { companyId: employerId } },
            select: {
                id: true,
                jobId: true,
                status: true,
                createdAt: true,
                applicantId: true,
                job: { select: { title: true } },
            },
            orderBy: { createdAt: "desc" },
        })
        : [];

    const applicationsByCandidate = new Map();
    for (const application of applications) {
        if (!applicationsByCandidate.has(application.applicantId)) applicationsByCandidate.set(application.applicantId, []);
        applicationsByCandidate.get(application.applicantId).push(application);
    }
    const applicantIds = [...applicationsByCandidate.keys()];

    const clauses = [];
    if (applicantIds.length) clauses.push({ userId: { in: applicantIds } });
    if (includeOpen) {
        clauses.push({ discoverable: true, user: { role: "jobseeker", trustState: { not: "suspended" } } });
    }

    const profiles = clauses.length
        ? await prisma.candidateProfile.findMany({
            where: { OR: clauses },
            select: PROFILE_FIELDS,
            orderBy: { updatedAt: "desc" },
            take: MAX_POOL,
        })
        : [];

    // An applicant who never had a CV analysed has no profile row, but is
    // still this employer's applicant and still belongs in the pool.
    const withProfile = new Set(profiles.map((profile) => profile.userId));
    const bare = applicantIds.filter((id) => !withProfile.has(id));
    if (bare.length) {
        const users = await prisma.user.findMany({
            where: { id: { in: bare } },
            select: { id: true, name: true, avatar: true, role: true, trustState: true },
        });
        for (const user of users) {
            profiles.push({ userId: user.id, user, skills: [], certifications: [], softSkills: [], targetRoles: [], industries: [] });
        }
    }

    return { profiles, applicationsByCandidate };
};

/**
 * @param {object} options
 * @param {string} options.employerId
 * @param {string} options.query
 * @param {"all"|"applicants"|"open"} options.scope
 * @param {number} options.page
 */
const searchTalent = async ({ employerId, query, scope = "all", page = 1 }) => {
    const verified = await isVerifiedEmployer(employerId);
    const includeApplicants = scope !== "open";
    const includeOpen = verified && scope !== "applicants";

    const [criteria, pool, stages] = await Promise.all([
        readQuery(query),
        loadPool({ employerId, includeApplicants, includeOpen }),
        getEmployerStages(employerId),
    ]);

    const hasQuery = Boolean(String(query || "").trim());
    const ranked = [];
    for (const profile of pool.profiles) {
        const fit = hasQuery
            ? scoreCandidate(profile, criteria)
            : { score: null, matchedSkills: [], missingSkills: [], locationFit: null };
        if (fit) ranked.push({ profile, fit });
    }

    ranked.sort((a, b) =>
        (b.fit.score ?? 0) - (a.fit.score ?? 0)
        || (b.profile.yearsOfExperience ?? -1) - (a.profile.yearsOfExperience ?? -1)
        || new Date(b.profile.updatedAt || 0) - new Date(a.profile.updatedAt || 0));

    const total = ranked.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const slice = ranked.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

    const invites = slice.length
        ? await prisma.talentInvite.findMany({
            where: { employerId, candidateId: { in: slice.map((entry) => entry.profile.userId) } },
            select: { candidateId: true, jobId: true },
        })
        : [];

    const candidates = slice.map(({ profile, fit }) => {
        const applications = pool.applicationsByCandidate.get(profile.userId) || [];
        const matched = new Set(fit.matchedSkills);
        // Matched skills first, so the reason a candidate is here is the first thing read.
        const skills = [...(profile.skills || [])].sort((a, b) =>
            Number(fit.matchedSkills.some((m) => skillsMatch(b, m))) - Number(fit.matchedSkills.some((m) => skillsMatch(a, m))));

        return {
            id: profile.userId,
            name: profile.user?.name || "Candidate",
            avatar: profile.user?.avatar || "",
            headline: profile.headline || "",
            location: profile.location || "",
            yearsOfExperience: profile.yearsOfExperience ?? null,
            education: profile.highestEducationLevel || null,
            seniority: profile.seniority || null,
            targetRoles: (profile.targetRoles || []).slice(0, 4),
            skills: skills.slice(0, 14),
            openToRemote: profile.openToRemote ?? null,
            willingToRelocate: profile.willingToRelocate ?? null,
            relation: applications.length ? "applicant" : "open",
            applications: applications.slice(0, 5).map((application) => ({
                id: application.id,
                jobId: application.jobId,
                jobTitle: application.job?.title || "Job",
                stage: findStage(stages, application.status)?.name || application.status,
                appliedAt: application.createdAt,
            })),
            invitedJobIds: invites.filter((invite) => invite.candidateId === profile.userId).map((invite) => invite.jobId),
            score: fit.score,
            matchedSkills: [...matched],
            missingSkills: fit.missingSkills,
            locationFit: fit.locationFit,
        };
    });

    return { candidates, total, page: current, pages, verified, scope };
};

module.exports = {
    searchTalent,
    isVerifiedEmployer,
    parseTalentQuery,
    mergeIntent,
    scoreCandidate,
    readQuery,
};
