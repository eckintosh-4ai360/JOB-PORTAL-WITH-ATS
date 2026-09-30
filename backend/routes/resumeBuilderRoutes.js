const express = require("express");
const router = express.Router();

const {
    listResumes,
    createResume,
    getResume,
    updateResume,
    deleteResume,
    duplicateResume,
    downloadPdf,
    checkResume,
    saveToDocuments,
    assist,
} = require("../controllers/resumeBuilderController");
const { protect } = require("../middlewares/authMiddleware");
// A general in-memory limiter, despite the name.
const aiRateLimit = require("../middlewares/aiRateLimit");

// Writing help costs a Groq call. Rendering costs only CPU, but a script
// should not be able to keep the server building PDFs in a loop.
const writingLimit = aiRateLimit({ scope: "resume-writer", windowMs: 60 * 60 * 1000, max: 40 });
const renderLimit = aiRateLimit({ scope: "resume-render", windowMs: 60 * 60 * 1000, max: 120 });

router.use(protect);

router.get("/", listResumes);
router.post("/", createResume);
// Before "/:id" so "assist" is never read as an id.
router.post("/assist", writingLimit, assist);

router.get("/:id", getResume);
router.put("/:id", updateResume);
router.delete("/:id", deleteResume);
router.post("/:id/duplicate", duplicateResume);
router.get("/:id/pdf", renderLimit, downloadPdf);
router.post("/:id/check", renderLimit, checkResume);
router.post("/:id/document", renderLimit, saveToDocuments);

module.exports = router;
