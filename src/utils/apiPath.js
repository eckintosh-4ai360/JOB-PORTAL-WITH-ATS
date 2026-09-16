export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

  APPLICATIONS: {
    APPLY_FOR_JOB: (id) => `/api/applications/${id}`,
    GET_APPLICANT: (id) => `/api/applications/job/${id}`,
    UPDATE_STATUS: (id) => `/api/applications/${id}/status`,
    GET_MY_APPLICATIONS: "/api/applications/my-applications",
    WITHDRAW_APPLICATION: (id) => `/api/applications/${id}`,
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
};

