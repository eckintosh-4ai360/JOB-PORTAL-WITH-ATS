const express = require("express");
const router = express.Router();
const {
    getEmployerAnalytics,
    getJobAnalytics,
    getPlatformSummary,
} = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");

// Public — platform-wide stats
router.get("/summary", getPlatformSummary);

// Private (Employer) — dashboard analytics
router.get("/", protect, getEmployerAnalytics);

// Private (Employer) — per-job analytics
router.get("/job/:jobId", protect, getJobAnalytics);

module.exports = router;
