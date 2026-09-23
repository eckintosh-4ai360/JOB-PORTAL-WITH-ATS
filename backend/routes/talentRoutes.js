const express = require("express");
const router = express.Router();

const { search, invite } = require("../controllers/talentController");
const { protect } = require("../middlewares/authMiddleware");
const aiRateLimit = require("../middlewares/aiRateLimit");

// A prose query can cost a Groq call, and an invite sends an email, so both
// get a budget of their own.
const searchLimit = aiRateLimit({ scope: "talent-search", windowMs: 60 * 60 * 1000, max: 120 });
const inviteLimit = aiRateLimit({ scope: "talent-invite", windowMs: 24 * 60 * 60 * 1000, max: 40 });

router.get("/search", protect, searchLimit, search);
router.post("/invite", protect, inviteLimit, invite);

module.exports = router;
