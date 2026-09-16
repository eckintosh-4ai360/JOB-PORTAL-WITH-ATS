const express = require("express");
const router = express.Router();
const {
    createJob,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    closeJob,
    deleteJob,
} = require("../controllers/jobController");
const { protect } = require("../middlewares/authMiddleware");

// Public routes
router.get("/", getAllJobs);
router.get("/employer/my-jobs", protect, getMyJobs);
router.get("/:id", getJobById);

// Private routes (Employer only)
router.post("/", protect, createJob);
router.put("/:id", protect, updateJob);
router.patch("/:id/close", protect, closeJob);
router.delete("/:id", protect, deleteJob);

module.exports = router;
