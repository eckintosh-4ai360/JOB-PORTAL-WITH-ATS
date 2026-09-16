const express = require("express");
const { protect, emailTemplateAccess } = require("../middlewares/authMiddleware");
const {
    getEmailTemplates,
    updateEmailTemplate,
} = require("../controllers/emailTemplateController");

const router = express.Router();

router.use(protect, emailTemplateAccess);
router.get("/", getEmailTemplates);
router.put("/:key", updateEmailTemplate);

module.exports = router;
