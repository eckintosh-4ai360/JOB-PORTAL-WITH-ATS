const express = require("express");
const router = express.Router();

const {
    getOverview,
    listCompanies,
    getCompany,
    decideCompany,
    listAccounts,
    listJobs,
} = require("../controllers/adminController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

// Platform control reads every account and decides who may publish — admin only.
router.use(protect, adminOnly);

router.get("/overview", getOverview);

router.get("/companies", listCompanies);
router.get("/companies/:id", getCompany);
router.post("/companies/:id/decision", decideCompany);

router.get("/accounts", listAccounts);
router.get("/jobs", listJobs);

module.exports = router;
