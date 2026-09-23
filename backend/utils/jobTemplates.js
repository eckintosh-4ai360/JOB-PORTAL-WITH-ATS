const prisma = require("../config/prisma");
const { validateQuestions } = require("./screeningQuestions");

/**
 * Reusable job adverts. A template holds what an employer would otherwise
 * retype for every opening of the same role — wording, skills, pay range,
 * screening questions — and nothing tied to one opening, like a deadline.
 */

const LIMITS = {
    name: 80,
    title: 120,
    description: 20000,
    requirements: 20000,
    location: 200,
    category: 100,
    type: 60,
    workModel: 30,
    tags: 30,
    tag: 60,
};

// Enough for every role an employer hires for, not a dumping ground.
const MAX_TEMPLATES = 100;

const clean = (value) => String(value ?? "").trim();

/** Optional short text: trimmed, or null when empty. */
const optionalText = (value, max, label) => {
    const text = clean(value).replace(/\s+/g, " ");
    if (!text) return { value: null };
    if (text.length > max) return { error: `${label} is too long (${max} characters at most).` };
    return { value: text };
};

const optionalNumber = (value, label, { min = -Infinity, max = Infinity } = {}) => {
    if (value === null || value === undefined || value === "") return { value: null };
    const n = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${label} is not a valid number.` };
    return { value: n };
};

/** Tags from a list or a comma-separated string, de-duplicated ignoring case. */
const readTags = (value) => {
    const list = Array.isArray(value) ? value : String(value ?? "").split(",");
    const seen = new Set();
    const tags = [];
    for (const raw of list) {
        const tag = clean(raw).replace(/\s+/g, " ");
        if (!tag || seen.has(tag.toLowerCase())) continue;
        if (tag.length > LIMITS.tag) return { error: `The skill "${tag.slice(0, 30)}…" is too long.` };
        seen.add(tag.toLowerCase());
        tags.push(tag);
    }
    if (tags.length > LIMITS.tags) return { error: `List at most ${LIMITS.tags} skills.` };
    return { tags };
};

/**
 * Check a template from the editor or the posting form. Returns `{ data }`
 * ready to write, or `{ error }`.
 */
const validateTemplate = (input) => {
    const body = input && typeof input === "object" ? input : {};

    const name = clean(body.name).replace(/\s+/g, " ");
    if (!name) return { error: "Give the template a name." };
    if (name.length > LIMITS.name) return { error: `Keep the template name under ${LIMITS.name} characters.` };

    const title = clean(body.title).replace(/\s+/g, " ");
    if (!title) return { error: "A template needs a job title." };
    if (title.length > LIMITS.title) return { error: `Keep the job title under ${LIMITS.title} characters.` };

    const description = clean(body.description);
    if (!description) return { error: "A template needs a job description." };
    if (description.length > LIMITS.description) return { error: "The job description is too long." };

    const requirements = clean(body.requirements);
    if (requirements.length > LIMITS.requirements) return { error: "The requirements are too long." };

    const fields = {};
    for (const [key, label] of [
        ["location", "The location"],
        ["category", "The department"],
        ["type", "The job type"],
        ["workModel", "The work model"],
    ]) {
        const { value, error } = optionalText(body[key], LIMITS[key], label);
        if (error) return { error };
        fields[key] = value;
    }

    const latitude = optionalNumber(body.latitude, "The latitude", { min: -90, max: 90 });
    const longitude = optionalNumber(body.longitude, "The longitude", { min: -180, max: 180 });
    if (latitude.error || longitude.error) return { error: latitude.error || longitude.error };
    // A pin is only useful as a pair.
    const hasPin = latitude.value !== null && longitude.value !== null;

    const salaryMin = optionalNumber(body.salaryMin, "The minimum pay", { min: 0, max: 1e9 });
    const salaryMax = optionalNumber(body.salaryMax, "The maximum pay", { min: 0, max: 1e9 });
    if (salaryMin.error || salaryMax.error) return { error: salaryMin.error || salaryMax.error };
    // The posting form sends 0 for an empty pay field.
    const min = salaryMin.value || null;
    const max = salaryMax.value || null;
    if (min !== null && max !== null && min > max) {
        return { error: "The minimum pay is higher than the maximum." };
    }

    const { tags, error: tagsError } = readTags(body.tags);
    if (tagsError) return { error: tagsError };

    const screening = validateQuestions(body.screeningQuestions);
    if (screening.error) return { error: screening.error };

    return {
        data: {
            name,
            title,
            description,
            requirements,
            ...fields,
            latitude: hasPin ? latitude.value : null,
            longitude: hasPin ? longitude.value : null,
            salaryMin: min,
            salaryMax: max,
            tags,
            screeningQuestions: screening.questions.length ? screening.questions : null,
        },
    };
};

/** A template's fields taken from one of the employer's job adverts. */
const templateFromJob = (job, name) => ({
    name: name || job.title,
    title: job.title,
    description: job.description,
    requirements: job.requirements || "",
    location: job.location,
    latitude: job.latitude,
    longitude: job.longitude,
    category: job.category,
    type: job.type || job.jobType,
    workModel: job.workModel,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    tags: job.tags || [],
    screeningQuestions: job.screeningQuestions || [],
});

/**
 * Count a posting published from a template. Called after the job is saved and
 * never awaited by the response — a usage count is not worth failing a post.
 * Returns the write, so a caller that does want to wait can.
 */
const recordTemplateUse = (templateId, employerId) => {
    if (!templateId || typeof templateId !== "string") return Promise.resolve();
    return prisma.jobTemplate
        .updateMany({
            where: { id: templateId, employerId },
            data: { timesUsed: { increment: 1 }, lastUsedAt: new Date() },
        })
        .catch((error) => console.warn("Could not record template use:", error.message));
};

module.exports = {
    LIMITS,
    MAX_TEMPLATES,
    validateTemplate,
    templateFromJob,
    recordTemplateUse,
};
