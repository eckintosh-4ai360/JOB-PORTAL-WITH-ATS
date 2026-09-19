/**
 * Groq chat-completion client.
 *
 * Thin wrapper over the Groq OpenAI-compatible REST endpoint. Node 18+ ships a
 * global fetch, so no HTTP dependency is needed here.
 *
 * `openai/gpt-oss-120b` is the strongest text model exposed on Groq's catalogue
 * (120B params, 131k context, native JSON/structured output + reasoning), so it
 * is the default for every AI feature in this portal. Override with GROQ_MODEL.
 */

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 60000);
const MAX_RETRIES = Number(process.env.GROQ_MAX_RETRIES || 2);

/** Errors raised by this module so callers can degrade gracefully. */
class GroqError extends Error {
    constructor(message, { status = null, retryable = false, cause = null } = {}) {
        super(message);
        this.name = "GroqError";
        this.status = status;
        this.retryable = retryable;
        this.cause = cause;
    }
}

const isConfigured = () => Boolean(process.env.GROQ_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Models in the gpt-oss family emit an internal reasoning trace. It is useful
 * for debugging but must never be shown to a candidate or employer, so it is
 * stripped before the payload leaves this module.
 */
const stripReasoning = (raw) => {
    if (typeof raw !== "string") return "";
    return raw
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\|channel\|>analysis[\s\S]*?<\|message\|>/gi, "")
        .trim();
};

/**
 * Pull the first balanced JSON object/array out of a model response. JSON mode
 * is reliable but not guaranteed — a model can still wrap output in a fence or
 * prepend a sentence, and a single malformed reply should not fail a request.
 */
const extractJson = (text) => {
    const cleaned = stripReasoning(text)
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    if (!cleaned) return null;

    try {
        return JSON.parse(cleaned);
    } catch {
        // Fall through to brace scanning.
    }

    const start = cleaned.search(/[[{]/);
    if (start === -1) return null;

    const opener = cleaned[start];
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i += 1) {
        const char = cleaned[i];

        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (char === opener) depth += 1;
        else if (char === closer) {
            depth -= 1;
            if (depth === 0) {
                try {
                    return JSON.parse(cleaned.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }

    return null;
};

/**
 * POST /chat/completions with retry on transient failures.
 *
 * @param {object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {boolean} [options.json] request a JSON object response
 * @param {"low"|"medium"|"high"} [options.reasoningEffort]
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
const chat = async ({
    messages,
    model = GROQ_MODEL,
    temperature = 0.2,
    maxTokens = 4096,
    json = false,
    reasoningEffort = process.env.GROQ_REASONING_EFFORT || "medium",
} = {}) => {
    if (!isConfigured()) {
        throw new GroqError("GROQ_API_KEY is not configured on the server", { status: 503 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new GroqError("messages must be a non-empty array");
    }

    const body = {
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        reasoning_effort: reasoningEffort,
    };
    if (json) {
        body.response_format = { type: "json_object" };
    }

    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => "");
                const retryable = response.status === 429 || response.status >= 500;
                const error = new GroqError(
                    `Groq request failed (${response.status}): ${detail.slice(0, 400)}`,
                    { status: response.status, retryable }
                );
                // Groq rejects its own output when JSON mode produces something
                // incomplete — almost always because reasoning ate the token
                // budget. Flagged so chatJson can retry differently rather than
                // giving up on a 400.
                error.jsonValidateFailed = detail.includes("json_validate_failed");
                throw error;
            }

            const payload = await response.json();
            const choice = payload.choices?.[0];

            return {
                content: stripReasoning(choice?.message?.content || ""),
                finishReason: choice?.finish_reason || null,
                model: payload.model || model,
                usage: payload.usage || {},
            };
        } catch (error) {
            lastError = error;

            const aborted = error.name === "AbortError";
            const retryable = aborted || error.retryable || error instanceof TypeError;
            if (!retryable || attempt === MAX_RETRIES) break;

            // Exponential backoff with jitter keeps bursts of concurrent
            // applicant scoring from hammering a rate-limited endpoint.
            await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
        } finally {
            clearTimeout(timer);
        }
    }

    if (lastError?.name === "AbortError") {
        throw new GroqError(`Groq request timed out after ${REQUEST_TIMEOUT_MS}ms`, {
            status: 504,
            cause: lastError,
        });
    }
    throw lastError instanceof GroqError
        ? lastError
        : new GroqError(`Groq request failed: ${lastError?.message || "unknown error"}`, {
            cause: lastError,
        });
};

/**
 * Ask the model for a JSON object and return it parsed.
 *
 * Falls back to the smaller gpt-oss-20b once if the flagship model returns
 * unparseable output, which keeps a feature alive rather than surfacing an
 * error page to the user.
 *
 * @param {object} options same shape as `chat`, plus `schemaHint`
 * @returns {Promise<{data: object, model: string, usage: object}>}
 */
const chatJson = async ({ system, user, schemaHint, ...rest } = {}) => {
    const messages = [
        {
            role: "system",
            content: schemaHint
                ? `${system}\n\nReturn ONLY a single valid JSON object matching this shape — no prose, no markdown fences:\n${schemaHint}`
                : system,
        },
        { role: "user", content: user },
    ];

    const primaryModel = rest.model || GROQ_MODEL;
    const baseTokens = rest.maxTokens || 4096;

    /**
     * Escalating attempts. Strict JSON mode first; if the model overruns its
     * budget, retry with a bigger budget and lighter reasoning, then without
     * JSON mode at all (extractJson copes with fences and stray prose), and
     * finally on the smaller model.
     */
    const attempts = [
        { model: primaryModel, json: true, maxTokens: baseTokens },
        {
            model: primaryModel,
            json: true,
            maxTokens: Math.min(32000, Math.round(baseTokens * 2)),
            reasoningEffort: "low",
        },
        {
            model: primaryModel,
            json: false,
            maxTokens: Math.min(32000, Math.round(baseTokens * 2)),
            reasoningEffort: "low",
        },
    ];
    if (GROQ_FALLBACK_MODEL && GROQ_FALLBACK_MODEL !== primaryModel) {
        attempts.push({ model: GROQ_FALLBACK_MODEL, json: true, maxTokens: baseTokens });
    }

    let lastError = null;

    for (const attempt of attempts) {
        try {
            const result = await chat({ ...rest, ...attempt, messages });
            const data = extractJson(result.content);

            if (!data) {
                throw new GroqError(
                    result.finishReason === "length"
                        ? "Model output was truncated before valid JSON was produced"
                        : "Model returned a response that was not valid JSON",
                    { status: 502 }
                );
            }

            return { data, model: result.model, usage: result.usage, finishReason: result.finishReason };
        } catch (error) {
            lastError = error;
            // A missing key or a timeout will not be fixed by trying again.
            if (error.status === 503 || error.status === 504) break;
        }
    }

    throw lastError;
};

module.exports = {
    chat,
    chatJson,
    extractJson,
    stripReasoning,
    isConfigured,
    GroqError,
    GROQ_MODEL,
};
