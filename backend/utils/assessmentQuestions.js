/**
 * Assessment questions: what an employer may write, what a candidate is shown,
 * and how answers are marked.
 *
 * Question shape:
 *   { id, type, prompt, options: [{ id, text }], correct: [optionId],
 *     points, guidance }
 *
 *   single   — one right option, marked automatically
 *   multiple — every right option and nothing else, marked automatically
 *   short    — a sentence or two, marked by the employer
 *   long     — a written answer, marked by the employer
 *
 * `correct` and `guidance` are the answer key. They are stripped from anything
 * a candidate receives.
 */

const QUESTION_TYPES = ["single", "multiple", "short", "long"];
const CHOICE_TYPES = new Set(["single", "multiple"]);

const LIMITS = {
    questions: 50,
    prompt: 1000,
    option: 300,
    minOptions: 2,
    maxOptions: 8,
    guidance: 1000,
    maxPoints: 100,
    shortAnswer: 1000,
    longAnswer: 6000,
    title: 120,
    instructions: 3000,
    note: 500,
};

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

const slug = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const isChoice = (question) => CHOICE_TYPES.has(question.type);

/**
 * Check an employer's question list. Returns `{ questions }` or `{ error }`.
 * Ids are kept when supplied so a question keeps its identity across edits.
 */
const validateQuestions = (input) => {
    if (!Array.isArray(input) || input.length === 0) {
        return { error: "Add at least one question." };
    }
    if (input.length > LIMITS.questions) {
        return { error: `An assessment can have at most ${LIMITS.questions} questions.` };
    }

    const questions = [];
    const ids = new Set();

    for (const [index, raw] of input.entries()) {
        const label = `Question ${index + 1}`;
        const type = QUESTION_TYPES.includes(raw?.type) ? raw.type : null;
        if (!type) return { error: `${label} needs a question type.` };

        const prompt = clean(raw.prompt, LIMITS.prompt);
        if (!prompt) return { error: `${label} is empty.` };

        const points = Math.round(Number(raw.points));
        if (!Number.isFinite(points) || points < 1 || points > LIMITS.maxPoints) {
            return { error: `${label} must be worth between 1 and ${LIMITS.maxPoints} points.` };
        }

        let id = slug(raw.id) || `q${index + 1}`;
        while (ids.has(id)) id = `${id}_${index + 1}`;
        ids.add(id);

        const question = { id, type, prompt, points, guidance: clean(raw.guidance, LIMITS.guidance), options: [], correct: [] };

        if (isChoice(question)) {
            const optionIds = new Set();
            for (const [optionIndex, option] of (Array.isArray(raw.options) ? raw.options : []).entries()) {
                const text = clean(option?.text, LIMITS.option);
                if (!text) continue;
                let optionId = slug(option?.id) || `o${optionIndex + 1}`;
                while (optionIds.has(optionId)) optionId = `${optionId}_${optionIndex + 1}`;
                optionIds.add(optionId);
                question.options.push({ id: optionId, text });
            }
            if (question.options.length < LIMITS.minOptions || question.options.length > LIMITS.maxOptions) {
                return { error: `${label} needs between ${LIMITS.minOptions} and ${LIMITS.maxOptions} answer options.` };
            }

            // Correct answers may arrive as option ids or as option positions.
            const wanted = (Array.isArray(raw.correct) ? raw.correct : [])
                .map((entry) => (typeof entry === "number" ? question.options[entry]?.id : slug(entry)))
                .filter((entry) => optionIds.has(entry));
            question.correct = [...new Set(wanted)];

            if (type === "single" && question.correct.length !== 1) {
                return { error: `${label} needs exactly one correct answer.` };
            }
            if (type === "multiple" && question.correct.length < 1) {
                return { error: `${label} needs at least one correct answer.` };
            }
        }

        questions.push(question);
    }

    return { questions };
};

/** Settings around the questions. Returns `{ data }` or `{ error }`. */
const validateAssessment = (body) => {
    const title = clean(body?.title, LIMITS.title);
    if (title.length < 3) return { error: "Give the assessment a title." };

    const { questions, error } = validateQuestions(body?.questions);
    if (error) return { error };

    let timeLimitMinutes = null;
    if (body?.timeLimitMinutes !== null && body?.timeLimitMinutes !== undefined && body?.timeLimitMinutes !== "") {
        timeLimitMinutes = Math.round(Number(body.timeLimitMinutes));
        if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 5 || timeLimitMinutes > 240) {
            return { error: "A time limit must be between 5 and 240 minutes, or left empty for an untimed test." };
        }
    }

    const passMark = Math.round(Number(body?.passMark ?? 60));
    if (!Number.isFinite(passMark) || passMark < 0 || passMark > 100) {
        return { error: "The pass mark must be between 0 and 100%." };
    }

    const defaultDueDays = Math.round(Number(body?.defaultDueDays ?? 7));
    if (!Number.isFinite(defaultDueDays) || defaultDueDays < 1 || defaultDueDays > 30) {
        return { error: "Candidates need between 1 and 30 days to complete it." };
    }

    return {
        data: {
            title,
            instructions: clean(body?.instructions, LIMITS.instructions) || null,
            questions,
            timeLimitMinutes,
            passMark,
            defaultDueDays,
        },
    };
};

const maxScoreOf = (questions) => questions.reduce((sum, question) => sum + question.points, 0);

/** What a candidate sees: no answer key, no scoring guidance. */
const forCandidate = (questions) =>
    questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        options: isChoice(question) ? question.options.map(({ id, text }) => ({ id, text })) : [],
        // A multiple-answer question says so, or it would be a trick.
        selectMany: question.type === "multiple",
    }));

/**
 * Keep only well-formed answers to questions that exist. Returns
 * `{ [questionId]: value }` — option id, list of option ids, or text.
 */
const cleanAnswers = (questions, input) => {
    const given = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const cleaned = {};

    for (const question of questions) {
        if (!(question.id in given)) continue;
        const value = given[question.id];
        const optionIds = new Set(question.options.map((option) => option.id));

        if (question.type === "single") {
            if (value === null || value === "") cleaned[question.id] = null;
            else if (optionIds.has(value)) cleaned[question.id] = value;
        } else if (question.type === "multiple") {
            if (Array.isArray(value)) cleaned[question.id] = [...new Set(value.filter((id) => optionIds.has(id)))];
        } else {
            const max = question.type === "long" ? LIMITS.longAnswer : LIMITS.shortAnswer;
            cleaned[question.id] = String(value ?? "").slice(0, max);
        }
    }

    return cleaned;
};

const sameSet = (a, b) => a.length === b.length && a.every((item) => b.includes(item));

/** Points for a choice question, or null for a written one. */
const autoPoints = (question, value) => {
    if (question.type === "single") return value && value === question.correct[0] ? question.points : 0;
    if (question.type === "multiple") {
        return Array.isArray(value) && sameSet(value, question.correct) ? question.points : 0;
    }
    return null;
};

/**
 * Turn saved values into marked answers. Choice questions are marked here;
 * written ones wait for the employer — except a blank one, which scores zero
 * without anyone having to read it.
 */
const markAnswers = (questions, values) => {
    const marked = {};
    for (const question of questions) {
        const value = values?.[question.id] ?? null;
        const auto = autoPoints(question, value);
        const blank = value === null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);
        marked[question.id] = {
            value,
            autoPoints: auto,
            points: auto !== null ? auto : blank ? 0 : null,
            note: "",
        };
    }
    return marked;
};

/** Totals, and whether anything is still waiting for the employer. */
const summarize = (questions, marked, passMark) => {
    let score = 0;
    let pending = 0;
    for (const question of questions) {
        const points = marked?.[question.id]?.points;
        if (points === null || points === undefined) pending += 1;
        else score += points;
    }
    const maxScore = maxScoreOf(questions);
    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return {
        score,
        maxScore,
        percent,
        pending,
        complete: pending === 0,
        passed: pending === 0 ? percent >= passMark : null,
    };
};

module.exports = {
    QUESTION_TYPES,
    LIMITS,
    isChoice,
    validateQuestions,
    validateAssessment,
    maxScoreOf,
    forCandidate,
    cleanAnswers,
    markAnswers,
    summarize,
};
