require("dotenv").config();

const prisma = require("../config/prisma");

/**
 * One-off backfill for the launch of company review.
 *
 * Review gates job posting, and `approvalState` defaults to "pending", so
 * without this every employer already using the platform would silently lose
 * the ability to post. The rule applied here is "nobody who can post today
 * loses it": every company that already exists is approved, and an employer
 * who finished onboarding but never got a Company row gets an approved one so
 * their account keeps working.
 *
 * An employer still midway through onboarding is left alone — they cannot post
 * today either, so they go through review like any new company.
 *
 * Idempotent: re-running it approves nothing that is already decided.
 */
const run = async () => {
    const pending = await prisma.company.findMany({
        where: { approvalState: "pending" },
        select: { id: true, name: true, verified: true },
    });

    for (const company of pending) {
        await prisma.company.update({
            where: { id: company.id },
            data: {
                approvalState: "approved",
                verified: true,
                reviewedAt: new Date(),
                approvalNote: "Approved automatically: existed before company review was introduced.",
            },
        });
        const badge = company.verified ? "" : "  (gained the verified badge)";
        console.log(`  approved  ${company.name}${badge}`);
    }

    // Employers who completed onboarding without a Company row would fail the
    // new gate outright, since there is nothing to approve.
    const orphaned = await prisma.user.findMany({
        where: { role: "employer", employerOnboardingComplete: true, company: { is: null } },
        select: { id: true, name: true, companyName: true, companyDescription: true, companyLogo: true },
    });

    for (const user of orphaned) {
        const name = user.companyName || user.name || "Unnamed company";
        await prisma.company.create({
            data: {
                userId: user.id,
                name,
                description: user.companyDescription || null,
                logo: user.companyLogo || null,
                approvalState: "approved",
                verified: true,
                reviewedAt: new Date(),
                approvalNote: "Approved automatically: posting before company review was introduced.",
            },
        });
        console.log(`  created   ${name}  (employer had no company profile)`);
    }

    const counts = await prisma.company.groupBy({ by: ["approvalState"], _count: { _all: true } });
    console.log("\ncompanies by state:", counts.map((c) => `${c.approvalState}=${c._count._all}`).join("  ") || "none");
};

run()
    .catch((error) => {
        console.error("Backfill failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
