const express = require("express");
const router = express.Router();
const {
    getOverview,
    getJobShortlist,
    findCandidates,
    addToShortlist,
    removeFromShortlist,
    updateShortlistNote,
    advanceShortlist,
} = require("../controllers/shortlistController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

// Literal paths first, so "add" or "note" is never read as a job id.
router.get("/", getOverview);
router.post("/add", addToShortlist);
router.post("/remove", removeFromShortlist);
router.patch("/note/:applicationId", updateShortlistNote);

router.get("/:jobId", getJobShortlist);
router.post("/:jobId/candidates", findCandidates);
router.post("/:jobId/advance", advanceShortlist);

module.exports = router;
