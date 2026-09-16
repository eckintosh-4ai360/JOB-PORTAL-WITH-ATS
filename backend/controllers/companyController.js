const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc    Get all companies (public directory)
// @route   GET /api/companies
// @access  Public
const getCompanies = async (req, res) => {
    try {
        const { industry, hq, stage, search } = req.query;

        // 1. Fetch registered Company profiles
        const whereClause = {};
        if (industry) whereClause.industry = { contains: industry, mode: "insensitive" };
        if (hq) whereClause.hq = { contains: hq, mode: "insensitive" };
        if (stage) whereClause.stage = { contains: stage, mode: "insensitive" };
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const companies = await prisma.company.findMany({
            where: whereClause,
            include: {
                jobs: {
                    where: { isClosed: false },
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        salaryMin: true,
                        salaryMax: true,
                        category: true,
                        createdAt: true,
                    },
                },
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // 2. Also find employers who don't have a dedicated Company record yet
        const existingCompanyUserIds = new Set(companies.map((c) => c.userId));
        const employers = await prisma.user.findMany({
            where: {
                role: { in: ["employer", "admin"] },
                id: { notIn: Array.from(existingCompanyUserIds) },
            },
            select: {
                id: true,
                name: true,
                companyName: true,
                companyDescription: true,
                companyLogo: true,
                createdAt: true,
                postedJobs: {
                    where: { isClosed: false },
                    select: {
                        id: true,
                        title: true,
                        location: true,
                        type: true,
                        salaryMin: true,
                        salaryMax: true,
                        category: true,
                        createdAt: true,
                    },
                },
            },
        });

        const employerCompanies = employers.map((emp) => {
            const displayName = emp.companyName || emp.name || "Enterprise Employer";
            return {
                id: `emp_${emp.id}`,
                _id: `emp_${emp.id}`,
                userId: emp.id,
                name: displayName,
                companyName: displayName,
                description: emp.companyDescription || "Leading organization recruiting top talent through SPG Job Portal.",
                logo: emp.companyLogo || "",
                companyLogo: emp.companyLogo || "",
                cover: null,
                hq: "Ghana / Remote",
                stage: "Growth",
                industry: "Technology & Services",
                employees: "20-100",
                website: "",
                rating: 4.8,
                glassdoor: 4.8,
                verified: true,
                stack: ["React", "Node.js", "PostgreSQL", "Cloud"],
                perks: ["Health Insurance", "Remote Flexibility", "Learning Budget", "Paid Time Off"],
                openRoles: emp.postedJobs.length,
                jobs: toClient(emp.postedJobs),
                createdAt: emp.createdAt,
            };
        });

        const mappedCompanies = companies.map((comp) => ({
            id: comp.id,
            _id: comp.id,
            userId: comp.userId,
            name: comp.name,
            companyName: comp.name,
            description: comp.description || "",
            logo: comp.logo || "",
            companyLogo: comp.logo || "",
            cover: comp.cover || null,
            hq: comp.hq || "Remote",
            stage: comp.stage || "Growth",
            industry: comp.industry || "Technology",
            employees: comp.employees || "10-50",
            website: comp.website || "",
            rating: comp.rating || 4.8,
            glassdoor: comp.rating || 4.8,
            verified: comp.verified,
            stack: comp.stack || [],
            perks: comp.perks || [],
            openRoles: comp.jobs ? comp.jobs.length : 0,
            jobs: toClient(comp.jobs || []),
            createdAt: comp.createdAt,
        }));

        const combined = [...mappedCompanies, ...employerCompanies];

        res.status(200).json({ companies: toClient(combined) });
    } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get single company by ID
// @route   GET /api/companies/:id
// @access  Public
const getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if query is for an employer-fallback ID
        if (id.startsWith("emp_")) {
            const userId = id.replace("emp_", "");
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    postedJobs: {
                        where: { isClosed: false },
                    },
                },
            });

            if (!user) {
                return res.status(404).json({ message: "Company not found" });
            }

            const displayName = user.companyName || user.name || "Enterprise Employer";
            return res.status(200).json(toClient({
                id: `emp_${user.id}`,
                _id: `emp_${user.id}`,
                userId: user.id,
                name: displayName,
                companyName: displayName,
                description: user.companyDescription || "",
                logo: user.companyLogo || "",
                companyLogo: user.companyLogo || "",
                cover: null,
                hq: "Ghana / Remote",
                stage: "Growth",
                industry: "Technology & Services",
                employees: "20-100",
                website: "",
                rating: 4.8,
                glassdoor: 4.8,
                verified: true,
                stack: ["React", "Node.js", "PostgreSQL", "Cloud"],
                perks: ["Health Insurance", "Remote Flexibility", "Learning Budget", "Paid Time Off"],
                openRoles: user.postedJobs.length,
                jobs: toClient(user.postedJobs),
                createdAt: user.createdAt,
            }));
        }

        const company = await prisma.company.findFirst({
            where: {
                OR: [{ id }, { userId: id }],
            },
            include: {
                jobs: {
                    where: { isClosed: false },
                },
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        const result = {
            id: company.id,
            _id: company.id,
            userId: company.userId,
            name: company.name,
            companyName: company.name,
            description: company.description || "",
            logo: company.logo || "",
            companyLogo: company.logo || "",
            cover: company.cover || null,
            hq: company.hq || "Remote",
            stage: company.stage || "Growth",
            industry: company.industry || "Technology",
            employees: company.employees || "10-50",
            website: company.website || "",
            rating: company.rating || 4.8,
            glassdoor: company.rating || 4.8,
            verified: company.verified,
            stack: company.stack || [],
            perks: company.perks || [],
            openRoles: company.jobs ? company.jobs.length : 0,
            jobs: toClient(company.jobs || []),
            createdAt: company.createdAt,
        };

        res.status(200).json(toClient(result));
    } catch (error) {
        console.error("Error getting company:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Get current logged-in employer's company profile
// @route   GET /api/companies/me/profile
// @access  Private (Employer)
const getMyCompanyProfile = async (req, res) => {
    try {
        let company = await prisma.company.findUnique({
            where: { userId: req.user._id },
            include: {
                jobs: {
                    where: { isClosed: false },
                },
            },
        });

        if (!company) {
            // Return defaults based on User info
            const user = await prisma.user.findUnique({ where: { id: req.user._id } });
            return res.status(200).json(toClient({
                name: user?.companyName || user?.name || "",
                companyName: user?.companyName || user?.name || "",
                logo: user?.companyLogo || "",
                companyLogo: user?.companyLogo || "",
                description: user?.companyDescription || "",
                hq: "Accra, Ghana",
                stage: "Growth",
                industry: "Technology",
                employees: "10-50",
                website: "",
                stack: [],
                perks: [],
                verified: false,
                rating: 5.0,
                jobs: [],
            }));
        }

        res.status(200).json(toClient({
            ...company,
            companyName: company.name,
            companyLogo: company.logo,
            openRoles: company.jobs ? company.jobs.length : 0,
        }));
    } catch (error) {
        console.error("Error getting company profile:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Update or create current employer's company profile
// @route   PUT /api/companies/me/profile
// @access  Private (Employer)
const updateMyCompanyProfile = async (req, res) => {
    try {
        const {
            name,
            logo,
            cover,
            description,
            hq,
            stage,
            employees,
            industry,
            website,
            stack,
            perks,
            rating,
            verified,
        } = req.body;

        const effectiveName = name || req.user.companyName || req.user.name || "Company";

        // Format stack & perks as array of strings if sent as comma-separated or array
        const parseArray = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === "string" && val.trim()) {
                return val.split(",").map((s) => s.trim()).filter(Boolean);
            }
            return [];
        };

        const company = await prisma.company.upsert({
            where: { userId: req.user._id },
            create: {
                userId: req.user._id,
                name: effectiveName,
                logo: logo || req.user.companyLogo || "",
                cover: cover || null,
                description: description || req.user.companyDescription || "",
                hq: hq || "Accra, Ghana",
                stage: stage || "Growth",
                employees: employees || "10-50",
                industry: industry || "Technology",
                website: website || "",
                rating: rating ? Number(rating) : 4.8,
                verified: verified !== undefined ? Boolean(verified) : false,
                stack: parseArray(stack),
                perks: parseArray(perks),
            },
            update: {
                name: effectiveName,
                logo: logo !== undefined ? logo : undefined,
                cover: cover !== undefined ? cover : undefined,
                description: description !== undefined ? description : undefined,
                hq: hq !== undefined ? hq : undefined,
                stage: stage !== undefined ? stage : undefined,
                employees: employees !== undefined ? employees : undefined,
                industry: industry !== undefined ? industry : undefined,
                website: website !== undefined ? website : undefined,
                rating: rating !== undefined ? Number(rating) : undefined,
                verified: verified !== undefined ? Boolean(verified) : undefined,
                stack: stack !== undefined ? parseArray(stack) : undefined,
                perks: perks !== undefined ? parseArray(perks) : undefined,
            },
        });

        // Also sync basic company info to User table
        await prisma.user.update({
            where: { id: req.user._id },
            data: {
                companyName: effectiveName,
                ...(logo ? { companyLogo: logo } : {}),
                ...(description ? { companyDescription: description } : {}),
            },
        });

        // Auto-link any unlinked jobs posted by this employer
        await prisma.job.updateMany({
            where: {
                companyId: req.user._id,
                companyProfileId: null,
            },
            data: {
                companyProfileId: company.id,
            },
        });

        res.status(200).json({
            message: "Company profile updated successfully",
            company: toClient(company),
        });
    } catch (error) {
        console.error("Error updating company profile:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getCompanies,
    getCompanyById,
    getMyCompanyProfile,
    updateMyCompanyProfile,
};
