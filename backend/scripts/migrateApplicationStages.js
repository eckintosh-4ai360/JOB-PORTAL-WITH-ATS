require("dotenv").config();

const prisma = require("../config/prisma");
const { LEGACY_STATUSES } = require("../utils/hiringPipeline");

/**
 * One-off backfill for configurable pipelines.
 *
 * Applications used to hold a display name ("Under Review", "Offered"). They
 * now hold a stage id from the default pipeline, which every employer starts
 * on. The read paths already translate the old names, so nothing breaks before
 * this runs — it just makes the column say what the code means.
 *
 * Idempotent: rows already holding a stage id are not matched.
 */
const run = async () => {
    for (const [legacy, stageId] of Object.entries(LEGACY_STATUSES)) {
        const { count } = await prisma.application.updateMany({
            where: { status: legacy },
            data: { status: stageId },
        });
        console.log(`${legacy.padEnd(14)} -> ${stageId.padEnd(10)} ${count} application${count === 1 ? "" : "s"}`);
    }

    const counts = await prisma.application.groupBy({ by: ["status"], _count: { _all: true } });
    console.log("\napplications by stage:", counts.map((c) => `${c.status}=${c._count._all}`).join("  ") || "none");
};

run()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
