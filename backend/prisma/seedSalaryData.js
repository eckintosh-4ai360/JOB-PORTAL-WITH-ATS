require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../config/prisma");

const ROLES_BENCHMARKS = [
    { role: "Senior Software Developer", location: "Accra / Remote", sector: "Fintech & Banking", tenure: "Senior (4-7 Yrs)", p25: 45000, median: 58500, p75: 78000, p90: 110000, currency: "GH₵" },
    { role: "DevOps / SRE Architect", location: "Accra / Remote", sector: "Cloud & Telecom", tenure: "Lead / Staff", p25: 48000, median: 65000, p75: 85000, p90: 125000, currency: "GH₵" },
    { role: "Engineering Manager", location: "Accra / Remote", sector: "Technology Leadership", tenure: "Manager (6+ Yrs)", p25: 60000, median: 80000, p75: 110000, p90: 160000, currency: "GH₵" },
    { role: "Senior Product Designer", location: "Accra / Remote", sector: "Product & UX", tenure: "Senior (4-7 Yrs)", p25: 35000, median: 46000, p75: 62000, p90: 85000, currency: "GH₵" },
    { role: "Data Engineer / AI", location: "Accra / Remote", sector: "Data & Analytics", tenure: "Senior (4-7 Yrs)", p25: 42000, median: 55000, p75: 75000, p90: 105000, currency: "GH₵" },
    { role: "Mobile Lead (Flutter/iOS)", location: "Accra / Remote", sector: "Mobile Engineering", tenure: "Lead (5+ Yrs)", p25: 40000, median: 52000, p75: 70000, p90: 95000, currency: "GH₵" },
    { role: "Full-Stack Engineer", location: "Accra / Remote", sector: "Web Platforms", tenure: "Mid-Senior (3-5 Yrs)", p25: 32000, median: 45000, p75: 62000, p90: 85000, currency: "GH₵" },
    { role: "Backend Engineer (Go/Java)", location: "Accra / Remote", sector: "Payments & Banking", tenure: "Senior (4-6 Yrs)", p25: 44000, median: 60000, p75: 82000, p90: 115000, currency: "GH₵" }
];

const SKILL_PREMIUMS = [
    { skill: "Go (Golang)", premium: "+32%", demand: "High", reason: "Fintech switches & telecom backend scaling" },
    { skill: "Kubernetes & Terraform", premium: "+28%", demand: "Very High", reason: "Multi-region cloud infrastructure" },
    { skill: "Rust", premium: "+35%", demand: "High", reason: "High-frequency payment processing engines" },
    { skill: "React Native & Flutter", premium: "+19%", demand: "Moderate", reason: "Pan-African mobile-first experiences" },
    { skill: "PostgreSQL DBA Tuning", premium: "+22%", demand: "High", reason: "Financial transaction consistency" },
    { skill: "AWS Certified Solution Architect", premium: "+24%", demand: "High", reason: "Enterprise cloud compliance" },
    { skill: "Next.js & TypeScript", premium: "+20%", demand: "Very High", reason: "High-performance enterprise frontends" },
    { skill: "System Design & Microservices", premium: "+26%", demand: "High", reason: "Distributed fintech architectures" }
];

const SEED_COMPANIES = [
    {
        name: "Hubtel Fintech Group",
        email: "careers@hubtel.com",
        logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
        hq: "Accra, Ghana (Kokomlemle)",
        stage: "Growth / Pre-IPO",
        employees: "500+",
        industry: "Messaging & Payment Infrastructure",
        website: "https://hubtel.com",
        rating: 4.8,
        verified: true,
        description: "Ghana's leading messaging and payment aggregator handling millions of mobile transactions and retail merchant orders daily.",
        stack: ["Kubernetes", "Docker", "Terraform", "Go", "Prometheus", "PostgreSQL"],
        perks: ["Medical Insurance", "Provident Fund", "Catered Lunch", "Continuous Learning Fund"],
    },
    {
        name: "Paystack Ghana",
        email: "hiring@paystack.com",
        logo: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=60",
        hq: "Pan-African Remote",
        stage: "Acquired (Stripe)",
        employees: "300+",
        industry: "Payments & Financial Infrastructure",
        website: "https://paystack.com",
        rating: 4.9,
        verified: true,
        description: "Paystack helps Africa's best businesses accept payments from anyone, anywhere in the world with state-of-the-art developer APIs.",
        stack: ["Node.js", "TypeScript", "React", "PostgreSQL", "AWS"],
        perks: ["100% Remote Flexibility", "Home Office Stipend", "Full Health Cover", "Equity Options"],
    },
    {
        name: "mPharma",
        email: "careers@mpharma.com",
        logo: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60",
        hq: "Accra, Ghana (Airport)",
        stage: "Series C",
        employees: "400+",
        industry: "HealthTech & Supply Chain",
        website: "https://mpharma.com",
        rating: 4.7,
        verified: true,
        description: "Building an Africa in good health by increasing patient access to safe, affordable medicines through community clinics and data logistics.",
        stack: ["Python", "Django", "React", "PostgreSQL", "AWS"],
        perks: ["Prescription Discounts", "Health Insurance", "Stock Units", "Hybrid Model"],
    },
    {
        name: "Zeepay Ghana",
        email: "careers@myzeepay.com",
        logo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=60",
        hq: "Accra, Ghana (Cantonments)",
        stage: "Growth / Pre-IPO",
        employees: "150+",
        industry: "Mobile Money & Cross-Border Remittance",
        website: "https://myzeepay.com",
        rating: 4.8,
        verified: true,
        description: "The fastest growing fintech in Ghana focused on digital rails, terminating mobile money transfers into 20+ African countries directly.",
        stack: ["Java", "Spring Boot", "Microservices", "Docker", "PostgreSQL"],
        perks: ["Annual Bonus", "Gym Access", "Work From Home Allowance", "Family Coverage"],
    },
    {
        name: "Spagad Technologies Ltd",
        email: "recruitment@spagad.com",
        logo: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=60",
        hq: "Accra, Ghana (Ridge)",
        stage: "Established Enterprise",
        employees: "120+",
        industry: "Enterprise Software & Cloud",
        website: "https://spagad.com",
        rating: 4.9,
        verified: true,
        description: "Enterprise software development and digital transformation consultancy engineering core banking and cloud operations.",
        stack: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker"],
        perks: ["Full Private Health Cover", "Hardware Stipend", "Tier-3 Pension", "Remote Days"],
    },
    {
        name: "Flutterwave",
        email: "talent@flutterwavego.com",
        logo: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=120&auto=format&fit=crop&q=60",
        cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60",
        hq: "Pan-African / Lagos / San Francisco",
        stage: "Unicorn (Series D)",
        employees: "800+",
        industry: "Global Payment Processing",
        website: "https://flutterwave.com",
        rating: 4.6,
        verified: true,
        description: "Connecting African businesses to the global digital economy with modern payment APIs and enterprise treasury management.",
        stack: ["React", "Python", "Java", "Docker", "GCP", "PostgreSQL"],
        perks: ["Global Travel", "Learning Budget", "Wellness Cover", "Equity"],
    }
];

async function seed() {
    console.log("Seeding salary benchmarks...");
    for (const b of ROLES_BENCHMARKS) {
        const existing = await prisma.salaryBenchmark.findFirst({
            where: { role: b.role },
        });
        if (!existing) {
            await prisma.salaryBenchmark.create({ data: b });
        } else {
            await prisma.salaryBenchmark.update({
                where: { id: existing.id },
                data: b,
            });
        }
    }
    console.log("✓ Salary benchmarks seeded.");

    console.log("Seeding skill premiums...");
    for (const s of SKILL_PREMIUMS) {
        const existing = await prisma.skillPremium.findFirst({
            where: { skill: s.skill },
        });
        if (!existing) {
            await prisma.skillPremium.create({ data: s });
        } else {
            await prisma.skillPremium.update({
                where: { id: existing.id },
                data: s,
            });
        }
    }
    console.log("✓ Skill premiums seeded.");

    console.log("Seeding verified ecosystem company profiles...");
    for (const c of SEED_COMPANIES) {
        // Find or create an employer user for each company
        let user = await prisma.user.findUnique({
            where: { email: c.email },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: c.name,
                    email: c.email,
                    role: "employer",
                    companyName: c.name,
                    companyLogo: c.logo,
                    companyDescription: c.description,
                },
            });
        }

        // Upsert Company profile
        await prisma.company.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                name: c.name,
                logo: c.logo,
                cover: c.cover,
                description: c.description,
                hq: c.hq,
                stage: c.stage,
                employees: c.employees,
                industry: c.industry,
                website: c.website,
                rating: c.rating,
                verified: c.verified,
                stack: c.stack,
                perks: c.perks,
            },
            update: {
                name: c.name,
                logo: c.logo,
                cover: c.cover,
                description: c.description,
                hq: c.hq,
                stage: c.stage,
                employees: c.employees,
                industry: c.industry,
                website: c.website,
                rating: c.rating,
                verified: c.verified,
                stack: c.stack,
                perks: c.perks,
            },
        });

        const companyRecord = await prisma.company.findUnique({
            where: { userId: user.id },
        });

        // Seed 1-2 live jobs for each company if none exist
        const existingJobsCount = await prisma.job.count({
            where: { companyId: user.id },
        });

        if (existingJobsCount === 0) {
            const jobDefs = {
                "Hubtel Fintech Group": {
                    title: "DevOps & Cloud Infrastructure Lead",
                    category: "Engineering",
                    type: "Full-Time",
                    location: "Accra, Ghana (Kokomlemle)",
                    salaryMin: 55000,
                    salaryMax: 85000,
                    description: "Maintain 99.99% uptime across mission-critical SMS, payment gateway infrastructure, and telecom interconnect switches powering millions of daily transactions.",
                    requirements: "4+ years administering production Kubernetes & Linux kernel tuning. Strong coding proficiency in Go or Python. Deep understanding of telecom protocols.",
                },
                "Paystack Ghana": {
                    title: "Product Operations Manager",
                    category: "Product",
                    type: "Full-Time",
                    location: "Pan-African Remote",
                    salaryMin: 45000,
                    salaryMax: 70000,
                    description: "Bridge customer feedback, settlement operations, and payment engineering to streamline dispute resolution and merchant integration across Ghana, Kenya, and Nigeria.",
                    requirements: "3+ years in product operations, fintech consulting, or analytics roles. Advanced proficiency in SQL. Empathetic communication.",
                },
                "mPharma": {
                    title: "Clinical Data Systems Architect",
                    category: "Data & Analytics",
                    type: "Full-Time",
                    location: "Accra, Ghana (Airport)",
                    salaryMin: 50000,
                    salaryMax: 80000,
                    description: "Build distributed healthcare data pipelines and inventory prediction engines connecting over 400 community pharmacies across sub-Saharan Africa.",
                    requirements: "5+ years data warehousing with PostgreSQL, Snowflake, and Python. Experience with health compliance regulations.",
                },
                "Zeepay Ghana": {
                    title: "Senior Mobile Engineer (Flutter)",
                    category: "Engineering",
                    type: "Full-Time",
                    location: "Accra, Ghana (Cantonments)",
                    salaryMin: 40000,
                    salaryMax: 72000,
                    description: "Lead development of Zeepay's next-generation remittance and omni-channel mobile apps with state-of-the-art biometrics and low-latency API sync.",
                    requirements: "4+ years production Flutter / Dart experience. Deep understanding of native iOS/Android bridge and offline state caching.",
                },
                "Spagad Technologies Ltd": {
                    title: "Senior Full-Stack Engineer",
                    category: "Engineering",
                    type: "Full-Time",
                    location: "Accra, Ghana (Ridge)",
                    salaryMin: 60000,
                    salaryMax: 90000,
                    description: "Architect resilient distributed systems, build responsive Next.js / TypeScript frontends, and collaborate with healthtech and fintech platforms across Ghana and West Africa.",
                    requirements: "5+ years production experience in JavaScript / TypeScript ecosystems. High-throughput PostgreSQL relational schema design.",
                },
                "Flutterwave": {
                    title: "Financial Settlement Backend Engineer",
                    category: "Engineering",
                    type: "Full-Time",
                    location: "Pan-African Remote",
                    salaryMin: 65000,
                    salaryMax: 95000,
                    description: "Engineer core settlement reconciliation microservices handling multi-currency forex clearing and automated merchant payouts.",
                    requirements: "Strong Java / Go microservices proficiency, distributed transactions (Saga pattern), and PostgreSQL database optimization.",
                },
            };

            const jobData = jobDefs[c.name];
            if (jobData) {
                await prisma.job.create({
                    data: {
                        ...jobData,
                        jobType: jobData.type,
                        companyLogo: c.logo,
                        companyId: user.id,
                        companyProfileId: companyRecord?.id,
                        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                });
            }
        }
    }
    console.log("✓ Ecosystem companies and live jobs seeded successfully.");
}

seed()
    .catch((e) => {
        console.error("Error during seeding:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
