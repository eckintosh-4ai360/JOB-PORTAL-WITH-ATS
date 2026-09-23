const express = require("express");
const router = express.Router();
const {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
} = require("../controllers/jobTemplateController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/", listTemplates);
router.post("/", createTemplate);
router.get("/:id", getTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

module.exports = router;
