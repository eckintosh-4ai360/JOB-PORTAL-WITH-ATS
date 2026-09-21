const express = require("express");
const router = express.Router();

const {
    listCases,
    getCase,
    decideCase,
    rescan,
    getStats,
} = require("../controllers/moderationController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");
const aiRateLimit = require("../middlewares/aiRateLimit");

// A manual rescan costs a Groq call, so it gets the same treatment as the
// other AI endpoints. Reading the queue is free and uncapped.
const rescanLimit = aiRateLimit({ scope: "moderation-rescan", windowMs: 60 * 60 * 1000, max: 60 });

// Moderation carries enforcement power over real accounts — admin only.
router.use(protect, adminOnly);

router.get("/stats", getStats);
router.get("/cases", listCases);
router.get("/cases/:id", getCase);
router.post("/cases/:id/decision", decideCase);
router.post("/rescan", rescanLimit, rescan);

module.exports = router;
