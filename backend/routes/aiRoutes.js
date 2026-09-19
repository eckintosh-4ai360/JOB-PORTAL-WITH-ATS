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

const { protect, optionalAuth } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const aiRateLimit = require("../middlewares/aiRateLimit");

// Every AI route costs a Groq call, so each gets its own budget.
const analyzeLimit = aiRateLimit({
    scope: "resume-analyze",
    windowMs: 60 * 60 * 1000,
    max: 20,
    guestMax: 3, // the public analyzer is the most abusable surface
});
const matchLimit = aiRateLimit({ scope: "job-match", windowMs: 60 * 60 * 1000, max: 60 });
const employerLimit = aiRateLimit({ scope: "applicant-score", windowMs: 60 * 60 * 1000, max: 40 });

// --- Status ---
router.get("/status", getAiStatus);

// --- Resume analysis ---
// Public: guests may analyse a resume (nothing is stored) so the marketing page
// works before sign-up. optionalAuth means a signed-in user gets it saved.
router.post("/resume/analyze", optionalAuth, analyzeLimit, upload.single("resume"), analyzeResume);
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

module.exports = router;
