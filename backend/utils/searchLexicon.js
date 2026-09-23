/**
 * Vocabularies behind advanced job search.
 *
 * Search on this portal has to work for a nurse in Tamale and a Series B
 * fintech in Accra alike, so the vocabulary is deliberately broad and local
 * rather than tech-only. Everything here is data: the parser (utils/queryParser)
 * reads it to turn a sentence into filters, and the search service reads it to
 * expand a term into the other words that mean the same thing.
 *
 * Keeping it in one module means a new synonym improves both query parsing and
 * ranking at once, and there is a single place to look when a search misses
 * something it should have found.
 */

/** Lowercase, strip punctuation that never carries meaning in a query. */
const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[‘’“”]/g, "'")
        .replace(/[^a-z0-9+#/.&'\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Tokens worth indexing — drops the words that match everything. */
const STOP_WORDS = new Set([
    "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "do",
    "for", "from", "get", "has", "have", "i", "in", "into", "is", "it", "its",
    "job", "jobs", "like", "looking", "me", "my", "need", "new", "of", "on",
    "or", "please", "position", "positions", "role", "roles", "show", "some",
    "that", "the", "their", "them", "there", "they", "this", "to", "want",
    "wanted", "was", "we", "who", "with", "within", "work", "would", "you",
    "your", "opportunity", "opportunities", "vacancy", "vacancies", "hiring",
    "find", "search", "near", "around", "experience", "experienced",
]);

const tokenize = (value) =>
    normalize(value)
        .split(" ")
        .map((token) => token.replace(/^[-'/.]+|[-'/.]+$/g, ""))
        .filter(Boolean);

const contentTokens = (value) =>
    tokenize(value).filter((token) => token.length > 1 && !STOP_WORDS.has(token));

// ---------------------------------------------------------------------------
// Places
//
// The regions and cities people actually type, with the spellings they type
// them with. `region` lets a search for "Ashanti" surface a job posted in
// "Kumasi", and the neighbourhood aliases let "East Legon" resolve to Accra.
// ---------------------------------------------------------------------------

const PLACES = [
    { canonical: "Accra", region: "Greater Accra", aliases: ["accra", "greater accra", "gt accra", "acra", "osu", "east legon", "madina", "adenta", "spintex", "airport residential", "labone", "dansoman", "achimota", "kasoa", "weija"] },
    { canonical: "Tema", region: "Greater Accra", aliases: ["tema", "tema industrial area", "ashaiman", "sakumono"] },
    { canonical: "Kumasi", region: "Ashanti", aliases: ["kumasi", "ashanti", "ashanti region", "kumase", "adum", "asokwa", "ejisu", "obuasi", "suame"] },
    { canonical: "Takoradi", region: "Western", aliases: ["takoradi", "sekondi", "sekondi-takoradi", "western region", "tarkwa", "axim"] },
    { canonical: "Tamale", region: "Northern", aliases: ["tamale", "northern region", "yendi", "savelugu"] },
    { canonical: "Cape Coast", region: "Central", aliases: ["cape coast", "capecoast", "central region", "elmina", "winneba", "mankessim"] },
    { canonical: "Koforidua", region: "Eastern", aliases: ["koforidua", "eastern region", "nkawkaw", "akosombo", "suhum", "begoro"] },
    { canonical: "Ho", region: "Volta", aliases: ["ho", "volta", "volta region", "hohoe", "keta", "aflao"] },
    { canonical: "Sunyani", region: "Bono", aliases: ["sunyani", "bono", "bono region", "berekum", "techiman", "dormaa"] },
    { canonical: "Bolgatanga", region: "Upper East", aliases: ["bolgatanga", "bolga", "upper east", "navrongo", "bawku"] },
    { canonical: "Wa", region: "Upper West", aliases: ["wa", "upper west", "wa municipal"] },
    { canonical: "Ghana", region: "Ghana", aliases: ["ghana", "nationwide", "countrywide"] },
];

// ---------------------------------------------------------------------------
// Work model, employment type, seniority, education, company stage
// ---------------------------------------------------------------------------

const WORK_MODELS = [
    { key: "remote", label: "Remote", patterns: ["remote", "remotely", "work from home", "wfh", "fully remote", "anywhere", "distributed", "telecommute"] },
    { key: "hybrid", label: "Hybrid", patterns: ["hybrid", "part remote", "partly remote", "flexible location", "blended"] },
    { key: "onsite", label: "On-site", patterns: ["on-site", "onsite", "on site", "in office", "in-office", "office based", "office-based", "in person", "on premise"] },
];

const EMPLOYMENT_TYPES = [
    { key: "full-time", label: "Full-Time", patterns: ["full time", "full-time", "fulltime", "permanent"] },
    { key: "part-time", label: "Part-Time", patterns: ["part time", "part-time", "parttime"] },
    { key: "contract", label: "Contract", patterns: ["contract", "contractor", "freelance", "consultancy", "consultant", "fixed term", "fixed-term"] },
    { key: "internship", label: "Internship", patterns: ["internship", "intern", "national service", "nss", "attachment", "trainee", "graduate scheme"] },
    { key: "temporary", label: "Temporary", patterns: ["temporary", "temp", "seasonal", "casual", "locum"] },
    { key: "volunteer", label: "Volunteer", patterns: ["volunteer", "voluntary", "pro bono"] },
];

/**
 * Seniority bands. `minYears`/`maxYears` let a posting that only states
 * "5+ years" still be placed on the ladder, and let "3 years experience" in a
 * query resolve to a band instead of being thrown away.
 */
const SENIORITY_LEVELS = [
    { key: "intern", label: "Intern / Trainee", rank: 0, minYears: 0, maxYears: 0, patterns: ["intern", "internship", "trainee", "national service", "nss", "apprentice", "student"] },
    { key: "entry", label: "Entry level", rank: 1, minYears: 0, maxYears: 2, patterns: ["entry level", "entry-level", "graduate", "junior", "jr", "fresh graduate", "no experience", "beginner"] },
    { key: "mid", label: "Mid level", rank: 2, minYears: 2, maxYears: 5, patterns: ["mid level", "mid-level", "intermediate", "associate", "experienced"] },
    { key: "senior", label: "Senior", rank: 3, minYears: 5, maxYears: 8, patterns: ["senior", "snr", "sr", "specialist", "expert", "advanced"] },
    { key: "lead", label: "Lead / Manager", rank: 4, minYears: 7, maxYears: 12, patterns: ["lead", "team lead", "tech lead", "principal", "staff engineer", "manager", "supervisor", "head of"] },
    { key: "executive", label: "Executive", rank: 5, minYears: 10, maxYears: 40, patterns: ["director", "executive", "chief", "cto", "ceo", "cfo", "coo", "vp", "vice president", "general manager", "country manager"] },
];

/** Shares its keys with matchEngine's EDUCATION_LEVELS so the two agree. */
const EDUCATION_OPTIONS = [
    { key: "secondary", label: "Secondary / WASSCE", rank: 1, patterns: ["wassce", "ssce", "o level", "a level", "high school", "secondary school", "shs"] },
    { key: "certificate", label: "Certificate", rank: 2, patterns: ["certificate", "nvti", "vocational", "technical certificate", "city and guilds"] },
    { key: "diploma", label: "Diploma / HND", rank: 3, patterns: ["diploma", "hnd", "higher national", "associate degree"] },
    { key: "bachelor", label: "Bachelor degree", rank: 4, patterns: ["bachelor", "bachelors", "bsc", "b.sc", "ba", "b.a", "beng", "btech", "bcom", "degree", "first degree", "undergraduate"] },
    { key: "master", label: "Master degree", rank: 5, patterns: ["master", "masters", "msc", "m.sc", "mba", "meng", "mphil", "postgraduate", "post graduate"] },
    { key: "doctorate", label: "Doctorate", rank: 6, patterns: ["phd", "ph.d", "doctorate", "doctoral", "dphil"] },
];

/**
 * Funding / maturity stage. The phrase people search with ("series A/B") is
 * rarely the phrase an employer typed into their profile ("Series B", "Growth",
 * "Scale-up"), so each stage carries every spelling we expect to see stored.
 */
const COMPANY_STAGES = [
    { key: "idea", label: "Idea / Pre-seed", patterns: ["pre-seed", "pre seed", "preseed", "idea stage", "founding"] },
    { key: "seed", label: "Seed", patterns: ["seed", "seed stage", "seed-stage", "early stage", "early-stage"] },
    { key: "series-a", label: "Series A", patterns: ["series a", "series-a", "seriesa", "a round", "round a"] },
    { key: "series-b", label: "Series B", patterns: ["series b", "series-b", "seriesb", "b round", "round b"] },
    { key: "series-c", label: "Series C+", patterns: ["series c", "series-c", "series d", "series e", "late stage", "late-stage", "pre-ipo"] },
    { key: "growth", label: "Growth / Scale-up", patterns: ["growth", "scale up", "scale-up", "scaleup", "scaling", "expansion"] },
    { key: "bootstrapped", label: "Bootstrapped", patterns: ["bootstrapped", "self funded", "self-funded", "profitable"] },
    { key: "sme", label: "SME", patterns: ["sme", "small business", "small and medium", "family business"] },
    { key: "enterprise", label: "Enterprise", patterns: ["enterprise", "corporate", "multinational", "large company", "blue chip"] },
    { key: "public", label: "Public / Listed", patterns: ["publicly traded", "listed company", "plc", "ipo"] },
    { key: "government", label: "Government", patterns: ["government", "public sector", "ministry", "state owned", "state-owned", "parastatal"] },
    { key: "nonprofit", label: "Nonprofit / NGO", patterns: ["ngo", "non-profit", "nonprofit", "not for profit", "charity", "development agency", "donor funded"] },
];

/**
 * Industry buckets. `categories` lists the values the job-posting form writes,
 * so one industry filter covers both a job's own category and its employer's
 * declared industry.
 */
const INDUSTRIES = [
    // "it" is deliberately absent: matched loosely it swallows half the board,
    // and matched strictly it is too rare to earn its place. Broad terms like
    // "engineering" and "data" are safe here only because INDUSTRY_MATCH_ORDER
    // in the search service tests technology last.
    { key: "technology", label: "Technology", categories: ["technology"], patterns: ["technology", "tech", "software", "information technology", "saas", "fintech", "telecom", "telecommunications", "engineering", "cloud", "data", "analytics", "product", "devops", "cyber", "cybersecurity"] },
    { key: "healthcare", label: "Healthcare & Pharmaceuticals", categories: ["healthcare"], patterns: ["healthcare", "health", "healthtech", "hospital", "clinic", "clinical", "medical", "pharmaceutical", "pharma", "nursing", "social care"] },
    { key: "education", label: "Education & Training", categories: ["education"], patterns: ["education", "school", "teaching", "training", "university", "academic", "edtech"] },
    { key: "finance", label: "Accounting & Finance", categories: ["finance"], patterns: ["finance", "financial", "accounting", "bank", "banking", "insurance", "audit", "investment", "microfinance", "payment", "payments", "remittance", "mobile money", "treasury"] },
    { key: "business", label: "Professional Services", categories: ["business"], patterns: ["professional services", "consulting", "consultancy", "legal", "law firm", "business services", "advisory", "human resources"] },
    { key: "sales", label: "Sales & Marketing", categories: ["sales"], patterns: ["sales", "marketing", "advertising", "media", "creative", "customer service", "public relations", "brand"] },
    { key: "construction", label: "Construction & Manufacturing", categories: ["construction"], patterns: ["construction", "manufacturing", "real estate", "building", "civil", "trades", "artisan", "factory", "production"] },
    { key: "hospitality", label: "Hospitality & Retail", categories: ["hospitality"], patterns: ["hospitality", "hotel", "restaurant", "retail", "tourism", "fmcg", "catering", "travel"] },
    { key: "transport", label: "Logistics & Transport", categories: ["transport"], patterns: ["logistics", "transport", "transportation", "supply chain", "shipping", "haulage", "delivery", "warehouse"] },
    { key: "energy", label: "Energy & Utilities", categories: ["energy"], patterns: ["energy", "oil", "gas", "power", "utilities", "mining", "solar", "renewable"] },
    { key: "agriculture", label: "Agriculture", categories: ["agriculture"], patterns: ["agriculture", "agric", "farming", "agribusiness", "cocoa", "agro", "fisheries"] },
    { key: "government", label: "Government & Nonprofit", categories: ["government"], patterns: ["public sector", "nonprofit", "ngo", "development", "community", "civil service"] },
];

/**
 * Role families for semantic expansion.
 *
 * A candidate searching "Software Engineer" should see a posting titled
 * "Backend Developer", and someone searching "driver" should see "dispatch
 * rider". Each entry is a bag of interchangeable titles: matching any of them
 * pulls in the rest at a reduced weight.
 */
const ROLE_FAMILIES = [
    ["software engineer", "software developer", "developer", "programmer", "swe", "software engineering", "full stack", "fullstack", "backend", "back-end", "frontend", "front-end", "web developer", "application developer", "mobile developer", "android developer", "ios developer"],
    ["data analyst", "data analytics", "business analyst", "bi analyst", "business intelligence", "reporting analyst", "insights analyst"],
    ["data scientist", "machine learning engineer", "ml engineer", "ai engineer", "data science"],
    ["devops engineer", "site reliability engineer", "sre", "platform engineer", "cloud engineer", "infrastructure engineer", "systems engineer"],
    ["qa engineer", "quality assurance", "test engineer", "software tester", "qa analyst"],
    ["product manager", "product owner", "programme manager", "program manager", "delivery manager", "scrum master"],
    ["project manager", "project coordinator", "project officer", "pmo"],
    ["ui designer", "ux designer", "product designer", "graphic designer", "visual designer", "web designer", "creative designer"],
    ["accountant", "accounts officer", "finance officer", "bookkeeper", "auditor", "financial analyst", "treasury officer"],
    ["teacher", "tutor", "lecturer", "instructor", "educator", "facilitator", "teaching assistant"],
    ["nurse", "registered nurse", "staff nurse", "midwife", "nursing officer", "clinical nurse"],
    ["doctor", "medical officer", "physician", "clinician", "house officer", "general practitioner"],
    ["pharmacist", "pharmacy technician", "dispensary assistant"],
    ["lab technician", "laboratory scientist", "biomedical scientist", "medical laboratory"],
    ["sales representative", "sales executive", "sales officer", "business development", "account executive", "field sales", "sales agent", "merchandiser"],
    ["marketing officer", "marketing executive", "digital marketer", "social media manager", "brand manager", "growth marketer", "content marketer"],
    ["customer service", "customer support", "call centre agent", "call center agent", "client relations", "customer care", "help desk", "service desk"],
    ["human resources", "hr officer", "hr manager", "people operations", "talent acquisition", "recruiter", "recruitment officer"],
    ["administrative assistant", "office administrator", "secretary", "front desk", "receptionist", "office assistant", "personal assistant", "executive assistant"],
    ["driver", "dispatch rider", "chauffeur", "delivery rider", "truck driver", "logistics driver"],
    ["security officer", "security guard", "watchman", "safety officer"],
    ["electrician", "electrical technician", "wireman", "electrical engineer"],
    ["plumber", "pipefitter", "plumbing technician"],
    ["mechanic", "auto technician", "vehicle technician", "fitter"],
    ["welder", "fabricator", "metal worker"],
    ["carpenter", "joiner", "furniture maker"],
    ["mason", "bricklayer", "block layer", "tiler"],
    ["civil engineer", "structural engineer", "site engineer", "quantity surveyor", "construction manager"],
    ["chef", "cook", "kitchen assistant", "sous chef", "caterer"],
    ["waiter", "waitress", "steward", "server", "bartender"],
    ["store keeper", "storekeeper", "warehouse assistant", "inventory officer", "stock controller"],
    ["procurement officer", "purchasing officer", "supply chain officer", "buyer"],
    ["operations manager", "operations officer", "general manager", "branch manager", "country manager"],
    ["legal officer", "lawyer", "solicitor", "legal counsel", "paralegal", "compliance officer"],
    ["social worker", "community officer", "field officer", "programme officer", "monitoring and evaluation"],
    ["journalist", "reporter", "editor", "content writer", "copywriter", "communications officer"],
    ["cashier", "teller", "bank teller", "sales assistant", "shop assistant"],
    ["cleaner", "janitor", "housekeeper", "custodian"],
];

/** Every phrase that appears in a role family, mapped to the families it is in. */
const ROLE_INDEX = (() => {
    const index = new Map();
    ROLE_FAMILIES.forEach((family, familyId) => {
        for (const phrase of family) {
            const key = normalize(phrase);
            if (!index.has(key)) index.set(key, new Set());
            index.get(key).add(familyId);
        }
    });
    return index;
})();

/**
 * Widen a phrase to the other phrases that mean the same job.
 * Returns every sibling in any family the phrase belongs to, itself excluded.
 */
const expandRole = (phrase) => {
    const key = normalize(phrase);
    const families = ROLE_INDEX.get(key);
    if (!families) return [];

    const expanded = new Set();
    for (const familyId of families) {
        for (const sibling of ROLE_FAMILIES[familyId]) {
            if (normalize(sibling) !== key) expanded.add(sibling);
        }
    }
    return [...expanded];
};

/** Relative date windows a query can name. */
const DATE_WINDOWS = [
    { key: "24h", label: "Last 24 hours", days: 1, patterns: ["today", "last 24 hours", "past 24 hours", "last day", "past day", "24 hours", "just posted"] },
    { key: "3d", label: "Last 3 days", days: 3, patterns: ["last 3 days", "past 3 days", "three days"] },
    { key: "7d", label: "Last 7 days", days: 7, patterns: ["this week", "last week", "past week", "last 7 days", "past 7 days", "seven days"] },
    { key: "14d", label: "Last 14 days", days: 14, patterns: ["last two weeks", "past two weeks", "last 14 days", "fortnight"] },
    { key: "30d", label: "Last 30 days", days: 30, patterns: ["this month", "last month", "past month", "last 30 days", "past 30 days"] },
];

module.exports = {
    normalize,
    tokenize,
    contentTokens,
    STOP_WORDS,
    PLACES,
    WORK_MODELS,
    EMPLOYMENT_TYPES,
    SENIORITY_LEVELS,
    EDUCATION_OPTIONS,
    COMPANY_STAGES,
    INDUSTRIES,
    ROLE_FAMILIES,
    expandRole,
    DATE_WINDOWS,
};
