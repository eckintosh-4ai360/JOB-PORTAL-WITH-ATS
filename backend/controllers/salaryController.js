const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc    Get all salary benchmarks (market data)
// @route   GET /api/salaries/benchmarks
// @access  Public
const getSalaryBenchmarks = async (req, res) => {
    try {
        const benchmarks = await prisma.salaryBenchmark.findMany({
            orderBy: { median: "desc" },
        });

        res.status(200).json({
            benchmarks: toClient(benchmarks),
            roles: toClient(benchmarks),
        });
    } catch (error) {
        console.error("Error fetching salary benchmarks:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get high-demand skill premiums
// @route   GET /api/salaries/skills
// @access  Public
const getSkillPremiums = async (req, res) => {
    try {
        const skills = await prisma.skillPremium.findMany({
            orderBy: { createdAt: "asc" },
        });

        res.status(200).json({
            skillsPremium: toClient(skills),
            skills: toClient(skills),
        });
    } catch (error) {
        console.error("Error fetching skill premiums:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get recent anonymous salary submissions
// @route   GET /api/salaries/submissions
// @access  Public
const getSalarySubmissions = async (req, res) => {
    try {
        const submissions = await prisma.salarySubmission.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        res.status(200).json({
            submissions: toClient(submissions),
        });
    } catch (error) {
        console.error("Error fetching salary submissions:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Submit anonymous salary data
// @route   POST /api/salaries/submit
// @access  Public
const submitSalary = async (req, res) => {
    try {
        const { role, compensation, experience, location } = req.body;

        if (!role || !compensation) {
            return res.status(400).json({ message: "Role and compensation are required" });
        }

        const submission = await prisma.salarySubmission.create({
            data: {
                role: role.trim(),
                compensation: String(compensation).trim(),
                experience: experience ? String(experience).trim() : "3-5",
                location: location ? String(location).trim() : "Accra, Ghana",
                isVerified: false,
            },
        });

        res.status(201).json({
            message: "Your salary data was recorded anonymously and queued for verification.",
            submission: toClient(submission),
        });
    } catch (error) {
        console.error("Error submitting salary:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getSalaryBenchmarks,
    getSkillPremiums,
    getSalarySubmissions,
    submitSalary,
};
