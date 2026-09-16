const prisma = require("../config/prisma");
const { DEFAULT_EMAIL_TEMPLATES } = require("../utils/emailService");
const { toClient } = require("../utils/prismaHelper");

const syncDefaultTemplates = async () => {
    for (const template of DEFAULT_EMAIL_TEMPLATES) {
        await prisma.emailTemplate.upsert({
            where: { key: template.key },
            update: {}, // don't overwrite user edits on sync
            create: {
                key: template.key,
                name: template.name,
                description: template.description || "",
                subject: template.subject,
                html: template.html,
                variables: template.variables || [],
            }
        });
    }
};

const getEmailTemplates = async (req, res) => {
    try {
        await syncDefaultTemplates();
        const templates = await prisma.emailTemplate.findMany({
            orderBy: { createdAt: "asc" },
        });
        const order = new Map(DEFAULT_EMAIL_TEMPLATES.map((template, index) => [template.key, index]));
        templates.sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
        res.json({ templates: toClient(templates) });
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

        const template = await prisma.emailTemplate.upsert({
            where: { key: defaultTemplate.key },
            update: {
                subject: subject.trim(),
                html: html.trim(),
            },
            create: {
                key: defaultTemplate.key,
                name: defaultTemplate.name,
                description: defaultTemplate.description || "",
                subject: subject.trim(),
                html: html.trim(),
                variables: defaultTemplate.variables || [],
            }
        });

        res.json({ message: "Email template saved", template: toClient(template) });
    } catch (error) {
        console.error("Failed to update email template:", error);
        res.status(500).json({ message: "Unable to save email template" });
    }
};

module.exports = { getEmailTemplates, updateEmailTemplate };
