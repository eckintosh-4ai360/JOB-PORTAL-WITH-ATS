require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
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

//Serve UPloads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {}));

//Error handling for routes
app.use((err, req, res, next) => {
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
