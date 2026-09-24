const express = require("express");
const router = express.Router();

const {
    getOverview,
    listCompanies,
    getCompany,
    startCompanyReview,
    decideCompany,
    updateCompanyStage,
    listAccounts,
    listJobs,
} = require("../controllers/adminController");

const {
    listPlatformDuplicates,
    scanPlatform,
    reviewPlatform,
} = require("../controllers/duplicateController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

// Platform control reads every account and decides who may publish — admin only.
router.use(protect, adminOnly);

router.get("/overview", getOverview);

router.get("/companies", listCompanies);
router.get("/companies/:id", getCompany);
router.post("/companies/:id/review", startCompanyReview);
router.post("/companies/:id/decision", decideCompany);
router.patch("/companies/:id/stage", updateCompanyStage);

router.get("/accounts", listAccounts);

// Jobseeker accounts that look like the same person.
router.get("/duplicates", listPlatformDuplicates);
router.post("/duplicates/scan", scanPlatform);
router.post("/duplicates/review", reviewPlatform);
router.get("/jobs", listJobs);

module.exports = router;
