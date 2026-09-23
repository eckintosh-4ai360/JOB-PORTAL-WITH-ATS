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
const {
    searchJobsHandler,
    suggestHandler,
    searchOptionsHandler,
} = require("../controllers/searchController");
const { protect, optionalAuth } = require("../middlewares/authMiddleware");

// Public routes.
//
// Every literal path is registered before "/:id", or Express would read
// "search" as a job id and answer these with a 404.
router.get("/companies", getCompanies);
router.get("/search/suggest", suggestHandler);
router.get("/search/options", searchOptionsHandler);
// Signed in, search is ranked with the candidate's own match scores, so the
// auth is optional rather than required.
router.get("/search", optionalAuth, searchJobsHandler);
router.get("/", getAllJobs);
router.get("/employer/my-jobs", protect, getMyJobs);
router.get("/:id", optionalAuth, getJobById);

// Private routes (Employer only)
router.post("/", protect, createJob);
router.put("/:id", protect, updateJob);
router.patch("/:id/close", protect, closeJob);
router.delete("/:id", protect, deleteJob);

module.exports = router;
