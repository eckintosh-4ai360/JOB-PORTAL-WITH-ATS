/**
 * Deterministic candidate/job match engine.
 *
 * Scores a candidate profile against a job spec across six weighted
 * dimensions: skills, experience, education, certifications, location, and
 * salary expectations.
 *
 * This runs without any network call, which matters for three reasons:
 *  1. Every score is explainable — we can always say which skill matched.
 *  2. Listing pages can score dozens of jobs instantly and for free.
 *  3. If Groq is rate-limited or unconfigured, matching still works.
 *
 * The AI layer refines these numbers (see services/jobMatchService.js); it does
 * not replace them.
 */

const DIMENSION_WEIGHTS = {
    skills: 35,
    experience: 20,
    location: 15,
    education: 12,
    certifications: 8,
    salary: 10,
};

/**
 * Skill aliases — a resume saying "JS" and a job asking for "JavaScript" is a
 * match, and an ATS that misses that is the reason candidates get filtered out
 * unfairly. Keys are canonical; values are the spellings seen in the wild.
 */
const SKILL_ALIASES = {
    javascript: ["js", "es6", "es2015", "ecmascript", "vanilla js"],
    typescript: ["ts"],
    react: ["reactjs", "react.js", "react native"],
    node: ["nodejs", "node.js", "express", "expressjs", "express.js"],
    python: ["py", "python3"],
    postgresql: ["postgres", "psql", "postgre"],
    mongodb: ["mongo", "mongoose"],
    "microsoft office": ["ms office", "office suite", "word", "excel", "powerpoint", "msoffice"],
    excel: ["microsoft excel", "ms excel", "spreadsheets", "advanced excel"],
    "customer service": ["customer support", "client service", "client relations", "customer care"],
    communication: ["communication skills", "verbal communication", "written communication"],
    leadership: ["team leadership", "team lead", "people management", "line management"],
    "project management": ["project coordination", "programme management", "pmp", "project delivery"],
    accounting: ["bookkeeping", "financial accounting", "accounts"],
    "data analysis": ["data analytics", "analytics", "data analyst", "business intelligence"],
    sql: ["mysql", "t-sql", "pl/sql", "structured query language"],
    "graphic design": ["graphics design", "visual design", "adobe creative suite"],
    marketing: ["digital marketing", "social media marketing", "brand marketing"],
    sales: ["business development", "b2b sales", "field sales", "telesales"],
    hr: ["human resources", "people operations", "talent acquisition", "recruitment"],
    "problem solving": ["problem-solving", "critical thinking", "analytical thinking"],
    aws: ["amazon web services", "ec2", "s3"],
    docker: ["containerization", "containers"],
    git: ["github", "gitlab", "version control"],
    figma: ["ui design", "ux design", "wireframing", "prototyping"],
    seo: ["search engine optimization", "search engine optimisation"],
    nursing: ["registered nurse", "rn", "patient care"],
    teaching: ["lesson planning", "curriculum development", "instruction"],
    driving: ["driver", "driving licence", "driving license", "defensive driving"],
};

/** Education levels, ranked so "higher than required" is recognised. */
const EDUCATION_LEVELS = [
    { level: 0, key: "none", patterns: [] },
    { level: 1, key: "secondary", patterns: ["wassce", "ssce", "o level", "a level", "high school", "secondary school", "shs"] },
    { level: 2, key: "certificate", patterns: ["certificate", "nvti", "vocational", "technical certificate"] },
    { level: 3, key: "diploma", patterns: ["diploma", "hnd", "higher national", "associate degree", "associate's"] },
    { level: 4, key: "bachelor", patterns: ["bachelor", "bsc", "b.sc", "ba", "b.a", "beng", "b.eng", "btech", "b.tech", "bcom", "undergraduate degree", "first degree", "degree in"] },
    { level: 5, key: "master", patterns: ["master", "msc", "m.sc", "ma", "m.a", "mba", "meng", "m.eng", "mphil", "postgraduate"] },
    { level: 6, key: "doctorate", patterns: ["phd", "ph.d", "doctorate", "doctoral", "dphil"] },
];

const REMOTE_PATTERNS = ["remote", "work from home", "wfh", "anywhere", "distributed"];
const HYBRID_PATTERNS = ["hybrid", "flexible location", "partly remote"];

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const norm = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9+#./\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Map a raw skill string onto its canonical form when we know an alias. */
const canonicalSkill = (skill) => {
    const s = norm(skill);
    if (!s) return "";

    if (SKILL_ALIASES[s]) return s;

    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        if (aliases.includes(s)) return canonical;
    }
    return s;
};

/**
 * Do two skills refer to the same thing? Exact canonical match first, then
 * containment (so "advanced excel" matches "excel"), then a token-overlap
 * check for multi-word skills.
 */
const skillsMatch = (candidateSkill, requiredSkill) => {
    const a = canonicalSkill(candidateSkill);
    const b = canonicalSkill(requiredSkill);

    if (!a || !b) return false;
    if (a === b) return true;

    // Short skills are matched on a boundary rather than by substring, so
    // "sql" still matches "postgresql" while "r" never matches "react".
    const shorter = a.length <= b.length ? a : b;
    const longer = shorter === a ? b : a;
    if (shorter.length <= 3) {
        if (shorter.length < 2) return false;
        return new RegExp(`(^|[^a-z0-9])${escapeRegex(shorter)}([^a-z0-9]|$)`, "i").test(longer)
            || longer.endsWith(shorter);
    }

    if (a.includes(b) || b.includes(a)) return true;

    const aTokens = new Set(a.split(" ").filter((t) => t.length > 3));
    const bTokens = b.split(" ").filter((t) => t.length > 3);
    if (aTokens.size === 0 || bTokens.length === 0) return false;

    const shared = bTokens.filter((t) => aTokens.has(t)).length;
    return shared / bTokens.length >= 0.6;
};

/** Is a skill mentioned anywhere in the free text of a resume? */
const skillInText = (skill, text) => {
    const canonical = canonicalSkill(skill);
    if (!canonical) return false;

    const needles = [canonical, ...(SKILL_ALIASES[canonical] || [])];
    return needles.some((needle) => {
        if (needle.length <= 3) {
            return new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, "i").test(text);
        }
        return text.includes(needle);
    });
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Highest education level mentioned in a blob of text.
 *
 * Abbreviations are matched on word boundaries, not as substrings. A plain
 * `includes("ma")` promotes "Ama Mensah" to a master's degree, and an
 * invented qualification is worse than a missing one.
 */
const educationLevelFromText = (text) => {
    const haystack = norm(text);
    let best = EDUCATION_LEVELS[0];

    for (const entry of EDUCATION_LEVELS) {
        if (entry.level <= best.level) continue;

        const hit = entry.patterns.some((pattern) => {
            // Multi-word phrases are unambiguous enough for a substring test.
            if (pattern.includes(" ")) return haystack.includes(pattern);
            return new RegExp(`(^|[^a-z0-9])${escapeRegex(pattern)}([^a-z0-9]|$)`).test(haystack);
        });

        if (hit) best = entry;
    }
    return best;
};

/**
 * Years of experience a job asks for, e.g. "3+ years", "minimum of 5 years",
 * "2-4 years". Returns null when the posting does not say.
 */
const requiredYearsFromText = (text) => {
    const haystack = norm(text);
    const matches = [
        ...haystack.matchAll(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to)?\s*(\d{1,2})?\s*(?:years?|yrs?)/g),
    ];

    let required = null;
    for (const match of matches) {
        const low = Number(match[1]);
        if (!Number.isFinite(low) || low > 40) continue;
        // A range like "2-4 years" is satisfied by the lower bound.
        if (required === null || low < required) required = low;
    }
    return required;
};

const locationMode = (text) => {
    const haystack = norm(text);
    if (REMOTE_PATTERNS.some((p) => haystack.includes(p))) return "remote";
    if (HYBRID_PATTERNS.some((p) => haystack.includes(p))) return "hybrid";
    return "onsite";
};

/** Compare two place strings on their meaningful tokens. */
const sameArea = (a, b) => {
    const stop = new Set(["ghana", "region", "city", "greater", "area", "and", "the", "municipal", "district"]);
    const tokensOf = (value) =>
        new Set(
            norm(value)
                .split(" ")
                .filter((t) => t.length > 2 && !stop.has(t))
        );

    const setA = tokensOf(a);
    const setB = tokensOf(b);
    if (setA.size === 0 || setB.size === 0) return false;

    for (const token of setB) {
        if (setA.has(token)) return true;
    }
    return false;
};

// ---------------------------------------------------------------------------
// Dimension scorers. Each returns { score, weight, label, detail, matched[], missing[] }
// ---------------------------------------------------------------------------

const scoreSkills = (profile, job) => {
    const required = (job.requiredSkills || []).filter(Boolean);
    const preferred = (job.preferredSkills || []).filter(Boolean);
    const candidateSkills = (profile.skills || []).filter(Boolean);
    const resumeText = norm(profile.rawText || "");

    if (required.length === 0 && preferred.length === 0) {
        return {
            score: 60,
            label: "Not specified",
            detail: "This posting does not list specific skills, so skills are scored neutrally.",
            matched: candidateSkills.slice(0, 8),
            missing: [],
        };
    }

    const matchOne = (requirement) => {
        const direct = candidateSkills.find((skill) => skillsMatch(skill, requirement));
        if (direct) return { requirement, evidence: direct, via: "skills" };
        // A skill demonstrated in the experience section still counts, even if
        // the candidate never listed it under "Skills".
        if (resumeText && skillInText(requirement, resumeText)) {
            return { requirement, evidence: requirement, via: "experience" };
        }
        return null;
    };

    const requiredHits = required.map(matchOne);
    const preferredHits = preferred.map(matchOne);

    const matchedRequired = requiredHits.filter(Boolean);
    const matchedPreferred = preferredHits.filter(Boolean);
    const missingRequired = required.filter((_, i) => !requiredHits[i]);
    const missingPreferred = preferred.filter((_, i) => !preferredHits[i]);

    // Required skills carry 80% of the dimension, preferred the remaining 20%.
    const requiredRatio = required.length ? matchedRequired.length / required.length : 1;
    const preferredRatio = preferred.length ? matchedPreferred.length / preferred.length : 1;
    const score = clamp(Math.round(requiredRatio * 80 + preferredRatio * 20));

    return {
        score,
        label: `${matchedRequired.length}/${required.length} core skills`,
        detail: missingRequired.length
            ? `Missing core skills: ${missingRequired.slice(0, 5).join(", ")}`
            : "You cover every core skill in this posting.",
        matched: matchedRequired.map((hit) => hit.requirement),
        matchedVia: matchedRequired,
        missing: missingRequired,
        missingPreferred,
    };
};

const scoreExperience = (profile, job) => {
    const candidateYears = Number(profile.yearsOfExperience) || 0;
    const requiredYears = job.requiredYears ?? requiredYearsFromText(
        `${job.requirements || ""} ${job.description || ""}`
    );

    if (requiredYears === null || requiredYears === undefined) {
        return {
            score: 65,
            label: `${candidateYears} yrs experience`,
            detail: "This posting does not state a years-of-experience requirement.",
            matched: [],
            missing: [],
        };
    }

    if (requiredYears === 0) {
        return {
            score: 100,
            label: "Entry level",
            detail: "This role is open to candidates without prior experience.",
            matched: [],
            missing: [],
        };
    }

    const ratio = candidateYears / requiredYears;
    let score;
    if (ratio >= 1) {
        // Being well over the bar is good, but massive over-qualification can
        // read as a flight risk, so the curve flattens rather than climbing.
        score = ratio >= 2.5 ? 88 : 100;
    } else if (ratio >= 0.75) score = 82;
    else if (ratio >= 0.5) score = 62;
    else if (ratio >= 0.25) score = 38;
    else score = 18;

    return {
        score,
        label: `${candidateYears} of ${requiredYears} yrs`,
        detail:
            ratio >= 1
                ? `You meet the ${requiredYears}-year requirement.`
                : `This role asks for ${requiredYears} years; your resume shows about ${candidateYears}.`,
        matched: [],
        missing: ratio >= 1 ? [] : [`${requiredYears} years of experience`],
    };
};

const scoreEducation = (profile, job) => {
    const jobText = `${job.requirements || ""} ${job.description || ""}`;
    const requiredLevel = job.requiredEducationLevel
        ? EDUCATION_LEVELS.find((e) => e.key === job.requiredEducationLevel) || EDUCATION_LEVELS[0]
        : educationLevelFromText(jobText);

    const candidateLevel = profile.highestEducationLevel
        ? EDUCATION_LEVELS.find((e) => e.key === profile.highestEducationLevel) || EDUCATION_LEVELS[0]
        : educationLevelFromText(
            `${(profile.education || []).map((e) => `${e.degree || ""} ${e.field || ""}`).join(" ")} ${profile.rawText || ""}`
        );

    if (requiredLevel.level === 0) {
        return {
            score: candidateLevel.level > 0 ? 80 : 60,
            label: candidateLevel.level > 0 ? titleCase(candidateLevel.key) : "Not specified",
            detail: "No formal education requirement is stated for this role.",
            matched: [],
            missing: [],
        };
    }

    const gap = candidateLevel.level - requiredLevel.level;
    let score;
    if (gap >= 1) score = 100;
    else if (gap === 0) score = 95;
    else if (gap === -1) score = 60;
    else if (gap === -2) score = 35;
    else score = 15;

    return {
        score,
        label: `${titleCase(candidateLevel.key)} vs ${titleCase(requiredLevel.key)}`,
        detail:
            gap >= 0
                ? `Your ${titleCase(candidateLevel.key)} meets the requirement.`
                : `This role expects a ${titleCase(requiredLevel.key)}-level qualification.`,
        matched: gap >= 0 ? [titleCase(candidateLevel.key)] : [],
        missing: gap >= 0 ? [] : [`${titleCase(requiredLevel.key)} qualification`],
    };
};

const scoreCertifications = (profile, job) => {
    const required = (job.requiredCertifications || []).filter(Boolean);
    const held = (profile.certifications || []).filter(Boolean);

    if (required.length === 0) {
        return {
            score: held.length > 0 ? 85 : 70,
            label: held.length ? `${held.length} held` : "None required",
            detail: held.length
                ? "No certifications are required, and yours add credibility."
                : "This posting does not require certifications.",
            matched: held.slice(0, 6),
            missing: [],
        };
    }

    const resumeText = norm(profile.rawText || "");
    const hits = required.filter(
        (cert) =>
            held.some((owned) => skillsMatch(owned, cert)) ||
            (resumeText && skillInText(cert, resumeText))
    );
    const missing = required.filter((cert) => !hits.includes(cert));

    return {
        score: clamp(Math.round((hits.length / required.length) * 100)),
        label: `${hits.length}/${required.length} certifications`,
        detail: missing.length
            ? `Missing: ${missing.slice(0, 4).join(", ")}`
            : "You hold every certification this role requires.",
        matched: hits,
        missing,
    };
};

const scoreLocation = (profile, job) => {
    const jobMode = job.workModel
        ? locationMode(job.workModel)
        : locationMode(`${job.location || ""} ${job.type || ""} ${job.description || ""}`);

    const candidateLocation = profile.location || "";
    const openToRemote = profile.openToRemote !== false;
    const willingToRelocate = Boolean(profile.willingToRelocate);

    if (jobMode === "remote") {
        return {
            score: openToRemote ? 100 : 70,
            label: "Remote",
            detail: "This role is remote, so your location is not a constraint.",
            matched: ["Remote-friendly"],
            missing: [],
        };
    }

    if (!candidateLocation) {
        return {
            score: 55,
            label: "Location unknown",
            detail: "Add your city to your profile for an accurate location score.",
            matched: [],
            missing: ["Your location"],
        };
    }

    const jobLocation = job.location || "";
    if (!jobLocation) {
        return {
            score: 65,
            label: "Not specified",
            detail: "This posting does not state a location.",
            matched: [],
            missing: [],
        };
    }

    if (sameArea(candidateLocation, jobLocation)) {
        return {
            score: jobMode === "hybrid" ? 98 : 100,
            label: "Same area",
            detail: `You are already in ${jobLocation}.`,
            matched: [jobLocation],
            missing: [],
        };
    }

    // Different area — relocation willingness is what rescues the score.
    const score = willingToRelocate ? 70 : jobMode === "hybrid" ? 40 : 30;
    return {
        score,
        label: "Different area",
        detail: willingToRelocate
            ? `This role is in ${jobLocation}; you have marked yourself open to relocating.`
            : `This role is based in ${jobLocation}, away from ${candidateLocation}.`,
        matched: [],
        missing: [`Presence in ${jobLocation}`],
    };
};

const scoreSalary = (profile, job) => {
    const expectedMin = Number(profile.expectedSalaryMin) || null;
    const expectedMax = Number(profile.expectedSalaryMax) || null;
    const jobMin = Number(job.salaryMin) || null;
    const jobMax = Number(job.salaryMax) || null;

    if (!expectedMin && !expectedMax) {
        return {
            score: 70,
            label: "No expectation set",
            detail: "Set a salary expectation on your profile to score this dimension.",
            matched: [],
            missing: ["Your salary expectation"],
        };
    }
    if (!jobMin && !jobMax) {
        return {
            score: 70,
            label: "Undisclosed",
            detail: "This employer has not published a salary range.",
            matched: [],
            missing: [],
        };
    }

    const wantLow = expectedMin || expectedMax;
    const wantHigh = expectedMax || expectedMin;
    const offerLow = jobMin || jobMax;
    const offerHigh = jobMax || jobMin;

    // Ranges overlap — everyone can live with the outcome.
    if (offerHigh >= wantLow && offerLow <= wantHigh) {
        const offerTopsExpectation = offerHigh >= wantHigh;
        return {
            score: offerTopsExpectation ? 100 : 88,
            label: "Ranges overlap",
            detail: offerTopsExpectation
                ? "The posted range covers your full expectation."
                : "The posted range partly covers your expectation.",
            matched: ["Compensation aligned"],
            missing: [],
        };
    }

    if (offerHigh < wantLow) {
        const shortfall = (wantLow - offerHigh) / wantLow;
        const score = shortfall <= 0.1 ? 70 : shortfall <= 0.25 ? 48 : shortfall <= 0.4 ? 28 : 12;
        return {
            score,
            label: "Below expectation",
            detail: `The posted maximum is about ${Math.round(shortfall * 100)}% below your minimum.`,
            matched: [],
            missing: ["Salary expectation met"],
        };
    }

    // Offer floor is above what the candidate asked for — no downside.
    return {
        score: 100,
        label: "Above expectation",
        detail: "This role pays above your stated expectation.",
        matched: ["Compensation aligned"],
        missing: [],
    };
};

const titleCase = (value) =>
    String(value || "")
        .split(/[\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

/**
 * Score one candidate profile against one job spec.
 *
 * @param {object} profile parsed candidate profile (see resumeAnalysisService)
 * @param {object} job job spec — a Job row optionally enriched with
 *   requiredSkills/preferredSkills/requiredYears/requiredEducationLevel/requiredCertifications
 * @returns {{matchScore: number, verdict: string, dimensions: object, strengths: string[], gaps: string[]}}
 */
const scoreMatch = (profile = {}, job = {}) => {
    const dimensions = {
        skills: { ...scoreSkills(profile, job), weight: DIMENSION_WEIGHTS.skills },
        experience: { ...scoreExperience(profile, job), weight: DIMENSION_WEIGHTS.experience },
        location: { ...scoreLocation(profile, job), weight: DIMENSION_WEIGHTS.location },
        education: { ...scoreEducation(profile, job), weight: DIMENSION_WEIGHTS.education },
        certifications: { ...scoreCertifications(profile, job), weight: DIMENSION_WEIGHTS.certifications },
        salary: { ...scoreSalary(profile, job), weight: DIMENSION_WEIGHTS.salary },
    };

    const totalWeight = Object.values(dimensions).reduce((sum, d) => sum + d.weight, 0);
    const weighted = Object.values(dimensions).reduce((sum, d) => sum + d.score * d.weight, 0);
    let matchScore = clamp(Math.round(weighted / totalWeight));

    // Core-skills gate. Weighted averaging alone lets a candidate who has none
    // of the required skills still score in the sixties, because living in the
    // right city and accepting the salary are cheap points. Missing the core
    // skills is disqualifying in practice, so a very low skills score caps the
    // total rather than merely dragging it down.
    const skillsScore = dimensions.skills.score;
    if (skillsScore < 40) {
        matchScore = Math.min(matchScore, Math.round(40 + skillsScore * 0.5));
    }

    const strengths = Object.entries(dimensions)
        .filter(([, d]) => d.score >= 85)
        .sort((a, b) => b[1].weight - a[1].weight)
        .map(([key, d]) => `${titleCase(key)}: ${d.label}`);

    const gaps = Object.entries(dimensions)
        .filter(([, d]) => d.score < 65)
        .sort((a, b) => b[1].weight * (100 - b[1].score) - a[1].weight * (100 - a[1].score))
        .map(([key, d]) => `${titleCase(key)}: ${d.detail}`);

    return {
        matchScore,
        verdict: verdictFor(matchScore),
        dimensions,
        strengths,
        gaps,
        missingSkills: dimensions.skills.missing || [],
    };
};

const verdictFor = (score) => {
    if (score >= 90) return "Excellent match";
    if (score >= 80) return "Strong match";
    if (score >= 65) return "Good match";
    if (score >= 50) return "Partial match";
    return "Weak match";
};

module.exports = {
    scoreMatch,
    scoreSkills,
    scoreExperience,
    scoreEducation,
    scoreCertifications,
    scoreLocation,
    scoreSalary,
    canonicalSkill,
    skillsMatch,
    skillInText,
    educationLevelFromText,
    requiredYearsFromText,
    locationMode,
    verdictFor,
    titleCase,
    DIMENSION_WEIGHTS,
    EDUCATION_LEVELS,
};
