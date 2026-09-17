require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../config/prisma");

// Sample data for a multi-industry job marketplace. Replace with verified local
// figures before presenting benchmark values as live market data.
const benchmarks = [
  ["Operations Manager", "Business & Professional Services", 30000, 42000, 58000, 75000],
  ["Registered Nurse", "Healthcare & Social Care", 24000, 33000, 45000, 60000],
  ["Secondary School Teacher", "Education & Training", 18000, 27000, 38000, 52000],
  ["Accountant", "Finance & Banking", 28000, 40000, 55000, 72000],
  ["Sales Manager", "Sales, Marketing & Customer Service", 35000, 50000, 70000, 95000],
  ["Site Supervisor", "Construction & Manufacturing", 26000, 38000, 52000, 68000],
  ["Hotel Front Office Manager", "Hospitality, Retail & Tourism", 25000, 36000, 50000, 65000],
  ["Software Developer", "Technology & Engineering", 35000, 50000, 70000, 95000],
].map(([role, sector, p25, median, p75, p90]) => ({
  role, sector, p25, median, p75, p90, location: "Accra / Ghana", tenure: "Mid-Senior (3-6 Yrs)", currency: "GHS",
}));

const skills = [
  ["Leadership", "+18%", "High", "Relevant across management and supervisory roles"],
  ["Professional Certification", "+15%", "High", "Recognised role-specific credentials"],
  ["Customer Service", "+12%", "High", "Critical in client-facing and service roles"],
  ["Financial Reporting", "+17%", "High", "Needed by finance and business teams"],
  ["Project Management", "+16%", "High", "Useful across operations, construction, and services"],
  ["Health & Safety", "+14%", "High", "Required in many site-based and care roles"],
  ["Digital Literacy", "+10%", "Very High", "Core capability for modern workplaces"],
  ["Communication", "+13%", "Very High", "Important for every collaborative role"],
].map(([skill, premium, demand, reason]) => ({ skill, premium, demand, reason }));

const companies = [
  {
    name: "Horizon Community Health", email: "careers@horizonhealth.example", industry: "Healthcare & Social Care", hq: "Accra, Ghana", specialties: ["Patient Care", "Pharmacy", "Community Health"],
    description: "A community healthcare organisation focused on accessible, patient-centred care.", perks: ["Health Insurance", "Professional Development", "Paid Leave"],
    job: { title: "Registered Nurse", category: "Healthcare & Social Care", type: "Full-Time", location: "Accra, Ghana", salaryMin: 24000, salaryMax: 42000, tags: ["Nursing Licence", "Patient Care", "Clinical Documentation"], description: "Provide safe, compassionate nursing care and support patients throughout their treatment journey.", requirements: "Current nursing qualification and licence. Strong patient-care, communication, and record-keeping skills." },
  },
  {
    name: "BrightPath Academy", email: "careers@brightpath.example", industry: "Education & Training", hq: "Kumasi, Ghana", specialties: ["Teaching", "Student Support", "Curriculum Design"],
    description: "An inclusive learning community helping students build knowledge, confidence, and practical skills.", perks: ["Training Budget", "School Holidays", "Pension Contribution"],
    job: { title: "Mathematics Teacher", category: "Education & Training", type: "Full-Time", location: "Kumasi, Ghana", salaryMin: 18000, salaryMax: 32000, tags: ["Teaching Licence", "Mathematics", "Lesson Planning"], description: "Plan and deliver engaging mathematics lessons while supporting the progress and wellbeing of secondary students.", requirements: "Relevant teaching qualification, subject knowledge, and strong classroom-management skills." },
  },
  {
    name: "Summit Build Works", email: "careers@summitbuild.example", industry: "Construction & Manufacturing", hq: "Tema, Ghana", specialties: ["Construction", "Site Safety", "Project Delivery"],
    description: "A construction company delivering safe, reliable commercial and residential projects.", perks: ["Safety Equipment", "Transport Allowance", "Training"],
    job: { title: "Site Supervisor", category: "Construction, Manufacturing & Trades", type: "Full-Time", location: "Tema, Ghana", salaryMin: 26000, salaryMax: 48000, tags: ["Site Supervision", "Health & Safety", "Construction"], description: "Coordinate daily site activities, maintain safety standards, and keep project work on schedule.", requirements: "Construction experience, knowledge of health and safety requirements, and proven team-supervision skills." },
  },
  {
    name: "MarketSquare Stores", email: "careers@marketsquare.example", industry: "Retail & Customer Service", hq: "Accra, Ghana", specialties: ["Retail", "Customer Service", "Store Operations"],
    description: "A growing retail organisation committed to convenient service and quality products.", perks: ["Staff Discount", "Performance Bonus", "Career Progression"],
    job: { title: "Store Manager", category: "Hospitality, Retail & Tourism", type: "Full-Time", location: "Accra, Ghana", salaryMin: 24000, salaryMax: 40000, tags: ["Retail Operations", "Team Leadership", "Inventory Management"], description: "Lead a store team to deliver excellent customer service, accurate stock control, and strong daily operations.", requirements: "Retail-management experience, leadership ability, and confidence working with sales and inventory data." },
  },
  {
    name: "SwiftRoute Logistics", email: "careers@swiftroute.example", industry: "Transport & Logistics", hq: "Accra, Ghana", specialties: ["Logistics", "Fleet Coordination", "Customer Support"],
    description: "A logistics partner connecting businesses and communities through dependable delivery services.", perks: ["Transport Allowance", "Health Cover", "Performance Bonus"],
    job: { title: "Logistics Coordinator", category: "Transport, Logistics & Supply Chain", type: "Full-Time", location: "Accra, Ghana", salaryMin: 22000, salaryMax: 38000, tags: ["Logistics", "Scheduling", "Customer Communication"], description: "Coordinate deliveries, communicate with drivers and customers, and keep operational records accurate.", requirements: "Experience in logistics or operations, strong organisation, and clear communication skills." },
  },
  {
    name: "Civic Impact Foundation", email: "careers@civicimpact.example", industry: "Nonprofit & Community Services", hq: "Tamale, Ghana", specialties: ["Community Engagement", "Programmes", "Monitoring & Evaluation"],
    description: "A nonprofit organisation working with communities to improve access to education, livelihoods, and essential services.", perks: ["Professional Development", "Wellness Support", "Flexible Leave"],
    job: { title: "Programme Officer", category: "Government, Nonprofit & Community", type: "Contract", location: "Tamale, Ghana", salaryMin: 28000, salaryMax: 45000, tags: ["Community Engagement", "Report Writing", "Project Coordination"], description: "Support the planning, delivery, and reporting of community programmes with local partners and participants.", requirements: "Relevant programme or community-development experience, strong writing skills, and a collaborative approach." },
  },
];

async function upsertByField(model, field, data) {
  const existing = await model.findFirst({ where: { [field]: data[field] } });
  return existing
    ? model.update({ where: { id: existing.id }, data })
    : model.create({ data });
}

async function seed() {
  await Promise.all(benchmarks.map((item) => upsertByField(prisma.salaryBenchmark, "role", item)));
  await Promise.all(skills.map((item) => upsertByField(prisma.skillPremium, "skill", item)));

  for (const company of companies) {
    const user = await prisma.user.upsert({
      where: { email: company.email },
      create: { name: company.name, email: company.email, role: "employer", companyName: company.name, companyDescription: company.description },
      update: { name: company.name, companyName: company.name, companyDescription: company.description },
    });
    const profile = await prisma.company.upsert({
      where: { userId: user.id },
      create: { userId: user.id, name: company.name, description: company.description, hq: company.hq, stage: "Established", employees: "50-250", industry: company.industry, rating: 4.5, verified: true, stack: company.specialties, perks: company.perks },
      update: { name: company.name, description: company.description, hq: company.hq, industry: company.industry, stack: company.specialties, perks: company.perks },
    });
    const existingJob = await prisma.job.findFirst({ where: { companyId: user.id, title: company.job.title } });
    if (!existingJob) {
      await prisma.job.create({ data: { ...company.job, jobType: company.job.type, companyId: user.id, companyProfileId: profile.id, deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    }
  }
  console.log("General marketplace sample data seeded successfully.");
}

seed()
  .catch((error) => { console.error("Error during seeding:", error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
