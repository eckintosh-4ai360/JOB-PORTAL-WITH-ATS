/**
 * Job update subscriptions — the platform writing to candidates about roles
 * they have not seen yet.
 *
 * Three rules shape everything here:
 *
 *  1. Nobody is mailed without a record of them asking. A subscription row is
 *     that record, and `unsubscribedAt` is how it is withdrawn.
 *  2. A role is never sent twice. Each subscription keeps a cursor
 *     (`lastJobAt`) at the newest role already delivered, and it only moves
 *     past roles the mail server accepted.
 *  3. An empty digest is never sent. No new roles means no email, which is
 *     the difference between a useful alert and noise people learn to ignore.
 */

const crypto = require("crypto");
const prisma = require("../config/prisma");
const {
    sendJobAlertDigestEmail,
    sendJobAlertsSubscribedEmail,
} = require("../utils/emailService");

/** How often a digest may go out, per cadence. */
const CADENCES = {
    // A shade under a day and a week, so a run that starts a few minutes late
    // never pushes a subscriber's mail to the following day.
    daily: 20 * 60 * 60 * 1000,
    weekly: 6.5 * 24 * 60 * 60 * 1000,
};

const DEFAULT_FREQUENCY = "weekly";

/** Roles per email. Beyond this the digest says how many more are waiting. */
const MAX_JOBS_PER_EMAIL = 12;

/** Resend accepts a couple of messages a second; this keeps a run inside that. */
const SEND_GAP_MS = 180;

/**
 * The same conditions the public job list uses (see jobController.getAllJobs):
 * open, not soft-deleted, and not hidden by moderation. `flagged` stays in on
 * purpose — a false positive must not silently drop a real advert.
 */
const LIVE_JOB = {
    isClosed: false,
    moderationState: { not: "hidden" },
    deletedAt: null,
};

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

/**
 * Where the unsubscribe link points. The API serves it rather than the SPA:
 * leaving must work from an email client in one click, with no login and no
 * JavaScript, so it cannot depend on the front end being reachable.
 */
const apiUrl = () => (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 8000}`)
    .replace(/\/+$/, "");

const unsubscribeUrl = (token) => `${apiUrl()}/api/job-alerts/unsubscribe?token=${encodeURIComponent(token)}`;

const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

const normaliseFrequency = (frequency) => (
    Object.prototype.hasOwnProperty.call(CADENCES, String(frequency))
        ? String(frequency)
        : DEFAULT_FREQUENCY
);

/** A short list of trimmed, unique, non-empty strings. */
const asList = (value, limit) => (
    Array.isArray(value)
        ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit)
        : []
);

const newToken = () => crypto.randomBytes(24).toString("hex");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------------------------------------------------------------------------
// Recording consent
// ---------------------------------------------------------------------------

/**
 * Record what someone decided about job updates.
 *
 * `agreed: false` still writes a row — a declined subscription. That is what
 * lets the candidate-facing prompt know the question has been answered, so
 * nobody is asked twice.
 *
 * Keyed on the address, so subscribing from the footer and later signing up
 * with the same address lands on one subscription rather than two.
 */
const recordConsent = async ({
    email,
    name,
    userId = null,
    agreed = true,
    frequency,
    categories,
    locations,
    source = "signup",
}) => {
    const address = normaliseEmail(email);
    if (!isValidEmail(address)) {
        const error = new Error("A valid email address is required");
        error.status = 400;
        throw error;
    }

    const existing = await prisma.jobAlertSubscription.findUnique({ where: { email: address } });

    // An address already tied to another account is left alone: linking it
    // would hand one person's subscription to a different signed-in user.
    const linkable = !existing?.userId || !userId || existing.userId === userId;

    const data = {
        name: name?.trim() || existing?.name || null,
        frequency: normaliseFrequency(frequency ?? existing?.frequency),
        unsubscribedAt: agreed ? null : (existing?.unsubscribedAt || new Date()),
    };

    if (userId && linkable) data.userId = userId;
    if (categories !== undefined) data.categories = asList(categories, 12);
    if (locations !== undefined) data.locations = asList(locations, 12);

    // Subscribing afresh starts the cursor from now: the roles posted before
    // someone asked for updates are not news to them, they are the board.
    if (agreed && existing?.unsubscribedAt) {
        data.lastJobAt = null;
        data.source = source;
    }

    const subscription = existing
        ? await prisma.jobAlertSubscription.update({ where: { email: address }, data })
        : await prisma.jobAlertSubscription.create({
            data: {
                email: address,
                source,
                unsubscribeToken: newToken(),
                categories: asList(categories, 12),
                locations: asList(locations, 12),
                ...data,
            },
        });

    // Confirm only a fresh "yes". Saving preferences on an existing
    // subscription is not news, and re-confirming it reads like a bug.
    const isNewYes = agreed && (!existing || existing.unsubscribedAt);
    if (isNewYes) {
        sendJobAlertsSubscribedEmail({
            to: subscription.email,
            name: subscription.name,
            cadence: subscription.frequency,
            browseUrl: `${frontendUrl()}/find-jobs`,
            unsubscribeUrl: unsubscribeUrl(subscription.unsubscribeToken),
        }).catch((error) => console.warn("Job alert confirmation failed:", error.message));
    }

    return subscription;
};

/**
 * The subscription for a signed-in user, by account or by address.
 *
 * Matching on the address too is what makes an account inherit a subscription
 * started from the footer before they signed up.
 */
const findForUser = async (user) => {
    if (!user) return null;
    const userId = user._id || user.id;
    const subscription = await prisma.jobAlertSubscription.findFirst({
        where: { OR: [{ userId }, { email: normaliseEmail(user.email) }] },
    });

    if (!subscription) return null;

    // Adopt an unlinked row, so later reads find it by account.
    if (!subscription.userId) {
        return prisma.jobAlertSubscription
            .update({ where: { id: subscription.id }, data: { userId } })
            .catch(() => subscription);
    }

    // Addresses are unique on both tables, so a row matched by address should
    // never belong to somebody else. If one ever does, it is not this user's
    // to read or change.
    return subscription.userId === userId ? subscription : null;
};

const unsubscribeByToken = async (token) => {
    const subscription = await prisma.jobAlertSubscription.findUnique({
        where: { unsubscribeToken: String(token || "") },
    });
    if (!subscription) return null;
    if (subscription.unsubscribedAt) return subscription;

    return prisma.jobAlertSubscription.update({
        where: { id: subscription.id },
        data: { unsubscribedAt: new Date() },
    });
};

// ---------------------------------------------------------------------------
// Choosing what to send
// ---------------------------------------------------------------------------

/**
 * The roles this subscription has not been told about, newest first.
 *
 * `total` counts everything new; `jobs` is the capped selection that goes in
 * the email. The cap drops the oldest of the new roles rather than the newest,
 * because a digest is a heads-up, not an archive — the count tells them the
 * rest are on the board.
 */
const newJobsFor = async (subscription, now = new Date()) => {
    const since = subscription.lastJobAt || subscription.createdAt;

    const where = {
        ...LIVE_JOB,
        company: { isActive: true },
        createdAt: { gt: since },
        // An advert whose deadline has already passed is not an opportunity.
        AND: [{ OR: [{ deadline: null }, { deadline: { gte: now } }] }],
    };

    if (subscription.categories.length > 0) {
        where.category = { in: subscription.categories };
    }

    if (subscription.locations.length > 0) {
        // Remote roles qualify wherever someone is: the location they asked
        // for is about commuting, and a remote role has no commute.
        where.AND.push({
            OR: [
                ...subscription.locations.map((location) => ({
                    location: { contains: location, mode: "insensitive" },
                })),
                { workModel: { equals: "Remote", mode: "insensitive" } },
            ],
        });
    }

    const [total, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: MAX_JOBS_PER_EMAIL,
            select: {
                id: true,
                title: true,
                location: true,
                type: true,
                workModel: true,
                salaryMin: true,
                salaryMax: true,
                createdAt: true,
                companyLogo: true,
                company: { select: { name: true, companyName: true } },
                companyProfile: { select: { name: true, verified: true } },
            },
        }),
    ]);

    return { total, jobs };
};

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const companyNameOf = (job) => (
    job.companyProfile?.name || job.company?.companyName || job.company?.name || "A company"
);

const payLine = (job) => {
    const format = (value) => Number(value).toLocaleString("en-GB");
    if (job.salaryMin > 0 && job.salaryMax > 0) return `GH₵ ${format(job.salaryMin)} – ${format(job.salaryMax)}`;
    if (job.salaryMin > 0) return `From GH₵ ${format(job.salaryMin)}`;
    if (job.salaryMax > 0) return `Up to GH₵ ${format(job.salaryMax)}`;
    return "";
};

/**
 * The list of roles, as table-based HTML.
 *
 * Tables rather than flexbox because Outlook ignores modern layout, and inline
 * styles because most clients strip <style> blocks.
 */
const renderJobList = (jobs) => {
    const base = frontendUrl();

    const rows = jobs.map((job) => {
        const facts = [
            job.location,
            job.workModel,
            job.type,
            payLine(job),
        ].filter(Boolean).map(escapeHtml).join(" &nbsp;•&nbsp; ");

        return `
            <tr>
                <td style="padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
                    <a href="${base}/job/${encodeURIComponent(job.id)}" style="color: #1f2937; font-size: 16px; font-weight: bold; text-decoration: none;">${escapeHtml(job.title)}</a>
                    <div style="color: #2563eb; font-size: 14px; font-weight: bold; margin-top: 2px;">${escapeHtml(companyNameOf(job))}${job.companyProfile?.verified ? ' <span style="color: #059669; font-weight: normal;">&#10003; verified</span>' : ""}</div>
                    ${facts ? `<div style="color: #6b7280; font-size: 13px; margin-top: 6px;">${facts}</div>` : ""}
                </td>
            </tr>
            <tr><td style="height: 10px; line-height: 10px; font-size: 0;">&nbsp;</td></tr>
        `;
    }).join("");

    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">${rows}</table>`;
};

/** "And 14 more went up too." — or nothing, when the email held them all. */
const moreLineFor = (total, shown) => {
    const remaining = total - shown;
    if (remaining <= 0) return "";
    return `${remaining} more new ${remaining === 1 ? "role" : "roles"} did not fit in this email — they are waiting on the board.`;
};

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** Whether enough time has passed since this subscription's last digest. */
const isDue = (subscription, now = new Date()) => {
    const interval = CADENCES[normaliseFrequency(subscription.frequency)];
    const reference = subscription.lastSentAt || subscription.createdAt;
    return now.getTime() - new Date(reference).getTime() >= interval;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send one subscription's digest, if it has anything to say.
 *
 * The cursor moves only after the mail server accepted the message, so a
 * failed send is retried on the next run instead of losing those roles.
 */
const sendDigest = async (subscription, { now = new Date(), dryRun = false } = {}) => {
    const { total, jobs } = await newJobsFor(subscription, now);
    if (jobs.length === 0) return { outcome: "nothing-new", jobs: 0 };

    const companies = new Set(jobs.map(companyNameOf));

    if (dryRun) return { outcome: "would-send", jobs: jobs.length, total };

    const result = await sendJobAlertDigestEmail({
        to: subscription.email,
        name: subscription.name,
        jobCount: jobs.length,
        companyCount: companies.size,
        period: normaliseFrequency(subscription.frequency) === "daily" ? "day" : "week",
        jobListHtml: renderJobList(jobs),
        moreLine: moreLineFor(total, jobs.length),
        browseUrl: `${frontendUrl()}/find-jobs`,
        unsubscribeUrl: unsubscribeUrl(subscription.unsubscribeToken),
    });

    if (!result?.sent) {
        return { outcome: "failed", jobs: 0, reason: result?.reason };
    }

    await prisma.jobAlertSubscription.update({
        where: { id: subscription.id },
        data: {
            lastSentAt: now,
            lastJobAt: jobs[0].createdAt,
            sentCount: { increment: 1 },
        },
    });

    return { outcome: "sent", jobs: jobs.length, total };
};

/**
 * Run the digest over every active subscription.
 *
 * Safe to run more often than any cadence: a subscription that is not due, or
 * has nothing new, is passed over without being written to. That is what lets
 * one scheduled run every few hours serve both daily and weekly subscribers.
 */
const dispatchDigests = async ({ frequency, limit = 500, force = false, dryRun = false } = {}) => {
    const now = new Date();
    const subscriptions = await prisma.jobAlertSubscription.findMany({
        where: {
            unsubscribedAt: null,
            ...(frequency ? { frequency: normaliseFrequency(frequency) } : {}),
        },
        orderBy: { lastSentAt: { sort: "asc", nulls: "first" } },
        take: Math.max(1, Math.min(Number(limit) || 500, 2000)),
    });

    const stats = {
        considered: subscriptions.length,
        sent: 0,
        notDue: 0,
        nothingNew: 0,
        failed: 0,
        jobsSent: 0,
        dryRun,
    };

    for (const subscription of subscriptions) {
        if (!force && !isDue(subscription, now)) {
            stats.notDue += 1;
            continue;
        }

        try {
            const result = await sendDigest(subscription, { now, dryRun });

            if (result.outcome === "nothing-new") stats.nothingNew += 1;
            if (result.outcome === "failed") stats.failed += 1;
            if (result.outcome === "sent" || result.outcome === "would-send") {
                stats.sent += 1;
                stats.jobsSent += result.jobs;
                if (!dryRun) await wait(SEND_GAP_MS);
            }
        } catch (error) {
            console.error(`Job alert digest failed for ${subscription.email}:`, error.message);
            stats.failed += 1;
        }
    }

    return stats;
};

/** Subscriber counts, for the admin overview. */
const subscriberStats = async () => {
    const [active, daily, unsubscribed, sentEver] = await Promise.all([
        prisma.jobAlertSubscription.count({ where: { unsubscribedAt: null } }),
        prisma.jobAlertSubscription.count({ where: { unsubscribedAt: null, frequency: "daily" } }),
        prisma.jobAlertSubscription.count({ where: { unsubscribedAt: { not: null } } }),
        prisma.jobAlertSubscription.count({ where: { lastSentAt: { not: null } } }),
    ]);

    const lastRun = await prisma.jobAlertSubscription.findFirst({
        where: { lastSentAt: { not: null } },
        orderBy: { lastSentAt: "desc" },
        select: { lastSentAt: true },
    });

    return {
        active,
        daily,
        weekly: active - daily,
        unsubscribed,
        everReceived: sentEver,
        lastSentAt: lastRun?.lastSentAt || null,
    };
};

module.exports = {
    CADENCES,
    DEFAULT_FREQUENCY,
    MAX_JOBS_PER_EMAIL,
    recordConsent,
    findForUser,
    unsubscribeByToken,
    unsubscribeUrl,
    newJobsFor,
    renderJobList,
    isDue,
    sendDigest,
    dispatchDigests,
    subscriberStats,
    normaliseEmail,
    normaliseFrequency,
    asList,
    isValidEmail,
};
