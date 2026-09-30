const prisma = require("../config/prisma");
const { resetVocabulary } = require("./searchVocabulary");

const ACCOUNT_INACTIVE_CODE = "ACCOUNT_INACTIVE";
const EXPIRED_REASON = "Subscription ended without renewal";
const SWEEP_INTERVAL_MS = 60_000;

let lastSweepAt = 0;
let pendingSweep = null;

const subscriptionHasExpired = (account, now = new Date()) =>
    account?.role !== "admin"
    && account?.isActive !== false
    && account?.subscriptionRenews === false
    && account?.subscriptionEndsAt
    && new Date(account.subscriptionEndsAt) <= now;

/**
 * Persist every due non-renewing subscription as inactive. The short cache
 * makes this safe to call from public reads as well as admin screens without
 * turning every request into a write query.
 */
const deactivateExpiredAccounts = async ({ force = false } = {}) => {
    const now = new Date();
    if (!force && now.getTime() - lastSweepAt < SWEEP_INTERVAL_MS) return { count: 0 };
    if (pendingSweep) return pendingSweep;

    pendingSweep = prisma.user.updateMany({
        where: {
            role: { not: "admin" },
            isActive: true,
            subscriptionRenews: false,
            subscriptionEndsAt: { lte: now },
        },
        data: {
            isActive: false,
            deactivatedAt: now,
            deactivationReason: EXPIRED_REASON,
        },
    }).then((result) => {
        lastSweepAt = Date.now();
        if (result.count > 0) resetVocabulary();
        return result;
    }).finally(() => {
        pendingSweep = null;
    });

    return pendingSweep;
};

/** Check one authenticated account immediately, without waiting for a sweep. */
const enforceAccountAccess = async (account) => {
    if (!account) return account;
    if (!subscriptionHasExpired(account)) return account;

    const deactivatedAt = new Date();
    const result = await prisma.user.updateMany({
        where: {
            id: account.id,
            role: { not: "admin" },
            isActive: true,
            subscriptionRenews: false,
            subscriptionEndsAt: { lte: deactivatedAt },
        },
        data: {
            isActive: false,
            deactivatedAt,
            deactivationReason: EXPIRED_REASON,
        },
    });
    if (result.count === 0) {
        // An administrator may have renewed the account between the read and
        // this conditional write. Re-read its access fields before deciding.
        const current = await prisma.user.findUnique({
            where: { id: account.id },
            select: {
                isActive: true,
                subscriptionEndsAt: true,
                subscriptionRenews: true,
                deactivatedAt: true,
                deactivationReason: true,
            },
        });
        return current ? { ...account, ...current } : { ...account, isActive: false };
    }
    resetVocabulary();
    return {
        ...account,
        isActive: false,
        deactivatedAt,
        deactivationReason: EXPIRED_REASON,
    };
};

const inactiveAccountPayload = (account) => ({
    code: ACCOUNT_INACTIVE_CODE,
    message: account?.deactivationReason === EXPIRED_REASON
        ? "Your subscription has ended and this account is inactive. Contact support to renew access."
        : "This account is inactive. Contact support if you believe this is a mistake.",
});

module.exports = {
    ACCOUNT_INACTIVE_CODE,
    EXPIRED_REASON,
    deactivateExpiredAccounts,
    enforceAccountAccess,
    inactiveAccountPayload,
    subscriptionHasExpired,
};
