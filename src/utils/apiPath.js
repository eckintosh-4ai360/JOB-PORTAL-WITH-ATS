const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

// The API host is baked into the bundle at build time. A loopback host works
// from this machine but points every other device on the LAN at *itself*, so
// opening the dev server at http://192.168.x.x:5173 from a phone fails with a
// refused connection. When the configured host is loopback but the page is not
// being served from one, reuse the hostname the page came from, keeping the
// configured port: http://192.168.x.x:5173 then calls http://192.168.x.x:8000.
// Deployed builds set VITE_API_URL to a real host and are left alone.
function resolveBaseUrl(configured) {
  if (typeof window === "undefined") return configured;
  if (LOOPBACK_HOSTS.includes(window.location.hostname)) return configured;

  let url;
  try {
    url = new URL(configured);
  } catch {
    return configured;
  }

  if (!LOOPBACK_HOSTS.includes(url.hostname)) return configured;

  url.hostname = window.location.hostname;
  return url.origin;
}

export const BASE_URL = resolveBaseUrl(CONFIGURED_API_URL);

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/auth/register", // Signup
    LOGIN: "/api/auth/login", // Authenticate user & return JWT token
    CLERK_AUTH: "/api/auth/clerk", // Google OAuth via Clerk → JWT
    GET_PROFILE: "/api/auth/me", // Get logged-in user details
    UPDATE_PROFILE: "/api/user/profile", // Update profile details
    DELETE_RESUME: "/api/user/resume", // Delete Resume details
    UPLOAD_RESUME: "/api/user/upload-resume", // Upload Resume file
  },

  DASHBOARD: {
    OVERVIEW: "/api/analytics",
  },

  JOBS: {
    GET_ALL_JOBS: "/api/jobs",

    // Advanced search. SEARCH accepts a natural-language `q` plus any of the
    // filters, and answers with ranked jobs, facet counts and its reading of
    // the query. SUGGEST powers autocomplete; OPTIONS supplies the filter
    // vocabularies so the client never keeps its own copy of them.
    SEARCH: "/api/jobs/search",
    SEARCH_SUGGEST: "/api/jobs/search/suggest",
    SEARCH_OPTIONS: "/api/jobs/search/options",
    TRENDING: "/api/jobs/search/trending",

    GET_COMPANIES: "/api/jobs/companies",
    GET_JOB_BY_ID: (id) => `/api/jobs/${id}`,
    POST_JOB: "/api/jobs",
    GET_JOBS_EMPLOYER: "/api/jobs/employer/my-jobs",
    UPDATE_JOB: (id) => `/api/jobs/${id}`,
    TOGGLE_CLOSE: (id) => `/api/jobs/${id}/close`,
    DELETE_JOB: (id) => `/api/jobs/${id}`,
    SAVE_JOB: (id) => `/api/saved-jobs/${id}`,
    UNSAVE_JOB: (id) => `/api/saved-jobs/${id}`,
    GET_SAVED_JOBS: "/api/saved-jobs",
  },

  // Platform control — company review, accounts and postings oversight.
  ADMIN: {
    OVERVIEW: "/api/admin/overview",
    GET_COMPANIES: "/api/admin/companies",
    GET_COMPANY: (id) => `/api/admin/companies/${id}`,
    START_COMPANY_REVIEW: (id) => `/api/admin/companies/${id}/review`,
    DECIDE_COMPANY: (id) => `/api/admin/companies/${id}/decision`,
    GET_ACCOUNTS: "/api/admin/accounts",
    DUPLICATES: "/api/admin/duplicates",
    DUPLICATES_SCAN: "/api/admin/duplicates/scan",
    DUPLICATES_REVIEW: "/api/admin/duplicates/review",
    GET_JOBS: "/api/admin/jobs",
  },

  MODERATION: {
    GET_STATS: "/api/moderation/stats",
    GET_CASES: "/api/moderation/cases",
    GET_CASE: (id) => `/api/moderation/cases/${id}`,
    DECIDE_CASE: (id) => `/api/moderation/cases/${id}/decision`,
    RESCAN: "/api/moderation/rescan",
  },

  APPLICATIONS: {
    APPLY_FOR_JOB: (id) => `/api/applications/${id}`,
    GET_APPLICANT: (id) => `/api/applications/job/${id}`,
    UPDATE_STATUS: (id) => `/api/applications/${id}/status`,
    GET_MY_APPLICATIONS: "/api/applications/my-applications",
    WITHDRAW_APPLICATION: (id) => `/api/applications/${id}`,
    GET_READINESS: (jobId) => `/api/applications/readiness/${jobId}`,
    GET_PIPELINE: "/api/applications/pipeline",
    DUPLICATES: "/api/applications/duplicates",
    DUPLICATE_GROUPS: "/api/applications/duplicates/groups",
    DUPLICATES_REVIEW: "/api/applications/duplicates/review",
    UPDATE_PIPELINE: "/api/applications/pipeline",
    // Every application to the employer's jobs: filters, paging, stage counts
    GET_EMPLOYER_APPLICATIONS: "/api/applications/employer",
  },

  // Reusable job adverts
  JOB_TEMPLATES: {
    LIST: "/api/job-templates",
    CREATE: "/api/job-templates",
    GET: (id) => `/api/job-templates/${id}`,
    UPDATE: (id) => `/api/job-templates/${id}`,
    DELETE: (id) => `/api/job-templates/${id}`,
  },

  // The employer's private shortlist, and assisted suggestions for it
  SHORTLISTS: {
    OVERVIEW: "/api/shortlists",
    JOB: (jobId) => `/api/shortlists/${jobId}`,
    CANDIDATES: (jobId) => `/api/shortlists/${jobId}/candidates`,
    ADVANCE: (jobId) => `/api/shortlists/${jobId}/advance`,
    ADD: "/api/shortlists/add",
    REMOVE: "/api/shortlists/remove",
    NOTE: (applicationId) => `/api/shortlists/note/${applicationId}`,
  },

  // Previews (JSON) and downloads (?format=csv|xlsx|pdf)
  REPORTS: {
    LIST: "/api/reports",
    GET: (type) => `/api/reports/${type}`,
  },

  IMAGE: {
    UPLOAD_IMAGE: "/api/auth/upload-image",  // upload profile image

},

  DOCUMENTS: {
    GET_DOCUMENTS: "/api/user/documents",
    UPLOAD_DOCUMENT: "/api/user/documents",
    DELETE_DOCUMENT: (id) => `/api/user/documents/${id}`,
  },

  COMPANIES: {
    GET_ALL: "/api/companies",
    GET_BY_ID: (id) => `/api/companies/${id}`,
    GET_MY_PROFILE: "/api/companies/me/profile",
    UPDATE_MY_PROFILE: "/api/companies/me/profile",
  },

  SALARIES: {
    GET_BENCHMARKS: "/api/salaries/benchmarks",
    GET_SKILLS: "/api/salaries/skills",
    GET_SUBMISSIONS: "/api/salaries/submissions",
    SUBMIT: "/api/salaries/submit",
  },

  EMAIL_TEMPLATES: {
    GET_ALL: "/api/email-templates",
    UPDATE: (key) => `/api/email-templates/${key}`,
  },

  // AI — resume analysis and job matching (Groq / openai-gpt-oss-120b)
  AI: {
    STATUS: "/api/ai/status",

    // Resume analysis. ANALYZE_RESUME accepts a multipart file upload, a
    // pasted resumeText, a documentId, or a resumeUrl.
    ANALYZE_RESUME: "/api/ai/resume/analyze",
    GET_ANALYSIS: "/api/ai/resume/analysis",
    GET_ANALYSIS_HISTORY: "/api/ai/resume/history",

    // Candidate matching profile — the criteria a match is scored against
    GET_MATCH_PROFILE: "/api/ai/match/profile",
    UPDATE_MATCH_PROFILE: "/api/ai/match/profile",

    // Candidate-facing matches
    GET_JOB_MATCHES: "/api/ai/match/jobs",
    GET_JOB_MATCH: (jobId) => `/api/ai/match/job/${jobId}`,

    // Employer-facing applicant scoring
    GET_SCORED_APPLICANTS: (jobId) => `/api/ai/match/applicants/${jobId}`,
    RESCORE_APPLICANTS: (jobId) => `/api/ai/match/applicants/${jobId}/rescore`,
    GET_JOB_SPEC: (jobId) => `/api/ai/match/job-spec/${jobId}`,

    // Candidate career paths
    CAREER_PATHS: "/api/ai/career-paths",

    // Employer writing and interview tools
    JOB_DESCRIPTION_ASSIST: "/api/ai/job-description",
    INTERVIEW_QUESTIONS: (applicationId) => `/api/ai/interview-questions/${applicationId}`,
  },

  TALENT: {
    SEARCH: "/api/talent/search",
    INVITE: "/api/talent/invite",
  },

  ASSESSMENTS: {
    // Employer — building and sending
    LIST: "/api/assessments",
    CREATE: "/api/assessments",
    GET: (id) => `/api/assessments/${id}`,
    UPDATE: (id) => `/api/assessments/${id}`,
    SET_STATUS: (id) => `/api/assessments/${id}/status`,
    DELETE: (id) => `/api/assessments/${id}`,
    ELIGIBLE: (id) => `/api/assessments/${id}/eligible`,
    SEND: (id) => `/api/assessments/${id}/send`,
    GENERATE: "/api/assessments/generate",

    // Employer — results and marking
    ATTEMPTS: "/api/assessments/attempts",
    ATTEMPT: (attemptId) => `/api/assessments/attempts/${attemptId}`,
    SCORE: (attemptId) => `/api/assessments/attempts/${attemptId}/score`,

    // Candidate
    MINE: "/api/assessments/mine",
    TAKE: (attemptId) => `/api/assessments/take/${attemptId}`,
    START: (attemptId) => `/api/assessments/take/${attemptId}/start`,
    SAVE_ANSWERS: (attemptId) => `/api/assessments/take/${attemptId}/answers`,
    SUBMIT: (attemptId) => `/api/assessments/take/${attemptId}/submit`,
  },
};

