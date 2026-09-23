const express = require("express");
const router = express.Router();

const {
    listAssessments,
    createAssessment,
    getAssessment,
    updateAssessment,
    setAssessmentStatus,
    deleteAssessment,
    getEligible,
    sendAssessment,
    generateQuestions,
    listAttempts,
    getAttempt,
    scoreAttempt,
    myAssessments,
    getTake,
    startTake,
    saveAnswers,
    submitTake,
} = require("../controllers/assessmentController");
const { protect } = require("../middlewares/authMiddleware");
const aiRateLimit = require("../middlewares/aiRateLimit");

// Generating costs a Groq call and sending emails candidates, so both are budgeted.
const generateLimit = aiRateLimit({ scope: "assessment-generate", windowMs: 60 * 60 * 1000, max: 20 });
const sendLimit = aiRateLimit({ scope: "assessment-send", windowMs: 60 * 60 * 1000, max: 60 });

router.use(protect);

// Fixed paths first, so none of them is read as an assessment id.

// Candidate
router.get("/mine", myAssessments);
router.get("/take/:attemptId", getTake);
router.post("/take/:attemptId/start", startTake);
router.put("/take/:attemptId/answers", saveAnswers);
router.post("/take/:attemptId/submit", submitTake);

// Employer — results across every assessment, and marking
router.get("/attempts", listAttempts);
router.get("/attempts/:attemptId", getAttempt);
router.put("/attempts/:attemptId/score", scoreAttempt);

// Employer — building and sending
router.post("/generate", generateLimit, generateQuestions);
router.get("/", listAssessments);
router.post("/", createAssessment);
router.get("/:id", getAssessment);
router.put("/:id", updateAssessment);
router.patch("/:id/status", setAssessmentStatus);
router.delete("/:id", deleteAssessment);
router.get("/:id/eligible", getEligible);
router.post("/:id/send", sendLimit, sendAssessment);

module.exports = router;
