/**
 * Fill in search facets for postings written before they existed.
 *
 * New adverts get their seniority, education level and skills derived as they
 * are saved (see controllers/jobController). Everything already in the database
 * has those columns empty, which would make the experience-level and education
 * filters look broken on exactly the jobs candidates are most likely to find.
 *
 *   node scripts/backfillJobFacets.js           derive only what is missing
 *   node scripts/backfillJobFacets.js --all     re-derive every posting
 *   node scripts/backfillJobFacets.js --dry-run show what would change
 *
 * Re-running is safe. `--all` is the one to use after editing the lexicon, so
 * an improved rule reaches postings that were already derived under the old one.
 */

require("dotenv").config();

const prisma = require("../config/prisma");
const { deriveJobFacets } = require("../utils/jobFacets");

const BATCH_SIZE = 200;

const sameList = (a = [], b = []) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

const main = async () => {
    const all = process.argv.includes("--all");
    const dryRun = process.argv.includes("--dry-run");

    // Soft-deleted postings are skipped: they are kept only so applications and
    // match history still point at something real, and are never searched.
    const where = all
        ? { deletedAt: null }
        : {
            deletedAt: null,
            OR: [
                { seniority: null },
                { educationLevel: null },
                { searchSkills: { isEmpty: true } },
            ],
        };

    const total = await prisma.job.count({ where });
    console.log(
        `${total} posting(s) to process${all ? " (--all)" : ""}${dryRun ? " — dry run, nothing will be written" : ""}.\n`
    );

    if (total === 0) return;

    let processed = 0;
    let changed = 0;
    let cursor = null;

    for (;;) {
        const batch = await prisma.job.findMany({
            where,
            select: { id: true, title: true, description: true, requirements: true, tags: true, seniority: true, educationLevel: true, searchSkills: true },
            orderBy: { id: "asc" },
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (batch.length === 0) break;
        cursor = batch[batch.length - 1].id;

        for (const job of batch) {
            processed += 1;
            const facets = deriveJobFacets(job);

            const unchanged =
                facets.seniority === job.seniority &&
                facets.educationLevel === job.educationLevel &&
                sameList(facets.searchSkills, job.searchSkills || []);

            if (unchanged) continue;
            changed += 1;

            if (dryRun) {
                console.log(
                    `  ${job.title?.slice(0, 48).padEnd(48)} ` +
                    `${String(facets.seniority || "—").padEnd(10)} ` +
                    `${String(facets.educationLevel || "—").padEnd(12)} ` +
                    `${facets.searchSkills.slice(0, 6).join(", ")}`
                );
                continue;
            }

            await prisma.job.update({ where: { id: job.id }, data: facets });
        }

        console.log(`  ...${processed}/${total}`);
    }

    console.log(
        dryRun
            ? `\nDry run complete: ${changed} of ${processed} posting(s) would change.`
            : `\nDone: ${changed} of ${processed} posting(s) updated.`
    );
};

main()
    .catch((error) => {
        console.error("Backfill failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
