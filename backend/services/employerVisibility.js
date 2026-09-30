/**
 * A company is publicly visible while its account is active and its
 * subscription has not ended without renewal. Admin accounts are exempt from
 * subscription expiry, matching accountAccessService.
 *
 * Use the predicate in a Prisma relation filter, for example:
 * `where: { company: activeEmployerWhere() }`.
 */
const activeEmployerWhere = (now = new Date()) => ({
    isActive: true,
    OR: [
        { role: "admin" },
        { subscriptionRenews: true },
        { subscriptionEndsAt: null },
        { subscriptionEndsAt: { gt: now } },
    ],
});

/** The equivalent check for an employer account already loaded from Prisma. */
const employerIsVisible = (account, now = new Date()) => Boolean(
    account?.isActive === true
    && (
        account.role === "admin"
        || account.subscriptionRenews === true
        || account.subscriptionEndsAt == null
        || new Date(account.subscriptionEndsAt) > now
    )
);

module.exports = { activeEmployerWhere, employerIsVisible };
