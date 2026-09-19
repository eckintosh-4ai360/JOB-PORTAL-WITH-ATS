/**
 * In-memory rate limiter for the AI endpoints.
 *
 * Every AI route costs a Groq call, so they need a ceiling that the rest of the
 * API does not. Keyed by user id when authenticated and by IP for guests, since
 * the public resume analyzer is the most abusable surface.
 *
 * This is per-process state. It is the right tool for a single Node instance;
 * behind multiple replicas it would need to move to Redis.
 */

const buckets = new Map();

// Sweep expired buckets so a long-running process does not grow unbounded.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}, SWEEP_INTERVAL_MS);
// Do not hold the event loop open on shutdown.
if (typeof sweeper.unref === "function") sweeper.unref();

const clientKey = (req) => {
    if (req.user?._id) return `user:${req.user._id}`;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || "")
        .split(",")[0]
        .trim() || req.ip || req.socket?.remoteAddress || "unknown";
    return `ip:${ip}`;
};

/**
 * @param {object} options
 * @param {number} options.windowMs
 * @param {number} options.max            limit for authenticated users
 * @param {number} [options.guestMax]     tighter limit for unauthenticated callers
 * @param {string} [options.scope]        so different routes get separate budgets
 */
const aiRateLimit = ({ windowMs = 60 * 60 * 1000, max = 30, guestMax = null, scope = "ai" } = {}) => {
    return (req, res, next) => {
        // A configured bypass is useful for load testing and for trusted crons.
        if (process.env.AI_RATE_LIMIT_DISABLED === "true") return next();

        const isGuest = !req.user?._id;
        const limit = isGuest && guestMax !== null ? guestMax : max;
        const key = `${scope}:${clientKey(req)}`;
        const now = Date.now();

        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        if (bucket.count >= limit) {
            const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            res.set("Retry-After", String(retryAfterSec));
            res.set("X-RateLimit-Limit", String(limit));
            res.set("X-RateLimit-Remaining", "0");
            return res.status(429).json({
                message: isGuest
                    ? "You have reached the free analysis limit. Sign in to keep analysing resumes."
                    : "You have reached the AI request limit for now. Please try again shortly.",
                retryAfterSeconds: retryAfterSec,
            });
        }

        bucket.count += 1;
        res.set("X-RateLimit-Limit", String(limit));
        res.set("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));

        next();
    };
};

/** Test/ops helper — clears all buckets. */
const resetRateLimits = () => buckets.clear();

module.exports = aiRateLimit;
module.exports.aiRateLimit = aiRateLimit;
module.exports.resetRateLimits = resetRateLimits;
