const EmailTemplate = require("../models/EmailTemplate");
const { DEFAULT_EMAIL_TEMPLATES } = require("../utils/emailService");

const syncDefaultTemplates = async () => {
    await Promise.all(DEFAULT_EMAIL_TEMPLATES.map((template) => (
        EmailTemplate.findOneAndUpdate(
            { key: template.key },
            { $setOnInsert: template },
            { upsert: true, new: true }
        )
    )));
};

const getEmailTemplates = async (req, res) => {
    try {
        await syncDefaultTemplates();
        const templates = await EmailTemplate.find({}).sort({ createdAt: 1 }).lean();
        const order = new Map(DEFAULT_EMAIL_TEMPLATES.map((template, index) => [template.key, index]));
        templates.sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
        res.json({ templates });
    } catch (error) {
        console.error("Failed to load email templates:", error);
        res.status(500).json({ message: "Unable to load email templates" });
    }
};

const updateEmailTemplate = async (req, res) => {
    try {
        const { subject, html } = req.body;
        const defaultTemplate = DEFAULT_EMAIL_TEMPLATES.find((template) => template.key === req.params.key);

        if (!defaultTemplate) {
            return res.status(404).json({ message: "Email template not found" });
        }
        if (!subject?.trim() || !html?.trim()) {
            return res.status(400).json({ message: "Subject and message HTML are required" });
        }

        const template = await EmailTemplate.findOneAndUpdate(
            { key: defaultTemplate.key },
            {
                $set: { subject: subject.trim(), html: html.trim() },
                $setOnInsert: {
                    key: defaultTemplate.key,
                    name: defaultTemplate.name,
                    description: defaultTemplate.description,
                    variables: defaultTemplate.variables,
                },
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ message: "Email template saved", template });
    } catch (error) {
        console.error("Failed to update email template:", error);
        res.status(500).json({ message: "Unable to save email template" });
    }
};

module.exports = { getEmailTemplates, updateEmailTemplate };
