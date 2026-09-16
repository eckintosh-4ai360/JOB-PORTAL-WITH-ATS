const express = require("express");
const router = express.Router();
const {
    getCompanies,
    getCompanyById,
    getMyCompanyProfile,
    updateMyCompanyProfile,
} = require("../controllers/companyController");
const { protect } = require("../middlewares/authMiddleware");

// Public routes
router.get("/", getCompanies);
router.get("/me/profile", protect, getMyCompanyProfile);
router.put("/me/profile", protect, updateMyCompanyProfile);
router.get("/:id", getCompanyById);

module.exports = router;
