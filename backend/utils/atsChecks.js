/**
 * Deterministic ATS structural checks.
 *
 * Real applicant tracking systems do not "understand" a resume — they parse it.
 * These checks mirror what that parser actually looks for: findable contact
 * details, recognisable section headings, parseable dates, a single-column
 * layout, and a sane length. Each check is a hard rule with a fixed penalty, so
 * the resulting score is reproducible and every deduction can be explained to
 * the candidate.
 *
 * The AI layer handles the judgement calls (tone, grammar, impact); it does not
 * second-guess these.
 */

const SECTION_PATTERNS = {
    contact: ["email", "phone", "@", "linkedin", "mobile", "tel"],
    summary: ["summary", "profile", "objective", "about me", "professional profile"],
    experience: [
        "experience", "employment", "work history", "professional experience",
        "career history", "positions held",
    ],
    education: ["education", "academic", "qualification", "schooling"],
    skills: ["skills", "competencies", "technical skills", "core competencies", "expertise"],
    certifications: ["certification", "certificate", "licence", "license", "accreditation", "training"],
};

/** Verbs that open a strong, ownership-carrying bullet point. */
const ACTION_VERBS = [
    "achieved", "led", "managed", "built", "created", "designed", "developed", "delivered",
    "implemented", "improved", "increased", "reduced", "launched", "negotiated", "coordinated",
    "supervised", "trained", "streamlined", "automated", "optimised", "optimized", "spearheaded",
    "established", "generated", "drove", "grew", "resolved", "restructured", "initiated",
    "oversaw", "mentored", "analysed", "analyzed", "secured", "expanded", "transformed",
];

/** Openers that describe a duty instead of an accomplishment. */
const WEAK_OPENERS = [
    "responsible for", "duties included", "tasked with", "worked on", "helped with",
    "involved in", "assisted with", "in charge of", "participated in",
];

const CLICHES = [
    "team player", "hard worker", "hard-working", "go-getter", "think outside the box",
    "detail oriented", "detail-oriented", "self-starter", "results-driven", "dynamic individual",
    "excellent communication skills", "fast learner", "people person", "synergy",
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// Permissive enough for Ghanaian mobile formats (+233 24 123 4567, 0241234567).
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}/;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+|linkedin\.com\/[^\s]+|github\.com\/[^\s]+/i;
const DATE_RE = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4}|\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current|date)\b|\b\d{1,2}\/(?:19|20)\d{2}\b/i;
const QUANTIFIED_RE = new RegExp(
    [
        // Percentages and scale suffixes: "46%", "1.2m", "300k"
        String.raw`\b\d+(?:[.,]\d+)?\s*(?:%|percent|k\b|m\b|bn\b)`,
        // Currency amounts, including cedis
        String.raw`(?:gh₵|ghs|usd|\$|€|£)\s*\d`,
        // "20+", "12,000+"
        String.raw`\b\d[\d,.]*\s*\+`,
        // "team of 4", "portfolio of 30"
        String.raw`\b(?:team|group|portfolio|budget|staff|headcount)\s+of\s+\d`,
        // A number followed by a countable business noun
        String.raw`\b\d[\d,.]*\s+(?:people|staff|employees|clients|customers|businesses|merchants`
            + String.raw`|students|patients|users|projects|accounts|branches|stores|units|records`
            + String.raw`|product\s+lines|engineers|developers|reports|hours|days|weeks|months)`,
    ].join("|"),
    "i"
);
const BULLET_RE = /^\s*(?:[-•▪◦‣*·]|\d+[.)])\s+/;

// Characters that survive a copy-paste but are mangled by older ATS parsers.
const PROBLEM_GLYPH_RE = /[←-⇿⌀-⏿■-➿️\u{1f300}-\u{1faff}]/u;
// A single pipe-separated contact header is normal and parses fine; a real
// table shows up as several consecutive rows with multiple cell separators.
const TABLE_ROW_RE = /^[^|\n]*\|[^|\n]*\|[^|\n]*\|/;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/**
 * Which standard sections does this resume have?
 * Headings are matched on short lines, since a heading is rarely a paragraph.
 */
const detectSections = (text) => {
    const lower = text.toLowerCase();
    const lines = lower.split("\n");
    const headingLines = lines.filter((l) => l.trim().length > 0 && l.trim().length <= 60);

    const found = {};
    for (const [section, patterns] of Object.entries(SECTION_PATTERNS)) {
        if (section === "contact") {
            found.contact = EMAIL_RE.test(text) || PHONE_RE.test(text);
            continue;
        }
        found[section] =
            headingLines.some((line) => patterns.some((p) => line.includes(p))) ||
            // Fall back to a full-text scan for resumes with inline headings.
            patterns.some((p) => lower.includes(p));
    }
    return found;
};

/**
 * Run every structural check.
 *
 * @param {string} text normalised resume text
 * @param {{pageCount?: number, wordCount?: number, multiColumn?: boolean, source?: string}} layout
 * @returns {{atsScore: number, checks: Array, sections: object, signals: object}}
 */
const runAtsChecks = (text = "", layout = {}) => {
    const wordCount = layout.wordCount || text.split(/\s+/).filter(Boolean).length;
    const pageCount = layout.pageCount || 1;
    const lines = text.split("\n");
    const sections = detectSections(text);

    const bulletLines = lines.filter((l) => BULLET_RE.test(l));
    const lowerText = text.toLowerCase();

    const actionVerbBullets = bulletLines.filter((line) => {
        const opener = line.replace(BULLET_RE, "").trim().toLowerCase();
        return ACTION_VERBS.some((verb) => opener.startsWith(verb));
    });

    const weakPhrases = WEAK_OPENERS.filter((phrase) => lowerText.includes(phrase));
    const clichesFound = CLICHES.filter((phrase) => lowerText.includes(phrase));
    const quantifiedLines = lines.filter((l) => QUANTIFIED_RE.test(l));
    const dateMatches = text.match(new RegExp(DATE_RE.source, "gi")) || [];

    /** @type {Array<{id:string,label:string,status:'pass'|'warn'|'fail',weight:number,advice:string}>} */
    const checks = [];
    const add = (id, label, status, weight, advice) =>
        checks.push({ id, label, status, weight, advice });

    // --- Parseability: can the ATS read the file at all? ---
    add(
        "machine_readable",
        "File is machine readable",
        wordCount >= 150 ? "pass" : wordCount >= 80 ? "warn" : "fail",
        10,
        wordCount >= 150
            ? "Your resume text extracts cleanly."
            : "Very little text could be extracted. Re-save as a text-based PDF rather than an image or design export."
    );

    add(
        "single_column",
        "Single-column layout",
        layout.multiColumn ? "fail" : "pass",
        9,
        layout.multiColumn
            ? "A multi-column layout is the most common reason an ATS scrambles a resume. Move to a single-column layout."
            : "A single-column layout parses reliably."
    );

    const tableRows = lines.filter((l) => TABLE_ROW_RE.test(l)).length;
    add(
        "no_tables",
        "No tables or text boxes",
        tableRows >= 2 ? "warn" : "pass",
        5,
        tableRows >= 2
            ? "Content that looks like a table was detected. Many parsers drop table contents entirely."
            : "No table-based layout detected."
    );

    add(
        "clean_glyphs",
        "No parser-hostile symbols",
        PROBLEM_GLYPH_RE.test(text) ? "warn" : "pass",
        3,
        PROBLEM_GLYPH_RE.test(text)
            ? "Icons or emoji were found. Replace them with plain text labels such as 'Email:' and 'Phone:'."
            : "No icon fonts or emoji in the document body."
    );

    // --- Contact details: an unreachable candidate is a rejected candidate. ---
    add(
        "email_present",
        "Email address found",
        EMAIL_RE.test(text) ? "pass" : "fail",
        9,
        EMAIL_RE.test(text)
            ? "A contactable email address is present."
            : "No email address was found. Add one as plain text in the header."
    );

    add(
        "phone_present",
        "Phone number found",
        PHONE_RE.test(text) ? "pass" : "fail",
        7,
        PHONE_RE.test(text)
            ? "A phone number is present."
            : "Add a phone number so recruiters can reach you directly."
    );

    add(
        "profile_link",
        "Professional link included",
        URL_RE.test(text) ? "pass" : "warn",
        3,
        URL_RE.test(text)
            ? "A LinkedIn, GitHub, or portfolio link is included."
            : "Add a LinkedIn or portfolio URL — recruiters check one before calling."
    );

    // --- Sections: an ATS maps content by heading. ---
    add(
        "experience_section",
        "Work experience section",
        sections.experience ? "pass" : "fail",
        10,
        sections.experience
            ? "A clearly labelled experience section was found."
            : "Add a heading literally called 'Work Experience' — parsers look for that exact wording."
    );

    add(
        "education_section",
        "Education section",
        sections.education ? "pass" : "fail",
        7,
        sections.education
            ? "An education section was found."
            : "Add an 'Education' heading with your qualification, institution, and year."
    );

    add(
        "skills_section",
        "Skills section",
        sections.skills ? "pass" : "fail",
        8,
        sections.skills
            ? "A dedicated skills section was found."
            : "Add a 'Skills' section. It is where keyword matching does most of its work."
    );

    add(
        "summary_section",
        "Professional summary",
        sections.summary ? "pass" : "warn",
        4,
        sections.summary
            ? "A summary or objective gives recruiters immediate context."
            : "Add a 2–3 line professional summary at the top, tailored to the role you want."
    );

    // --- Content quality signals the parser also scores on. ---
    add(
        "dates_parseable",
        "Employment dates present",
        dateMatches.length >= 2 ? "pass" : dateMatches.length === 1 ? "warn" : "fail",
        6,
        dateMatches.length >= 2
            ? "Dates are present and in a parseable format."
            : "Add start and end dates in a consistent 'Jan 2023 – Mar 2025' format for every role."
    );

    add(
        "bullet_points",
        "Bulleted achievements",
        bulletLines.length >= 5 ? "pass" : bulletLines.length >= 2 ? "warn" : "fail",
        5,
        bulletLines.length >= 5
            ? "Your experience is broken into scannable bullets."
            : "Rewrite dense paragraphs as short bullet points — recruiters scan, they do not read."
    );

    const actionRatio = bulletLines.length ? actionVerbBullets.length / bulletLines.length : 0;
    add(
        "action_verbs",
        "Bullets open with action verbs",
        actionRatio >= 0.5 ? "pass" : actionRatio >= 0.25 ? "warn" : "fail",
        5,
        actionRatio >= 0.5
            ? "Most bullets lead with a strong action verb."
            : "Start each bullet with a verb like 'Led', 'Built', or 'Increased' instead of a duty description."
    );

    add(
        "quantified_impact",
        "Quantified achievements",
        quantifiedLines.length >= 3 ? "pass" : quantifiedLines.length >= 1 ? "warn" : "fail",
        7,
        quantifiedLines.length >= 3
            ? "You back up claims with numbers."
            : "Add measurable outcomes — percentages, cedi amounts, team sizes, or volumes handled."
    );

    add(
        "no_weak_phrasing",
        "Avoids duty-based phrasing",
        weakPhrases.length === 0 ? "pass" : weakPhrases.length <= 2 ? "warn" : "fail",
        4,
        weakPhrases.length === 0
            ? "No 'responsible for' style phrasing found."
            : `Replace passive phrasing (${weakPhrases.slice(0, 3).join(", ")}) with what you actually achieved.`
    );

    add(
        "no_cliches",
        "Free of filler clichés",
        clichesFound.length === 0 ? "pass" : clichesFound.length <= 2 ? "warn" : "fail",
        3,
        clichesFound.length === 0
            ? "No empty buzzwords detected."
            : `Cut unverifiable clichés (${clichesFound.slice(0, 3).join(", ")}) and show evidence instead.`
    );

    const lengthOk = wordCount >= 300 && wordCount <= 1000 && pageCount <= 2;
    add(
        "appropriate_length",
        "Appropriate length",
        lengthOk ? "pass" : "warn",
        5,
        lengthOk
            ? `At roughly ${wordCount} words across ${pageCount} page(s), the length is right.`
            : wordCount < 300
                ? `At ${wordCount} words this is too thin — expand your achievements to 400–800 words.`
                : `At ${wordCount} words across ${pageCount} pages this is long. Trim to two pages of the most relevant work.`
    );

    // --- Weighted score. A warn earns half credit. ---
    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    const earned = checks.reduce((sum, c) => {
        if (c.status === "pass") return sum + c.weight;
        if (c.status === "warn") return sum + c.weight * 0.5;
        return sum;
    }, 0);

    return {
        atsScore: clamp(Math.round((earned / totalWeight) * 100)),
        checks,
        sections,
        signals: {
            wordCount,
            pageCount,
            multiColumn: Boolean(layout.multiColumn),
            bulletCount: bulletLines.length,
            actionVerbRatio: Number(actionRatio.toFixed(2)),
            quantifiedCount: quantifiedLines.length,
            dateCount: dateMatches.length,
            weakPhrases,
            cliches: clichesFound,
            hasEmail: EMAIL_RE.test(text),
            hasPhone: PHONE_RE.test(text),
            hasProfileLink: URL_RE.test(text),
        },
    };
};

module.exports = {
    runAtsChecks,
    detectSections,
    ACTION_VERBS,
    WEAK_OPENERS,
    CLICHES,
};
