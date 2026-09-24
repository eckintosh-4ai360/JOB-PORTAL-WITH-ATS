const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const fraud = require("../services/fraudModerationService");
const { sendCompanySubmittedEmail } = require("../utils/emailService");
const { COMPANY_STAGES } = require("../utils/searchLexicon");

const ORGANIZATION_TYPES = new Set([
    "Sole proprietorship",
    "Partnership",
    "Private limited company",
    "Public limited company",
    "Nonprofit / NGO",
    "Government / public institution",
    "International organisation",
    "Other",
]);

const EMPLOYEE_BANDS = new Set([
    "1-10",
    "11-50",
    "51-200",
    "201-500",
    "501-1,000",
    "1,001-5,000",
    "5,001+",
]);

const COMPANY_STAGE_LABELS = new Set(COMPANY_STAGES.map((stage) => stage.label));

// The jobs a candidate can actually see, matching the public job listing. A
// removed or moderation-hidden advert must not count as an open role.
const LIVE_JOB_WHERE = { isClosed: false, deletedAt: null, moderationState: { not: "hidden" } };

const parseArray = (value) => {
    const items = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split(",")
            : [];

    return [...new Set(
        items
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
    )].slice(0, 12);
};

const isValidWebsite = (value) => {
    if (!value) return true;
    try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
};

const validateCompanySetup = (data) => {
    const errors = {};
    const text = (value) => typeof value === "string" ? value.trim() : "";
    const name = text(data.name);
    const legalName = text(data.legalName);
    const description = text(data.description);
    const hq = text(data.hq);
    const stage = text(data.stage);
    const contactName = text(data.contactName);
    const contactTitle = text(data.contactTitle);
    const contactEmail = text(data.contactEmail);
    const contactPhone = text(data.contactPhone).replace(/[\s()-]/g, "");

    if (name.length < 2 || name.length > 120) {
        errors.name = "Enter a company name between 2 and 120 characters.";
    }
    if (legalName.length < 2 || legalName.length > 160) {
        errors.legalName = "Enter the registered legal name of the organisation.";
    }
    if (!ORGANIZATION_TYPES.has(data.organizationType)) {
        errors.organizationType = "Choose a valid organisation type.";
    }
    if (text(data.registrationNumber).length < 4 || text(data.registrationNumber).length > 100) {
        errors.registrationNumber = "Enter the business registration number or TIN.";
    }
    // The certificate is what a reviewer actually checks the other details
    // against, so setup is not complete without it.
    if (!text(data.registrationDocUrl)) {
        errors.registrationDocUrl = "Upload your business registration certificate.";
    }
    if (!text(data.industry)) {
        errors.industry = "Choose the industry your organisation works in.";
    }
    if (!EMPLOYEE_BANDS.has(data.employees)) {
        errors.employees = "Choose your company size.";
    }
    if (!COMPANY_STAGE_LABELS.has(stage)) {
        errors.stage = "Choose your company's current stage.";
    }
    if (hq.length < 2) {
        errors.hq = "Enter your primary office or hiring location.";
    }
    if (!text(data.logo)) {
        errors.logo = "Upload or provide a link to your company logo.";
    }
    if (description.length < 80 || description.length > 2000) {
        errors.description = "Use 80 to 2,000 characters to describe your company.";
    }
    if (!isValidWebsite(text(data.website))) {
        errors.website = "Enter a valid website URL beginning with http:// or https://.";
    }
    if (contactName.length < 2 || contactName.length > 120) {
        errors.contactName = "Enter the name of the authorised hiring contact.";
    }
    if (contactTitle.length < 2 || contactTitle.length > 120) {
        errors.contactTitle = "Enter the hiring contact's job title.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        errors.contactEmail = "Enter a valid work email address.";
    }
    if (!/^(?:\+233\d{9}|0\d{9})$/.test(contactPhone)) {
        errors.contactPhone = "Enter a valid Ghana phone number, for example +233 20 123 4567.";
    }
    if (parseArray(data.stack).length < 1) {
        errors.stack = "Add at least one hiring speciality or area of work.";
    }
    if (parseArray(data.perks).length < 1) {
        errors.perks = "Add at least one candidate benefit or workplace highlight.";
    }
    if (data.authorityConfirmed !== true) {
        errors.authorityConfirmed = "Confirm that you are authorised to represent this company.";
    }
    if (data.termsAccepted !== true) {
        errors.termsAccepted = "You must accept the employer terms to continue.";
    }
    if (data.fairHiringAcknowledged !== true) {
        errors.fairHiringAcknowledged = "Acknowledge the fair-hiring and no-fee policy to continue.";
    }

    return errors;
};

const requireEmployer = (req, res) => {
    if (req.user?.role !== "employer") {
        res.status(403).json({ message: "Employer access is required." });
        return false;
    }
    return true;
};

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
                    where: LIVE_JOB_WHERE,
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
                    select: { id: true, name: true, email: true, employerOnboardingComplete: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Only completed employer profiles should be visible to candidates.
        const visibleCompanies = companies.filter(
            (company) => company.user?.employerOnboardingComplete !== false
        );

        // 2. Also find legacy employers who don't have a dedicated Company record yet
        const existingCompanyUserIds = new Set(visibleCompanies.map((c) => c.userId));
        const employers = await prisma.user.findMany({
            where: {
                role: { in: ["employer", "admin"] },
                employerOnboardingComplete: true,
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
                    where: LIVE_JOB_WHERE,
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
                stage: "Not specified",
                industry: "General Services",
                employees: "20-100",
                website: "",
                rating: 0,
                glassdoor: 0,
                verified: false,
                stack: [],
                perks: [],
                openRoles: emp.postedJobs.length,
                jobs: toClient(emp.postedJobs),
                createdAt: emp.createdAt,
            };
        });

        const mappedCompanies = visibleCompanies.map((comp) => ({
            id: comp.id,
            _id: comp.id,
            userId: comp.userId,
            name: comp.name,
            companyName: comp.name,
            description: comp.description || "",
            logo: comp.logo || "",
            companyLogo: comp.logo || "",
            cover: comp.cover || null,
            hq: comp.hq || "Ghana (Remote)",
            stage: comp.stage || "Not specified",
            industry: comp.industry || "General Services",
            employees: comp.employees || "10-50",
            website: comp.website || "",
            rating: comp.rating ?? 0,
            glassdoor: comp.rating ?? 0,
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
                        where: LIVE_JOB_WHERE,
                    },
                },
            });

            if (
                !user ||
                !["employer", "admin"].includes(user.role) ||
                user.employerOnboardingComplete === false
            ) {
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
                stage: "Not specified",
                industry: "General Services",
                employees: "20-100",
                website: "",
                rating: 0,
                glassdoor: 0,
                verified: false,
                stack: [],
                perks: [],
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
                    where: LIVE_JOB_WHERE,
                },
                user: {
                    select: { id: true, name: true, email: true, employerOnboardingComplete: true },
                },
            },
        });

        if (!company || company.user?.employerOnboardingComplete === false) {
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
            hq: company.hq || "Ghana (Remote)",
            stage: company.stage || "Not specified",
            industry: company.industry || "General Services",
            employees: company.employees || "10-50",
            website: company.website || "",
            rating: company.rating ?? 0,
            glassdoor: company.rating ?? 0,
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
        if (!requireEmployer(req, res)) return;

        let company = await prisma.company.findUnique({
            where: { userId: req.user._id },
            include: {
                jobs: {
                    where: { isClosed: false },
                },
            },
        });

        if (!company) {
            // A new employer can save a draft before a Company record exists.
            return res.status(200).json(toClient({
                name: req.user.companyName || "",
                companyName: req.user.companyName || "",
                logo: req.user.companyLogo || "",
                companyLogo: req.user.companyLogo || "",
                description: req.user.companyDescription || "",
                hq: "",
                stage: "",
                industry: "",
                employees: "",
                website: "",
                legalName: "",
                organizationType: "",
                registrationNumber: "",
                contactName: req.user.name || "",
                contactTitle: "",
                contactEmail: req.user.email || "",
                contactPhone: "",
                stack: [],
                perks: [],
                verified: false,
                rating: 0,
                jobs: [],
                // Nothing has been submitted yet, so there is nothing to review.
                approvalState: "setup_incomplete",
                approvalNote: null,
                registrationDocUrl: "",
                registrationDocName: "",
                onboardingComplete: req.user.employerOnboardingComplete !== false,
            }));
        }

        res.status(200).json(toClient({
            ...company,
            companyName: company.name,
            companyLogo: company.logo,
            openRoles: company.jobs ? company.jobs.length : 0,
            onboardingComplete: req.user.employerOnboardingComplete !== false,
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
        if (!requireEmployer(req, res)) return;

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
            legalName,
            organizationType,
            registrationNumber,
            contactName,
            contactTitle,
            contactEmail,
            contactPhone,
            registrationDocUrl,
            registrationDocName,
            completeSetup,
            authorityConfirmed,
            termsAccepted,
            fairHiringAcknowledged,
        } = req.body;

        const isCompletingSetup = completeSetup === true;
        const requestedStage = typeof stage === "string" ? stage.trim() : "";
        if (stage !== undefined && requestedStage && !COMPANY_STAGE_LABELS.has(requestedStage)) {
            return res.status(422).json({
                message: "Choose a valid company stage.",
                errors: { stage: "Choose your company's current stage." },
            });
        }

        if (isCompletingSetup) {
            const errors = validateCompanySetup({
                name,
                logo,
                description,
                hq,
                stage,
                employees,
                industry,
                website,
                stack,
                perks,
                legalName,
                organizationType,
                registrationNumber,
                registrationDocUrl,
                contactName,
                contactTitle,
                contactEmail,
                contactPhone,
                authorityConfirmed,
                termsAccepted,
                fairHiringAcknowledged,
            });

            if (Object.keys(errors).length > 0) {
                return res.status(422).json({
                    message: "Complete the required company setup details before continuing.",
                    errors,
                });
            }
        }

        const cleanText = (value) => typeof value === "string" ? value.trim() : "";
        const nullableField = (value) => value === undefined ? undefined : cleanText(value) || null;
        const effectiveName = cleanText(name) || req.user.companyName || req.user.name || "Company";
        const parsedStack = stack === undefined ? undefined : parseArray(stack);
        const parsedPerks = perks === undefined ? undefined : parseArray(perks);
        const completionTime = isCompletingSetup ? new Date() : null;

        // Submitting setup is what puts a company in front of a reviewer. A
        // company that was rejected and has come back with corrections goes to
        // the back of the queue rather than staying rejected forever.
        const reviewFields = isCompletingSetup
            ? {
                approvalState: "pending",
                approvalNote: null,
                reviewedAt: null,
                reviewedById: null,
                submittedForReviewAt: completionTime,
                verified: false,
            }
            : {};

        const company = await prisma.company.upsert({
            where: { userId: req.user._id },
            create: {
                userId: req.user._id,
                name: effectiveName,
                logo: cleanText(logo) || req.user.companyLogo || null,
                cover: nullableField(cover),
                description: cleanText(description) || req.user.companyDescription || null,
                hq: nullableField(hq),
                stage: nullableField(stage),
                employees: nullableField(employees),
                industry: nullableField(industry),
                website: nullableField(website),
                legalName: nullableField(legalName),
                organizationType: nullableField(organizationType),
                registrationNumber: nullableField(registrationNumber),
                contactName: nullableField(contactName),
                contactTitle: nullableField(contactTitle),
                contactEmail: nullableField(contactEmail),
                contactPhone: nullableField(contactPhone),
                registrationDocUrl: nullableField(registrationDocUrl),
                registrationDocName: nullableField(registrationDocName),
                stack: parsedStack || [],
                perks: parsedPerks || [],
                ...reviewFields,
                ...(isCompletingSetup ? {
                    authorityConfirmedAt: completionTime,
                    termsAcceptedAt: completionTime,
                    hiringPolicyAcceptedAt: completionTime,
                } : {}),
            },
            update: {
                name: effectiveName,
                logo: nullableField(logo),
                cover: nullableField(cover),
                description: nullableField(description),
                hq: nullableField(hq),
                stage: nullableField(stage),
                employees: nullableField(employees),
                industry: nullableField(industry),
                website: nullableField(website),
                legalName: nullableField(legalName),
                organizationType: nullableField(organizationType),
                registrationNumber: nullableField(registrationNumber),
                contactName: nullableField(contactName),
                contactTitle: nullableField(contactTitle),
                contactEmail: nullableField(contactEmail),
                contactPhone: nullableField(contactPhone),
                registrationDocUrl: nullableField(registrationDocUrl),
                registrationDocName: nullableField(registrationDocName),
                stack: parsedStack,
                perks: parsedPerks,
                ...reviewFields,
                ...(isCompletingSetup ? {
                    authorityConfirmedAt: completionTime,
                    termsAcceptedAt: completionTime,
                    hiringPolicyAcceptedAt: completionTime,
                } : {}),
            },
        });

        // Also sync basic company info to User table
        const updatedUser = await prisma.user.update({
            where: { id: req.user._id },
            data: {
                companyName: effectiveName,
                ...(cleanText(logo) ? { companyLogo: cleanText(logo) } : {}),
                ...(cleanText(description) ? { companyDescription: cleanText(description) } : {}),
                ...(isCompletingSetup ? {
                    employerOnboardingComplete: true,
                    employerOnboardingCompletedAt: completionTime,
                } : {}),
            },
        });

        if (isCompletingSetup) {
            fraud.screenInBackground(`company:${company.id}`, () => fraud.screenCompany(company.id));

            // Not awaited: a mail outage must not fail a submission already saved.
            const recipient = company.contactEmail || req.user.email;
            if (recipient) {
                sendCompanySubmittedEmail({
                    to: recipient,
                    contactName: company.contactName || req.user.name,
                    companyName: company.name,
                });
            }
        }

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
            message: isCompletingSetup
                ? "Company setup completed successfully"
                : "Company profile draft saved successfully",
            company: toClient(company),
            user: toClient({
                _id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                companyName: updatedUser.companyName || "",
                companyDescription: updatedUser.companyDescription || "",
                companyLogo: updatedUser.companyLogo || "",
                resume: updatedUser.resume || "",
                employerOnboardingComplete: updatedUser.employerOnboardingComplete !== false,
                employerOnboardingCompletedAt: updatedUser.employerOnboardingCompletedAt || null,
            }),
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
