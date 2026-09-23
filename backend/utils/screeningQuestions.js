/**
 * Employer-specific screening questions asked at the moment of applying, and
 * the answers given to them.
 *
 * Questions live on the job. Answers are stored on the application together
 * with the question as it was asked, so an employer rewording a question later
 * never changes what an earlier applicant appears to have said.
 */

// `salary` is a number, kept separate so it can be prefilled from the
// candidate's stated expectation.
const QUESTION_TYPES = ["text", "number", "salary", "yes_no", "choice", "date"];

const MAX_QUESTIONS = 10;
const MAX_PROMPT_LENGTH = 200;
const MAX_OPTIONS = 10;
const MAX_TEXT_ANSWER = 1000;

const slugify = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

/**
 * Check an employer's question list. Returns `{ questions }` (an empty list
 * clears them) or `{ error }`.
 */
const validateQuestions = (input) => {
    if (input === null || input === undefined || input === "") return { questions: [] };

    let list = input;
    if (typeof list === "string") {
        try {
            list = JSON.parse(list);
        } catch {
            return { error: "Screening questions could not be read." };
        }
    }
    if (!Array.isArray(list)) return { error: "Screening questions must be a list." };
    if (list.length > MAX_QUESTIONS) {
        return { error: `Ask at most ${MAX_QUESTIONS} screening questions — every one slows the application down.` };
    }

    const questions = [];
    const ids = new Set();

    for (const [index, raw] of list.entries()) {
        const prompt = String(raw?.prompt || "").trim().replace(/\s+/g, " ");
        if (!prompt) return { error: `Screening question ${index + 1} is empty.` };
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return { error: `Screening question ${index + 1} is too long (${MAX_PROMPT_LENGTH} characters at most).` };
        }

        const type = QUESTION_TYPES.includes(raw?.type) ? raw.type : "text";

        let options = [];
        if (type === "choice") {
            options = [...new Set(
                (Array.isArray(raw?.options) ? raw.options : [])
                    .map((option) => String(option).trim())
                    .filter(Boolean)
            )].slice(0, MAX_OPTIONS);
            if (options.length < 2) {
                return { error: `"${prompt}" needs at least two answers to choose from.` };
            }
        }

        let id = slugify(raw?.id) || `q${index + 1}`;
        while (ids.has(id)) id = `${id}_${index + 1}`;
        ids.add(id);

        questions.push({ id, prompt, type, required: raw?.required !== false, options });
    }

    return { questions };
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

/** One answer, coerced to its question's type, or an error string. */
const coerceAnswer = (question, value) => {
    switch (question.type) {
        case "number":
        case "salary": {
            const n = Number(String(value).replace(/,/g, ""));
            if (!Number.isFinite(n) || n < 0) return { error: "Enter a number." };
            if (n > 1e9) return { error: "That number is too large." };
            return { answer: n };
        }
        case "yes_no": {
            if (value === true || value === "yes" || value === "true") return { answer: true };
            if (value === false || value === "no" || value === "false") return { answer: false };
            return { error: "Answer yes or no." };
        }
        case "choice": {
            const choice = String(value).trim();
            if (!question.options.includes(choice)) return { error: "Pick one of the listed answers." };
            return { answer: choice };
        }
        case "date": {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return { error: "Enter a valid date." };
            return { answer: date.toISOString().slice(0, 10) };
        }
        default: {
            const text = String(value).trim();
            if (text.length > MAX_TEXT_ANSWER) {
                return { error: `Keep this under ${MAX_TEXT_ANSWER} characters.` };
            }
            return { answer: text };
        }
    }
};

/**
 * Check a candidate's answers against the job's questions. Takes the raw
 * `{ [questionId]: value }` map (or its JSON string, since applications arrive
 * as multipart form data) and returns `{ answers }` ready to store, or
 * `{ errors: { [questionId]: message } }`.
 */
const validateAnswers = (questions, input) => {
    if (!questions?.length) return { answers: [] };

    let given = input || {};
    if (typeof given === "string") {
        try {
            given = JSON.parse(given);
        } catch {
            given = {};
        }
    }
    if (typeof given !== "object" || Array.isArray(given)) given = {};

    const answers = [];
    const errors = {};

    for (const question of questions) {
        const value = given[question.id];

        if (isBlank(value)) {
            if (question.required) errors[question.id] = "This question needs an answer.";
            continue;
        }

        const { answer, error } = coerceAnswer(question, value);
        if (error) {
            errors[question.id] = error;
            continue;
        }

        answers.push({ questionId: question.id, prompt: question.prompt, type: question.type, answer });
    }

    return Object.keys(errors).length > 0 ? { errors } : { answers };
};

/** Prompts compared loosely, so "Can you start?" and "can you start" match. */
const promptKey = (prompt) => String(prompt || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

module.exports = {
    QUESTION_TYPES,
    MAX_QUESTIONS,
    validateQuestions,
    validateAnswers,
    promptKey,
};
