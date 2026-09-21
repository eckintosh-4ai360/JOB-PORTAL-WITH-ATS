const express = require("express");
const router = express.Router();
const {
    createJob,
    getCompanies,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    closeJob,
    deleteJob,
} = require("../controllers/jobController");
const { protect, optionalAuth } = require("../middlewares/authMiddleware");

// Public routes
router.get("/companies", getCompanies);
router.get("/", getAllJobs);
router.get("/employer/my-jobs", protect, getMyJobs);
router.get("/:id", optionalAuth, getJobById);

// Private routes (Employer only)
router.post("/", protect, createJob);
router.put("/:id", protect, updateJob);
router.patch("/:id/close", protect, closeJob);
router.delete("/:id", protect, deleteJob);

module.exports = router;
