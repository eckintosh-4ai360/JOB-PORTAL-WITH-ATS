const express = require("express");
const router = express.Router();

const {
    analyzeResume,
    getLatestAnalysis,
    getAnalysisHistory,
    getMatchProfile,
    updateMatchProfile,
    getJobMatches,
    getJobMatch,
    getScoredApplicants,
    rescoreApplicants,
    getJobSpecForEmployer,
    getAiStatus,
} = require("../controllers/aiController");
const {
    assistWithJobDescription,
    getInterviewGuide,
    createInterviewGuide,
} = require("../controllers/employerAiController");
const { getCareerPaths, createCareerPaths } = require("../controllers/careerController");

const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const aiRateLimit = require("../middlewares/aiRateLimit");

// Every AI route costs a Groq call, so each gets its own budget.
const analyzeLimit = aiRateLimit({
    scope: "resume-analyze",
    windowMs: 60 * 60 * 1000,
    max: 20,
});
const matchLimit = aiRateLimit({ scope: "job-match", windowMs: 60 * 60 * 1000, max: 60 });
const employerLimit = aiRateLimit({ scope: "applicant-score", windowMs: 60 * 60 * 1000, max: 40 });
const writingLimit = aiRateLimit({ scope: "job-description", windowMs: 60 * 60 * 1000, max: 30 });
const interviewLimit = aiRateLimit({ scope: "interview-questions", windowMs: 60 * 60 * 1000, max: 30 });
const careerLimit = aiRateLimit({ scope: "career-paths", windowMs: 60 * 60 * 1000, max: 10 });

// --- Status ---
router.get("/status", getAiStatus);

// --- Resume analysis ---
router.post("/resume/analyze", protect, analyzeLimit, upload.single("resume"), analyzeResume);
router.get("/resume/analysis", protect, getLatestAnalysis);
router.get("/resume/history", protect, getAnalysisHistory);

// --- Candidate match profile ---
router.get("/match/profile", protect, getMatchProfile);
router.put("/match/profile", protect, updateMatchProfile);

// --- Candidate job matching ---
router.get("/match/jobs", protect, matchLimit, getJobMatches);
router.get("/match/job/:jobId", protect, matchLimit, getJobMatch);

// --- Employer applicant scoring ---
router.get("/match/applicants/:jobId", protect, employerLimit, getScoredApplicants);
router.post("/match/applicants/:jobId/rescore", protect, employerLimit, rescoreApplicants);
router.get("/match/job-spec/:jobId", protect, employerLimit, getJobSpecForEmployer);

// --- Candidate career paths ---
// Reading saved paths costs nothing; only writing them calls the model.
router.get("/career-paths", protect, getCareerPaths);
router.post("/career-paths", protect, careerLimit, createCareerPaths);

// --- Employer writing and interview tools ---
router.post("/job-description", protect, writingLimit, assistWithJobDescription);
// Reading a saved guide costs nothing, so only generating is limited.
router.get("/interview-questions/:applicationId", protect, getInterviewGuide);
router.post("/interview-questions/:applicationId", protect, interviewLimit, createInterviewGuide);

module.exports = router;
