/**
 * Deterministic fraud signals.
 *
 * Every detector here is a pure function over data we already hold. That is
 * deliberate: the score a reviewer sees must be reproducible, explainable, and
 * impossible to talk out of. Nothing a fraudster writes can change how these
 * rules fire, which is exactly the property an AI pass cannot offer.
 *
 * The AI layer in services/fraudModerationService sits on top and may nudge the
 * result within a hard cap. It never replaces these numbers.
 *
 * Each detector returns signals shaped:
 *   { id, label, weight, detail }
 * `weight` is the contribution to a 0-100 risk score. Weights are additive and
 * then saturated, so a pile of weak signals can reach "medium" but only a
 * genuinely damning one reaches "critical" alone.
 */

const crypto = require("crypto");

// ─── scoring ────────────────────────────────────────────────────────────────

const BANDS = [
    { band: "critical", min: 80 },
    { band: "high", min: 60 },
    { band: "medium", min: 35 },
    { band: "low", min: 0 },
];

const bandFor = (score) => BANDS.find((b) => score >= b.min).band;

/**
 * Combine weights without letting volume alone reach the top.
 *
 * Straight addition means eight trivial signals outrank one serious one, which
 * is how naive scoring buries real fraud under noise. Diminishing returns keep
 * the ordering sensible: the largest signal counts in full, each subsequent one
 * contributes progressively less.
 */
const scoreSignals = (signals) => {
    if (!signals.length) return 0;
    const sorted = [...signals].sort((a, b) => b.weight - a.weight);
    let score = 0;
    sorted.forEach((signal, index) => {
        score += signal.weight * Math.pow(0.65, index);
    });
    return Math.min(100, Math.round(score));
};

// ─── text helpers ───────────────────────────────────────────────────────────

const normalise = (text = "") =>
    String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Stable fingerprint of a job's wording, used for exact-duplicate lookup. */
const contentHash = (...parts) =>
    crypto.createHash("sha256").update(normalise(parts.filter(Boolean).join(" "))).digest("hex");

/** Overlapping word triples — the unit of comparison for near-duplicates. */
const shingles = (text, size = 3) => {
    const words = normalise(text).split(" ").filter(Boolean);
    if (words.length < size) return new Set(words.length ? [words.join(" ")] : []);
    const out = new Set();
    for (let i = 0; i <= words.length - size; i += 1) {
        out.add(words.slice(i, i + size).join(" "));
    }
    return out;
};

const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
};

const domainOf = (value = "") => {
    const raw = String(value).trim().toLowerCase();
    if (!raw) return "";
    const email = raw.includes("@") ? raw.split("@").pop() : raw;
    return email
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .split("?")[0]
        .trim();
};

// ─── reference lists ────────────────────────────────────────────────────────

const FREE_EMAIL_DOMAINS = new Set([
    "gmail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com", "live.com",
    "aol.com", "icloud.com", "protonmail.com", "proton.me", "gmx.com", "mail.com",
    "yandex.com", "zoho.com",
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "temp-mail.org", "yopmail.com", "throwawaymail.com", "trashmail.com",
    "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
    "fakeinbox.com", "mintemail.com", "spamgourmet.com",
]);

/**
 * Advance-fee patterns. Charging a candidate to apply, interview, or be hired
 * is the single most common recruitment scam, and employers explicitly accept a
 * no-fee hiring policy during company setup — so a hit here is both a fraud
 * signal and a breach of a term they agreed to.
 */
const FEE_PATTERNS = [
    /\b(registration|processing|application|placement|training|medical|screening)\s+fee\b/i,
    /\bpay\s+(a\s+)?(small\s+)?(fee|amount|deposit|token)\b/i,
    /\bnon[-\s]?refundable\b/i,
    /\bsend\s+(gh|ghs|₵|cedis|money|payment)\b/i,
    /\bmobile\s+money\b.{0,40}\b(before|to\s+secure|to\s+confirm)\b/i,
    /\bfee\s+is\s+required\b/i,
];

/** Moving the conversation off-platform defeats every protection we offer. */
const OFFSITE_CONTACT_PATTERNS = [
    /\bwhats\s?app\b/i,
    /\btelegram\b/i,
    /\bt\.me\//i,
    /\bwa\.me\//i,
    /\btext\s+(me|us)\s+on\b/i,
    /\bdm\s+(me|us)\s+on\b/i,
    /\bchat\s+(me|us)\s+up\s+on\b/i,
];

/** Requests that only ever precede identity theft. */
const CREDENTIAL_HARVEST_PATTERNS = [
    /\b(bank\s+account|account\s+number|bvn|ssnit\s+number|ghana\s+card\s+number)\b/i,
    /\b(atm|card)\s+(pin|number)\b/i,
    /\bsend\s+(a\s+)?(copy\s+of\s+)?your\s+(id|passport|ghana\s+card)\b.{0,40}\bbefore\b/i,
    /\bmomo\s+pin\b/i,
];

const matchAny = (patterns, text) => patterns.filter((re) => re.test(text)).length;

const signal = (id, label, weight, detail) => ({ id, label, weight, detail });

// ─── 1. fake companies ──────────────────────────────────────────────────────

/**
 * @param {object} company  Company record (may be null for a bare employer)
 * @param {object} user     Owning employer user
 * @param {object} context  { jobCount, accountAgeHours }
 */
const companySignals = (company = {}, user = {}, context = {}) => {
    const signals = [];
    const contactDomain = domainOf(company.contactEmail || user.email || "");
    const siteDomain = domainOf(company.website || "");
    const description = String(company.description || user.companyDescription || "");

    if (DISPOSABLE_EMAIL_DOMAINS.has(contactDomain)) {
        signals.push(signal(
            "disposable_contact_email",
            "Disposable contact address",
            55,
            `The hiring contact uses ${contactDomain}, a throwaway mail provider.`
        ));
    } else if (contactDomain && FREE_EMAIL_DOMAINS.has(contactDomain)) {
        signals.push(signal(
            "free_contact_email",
            "Free mailbox as hiring contact",
            18,
            `The hiring contact uses ${contactDomain} rather than a company domain. Common for small firms, so weighted lightly.`
        ));
    }

    if (siteDomain && contactDomain && !FREE_EMAIL_DOMAINS.has(contactDomain) && siteDomain !== contactDomain) {
        signals.push(signal(
            "domain_mismatch",
            "Contact domain does not match website",
            30,
            `Website is ${siteDomain} but the contact writes from ${contactDomain}.`
        ));
    }

    if (!company.registrationNumber) {
        signals.push(signal(
            "no_registration_number",
            "No registration number",
            20,
            "No company registration number was supplied during setup."
        ));
    }

    if (!company.website) {
        signals.push(signal("no_website", "No website", 12, "The company profile has no website to corroborate it."));
    }

    if (!company.contactName || !company.contactEmail || !company.contactPhone) {
        signals.push(signal(
            "incomplete_contact",
            "Incomplete hiring contact",
            18,
            "One or more of contact name, email and phone is missing."
        ));
    }

    if (!company.authorityConfirmedAt) {
        signals.push(signal(
            "authority_unconfirmed",
            "Hiring authority not confirmed",
            15,
            "The employer never confirmed they are authorised to hire for this company."
        ));
    }

    const words = normalise(description).split(" ").filter(Boolean).length;
    if (words < 20) {
        signals.push(signal(
            "thin_description",
            "Thin company description",
            16,
            `The description is ${words} word${words === 1 ? "" : "s"} long.`
        ));
    }

    if (/is hiring on spg talent network/i.test(description)) {
        signals.push(signal(
            "placeholder_description",
            "Auto-generated description never edited",
            14,
            "The profile still carries the placeholder text written at signup."
        ));
    }

    const name = String(company.name || user.companyName || "");
    if (name && /[0-9]{3,}/.test(name)) {
        signals.push(signal("numeric_name", "Digits in company name", 12, `Company name "${name}" contains a numeric run.`));
    }
    if (name && /^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(name.replace(/\s/g, ""))) {
        signals.push(signal("implausible_name", "Implausible company name", 25, `Company name "${name}" has no vowels.`));
    }

    const { jobCount = 0, accountAgeHours = null } = context;
    if (accountAgeHours !== null && accountAgeHours < 24 && jobCount >= 5) {
        signals.push(signal(
            "new_account_burst",
            "New account posting in volume",
            35,
            `${jobCount} jobs posted within ${Math.round(accountAgeHours)}h of the account being created.`
        ));
    }

    const score = scoreSignals(signals);
    return { category: "fake_company", signals, score, band: bandFor(score) };
};

// ─── 2. duplicate jobs ──────────────────────────────────────────────────────

/**
 * @param {object} job       The job being checked
 * @param {Array}  siblings  Other live jobs to compare against
 */
const duplicateJobSignals = (job = {}, siblings = []) => {
    const signals = [];
    const body = `${job.title || ""} ${job.description || ""} ${job.requirements || ""}`;
    const hash = contentHash(job.title, job.description, job.requirements);
    const own = shingles(body);
    let duplicateOfId = null;
    let bestSimilarity = 0;

    for (const other of siblings) {
        if (!other || other.id === job.id) continue;

        const otherHash = other.contentHash
            || contentHash(other.title, other.description, other.requirements);
        const sameEmployer = other.companyId === job.companyId;

        if (otherHash === hash) {
            duplicateOfId = other.id;
            bestSimilarity = 1;
            signals.push(signal(
                sameEmployer ? "exact_duplicate" : "cross_employer_duplicate",
                sameEmployer ? "Exact repost" : "Identical advert from another employer",
                sameEmployer ? 60 : 85,
                sameEmployer
                    ? `Word-for-word identical to "${other.title}".`
                    : `Word-for-word identical to "${other.title}" posted by a different account — typically a scraped advert.`
            ));
            break;
        }

        const similarity = jaccard(own, shingles(`${other.title || ""} ${other.description || ""} ${other.requirements || ""}`));
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            if (similarity >= 0.85) duplicateOfId = other.id;
        }
    }

    if (!duplicateOfId && bestSimilarity >= 0.7) {
        signals.push(signal(
            "near_duplicate",
            "Near-identical to an existing advert",
            Math.round(30 + (bestSimilarity - 0.7) * 100),
            `${Math.round(bestSimilarity * 100)}% of the wording is shared with another live advert.`
        ));
    } else if (duplicateOfId && bestSimilarity < 1) {
        signals.push(signal(
            "near_duplicate",
            "Near-identical to an existing advert",
            50,
            `${Math.round(bestSimilarity * 100)}% of the wording is shared with another live advert.`
        ));
    }

    const score = scoreSignals(signals);
    return {
        category: "duplicate_job",
        signals,
        score,
        band: bandFor(score),
        contentHash: hash,
        duplicateOfId,
        similarity: Number(bestSimilarity.toFixed(3)),
    };
};

// ─── 3. spam recruiters ─────────────────────────────────────────────────────

/**
 * @param {object} user  Employer user
 * @param {Array}  jobs  Their recent jobs
 */
const recruiterSignals = (user = {}, jobs = []) => {
    const signals = [];
    const corpus = jobs.map((j) => `${j.title || ""} ${j.description || ""} ${j.requirements || ""}`).join("\n");

    const feeHits = matchAny(FEE_PATTERNS, corpus);
    if (feeHits) {
        signals.push(signal(
            "candidate_fee",
            "Asks candidates for money",
            90,
            `${feeHits} advance-fee phrase${feeHits === 1 ? "" : "s"} found. Charging applicants breaches the no-fee hiring policy this employer accepted at setup.`
        ));
    }

    const harvestHits = matchAny(CREDENTIAL_HARVEST_PATTERNS, corpus);
    if (harvestHits) {
        signals.push(signal(
            "credential_harvest",
            "Requests financial or identity credentials",
            85,
            `${harvestHits} request${harvestHits === 1 ? "" : "s"} for bank, card or national ID details inside a job advert.`
        ));
    }

    const offsiteHits = matchAny(OFFSITE_CONTACT_PATTERNS, corpus);
    if (offsiteHits) {
        signals.push(signal(
            "offsite_contact",
            "Pushes applicants off-platform",
            40,
            `${offsiteHits} instruction${offsiteHits === 1 ? "" : "s"} to continue on WhatsApp, Telegram or direct message.`
        ));
    }

    // Same body text under several different titles: one advert sprayed across
    // the board to widen its net.
    const byBody = new Map();
    for (const job of jobs) {
        const key = contentHash(job.description);
        if (!key) continue;
        const entry = byBody.get(key) || { titles: new Set() };
        entry.titles.add(job.title || "");
        byBody.set(key, entry);
    }
    const sprayed = [...byBody.values()].find((entry) => entry.titles.size >= 3);
    if (sprayed) {
        signals.push(signal(
            "template_spray",
            "One advert under many titles",
            45,
            `The same job body appears under ${sprayed.titles.size} different titles.`
        ));
    }

    // Burst posting.
    const now = Date.now();
    const lastHour = jobs.filter((j) => j.createdAt && now - new Date(j.createdAt).getTime() < 3600_000);
    if (lastHour.length >= 10) {
        signals.push(signal(
            "posting_velocity",
            "Burst posting",
            45,
            `${lastHour.length} adverts published in the last hour.`
        ));
    }

    const shouty = jobs.filter((j) => j.title && j.title.length > 12 && j.title === j.title.toUpperCase());
    if (shouty.length >= 2) {
        signals.push(signal(
            "all_caps_titles",
            "Shouting titles",
            15,
            `${shouty.length} adverts have an all-capitals title.`
        ));
    }

    const linkHeavy = jobs.filter((j) => (String(j.description || "").match(/https?:\/\//g) || []).length >= 4);
    if (linkHeavy.length) {
        signals.push(signal(
            "link_stuffing",
            "Link-stuffed adverts",
            20,
            `${linkHeavy.length} advert${linkHeavy.length === 1 ? "" : "s"} carry four or more outbound links.`
        ));
    }

    // Pay far outside the Ghanaian market, paired with a body too thin to
    // justify it, is the classic bait.
    const baited = jobs.filter((j) => {
        const thin = normalise(j.description).split(" ").filter(Boolean).length < 60;
        return thin && Number(j.salaryMin) >= 100000;
    });
    if (baited.length) {
        signals.push(signal(
            "implausible_pay",
            "Implausible pay on a thin advert",
            35,
            `${baited.length} advert${baited.length === 1 ? "" : "s"} promise GH₵100k+/month with almost no detail.`
        ));
    }

    const score = scoreSignals(signals);
    return { category: "spam_recruiter", signals, score, band: bandFor(score) };
};

// ─── 4. fake resumes ────────────────────────────────────────────────────────

const parseYear = (value) => {
    const match = /(19|20)\d{2}/.exec(String(value || ""));
    return match ? Number(match[0]) : null;
};

/**
 * @param {object} analysis  Stored ResumeAnalysis (profile, signals, redFlags)
 * @param {object} context   { duplicateOwnerCount, accountEmail }
 */
const resumeSignals = (analysis = {}, context = {}) => {
    const signals = [];
    const profile = analysis.profile || {};
    const text = String(analysis.resumeText || "");
    const words = normalise(text).split(" ").filter(Boolean);

    // The same file already analysed under a different account.
    if (Number(context.duplicateOwnerCount) > 0) {
        signals.push(signal(
            "shared_resume",
            "Identical resume on another account",
            70,
            `This exact file has been analysed under ${context.duplicateOwnerCount} other account${context.duplicateOwnerCount === 1 ? "" : "s"}.`
        ));
    }

    // Keyword stuffing: a handful of terms dominating the document, which is
    // how a resume is gamed past a keyword-matching ATS.
    if (words.length >= 120) {
        const counts = new Map();
        for (const word of words) {
            if (word.length < 4) continue;
            counts.set(word, (counts.get(word) || 0) + 1);
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topShare = top.reduce((sum, [, n]) => sum + n, 0) / words.length;
        if (topShare > 0.18) {
            signals.push(signal(
                "keyword_stuffing",
                "Keyword stuffing",
                40,
                `The five commonest terms make up ${Math.round(topShare * 100)}% of the document (${top.map(([w]) => w).join(", ")}).`
            ));
        }
    }

    // Timeline arithmetic.
    const experience = Array.isArray(profile.experience) ? profile.experience : [];
    const currentYear = new Date().getFullYear();
    const starts = experience.map((e) => parseYear(e.start)).filter(Boolean);
    const futureDated = experience.filter((e) => {
        const start = parseYear(e.start);
        return start && start > currentYear;
    });
    if (futureDated.length) {
        signals.push(signal(
            "future_dated_role",
            "Role starts in the future",
            45,
            `${futureDated.length} listed role${futureDated.length === 1 ? "" : "s"} begin after ${currentYear}.`
        ));
    }

    const claimedYears = Number(profile.yearsOfExperience);
    if (Number.isFinite(claimedYears) && starts.length) {
        const span = currentYear - Math.min(...starts);
        if (claimedYears > span + 2) {
            signals.push(signal(
                "experience_overclaim",
                "Claimed experience exceeds career span",
                50,
                `Claims ${claimedYears} years, but the earliest role listed began ${span} years ago.`
            ));
        }
    }

    // Concurrent full-time roles.
    const ranges = experience
        .map((e) => ({ start: parseYear(e.start), end: parseYear(e.end) || currentYear, title: e.title }))
        .filter((r) => r.start)
        .sort((a, b) => a.start - b.start);
    let overlaps = 0;
    for (let i = 1; i < ranges.length; i += 1) {
        if (ranges[i].start < ranges[i - 1].end - 1) overlaps += 1;
    }
    if (overlaps >= 2) {
        signals.push(signal(
            "overlapping_roles",
            "Overlapping full-time roles",
            30,
            `${overlaps} listed roles overlap by more than a year.`
        ));
    }

    // Contact details that do not belong to the account holder.
    const profileDomain = domainOf(profile.email || "");
    const accountDomain = domainOf(context.accountEmail || "");
    if (profile.email && context.accountEmail
        && String(profile.email).toLowerCase() !== String(context.accountEmail).toLowerCase()
        && profileDomain !== accountDomain) {
        signals.push(signal(
            "contact_mismatch",
            "Resume contact differs from account",
            22,
            `The resume lists ${profile.email} while the account is ${context.accountEmail}.`
        ));
    }

    // Senior claim on a near-empty document.
    const seniority = String(profile.seniority || "").toLowerCase();
    if (words.length < 150 && ["senior", "lead", "executive"].includes(seniority)) {
        signals.push(signal(
            "thin_senior_claim",
            "Senior claim on a thin document",
            28,
            `Only ${words.length} words, yet presented at ${seniority} level.`
        ));
    }

    // Red flags the analysis model already surfaced.
    const redFlags = Array.isArray(analysis.redFlags) ? analysis.redFlags : [];
    if (redFlags.length >= 3) {
        signals.push(signal(
            "analysis_red_flags",
            "Multiple resume red flags",
            20,
            `The resume analysis raised ${redFlags.length} red flags.`
        ));
    }

    const score = scoreSignals(signals);
    return { category: "fake_resume", signals, score, band: bandFor(score) };
};

module.exports = {
    BANDS,
    bandFor,
    scoreSignals,
    contentHash,
    shingles,
    jaccard,
    normalise,
    domainOf,
    companySignals,
    duplicateJobSignals,
    recruiterSignals,
    resumeSignals,
    FREE_EMAIL_DOMAINS,
    DISPOSABLE_EMAIL_DOMAINS,
};
