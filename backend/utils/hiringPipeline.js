const prisma = require("../config/prisma");

/**
 * The recruitment pipeline an employer moves applications through, and the
 * much simpler picture a candidate is allowed to see of it.
 *
 * Employers name and order their own stages. Every stage declares which of
 * five candidate phases it belongs to, and the candidate only ever sees the
 * phase. "Longlisted", "Assessment" or "Final Review" are the employer's
 * working vocabulary — telling a candidate they were longlisted, or that they
 * sat in final review for a fortnight, discloses how the employer ranks people.
 *
 * An application's `status` column holds a stage id. "rejected" is fixed and
 * outside the editable list: it is reachable from anywhere and settles the
 * application for good.
 */

// In the order a candidate moves through them.
const CANDIDATE_PHASES = [
    { key: "received", label: "Application received" },
    { key: "under_review", label: "Under review" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interview", label: "Interview" },
    { key: "decision", label: "Decision" },
];
const PHASE_KEYS = CANDIDATE_PHASES.map((phase) => phase.key);
const phaseIndex = (key) => PHASE_KEYS.indexOf(key);

// What a stage does besides being a label. `interview` needs a schedule and
// sends the details to the candidate; `offer` and `hired` are outcomes.
const STAGE_TYPES = ["standard", "interview", "offer", "hired"];

const REJECTED_STAGE = Object.freeze({
    id: "rejected",
    name: "Rejected",
    phase: "decision",
    type: "rejected",
});

const DEFAULT_STAGES = Object.freeze([
    { id: "applied", name: "Applied", phase: "received", type: "standard" },
    { id: "screening", name: "Screening", phase: "under_review", type: "standard" },
    { id: "longlisted", name: "Longlisted", phase: "under_review", type: "standard" },
    { id: "shortlisted", name: "Shortlisted", phase: "shortlisted", type: "standard" },
    { id: "assessment", name: "Assessment", phase: "shortlisted", type: "standard" },
    { id: "interview", name: "Interview", phase: "interview", type: "interview" },
    { id: "final_review", name: "Final Review", phase: "interview", type: "standard" },
    { id: "offer", name: "Offer", phase: "decision", type: "offer" },
    { id: "hired", name: "Hired", phase: "decision", type: "hired" },
].map(Object.freeze));

// Statuses written before stages were configurable. scripts/migrateApplicationStages.js
// rewrites them; this keeps rows it has not reached yet readable.
const LEGACY_STATUSES = {
    Applied: "applied",
    "Under Review": "screening",
    Interviewing: "interview",
    Offered: "offer",
    Rejected: "rejected",
};

const MIN_STAGES = 2;
const MAX_STAGES = 12;
const MAX_NAME_LENGTH = 40;

const normalizeStatus = (status) => LEGACY_STATUSES[status] || status;

const slugify = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

/** Every stage an application can be in: the employer's list, then rejection. */
const withRejected = (stages) => [...stages, REJECTED_STAGE];

const findStage = (stages, status) => {
    const id = normalizeStatus(status);
    return withRejected(stages).find((stage) => stage.id === id) || null;
};

/**
 * Check and tidy an employer's proposed stage list. Returns `{ stages }` or
 * `{ error }`. Ids are kept when supplied, so renaming a stage never strands
 * the applications sitting in it, and generated from the name otherwise.
 */
const validateStages = (input) => {
    if (!Array.isArray(input)) return { error: "Stages must be a list." };
    if (input.length < MIN_STAGES || input.length > MAX_STAGES) {
        return { error: `A pipeline needs between ${MIN_STAGES} and ${MAX_STAGES} stages.` };
    }

    const stages = [];
    const ids = new Set();
    const names = new Set();

    for (const [index, raw] of input.entries()) {
        const position = `Stage ${index + 1}`;
        const name = String(raw?.name || "").trim().replace(/\s+/g, " ");
        if (!name) return { error: `${position} needs a name.` };
        if (name.length > MAX_NAME_LENGTH) {
            return { error: `"${name}" is too long — keep stage names under ${MAX_NAME_LENGTH} characters.` };
        }
        if (names.has(name.toLowerCase())) return { error: `There are two stages called "${name}".` };

        const phase = String(raw?.phase || "");
        if (!PHASE_KEYS.includes(phase)) return { error: `Choose what candidates see for "${name}".` };

        const type = STAGE_TYPES.includes(raw?.type) ? raw.type : "standard";
        if (type === "interview" && phase !== "interview") {
            return { error: `"${name}" schedules an interview, so candidates must see it as Interview.` };
        }
        if ((type === "offer" || type === "hired") && phase !== "decision") {
            return { error: `"${name}" is an outcome, so candidates must see it as Decision.` };
        }

        let id = slugify(raw?.id) || slugify(name) || `stage_${index + 1}`;
        if (id === REJECTED_STAGE.id) id = `${id}_stage`;
        while (ids.has(id)) id = `${id}_${index + 1}`;

        ids.add(id);
        names.add(name.toLowerCase());
        stages.push({ id, name, phase, type });
    }

    if (stages[0].phase !== "received" || stages[0].type !== "standard") {
        return { error: "The first stage is where new applications land, so candidates must see it as Application received." };
    }

    // Moving forward through the stages must never move a candidate backward
    // through what they can see — "Interview" followed by "Under review" would
    // read as a demotion nobody decided on.
    for (let i = 1; i < stages.length; i += 1) {
        if (phaseIndex(stages[i].phase) < phaseIndex(stages[i - 1].phase)) {
            return {
                error: `"${stages[i].name}" comes after "${stages[i - 1].name}" but shows candidates an earlier step. Reorder the stages or change what candidates see.`,
            };
        }
    }

    const hiredAt = stages.findIndex((stage) => stage.type === "hired");
    if (stages.filter((stage) => stage.type === "hired").length > 1) {
        return { error: "Only one stage can mark a candidate as hired." };
    }
    if (hiredAt !== -1 && hiredAt !== stages.length - 1) {
        return { error: "The hired stage has to be the last one." };
    }
    if (stages.filter((stage) => stage.type === "offer").length > 1) {
        return { error: "Only one stage can make an offer." };
    }

    return { stages };
};

/**
 * Whether an application may move between two stages. Forward only, or out to
 * rejection. Nothing leaves rejection or a hire — both have been told to the
 * candidate as final.
 */
const canTransition = (stages, from, to) => {
    const fromId = normalizeStatus(from);
    const toId = normalizeStatus(to);
    if (fromId === toId) return false;

    const fromStage = findStage(stages, fromId);
    if (!fromStage || fromStage.type === "rejected" || fromStage.type === "hired") return false;
    if (toId === REJECTED_STAGE.id) return true;

    const fromIndex = stages.findIndex((stage) => stage.id === fromId);
    const toIndex = stages.findIndex((stage) => stage.id === toId);
    return fromIndex !== -1 && toIndex > fromIndex;
};

const OUTCOMES = {
    offer: { outcome: "offer", outcomeLabel: "Offer made" },
    hired: { outcome: "hired", outcomeLabel: "Hired" },
    rejected: { outcome: "unsuccessful", outcomeLabel: "Not selected" },
};

/**
 * What a candidate is shown for a stage: the phase, its position in the five,
 * and — only once there is one — the outcome. Never the stage name.
 */
const toCandidateStatus = (stages, status) => {
    const stage = findStage(stages, status) || stages[0];
    const phase = CANDIDATE_PHASES.find((entry) => entry.key === stage.phase) || CANDIDATE_PHASES[0];

    return {
        phase: phase.key,
        label: phase.label,
        step: phaseIndex(phase.key) + 1,
        totalSteps: CANDIDATE_PHASES.length,
        outcome: OUTCOMES[stage.type]?.outcome || null,
        outcomeLabel: OUTCOMES[stage.type]?.outcomeLabel || null,
    };
};

/** The stages an employer works with — their own, or the default. */
const getEmployerStages = async (employerId) => {
    if (!employerId) return [...DEFAULT_STAGES];
    const saved = await prisma.hiringPipeline.findUnique({
        where: { employerId },
        select: { stages: true },
    });
    const { stages } = validateStages(saved?.stages);
    return stages || [...DEFAULT_STAGES];
};

/** Stage lists for several employers in one query, keyed by employer id. */
const getStagesByEmployer = async (employerIds) => {
    const unique = [...new Set(employerIds.filter(Boolean))];
    const rows = unique.length
        ? await prisma.hiringPipeline.findMany({
            where: { employerId: { in: unique } },
            select: { employerId: true, stages: true },
        })
        : [];

    const byEmployer = new Map();
    for (const row of rows) {
        const { stages } = validateStages(row.stages);
        if (stages) byEmployer.set(row.employerId, stages);
    }
    return (employerId) => byEmployer.get(employerId) || [...DEFAULT_STAGES];
};

module.exports = {
    CANDIDATE_PHASES,
    STAGE_TYPES,
    DEFAULT_STAGES,
    REJECTED_STAGE,
    LEGACY_STATUSES,
    normalizeStatus,
    withRejected,
    findStage,
    validateStages,
    canTransition,
    toCandidateStatus,
    getEmployerStages,
    getStagesByEmployer,
};
