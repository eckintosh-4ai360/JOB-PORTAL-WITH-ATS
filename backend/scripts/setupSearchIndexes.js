/**
 * Install the Postgres extensions and indexes advanced search relies on.
 *
 * Why this is a script and not part of the schema: this project applies schema
 * changes with `prisma db push`, which reconciles the database to schema.prisma
 * and drops anything it does not find there — extensions and expression indexes
 * included. So `npm run prisma:push` runs this immediately afterwards to put
 * them back, and running it twice is harmless.
 *
 * Search still works without any of this. The full-text query falls back to a
 * sequential scan, and services/jobSearchService checks for pg_trgm at startup
 * and disables typo tolerance if it is missing rather than erroring. This makes
 * it fast and makes it forgiving.
 *
 *   node scripts/setupSearchIndexes.js
 */

require("dotenv").config();

const prisma = require("../config/prisma");
const {
    jobDocumentIndexed,
    SEARCH_DOC_FUNCTION_SQL,
    EXPANSION_WEIGHTS,
} = require("../services/jobSearchService");

/**
 * The GIN index over the search document.
 *
 * The expression must match the one the query uses character for character or
 * the planner will not use the index, which is why both come from
 * `jobDocumentIndexed()`. The bare form, with no table alias, is what an index
 * definition takes.
 */
const searchDocumentIndex = `CREATE INDEX IF NOT EXISTS "Job_search_doc_idx"
    ON "Job" USING GIN (${jobDocumentIndexed("")})`;

const steps = [
    {
        label: "pg_trgm extension (typo tolerance)",
        sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
        // Neon and most managed Postgres allow this; a locked-down instance may
        // not, and search degrades rather than fails if so.
        optional: true,
    },
    {
        // Postgres will not index an expression it cannot prove is immutable,
        // and array_to_string is only STABLE. This wrapper is the way in.
        label: "immutable search-document function",
        sql: SEARCH_DOC_FUNCTION_SQL,
    },
    {
        label: "full-text index over job postings",
        sql: searchDocumentIndex,
    },
    {
        // Synonym expansion only searches the title, tags and skills, so that
        // narrower document gets its own index rather than falling back to a
        // scan whenever a search expands a role.
        label: "full-text index over job titles and tags",
        sql: `CREATE INDEX IF NOT EXISTS "Job_search_doc_title_idx"
            ON "Job" USING GIN (ts_filter(${jobDocumentIndexed("")}, ${EXPANSION_WEIGHTS}))`,
    },
    {
        label: "trigram index on job titles",
        sql: `CREATE INDEX IF NOT EXISTS "Job_title_trgm_idx" ON "Job" USING GIN ("title" gin_trgm_ops)`,
        requires: "pg_trgm",
    },
    {
        label: "trigram index on job locations",
        sql: `CREATE INDEX IF NOT EXISTS "Job_location_trgm_idx" ON "Job" USING GIN ("location" gin_trgm_ops)`,
        requires: "pg_trgm",
    },
    {
        label: "trigram index on company names",
        sql: `CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx" ON "Company" USING GIN ("name" gin_trgm_ops)`,
        requires: "pg_trgm",
    },
    {
        label: "index on derived job skills",
        sql: `CREATE INDEX IF NOT EXISTS "Job_search_skills_idx" ON "Job" USING GIN ("searchSkills")`,
    },
    {
        label: "index on job tags",
        sql: `CREATE INDEX IF NOT EXISTS "Job_tags_idx" ON "Job" USING GIN ("tags")`,
    },
];

const hasExtension = async (name) => {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 AS ok FROM pg_extension WHERE extname = $1 LIMIT 1`,
        name
    );
    return rows.length > 0;
};

const main = async () => {
    console.log("Setting up search indexes...\n");

    let failures = 0;
    let trigram = false;

    for (const step of steps) {
        // The trigram indexes are useless without the extension, and attempting
        // them without it produces a confusing error about an unknown operator
        // class, so availability is established before anything depends on it.
        if (step.requires === "pg_trgm" && !trigram) {
            console.log(`  skipped  ${step.label} (pg_trgm unavailable)`);
            continue;
        }

        try {
            await prisma.$executeRawUnsafe(step.sql);
            console.log(`  ok       ${step.label}`);
        } catch (error) {
            const detail = error.message.split("\n")[0];
            if (step.optional) {
                console.warn(`  skipped  ${step.label}: ${detail}`);
            } else {
                failures += 1;
                console.error(`  FAILED   ${step.label}: ${detail}`);
            }
        }

        if (step.sql.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm")) {
            trigram = await hasExtension("pg_trgm").catch(() => false);
        }
    }

    console.log(
        trigram
            ? "\nTypo tolerance: enabled (pg_trgm installed)."
            : "\nTypo tolerance: unavailable — pg_trgm could not be installed. " +
              "Search will still run, matching on full text and spell correction only."
    );

    if (failures > 0) {
        console.error(`\n${failures} step(s) failed.`);
        process.exitCode = 1;
    } else {
        console.log("Search indexes are in place.");
    }
};

main()
    .catch((error) => {
        console.error("Search index setup failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
