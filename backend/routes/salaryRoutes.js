const express = require("express");
const router = express.Router();
const {
    getSalaryBenchmarks,
    getSkillPremiums,
    getSalarySubmissions,
    submitSalary,
} = require("../controllers/salaryController");

// Public routes
router.get("/benchmarks", getSalaryBenchmarks);
router.get("/skills", getSkillPremiums);
router.get("/submissions", getSalarySubmissions);
router.post("/submit", submitSalary);

module.exports = router;
