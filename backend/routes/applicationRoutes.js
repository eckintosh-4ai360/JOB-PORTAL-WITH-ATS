const express = require("express");
const router = express.Router();
const {
    applyForJob,
    getMyApplications,
    getEmployerApplications,
    getEmployerApplicants,
    getApplicationsForJob,
    getApplicationById,
    updateApplicationStatus,
    withdrawApplication,
    getPipeline,
    updatePipeline,
} = require("../controllers/applicationController");
const { protect, optionalAuth } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

// Employer — the stages applications move through. Registered before the
// "/:id" and "/:jobId" routes so "pipeline" is never read as an id.
router.get("/pipeline", protect, getPipeline);
router.put("/pipeline", protect, updatePipeline);

// Apply for a job — works for both logged-in users and guests
router.post("/:jobId", optionalAuth, upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
]), applyForJob);

// Jobseeker — view all their own applications
router.get("/my-applications", protect, getMyApplications);

router.get("/employer", protect, getEmployerApplications);
router.get("/employer/applicants", protect, getEmployerApplicants);

// Employer — view all applications for a specific job
router.get("/job/:jobId", protect, getApplicationsForJob);

// Shared — view a single application (applicant or employer)
router.get("/:id", protect, getApplicationById);

// Employer — update application status
router.patch("/:id/status", protect, updateApplicationStatus);

// Jobseeker — withdraw an application
router.delete("/:id", protect, withdrawApplication);

module.exports = router;
