require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const prisma = require("./config/prisma");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const savedJobRoutes = require("./routes/savedJobRoutes");
const emailTemplateRoutes = require("./routes/emailTemplateRoutes");
const companyRoutes = require("./routes/companyRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const aiRoutes = require("./routes/aiRoutes");
const talentRoutes = require("./routes/talentRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const moderationRoutes = require("./routes/moderationRoutes");
const adminRoutes = require("./routes/adminRoutes");


const app = express();

//Middleware to handle cors
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Middleware to handle json data
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api/email-templates', emailTemplateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/talent', talentRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);

// Serve uploads folder.
//
// A link's `download` attribute is honoured only for same-origin URLs, and the
// SPA runs on a different port — so "Download" silently degrades to "View"
// unless the server declares the attachment itself. `?download=1` is how the
// client asks for that. Without it a file is offered inline, which lets a PDF
// open in the browser's viewer rather than landing in the downloads folder.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
        const disposition = res.req?.query?.download === "1" ? "attachment" : "inline";
        res.setHeader(
            "Content-Disposition",
            `${disposition}; filename="${path.basename(filePath)}"`
        );
    },
}));

//Error handling for routes
app.use((err, req, res, next) => {
    // Upload rejections are user mistakes, not server faults. They are thrown
    // by multer before any controller runs, so they bypass controller
    // try/catch blocks and would otherwise surface as a bare 500 — which tells
    // someone who picked the wrong file that the site is broken.
    if (err instanceof multer.MulterError) {
        const messages = {
            LIMIT_FILE_SIZE: "That file is too large. Please upload a file under 12MB.",
            LIMIT_FILE_COUNT: "Too many files were uploaded at once.",
            LIMIT_UNEXPECTED_FILE: `Unexpected file field "${err.field}".`,
        };
        return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
            message: messages[err.code] || "That file could not be uploaded.",
            code: err.code,
        });
    }

    if (err?.code === "INVALID_FILE_TYPE") {
        return res.status(400).json({ message: err.message, code: err.code });
    }

    console.error("Unhandled error:", err.stack || err);
    res.status(500).json({ message: "internal server error", error: err.message });
});

// start Server
const PORT = process.env.PORT || 5000;

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to Neon PostgreSQL via Prisma successfully");
    } catch (error) {
        console.error("Failed to connect to database:", error.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`server is running on port ${PORT}`)
    });
}

main();
