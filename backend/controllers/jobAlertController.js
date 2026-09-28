const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const alerts = require("../services/jobAlertService");

/**
 * What the client is told about a subscription.
 *
 * The unsubscribe token is deliberately absent: it authorises leaving without
 * a login, so it belongs in an email and nowhere else.
 */
const toClientSubscription = (subscription) => (subscription ? toClient({
    _id: subscription.id,
    id: subscription.id,
    email: subscription.email,
    subscribed: subscription.unsubscribedAt === null,
    frequency: subscription.frequency,
    categories: subscription.categories,
    locations: subscription.locations,
    lastSentAt: subscription.lastSentAt,
    sentCount: subscription.sentCount,
    createdAt: subscription.createdAt,
}) : null);

const fail = (res, error, fallback) => {
    if (error?.status) return res.status(error.status).json({ message: error.message });
    console.error(fallback, error);
    return res.status(500).json({ message: fallback });
};

// @desc    Ask for updates about newly posted roles
// @route   POST /api/job-alerts/subscribe
// @access  Public (a signed-in request is tied to the account)
const subscribe = async (req, res) => {
    try {
        const { email, name, frequency, categories, locations, source } = req.body;

        // A signed-in candidate subscribes their account address. Letting the
        // body choose would turn this into a way to sign other people up.
        const address = req.user ? req.user.email : email;

        const subscription = await alerts.recordConsent({
            email: address,
            name: name || req.user?.name,
            userId: req.user?._id || null,
            agreed: true,
            frequency,
            categories,
            locations,
            source: source || (req.user ? "settings" : "footer"),
        });

        res.status(201).json({
            message: "You'll hear from us when new roles are posted.",
            subscription: toClientSubscription(subscription),
        });
    } catch (error) {
        fail(res, error, "Could not save your subscription");
    }
};

// @desc    The signed-in user's subscription, and whether they have decided yet
// @route   GET /api/job-alerts/me
// @access  Private
const getMine = async (req, res) => {
    try {
        const subscription = await alerts.findForUser(req.user);
        res.status(200).json({
            // `false` is what the opt-in prompt watches: it appears only for
            // someone who has neither agreed nor declined.
            decided: Boolean(subscription),
            subscription: toClientSubscription(subscription),
        });
    } catch (error) {
        fail(res, error, "Could not load your job update settings");
    }
};

// @desc    Change cadence, filters, or turn updates off
// @route   PUT /api/job-alerts/me
// @access  Private
const updateMine = async (req, res) => {
    try {
        const { subscribed, frequency, categories, locations } = req.body;
        const existing = await alerts.findForUser(req.user);

        // Turning it off keeps the row: it is the record of the decision, and
        // what stops the platform asking again.
        if (subscribed === false) {
            if (!existing) {
                const declined = await alerts.recordConsent({
                    email: req.user.email,
                    name: req.user.name,
                    userId: req.user._id,
                    agreed: false,
                    source: "settings",
                });
                return res.status(200).json({
                    message: "You won't get job updates by email.",
                    decided: true,
                    subscription: toClientSubscription(declined),
                });
            }

            const stopped = await prisma.jobAlertSubscription.update({
                where: { id: existing.id },
                data: { unsubscribedAt: existing.unsubscribedAt || new Date() },
            });
            return res.status(200).json({
                message: "You won't get job updates by email.",
                decided: true,
                subscription: toClientSubscription(stopped),
            });
        }

        const subscription = await alerts.recordConsent({
            email: req.user.email,
            name: req.user.name,
            userId: req.user._id,
            agreed: true,
            frequency,
            categories,
            locations,
            source: "settings",
        });

        res.status(200).json({
            message: "Your job update settings are saved.",
            decided: true,
            subscription: toClientSubscription(subscription),
        });
    } catch (error) {
        fail(res, error, "Could not save your job update settings");
    }
};

// @desc    Record a "no thanks" so the prompt stops appearing
// @route   POST /api/job-alerts/decline
// @access  Private
const decline = async (req, res) => {
    try {
        const existing = await alerts.findForUser(req.user);
        const subscription = existing
            ? await prisma.jobAlertSubscription.update({
                where: { id: existing.id },
                data: { unsubscribedAt: existing.unsubscribedAt || new Date() },
            })
            : await alerts.recordConsent({
                email: req.user.email,
                name: req.user.name,
                userId: req.user._id,
                agreed: false,
                source: "prompt",
            });

        res.status(200).json({
            message: "We won't ask again. You can switch job updates on from your profile.",
            decided: true,
            subscription: toClientSubscription(subscription),
        });
    } catch (error) {
        fail(res, error, "Could not save your choice");
    }
};

/** The address is shown back on the unsubscribe page, so it is escaped first. */
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** A plain page, because this is opened from a mail client, not the SPA. */
const noticePage = ({ heading, body, linkLabel, linkUrl }) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${heading}</title>
</head>
<body style="margin:0;padding:40px 20px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${heading}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b5563;">${body}</p>
        <a href="${linkUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">${linkLabel}</a>
    </div>
</body>
</html>`;

// @desc    One-click unsubscribe from an email footer
// @route   GET /api/job-alerts/unsubscribe?token=...
// @access  Public (the token is the authorisation)
const unsubscribe = async (req, res) => {
    const browse = `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}/find-jobs`;

    try {
        const subscription = await alerts.unsubscribeByToken(req.query.token);

        if (!subscription) {
            return res.status(404).type("html").send(noticePage({
                heading: "This link is no longer valid",
                body: "We could not find a subscription for this link. It may have already been removed. You can manage job updates from your profile once signed in.",
                linkLabel: "Browse jobs",
                linkUrl: browse,
            }));
        }

        return res.type("html").send(noticePage({
            heading: "You're unsubscribed",
            body: `We won't email <strong>${escapeHtml(subscription.email)}</strong> about new roles any more. Nothing else about your account has changed, and you can turn updates back on from your profile at any time.`,
            linkLabel: "Browse jobs",
            linkUrl: browse,
        }));
    } catch (error) {
        console.error("Unsubscribe failed:", error);
        return res.status(500).type("html").send(noticePage({
            heading: "Something went wrong",
            body: "We could not process that just now. Please try the link again, or turn job updates off from your profile.",
            linkLabel: "Browse jobs",
            linkUrl: browse,
        }));
    }
};

// @desc    Subscriber counts
// @route   GET /api/job-alerts/stats
// @access  Private (admin)
const stats = async (req, res) => {
    try {
        res.status(200).json({ stats: await alerts.subscriberStats() });
    } catch (error) {
        fail(res, error, "Could not load subscription stats");
    }
};

// @desc    Send the digests that are due now
// @route   POST /api/job-alerts/dispatch
// @access  Private (admin)
const dispatch = async (req, res) => {
    try {
        const result = await alerts.dispatchDigests({
            frequency: req.body?.frequency,
            limit: req.body?.limit,
            force: req.body?.force === true,
            dryRun: req.body?.dryRun === true,
        });

        const summary = result.sent === 0
            ? "Nothing to send — no subscriber is both due and has new roles waiting."
            : `${result.sent} digest${result.sent === 1 ? "" : "s"} ${result.dryRun ? "would be sent" : "sent"}, covering ${result.jobsSent} role${result.jobsSent === 1 ? "" : "s"}.`;

        res.status(200).json({ message: summary, result });
    } catch (error) {
        fail(res, error, "Could not send the job update digests");
    }
};

module.exports = {
    subscribe,
    getMine,
    updateMine,
    decline,
    unsubscribe,
    stats,
    dispatch,
};
