/**
 * Duplicate candidate detection: two or more accounts (or guest applications)
 * that look like the same person.
 *
 * Two scopes, with different data:
 *   - platform (admins): every jobseeker account, using everything the
 *     platform holds for it — analysed CVs, stored CV files, applications;
 *   - employer: one employer's applicants, using only what those applicants
 *     sent that employer — the CVs attached to their applications and the
 *     contact details on them. An employer never learns anything here that
 *     their own applications did not already show them.
 *
 * Evidence is scored, and a pair is only reported with at least one strong
 * signal: the same CV file or text, near-identical wording, the same phone,
 * the same email inbox. A shared name is supporting evidence only, and
 * clearly different names lower the score — a phone shared by different
 * people is more often a family member or an agent than a duplicate account.
 *
 * Nothing here acts on an account. It flags, explains, and records what a
 * person decided.
 */

const prisma = require("../config/prisma");
const { downloadFile, extractFromBuffer } = require("../utils/resumeTextExtractor");
const signals = require("../utils/identitySignals");

const REPORT_MIN_POINTS = 45;
const HIGH_MIN_POINTS = 75;
const DOWNLOAD_CONCURRENCY = 3;
// A token shared by more identities than this is noise (a template phone
// number, a CV sample file), not evidence about any one pair.
const MAX_BUCKET = 25;
const MAX_SOURCES_PER_SUBJECT = 8;

const PLATFORM_SCOPE = "platform";
const employerScope = (employerId) => `employer:${employerId}`;

// ---------------------------------------------------------------------------
// Fingerprints
// ---------------------------------------------------------------------------

const featuresOfText = (text) => {
    const { textHash, minhash } = signals.textFeatures(text);
    const { emails, phones } = signals.extractContacts(text);
    return { textHash, minhash, emails, phones };
};

/** Read one CV source into its fingerprint. Analysed text needs no download. */
const computeFingerprint = async ({ key, text }) => {
    if (typeof text === "string") return { fileHash: null, ...featuresOfText(text) };

    const { buffer, mimetype, filename } = await downloadFile(key);
    const fileHash = signals.sha256(buffer);
    try {
        const extracted = await extractFromBuffer(buffer, { mimetype, filename });
        return { fileHash, ...featuresOfText(extracted.text) };
    } catch {
        // A scanned CV has no readable text, but its file can still match.
        return { fileHash, textHash: null, minhash: [], emails: [], phones: [] };
    }
};

const saveFingerprint = (sourceKey, data) =>
    prisma.cvFingerprint.upsert({
        where: { sourceKey },
        create: { sourceKey, ...data },
        update: {},
    });

/**
 * Fingerprints for every source, computing the missing ones. Analysed text is
 * always processed; downloads are capped by `budget` so a request never waits
 * on dozens of files — the rest are reported as pending.
 *
 * @param {Array<{key: string, text?: string}>} sources
 * @returns {Promise<{fingerprints: Map<string, object>, pending: number, processed: number}>}
 */
const ensureFingerprints = async (sources, { budget = 0 } = {}) => {
    const unique = [...new Map(sources.filter((s) => s?.key).map((s) => [s.key, s])).values()];
    const existing = unique.length
        ? await prisma.cvFingerprint.findMany({ where: { sourceKey: { in: unique.map((s) => s.key) } } })
        : [];
    const fingerprints = new Map(existing.map((row) => [row.sourceKey, row]));

    const missing = unique.filter((source) => !fingerprints.has(source.key));
    const fromText = missing.filter((source) => typeof source.text === "string");
    const fromFiles = missing.filter((source) => typeof source.text !== "string" && /^https?:\/\//i.test(source.key));
    const queue = [...fromText, ...fromFiles.slice(0, budget)];
    let processed = 0;

    const worker = async () => {
        while (queue.length) {
            const source = queue.shift();
            let data;
            try {
                data = await computeFingerprint(source);
            } catch (error) {
                console.warn(`Could not fingerprint CV ${source.key.slice(0, 80)}:`, error.message);
                data = { failed: true };
            }
            try {
                fingerprints.set(source.key, await saveFingerprint(source.key, data));
                processed += 1;
            } catch (error) {
                console.warn("Could not save CV fingerprint:", error.message);
            }
        }
    };
    await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));

    return { fingerprints, pending: Math.max(0, fromFiles.length - budget), processed };
};

/** Fire-and-forget: a new CV is read in the background so detection is ready later. */
const fingerprintInBackground = (source) => {
    if (!source?.key) return;
    Promise.resolve()
        .then(() => ensureFingerprints([source], { budget: 1 }))
        .catch((error) => console.warn("Background CV fingerprint failed:", error.message));
};

// ---------------------------------------------------------------------------
// Who is being compared
// ---------------------------------------------------------------------------

const identityKeyForApplication = (application) => {
    if (application.applicantId) return `user:${application.applicantId}`;
    const email = signals.normalizeEmail(application.guestEmail);
    return email ? `guest:${email}` : `guest-application:${application.id}`;
};

/** Every jobseeker account, with all the CVs the platform has seen from it. */
const loadPlatformSubjects = async () => {
    const users = await prisma.user.findMany({
        where: { role: "jobseeker" },
        select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            resume: true,
            trustState: true,
            createdAt: true,
            documents: { where: { category: "Resume" }, select: { url: true }, orderBy: { uploadedAt: "desc" }, take: 5 },
            resumeAnalyses: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 3 },
            applications: {
                select: { id: true, jobId: true, resume: true, createdAt: true, job: { select: { title: true } } },
                orderBy: { createdAt: "desc" },
                take: 50,
            },
        },
    });

    return users.map((user) => ({
        key: `user:${user.id}`,
        kind: "user",
        userId: user.id,
        name: user.name,
        avatar: user.avatar || "",
        rawEmails: [user.email],
        identityEmails: [signals.normalizeEmail(user.email)].filter(Boolean),
        phones: [],
        createdAt: user.createdAt,
        trustState: user.trustState,
        sources: [
            ...user.resumeAnalyses.map((analysis) => ({ key: `analysis:${analysis.id}`, analysisId: analysis.id })),
            ...[user.resume, ...user.documents.map((doc) => doc.url), ...user.applications.map((app) => app.resume)]
                .filter(Boolean)
                .map((url) => ({ key: url })),
        ].slice(0, MAX_SOURCES_PER_SUBJECT),
        applications: user.applications.map((app) => ({
            id: app.id,
            jobId: app.jobId,
            jobTitle: app.job?.title || "",
            appliedAt: app.createdAt,
        })),
    }));
};

/** One employer's applicants, grouped into identities, with only what they sent. */
const loadEmployerSubjects = async (employerId) => {
    const applications = await prisma.application.findMany({
        where: { job: { companyId: employerId } },
        select: {
            id: true,
            jobId: true,
            applicantId: true,
            guestName: true,
            guestEmail: true,
            guestPhone: true,
            resume: true,
            status: true,
            createdAt: true,
            job: { select: { title: true } },
            applicant: { select: { name: true, email: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const subjects = new Map();
    for (const application of applications) {
        const key = identityKeyForApplication(application);
        if (!subjects.has(key)) {
            const email = application.applicant?.email || application.guestEmail;
            subjects.set(key, {
                key,
                kind: application.applicantId ? "user" : "guest",
                userId: application.applicantId || null,
                name: application.applicant?.name || application.guestName || "Applicant",
                avatar: application.applicant?.avatar || "",
                rawEmails: [email].filter(Boolean),
                identityEmails: [signals.normalizeEmail(email)].filter(Boolean),
                phones: [],
                createdAt: application.createdAt,
                sources: [],
                applications: [],
            });
        }
        const subject = subjects.get(key);
        const phone = signals.normalizePhone(application.guestPhone);
        if (phone && !subject.phones.includes(phone)) subject.phones.push(phone);
        if (application.resume && subject.sources.length < MAX_SOURCES_PER_SUBJECT
            && !subject.sources.some((source) => source.key === application.resume)) {
            subject.sources.push({ key: application.resume });
        }
        subject.applications.push({
            id: application.id,
            jobId: application.jobId,
            jobTitle: application.job?.title || "",
            status: application.status,
            appliedAt: application.createdAt,
        });
    }
    return [...subjects.values()];
};

/** Analysed text is fetched only for analyses that have not been fingerprinted. */
const withAnalysisText = async (sources) => {
    const analysisIds = sources.filter((source) => source.analysisId).map((source) => source.analysisId);
    if (!analysisIds.length) return sources;

    const done = await prisma.cvFingerprint.findMany({
        where: { sourceKey: { in: analysisIds.map((id) => `analysis:${id}`) } },
        select: { sourceKey: true },
    });
    const doneKeys = new Set(done.map((row) => row.sourceKey));
    const needed = analysisIds.filter((id) => !doneKeys.has(`analysis:${id}`));
    const texts = needed.length
        ? await prisma.resumeAnalysis.findMany({ where: { id: { in: needed } }, select: { id: true, resumeText: true } })
        : [];
    const textById = new Map(texts.map((row) => [row.id, row.resumeText || ""]));

    return sources.map((source) =>
        source.analysisId && textById.has(source.analysisId) ? { key: source.key, text: textById.get(source.analysisId) } : { key: source.key }
    );
};

// ---------------------------------------------------------------------------
// Comparing
// ---------------------------------------------------------------------------

const intersect = (a, b) => {
    const set = new Set(b);
    return [...new Set(a)].filter((item) => set.has(item));
};

const prepare = (subject, fingerprints) => {
    const prints = subject.sources.map((source) => fingerprints.get(source.key)).filter((print) => print && !print.failed);
    return {
        ...subject,
        fileHashes: [...new Set(prints.map((p) => p.fileHash).filter(Boolean))],
        textHashes: [...new Set(prints.map((p) => p.textHash).filter(Boolean))],
        minhashes: prints.map((p) => p.minhash).filter((m) => m?.length === signals.SIGNATURE_SIZE),
        cvEmails: [...new Set(prints.flatMap((p) => p.emails || []))],
        allPhones: [...new Set([...subject.phones, ...prints.flatMap((p) => p.phones || [])])],
        readableCvs: prints.length,
    };
};

const firstName = (name) => String(name || "").split(" ")[0] || "One applicant";

/**
 * Compare two identities. Returns null when there is not enough to report,
 * otherwise the score, a confidence, and the evidence in plain words.
 */
const comparePair = (a, b) => {
    const evidence = [];
    let points = 0;
    let strong = 0;
    const add = (code, label, detail, weight, strength) => {
        evidence.push({ code, label, detail, strength });
        points += weight;
        if (strength === "strong") strong += 1;
    };

    // The CV itself.
    let cvEvidence = false;
    if (intersect(a.fileHashes, b.fileHashes).length) {
        add("same_file", "Identical CV file", "Both uploaded exactly the same file.", 60, "strong");
        cvEvidence = true;
    } else if (intersect(a.textHashes, b.textHashes).length) {
        add("same_text", "Identical CV text", "Word for word the same CV, saved as different files.", 55, "strong");
        cvEvidence = true;
    } else {
        let best = 0;
        for (const ma of a.minhashes) for (const mb of b.minhashes) best = Math.max(best, signals.similarity(ma, mb));
        const percent = Math.round(best * 100);
        if (best >= 0.85) {
            add("similar_text", "Near-identical CVs", `${percent}% of the wording is the same.`, 45, "strong");
            cvEvidence = true;
        } else if (best >= 0.7) {
            add("similar_text", "Very similar CVs", `${percent}% of the wording is the same.`, 25, "supporting");
            cvEvidence = true;
        }
    }

    // Email.
    const sameInbox = intersect(a.identityEmails, b.identityEmails);
    if (sameInbox.length) {
        const [ra, rb] = [a.rawEmails[0], b.rawEmails[0]];
        add(
            "same_inbox",
            "Same email inbox",
            ra && rb && ra.toLowerCase() !== rb.toLowerCase()
                ? `${ra} and ${rb} deliver to the same inbox.`
                : `Both use ${ra || rb}.`,
            55,
            "strong"
        );
    } else {
        const aOnB = intersect(a.identityEmails, b.cvEmails);
        const bOnA = intersect(b.identityEmails, a.cvEmails);
        const onBoth = intersect(a.cvEmails, b.cvEmails);
        if (aOnB.length) {
            add("shared_email", "Same email address", `${firstName(b.name)}'s CV gives ${aOnB[0]}, the email ${firstName(a.name)} used.`, 45, "strong");
        } else if (bOnA.length) {
            add("shared_email", "Same email address", `${firstName(a.name)}'s CV gives ${bOnA[0]}, the email ${firstName(b.name)} used.`, 45, "strong");
        } else if (onBoth.length) {
            add("shared_email", "Same email address", `${onBoth[0]} is on both CVs.`, 45, "strong");
        }
    }

    // Phone.
    const phones = intersect(a.allPhones, b.allPhones);
    if (phones.length) {
        add("shared_phone", "Same phone number", `${signals.formatPhone(phones[0])} is given by both.`, 45, "strong");
    }

    // Names — supporting, or evidence against.
    const names = signals.compareNames(a.name, b.name);
    if (names === "same") add("same_name", "Same name", "", 15, "supporting");
    else if (names === "similar") add("similar_name", "Similar name", `${a.name} / ${b.name}`, 8, "supporting");
    else if (names === "different") {
        evidence.push({ code: "names_differ", label: "Different names", detail: `${a.name} and ${b.name}.`, strength: "against" });
        points -= 15;
    }

    // Both applied to the same job — the one-application rule sidestepped.
    const sameJobs = intersect(a.applications.map((x) => x.jobId), b.applications.map((x) => x.jobId));
    if (sameJobs.length) {
        const titles = sameJobs.map((id) => a.applications.find((x) => x.jobId === id)?.jobTitle).filter(Boolean);
        add("same_job", "Applied to the same job", titles.slice(0, 3).join(", "), 10, "supporting");
    }

    if (strong === 0 || points < REPORT_MIN_POINTS) return null;

    // Different names and different CVs, tied only by a phone or an email, is
    // as likely an agent or a relative applying for someone else.
    const contactOnly = names === "different" && !cvEvidence;
    let confidence = points >= HIGH_MIN_POINTS || strong >= 2 || (names === "same" || names === "similar") ? "high" : "medium";
    if (contactOnly) {
        confidence = "medium";
        evidence.push({
            code: "shared_contact_note",
            label: "May be different people",
            detail: "Different names and different CVs sharing contact details — often someone applying on another person's behalf.",
            strength: "against",
        });
    }

    return { score: Math.max(0, Math.min(100, points)), confidence, evidence };
};

const encodeKey = (key) => key.replace(/\|/g, "%7C");
const pairKeyOf = (a, b) => [encodeKey(a), encodeKey(b)].sort().join("|");

/**
 * Every reported pair among the subjects, with any human decision applied.
 *
 * @param {object[]} subjects prepared subjects
 * @param {Map<string,string>} decisions pairKey → "same" | "distinct"
 */
const findPairs = (subjects, decisions) => {
    const buckets = new Map();
    const put = (token, index) => {
        if (!buckets.has(token)) buckets.set(token, new Set());
        buckets.get(token).add(index);
    };

    subjects.forEach((subject, index) => {
        subject.fileHashes.forEach((hash) => put(`f:${hash}`, index));
        subject.textHashes.forEach((hash) => put(`t:${hash}`, index));
        [...subject.identityEmails, ...subject.cvEmails].forEach((email) => put(`e:${email}`, index));
        subject.allPhones.forEach((phone) => put(`p:${phone}`, index));
        subject.minhashes.forEach((minhash) => signals.bandKeys(minhash).forEach((band) => put(`b:${band}`, index)));
    });

    const candidates = new Set();
    for (const members of buckets.values()) {
        if (members.size < 2 || members.size > MAX_BUCKET) continue;
        const list = [...members];
        for (let i = 0; i < list.length; i += 1) {
            for (let j = i + 1; j < list.length; j += 1) candidates.add(`${list[i]}:${list[j]}`);
        }
    }

    const pairs = [];
    for (const candidate of candidates) {
        const [i, j] = candidate.split(":").map(Number);
        const result = comparePair(subjects[i], subjects[j]);
        if (!result) continue;
        const pairKey = pairKeyOf(subjects[i].key, subjects[j].key);
        pairs.push({ a: subjects[i].key, b: subjects[j].key, pairKey, decision: decisions.get(pairKey) || null, ...result });
    }
    return pairs.sort((x, y) => y.score - x.score);
};

/** Group pairs that share an identity: one person with three accounts is one cluster. */
const clusterPairs = (pairs) => {
    const parent = new Map();
    const find = (x) => {
        if (!parent.has(x)) parent.set(x, x);
        while (parent.get(x) !== x) {
            parent.set(x, parent.get(parent.get(x)));
            x = parent.get(x);
        }
        return x;
    };
    for (const pair of pairs) parent.set(find(pair.a), find(pair.b));

    const clusters = new Map();
    for (const pair of pairs) {
        const root = find(pair.a);
        if (!clusters.has(root)) clusters.set(root, { members: new Set(), pairs: [] });
        const cluster = clusters.get(root);
        cluster.members.add(pair.a);
        cluster.members.add(pair.b);
        cluster.pairs.push(pair);
    }
    return [...clusters.values()];
};

const loadDecisions = async (scope) => {
    const rows = await prisma.duplicateReview.findMany({ where: { scope }, select: { pairKey: true, decision: true } });
    return new Map(rows.map((row) => [row.pairKey, row.decision]));
};

/**
 * Run detection for a set of raw subjects.
 * @returns {Promise<{subjects: Map, pairs: object[], clusters: object[], pending: number}>}
 */
const detect = async ({ subjects, scope, budget = 0 }) => {
    // Decisions do not depend on the fingerprints, so they load alongside.
    const decisionsLoading = loadDecisions(scope);
    const sources = await withAnalysisText(subjects.flatMap((subject) => subject.sources));
    const { fingerprints, pending } = await ensureFingerprints(sources, { budget });
    const prepared = subjects.map((subject) => prepare(subject, fingerprints));
    const decisions = await decisionsLoading;
    const pairs = findPairs(prepared, decisions);
    const byKey = new Map(prepared.map((subject) => [subject.key, subject]));
    return { subjects: byKey, pairs, clusters: clusterPairs(pairs), pending };
};

/** Record one decision for every pair among the given identities. */
const recordDecision = async ({ scope, keys, decision, note, decidedById }) => {
    const unique = [...new Set(keys)];
    const writes = [];
    for (let i = 0; i < unique.length; i += 1) {
        for (let j = i + 1; j < unique.length; j += 1) {
            const pairKey = pairKeyOf(unique[i], unique[j]);
            writes.push(prisma.duplicateReview.upsert({
                where: { scope_pairKey: { scope, pairKey } },
                create: { scope, pairKey, decision, note: note || null, decidedById },
                update: { decision, note: note || null, decidedById },
            }));
        }
    }
    await prisma.$transaction(writes);
    return writes.length;
};

module.exports = {
    PLATFORM_SCOPE,
    employerScope,
    loadPlatformSubjects,
    loadEmployerSubjects,
    detect,
    recordDecision,
    ensureFingerprints,
    withAnalysisText,
    fingerprintInBackground,
    identityKeyForApplication,
    // Exported for tests
    _internal: { comparePair, findPairs, clusterPairs, prepare, pairKeyOf },
};
