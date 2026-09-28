/**
 * Send the job update digests that are due.
 *
 * This is the scheduled half of the subscription feature: consent is recorded
 * by the app, and this is what actually writes to people. Point a cron job
 * (Render Cron, GitHub Actions, crontab) at it — every few hours is plenty,
 * because a subscription that is not due, or has nothing new to report, is
 * passed over without being touched. One schedule therefore serves both daily
 * and weekly subscribers.
 *
 *   node scripts/sendJobAlerts.js                    send what is due
 *   node scripts/sendJobAlerts.js --dry-run          report, send nothing
 *   node scripts/sendJobAlerts.js --force            ignore the cadence
 *   node scripts/sendJobAlerts.js --frequency=daily  only daily subscribers
 *   node scripts/sendJobAlerts.js --limit=50         cap the subscribers read
 *
 * Re-running is safe. Each subscription keeps a cursor at the newest role it
 * has been sent, moved only after the mail server accepted the message, so no
 * role is ever sent twice and a failed send is retried on the next run.
 */

require("dotenv").config();

const prisma = require("../config/prisma");
const { dispatchDigests } = require("../services/jobAlertService");

const flag = (name) => process.argv.includes(`--${name}`);

const value = (name) => {
    const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
    return match ? match.split("=")[1] : undefined;
};

const main = async () => {
    const dryRun = flag("dry-run");
    const force = flag("force");
    const frequency = value("frequency");
    const limit = value("limit");

    if (frequency && !["daily", "weekly"].includes(frequency)) {
        throw new Error(`--frequency must be daily or weekly, not "${frequency}"`);
    }

    if (!process.env.RESEND_API_KEY && !dryRun) {
        console.warn("RESEND_API_KEY is not set — nothing can be delivered. Use --dry-run to test the selection.\n");
    }

    console.log(
        `Sending job update digests${frequency ? ` (${frequency} only)` : ""}`
        + `${force ? ", ignoring the cadence" : ""}`
        + `${dryRun ? " — dry run, nothing will be sent" : ""}.\n`
    );

    const stats = await dispatchDigests({ frequency, limit, force, dryRun });

    console.log(`  subscribers read : ${stats.considered}`);
    console.log(`  not due yet      : ${stats.notDue}`);
    console.log(`  nothing new      : ${stats.nothingNew}`);
    console.log(`  ${dryRun ? "would send" : "sent"}       : ${stats.sent}`);
    console.log(`  roles included   : ${stats.jobsSent}`);
    console.log(`  failed           : ${stats.failed}`);

    // A failed send is not a broken run — those roles go out next time — but
    // the exit code has to say so, or a cron job looks healthy while nothing
    // is arriving.
    if (stats.failed > 0) process.exitCode = 1;
};

main()
    .catch((error) => {
        console.error("Job alert dispatch failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
