/**
 * Screening questions as the job posting form edits them. The API shape is
 * `{ id, prompt, type, required, options }`; the editor adds a stable `key`
 * so rows keep their identity while being reordered or before they have an id.
 */

export const MAX_SCREENING_QUESTIONS = 10;

let draftCounter = 0;
export const newQuestionKey = () => {
  draftCounter += 1;
  return `draft_${Date.now().toString(36)}_${draftCounter}`;
};

/** Stored questions → editor rows. */
export const toEditorQuestions = (questions) =>
  (Array.isArray(questions) ? questions : []).map((question) => ({
    ...question,
    options: question.options || [],
    key: question.id || newQuestionKey(),
  }));

/** Editor rows → what the API stores. Blank prompts are dropped. */
export const toPayloadQuestions = (questions) =>
  questions
    .filter((question) => question.prompt.trim())
    .map((question) => {
      const payload = { ...question };
      delete payload.key;
      return {
        ...payload,
        prompt: question.prompt.trim(),
        options:
          question.type === "choice" ? question.options.map((option) => option.trim()).filter(Boolean) : [],
      };
    });
