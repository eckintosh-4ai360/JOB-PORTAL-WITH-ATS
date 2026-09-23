/**
 * The pieces of a CV or an account that can show two records are one person:
 * contact details, the file itself, and the wording.
 *
 * Everything here is deterministic and cheap. Names are normalised too, but a
 * name is only ever supporting evidence — "Kwame Mensah" is not one person.
 */

const crypto = require("crypto");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// Shared mailboxes are not a person. A CV that lists hr@company.com as a
// reference must not tie its owner to every colleague who did the same.
const ROLE_MAILBOXES = new Set([
    "info", "hr", "admin", "contact", "careers", "career", "jobs", "job", "recruitment",
    "recruiting", "support", "hello", "noreply", "no-reply", "office", "enquiries",
    "enquiry", "sales", "mail", "email", "yourname", "name", "example",
]);

/**
 * The inbox an address delivers to. Gmail ignores dots and anything after a
 * plus; most providers ignore the plus tag. "K.Mensah+jobs@gmail.com" and
 * "kmensah@gmail.com" are the same inbox.
 */
const normalizeEmail = (value) => {
    const email = String(value || "").trim().toLowerCase();
    const match = /^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/.exec(email);
    if (!match) return null;
    let [, local, domain] = match;
    if (domain === "googlemail.com") domain = "gmail.com";
    local = local.split("+")[0];
    if (GMAIL_DOMAINS.has(domain)) local = local.replace(/\./g, "");
    if (!local) return null;
    return `${local}@${domain}`;
};

const isPersonalEmail = (normalized) => {
    if (!normalized) return false;
    const local = normalized.split("@")[0];
    return !ROLE_MAILBOXES.has(local);
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * A phone number in one canonical form: Ghanaian numbers as 233XXXXXXXXX,
 * anything else as its international digits. Returns null for anything that
 * is not plausibly a phone number — years, dates and short codes.
 */
const normalizePhone = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length === 10 && digits.startsWith("0")) digits = `233${digits.slice(1)}`;
    if (digits.length < 10 || digits.length > 15) return null;
    // "024 000 0000" and "024 111 1111" are placeholders, not numbers — the
    // subscriber digits after the network prefix give them away.
    if (new Set(digits.slice(-7)).size <= 2) return null;
    return digits;
};

/** "233241234567" → "+233 24 123 4567". */
const formatPhone = (normalized) => {
    if (!normalized) return "";
    if (normalized.startsWith("233") && normalized.length === 12) {
        const rest = normalized.slice(3);
        return `+233 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
    }
    return `+${normalized}`;
};

// ---------------------------------------------------------------------------
// Contacts on a CV
// ---------------------------------------------------------------------------

// A candidate's own details sit in the header. Referees, previous employers
// and schools come later, and are shared by many people.
const HEADER_CHARS = 800;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,18}\d/g;

const extractContacts = (text) => {
    const header = String(text || "").slice(0, HEADER_CHARS);
    const emails = [...new Set((header.match(EMAIL_PATTERN) || []).map(normalizeEmail).filter(isPersonalEmail))];
    const phones = [...new Set((header.match(PHONE_PATTERN) || []).map(normalizePhone).filter(Boolean))];
    return { emails: emails.slice(0, 5), phones: phones.slice(0, 5) };
};

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "rev", "sir", "madam", "mx", "eng", "hon"]);

const nameTokens = (value) =>
    String(value || "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z\s'-]/g, " ")
        .split(/[\s'-]+/)
        .filter((token) => token.length >= 2 && !TITLES.has(token));

/** Same name in any order: "Mensah Kwame" is "Kwame Mensah". */
const nameKey = (value) => [...new Set(nameTokens(value))].sort().join(" ");

/**
 * How two names relate: "same", "similar" (a shared first and last name with
 * a middle name added or dropped), "different" (nothing in common), or null
 * when either is unknown.
 */
const compareNames = (a, b) => {
    const ta = new Set(nameTokens(a));
    const tb = new Set(nameTokens(b));
    if (!ta.size || !tb.size) return null;
    if (nameKey(a) === nameKey(b)) return "same";
    const shared = [...ta].filter((token) => tb.has(token)).length;
    if (shared === 0) return "different";
    if (shared >= 2 && shared / Math.min(ta.size, tb.size) >= 2 / 3) return "similar";
    return "partial";
};

// ---------------------------------------------------------------------------
// Wording: exact text hash and MinHash for near-duplicates
// ---------------------------------------------------------------------------

const SHINGLE_WORDS = 5;
const SIGNATURE_SIZE = 64;
const BANDS = 16;
const ROWS = SIGNATURE_SIZE / BANDS;

const textTokens = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean);

/** FNV-1a, 32-bit. */
const fnv1a = (value) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

/** MurmurHash3's finaliser — spreads one hash into many independent ones. */
const mix = (value) => {
    let h = value;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
};

const SEEDS = Array.from({ length: SIGNATURE_SIZE }, (_, i) => mix((i + 1) * 0x9e3779b1));

/**
 * The fingerprint of a CV's wording.
 *   textHash — identical after normalising case, punctuation and spacing, so
 *              the same CV saved as PDF and as DOCX still matches;
 *   minhash  — a 64-number signature whose agreement estimates how much of the
 *              wording two CVs share (Jaccard over five-word shingles).
 * Values are stored as signed 32-bit integers to fit a Postgres int column.
 */
const textFeatures = (text) => {
    const tokens = textTokens(text);
    if (tokens.length < 20) return { textHash: null, minhash: [] };

    const textHash = sha256(tokens.join(" "));
    const shingles = new Set();
    for (let i = 0; i + SHINGLE_WORDS <= tokens.length; i += 1) {
        shingles.add(tokens.slice(i, i + SHINGLE_WORDS).join(" "));
    }

    const signature = new Array(SIGNATURE_SIZE).fill(0xffffffff);
    for (const shingle of shingles) {
        const base = fnv1a(shingle);
        for (let i = 0; i < SIGNATURE_SIZE; i += 1) {
            const value = mix(base ^ SEEDS[i]);
            if (value < signature[i]) signature[i] = value;
        }
    }

    return { textHash, minhash: signature.map((value) => value | 0) };
};

/** Estimated share of wording two CVs have in common, 0–1. */
const similarity = (a, b) => {
    if (!a?.length || a.length !== b?.length) return 0;
    let equal = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) equal += 1;
    return equal / a.length;
};

/** LSH band keys: two signatures sharing any band are worth comparing. */
const bandKeys = (minhash) => {
    if (minhash?.length !== SIGNATURE_SIZE) return [];
    const keys = [];
    for (let band = 0; band < BANDS; band += 1) {
        keys.push(`${band}:${minhash.slice(band * ROWS, band * ROWS + ROWS).join(",")}`);
    }
    return keys;
};

module.exports = {
    sha256,
    normalizeEmail,
    isPersonalEmail,
    normalizePhone,
    formatPhone,
    extractContacts,
    nameTokens,
    nameKey,
    compareNames,
    textFeatures,
    similarity,
    bandKeys,
    SIGNATURE_SIZE,
};
