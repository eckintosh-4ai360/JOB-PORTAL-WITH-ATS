/**
 * The structured CV behind the resume builder.
 *
 * One shape is stored, edited and rendered. Everything the browser sends is
 * passed through `sanitizeContent` before it is saved, so the PDF renderer and
 * the AI writer can trust every field to be a string of bounded length in the
 * place it belongs.
 *
 * Dates are kept as "YYYY" or "YYYY-MM" and only formatted on the way out, so
 * a CV always prints them in the one form an ATS parses ("Mar 2021").
 *
 * There is deliberately no field for a photo, date of birth, gender, marital
 * status or religion. None of them belong on a CV, and each invites the kind
 * of screening this platform warns employers against.
 */

const TEMPLATES = ["modern", "classic", "compact"];
const ACCENTS = ["indigo", "teal", "slate", "burgundy", "forest", "navy"];

const SECTION_KEYS = [
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
    "languages",
    "references",
];

const LANGUAGE_LEVELS = ["Native", "Fluent", "Professional", "Conversational", "Basic"];
const REFERENCE_MODES = ["on_request", "list", "hide"];

const LIMITS = {
    title: 80,
    short: 120,
    line: 200,
    bullet: 400,
    paragraph: 1200,
    summary: 1200,
    experience: 15,
    bullets: 10,
    education: 10,
    skills: 40,
    skill: 60,
    certifications: 15,
    projects: 10,
    languages: 10,
    references: 4,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const text = (value, max = LIMITS.short) =>
    String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Multi-line text keeps its line breaks but not runs of blank lines. */
const paragraph = (value, max = LIMITS.paragraph) =>
    String(value ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max);

/** A bullet typed with its own marker ("- ", "• ", "1.") keeps only the words. */
const bullet = (value) => text(String(value ?? "").replace(/^\s*(?:[-•*·▪◦]|\d+[.)])\s*/, ""), LIMITS.bullet);

const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

/** Entries need a stable id so the editor can reorder them without losing focus. */
const entryId = (value) => {
    const id = String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    return id || Math.random().toString(36).slice(2, 12);
};

/** Accept "YYYY" or "YYYY-MM" with a plausible year; anything else is dropped. */
const date = (value) => {
    const match = /^(\d{4})(?:-(\d{2}))?$/.exec(String(value ?? "").trim());
    if (!match) return "";
    const year = Number(match[1]);
    if (year < 1950 || year > 2100) return "";
    const month = match[2] ? Number(match[2]) : null;
    if (month !== null && (month < 1 || month > 12)) return match[1];
    return match[0];
};

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const dedupe = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = item.toLowerCase();
        if (!item || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

/** An entry with nothing in it is left out rather than printed as a gap. */
const hasAny = (entry, keys) => keys.some((key) => (Array.isArray(entry[key]) ? entry[key].length : entry[key]));

const sanitizeContent = (raw = {}) => {
    const source = raw && typeof raw === "object" ? raw : {};
    const personal = source.personal || {};

    const order = dedupe(list(source.sections, SECTION_KEYS.length).map((key) => String(key)))
        .filter((key) => SECTION_KEYS.includes(key));
    // A section missing from the stored order (say, one added in a later
    // release) goes on the end instead of disappearing.
    const sections = [...order, ...SECTION_KEYS.filter((key) => !order.includes(key))];

    const references = source.references || {};

    return {
        personal: {
            fullName: text(personal.fullName, LIMITS.short),
            headline: text(personal.headline, LIMITS.line),
            email: text(personal.email, LIMITS.short),
            phone: text(personal.phone, 40),
            location: text(personal.location, LIMITS.short),
            linkedin: text(personal.linkedin, LIMITS.line),
            website: text(personal.website, LIMITS.line),
        },
        summary: paragraph(source.summary, LIMITS.summary),
        experience: list(source.experience, LIMITS.experience)
            .map((entry) => ({
                id: entryId(entry?.id),
                title: text(entry?.title),
                employer: text(entry?.employer),
                location: text(entry?.location),
                start: date(entry?.start),
                end: entry?.current ? "" : date(entry?.end),
                current: Boolean(entry?.current),
                bullets: list(entry?.bullets, LIMITS.bullets).map(bullet).filter(Boolean),
            }))
            .filter((entry) => hasAny(entry, ["title", "employer", "bullets"])),
        education: list(source.education, LIMITS.education)
            .map((entry) => ({
                id: entryId(entry?.id),
                qualification: text(entry?.qualification, LIMITS.line),
                institution: text(entry?.institution, LIMITS.line),
                location: text(entry?.location),
                start: date(entry?.start),
                end: date(entry?.end),
                details: paragraph(entry?.details, 600),
            }))
            .filter((entry) => hasAny(entry, ["qualification", "institution"])),
        skills: dedupe(list(source.skills, LIMITS.skills).map((skill) => text(skill, LIMITS.skill))),
        certifications: list(source.certifications, LIMITS.certifications)
            .map((entry) => ({
                id: entryId(entry?.id),
                name: text(entry?.name, LIMITS.line),
                issuer: text(entry?.issuer),
                year: date(entry?.year).slice(0, 4),
            }))
            .filter((entry) => entry.name),
        projects: list(source.projects, LIMITS.projects)
            .map((entry) => ({
                id: entryId(entry?.id),
                name: text(entry?.name),
                link: text(entry?.link, LIMITS.line),
                description: paragraph(entry?.description, 700),
            }))
            .filter((entry) => entry.name),
        languages: list(source.languages, LIMITS.languages)
            .map((entry) => ({
                id: entryId(entry?.id),
                name: text(entry?.name, 60),
                level: oneOf(entry?.level, LANGUAGE_LEVELS, ""),
            }))
            .filter((entry) => entry.name),
        references: {
            mode: oneOf(references.mode, REFERENCE_MODES, "on_request"),
            items: list(references.items, LIMITS.references)
                .map((entry) => ({
                    id: entryId(entry?.id),
                    name: text(entry?.name),
                    position: text(entry?.position),
                    organisation: text(entry?.organisation),
                    email: text(entry?.email),
                    phone: text(entry?.phone, 40),
                }))
                .filter((entry) => entry.name),
        },
        sections,
    };
};

/**
 * Keep the editor's empty rows while it is being typed into.
 *
 * `sanitizeContent` drops blank entries, which is right for a finished CV but
 * wrong mid-edit: a candidate who clicks "Add role" expects the empty form to
 * still be there after the autosave. So what is stored keeps blank entries and
 * bullets; `sanitizeContent` is applied when the CV is rendered or read by AI.
 */
const sanitizeDraft = (raw = {}) => {
    const source = raw && typeof raw === "object" ? raw : {};
    const clean = sanitizeContent(source);

    const keepBlank = (key, shape) => list(source[key], LIMITS[key]).map((entry) => shape(entry || {}));

    clean.experience = keepBlank("experience", (entry) => ({
        id: entryId(entry.id),
        title: text(entry.title),
        employer: text(entry.employer),
        location: text(entry.location),
        start: date(entry.start),
        end: entry.current ? "" : date(entry.end),
        current: Boolean(entry.current),
        bullets: list(entry.bullets, LIMITS.bullets).map((line) => String(line ?? "").replace(/\s+/g, " ").slice(0, LIMITS.bullet)),
    }));
    clean.education = keepBlank("education", (entry) => ({
        id: entryId(entry.id),
        qualification: text(entry.qualification, LIMITS.line),
        institution: text(entry.institution, LIMITS.line),
        location: text(entry.location),
        start: date(entry.start),
        end: date(entry.end),
        details: paragraph(entry.details, 600),
    }));
    clean.certifications = keepBlank("certifications", (entry) => ({
        id: entryId(entry.id),
        name: text(entry.name, LIMITS.line),
        issuer: text(entry.issuer),
        year: date(entry.year).slice(0, 4),
    }));
    clean.projects = keepBlank("projects", (entry) => ({
        id: entryId(entry.id),
        name: text(entry.name),
        link: text(entry.link, LIMITS.line),
        description: paragraph(entry.description, 700),
    }));
    clean.languages = keepBlank("languages", (entry) => ({
        id: entryId(entry.id),
        name: text(entry.name, 60),
        level: oneOf(entry.level, LANGUAGE_LEVELS, ""),
    }));
    clean.references.items = list(source.references?.items, LIMITS.references).map((entry) => ({
        id: entryId(entry?.id),
        name: text(entry?.name),
        position: text(entry?.position),
        organisation: text(entry?.organisation),
        email: text(entry?.email),
        phone: text(entry?.phone, 40),
    }));

    return clean;
};

const emptyContent = () => sanitizeContent({});

// --- Formatting -------------------------------------------------------------

const formatDate = (value) => {
    const [year, month] = String(value || "").split("-");
    if (!year) return "";
    return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
};

/** "Mar 2021 – Present", "2018 – 2022", or just "2022". */
const formatRange = (start, end, current = false) => {
    const from = formatDate(start);
    const to = current ? "Present" : formatDate(end);
    if (from && to) return `${from} – ${to}`;
    return from ? (current ? `${from} – Present` : from) : to;
};

/**
 * Printable form of a URL. The scheme is dropped only where the rest still
 * reads as a link to a parser — "www." or a LinkedIn/GitHub address — so
 * "ama.dev" prints as "https://ama.dev" and "https://www.ama.dev" as
 * "www.ama.dev".
 */
const displayUrl = (value) => {
    const url = String(value || "").trim().replace(/\/+$/, "");
    if (!url) return "";
    const bare = url.replace(/^https?:\/\//i, "");
    if (/^(?:www\.)?(?:linkedin|github)\.com\//i.test(bare)) return bare.replace(/^www\./i, "");
    if (/^www\./i.test(bare)) return bare;
    return /^https?:\/\//i.test(url) ? url : `https://${bare}`;
};

const hrefFor = (value) => {
    const url = String(value || "").trim();
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

// --- Prefill ----------------------------------------------------------------

const MONTH_INDEX = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Read a date the resume analyser lifted from free text — "Jan 2020",
 * "01/2020", "2020", "Present" — into the builder's own form.
 */
const parseLooseDate = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return { value: "", current: false };
    if (/present|current|date|now|ongoing/.test(raw)) return { value: "", current: true };

    const year = /(19|20)\d{2}/.exec(raw)?.[0];
    if (!year) return { value: "", current: false };

    const named = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*/.exec(raw)?.[1];
    const numeric = /\b(\d{1,2})[/.-](?:19|20)\d{2}\b/.exec(raw)?.[1];
    const month = named ? MONTH_INDEX[named] : numeric ? Number(numeric) : null;

    return {
        value: month && month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : year,
        current: false,
    };
};

/**
 * A first draft built from what the platform already knows about the
 * candidate: their account, their matching profile, and the profile the
 * resume analyser read from their latest CV. Nothing is invented — a field
 * the platform does not know is left for the candidate to fill in.
 */
const prefillContent = ({ user = {}, candidateProfile = null, analysisProfile = null } = {}) => {
    const analysed = analysisProfile || {};
    const profile = candidateProfile || {};

    const experience = (Array.isArray(analysed.experience) ? analysed.experience : []).map((role) => {
        const start = parseLooseDate(role?.start);
        const end = parseLooseDate(role?.end);
        return {
            title: role?.title,
            employer: role?.company,
            start: start.value,
            end: end.value,
            current: end.current,
            bullets: Array.isArray(role?.highlights) ? role.highlights : [],
        };
    });

    const education = (Array.isArray(analysed.education) ? analysed.education : []).map((entry) => {
        const degree = String(entry?.degree || "").trim();
        const field = String(entry?.field || "").trim();
        const qualification = field && !degree.toLowerCase().includes(field.toLowerCase())
            ? [degree, field].filter(Boolean).join(degree ? " in " : "")
            : degree || field;
        return {
            qualification,
            institution: entry?.institution,
            end: parseLooseDate(entry?.year).value,
        };
    });

    const skills = [
        ...(Array.isArray(analysed.skills) ? analysed.skills : []),
        ...(Array.isArray(profile.skills) ? profile.skills : []),
    ].slice(0, 20);

    const certifications = [
        ...(Array.isArray(analysed.certifications) ? analysed.certifications : []),
        ...(Array.isArray(profile.certifications) ? profile.certifications : []),
    ].map((name) => ({ name }));

    const languages = (Array.isArray(analysed.languages) ? analysed.languages : []).map((name) => ({ name }));

    const draft = sanitizeContent({
        personal: {
            fullName: analysed.fullName || user.name,
            headline: analysed.headline || profile.headline || profile.targetRoles?.[0],
            email: user.email || analysed.email,
            phone: analysed.phone,
            location: analysed.location || profile.location,
        },
        summary: analysed.summary,
        experience,
        education,
        skills,
        certifications,
        languages,
    });

    // Certifications arrive from two sources and are often the same one twice.
    const seen = new Set();
    draft.certifications = draft.certifications.filter((entry) => {
        const key = entry.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return draft;
};

// --- Plain text -------------------------------------------------------------

/** The CV as plain text, for the AI writer's prompts. */
const toPlainText = (raw) => {
    const content = sanitizeContent(raw);
    const { personal } = content;
    const lines = [personal.fullName, personal.headline].filter(Boolean);

    for (const key of content.sections) {
        if (key === "summary" && content.summary) lines.push("", "SUMMARY", content.summary);
        if (key === "experience" && content.experience.length) {
            lines.push("", "WORK EXPERIENCE");
            for (const role of content.experience) {
                lines.push([role.title, role.employer, formatRange(role.start, role.end, role.current)].filter(Boolean).join(" | "));
                role.bullets.forEach((line) => lines.push(`- ${line}`));
            }
        }
        if (key === "education" && content.education.length) {
            lines.push("", "EDUCATION");
            content.education.forEach((entry) =>
                lines.push([entry.qualification, entry.institution, formatRange(entry.start, entry.end)].filter(Boolean).join(" | ")));
        }
        if (key === "skills" && content.skills.length) lines.push("", "SKILLS", content.skills.join(", "));
        if (key === "certifications" && content.certifications.length) {
            lines.push("", "CERTIFICATIONS");
            content.certifications.forEach((entry) => lines.push([entry.name, entry.issuer, entry.year].filter(Boolean).join(", ")));
        }
        if (key === "projects" && content.projects.length) {
            lines.push("", "PROJECTS");
            content.projects.forEach((entry) => lines.push([entry.name, entry.description].filter(Boolean).join(": ")));
        }
    }

    return lines.join("\n").trim();
};

module.exports = {
    TEMPLATES,
    ACCENTS,
    SECTION_KEYS,
    LANGUAGE_LEVELS,
    LIMITS,
    sanitizeContent,
    sanitizeDraft,
    emptyContent,
    prefillContent,
    parseLooseDate,
    formatDate,
    formatRange,
    displayUrl,
    hrefFor,
    toPlainText,
};
