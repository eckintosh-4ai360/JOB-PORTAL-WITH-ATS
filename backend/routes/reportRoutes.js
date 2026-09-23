const express = require("express");
const router = express.Router();
const { listReports, getReport } = require("../controllers/reportController");
const { protect } = require("../middlewares/authMiddleware");
// A general in-memory limiter, despite the name; reports reuse it so a script
// cannot have the server building files in a loop.
const aiRateLimit = require("../middlewares/aiRateLimit");

const exportLimit = aiRateLimit({ scope: "report-export", windowMs: 60 * 60 * 1000, max: 60 });

// Previews are cheap and follow every filter change, so only file downloads count.
const limitDownloads = (req, res, next) => {
    const format = String(req.query.format || "json").toLowerCase();
    return format === "json" ? next() : exportLimit(req, res, next);
};

router.use(protect);

router.get("/", listReports);
router.get("/:type", limitDownloads, getReport);

module.exports = router;
