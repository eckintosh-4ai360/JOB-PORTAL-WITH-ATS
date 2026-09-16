const express = require("express");
const router = express.Router();
const {
    saveJob,
    getSavedJobs,
    checkIfJobSaved,
    unsaveJob,
} = require("../controllers/savedJobController");
const { protect } = require("../middlewares/authMiddleware");

// All routes are private (Jobseeker only)

// Get all saved jobs
router.get("/", protect, getSavedJobs);

// Check if a specific job is saved
router.get("/check/:jobId", protect, checkIfJobSaved);

// Save a job
router.post("/:jobId", protect, saveJob);

// Unsave a job
router.delete("/:jobId", protect, unsaveJob);

module.exports = router;
