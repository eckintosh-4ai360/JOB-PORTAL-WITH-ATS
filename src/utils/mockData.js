// Curated mock datasets matching the SCREENS specifications
// Ensures rich, pixel-perfect visual fidelity alongside live backend API data

export const MOCK_JOBS = [
  {
    _id: "mock-job-1",
    title: "Senior Full-Stack Engineer",
    company: {
      companyName: "Spagad Technologies Ltd",
      companyLogo: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=120&auto=format&fit=crop&q=60",
      location: "Accra, Ghana",
      isVerified: true,
    },
    location: "Accra, Ghana (Hybrid)",
    workModel: "Hybrid",
    type: "Full-Time",
    category: "engineering",
    experienceLevel: "Senior",
    salaryMin: 60000,
    salaryMax: 90000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"],
    matchScore: 96,
    isUrgent: true,
    description:
      "Architect resilient distributed systems, build responsive Next.js / TypeScript frontends, and collaborate with healthtech and fintech platforms across Ghana and West Africa.",
    responsibilities: [
      "Architect and maintain modular Next.js frontends and Node.js microservices.",
      "Design ACID-compliant PostgreSQL schemas ensuring health data encryption.",
      "Implement mobile money rails (MTN MoMo, Telecel Cash) and national health aggregators.",
      "Optimize Core Web Vitals and Redis event caching across low-bandwidth environments."
    ],
    requirements: [
      "5+ years of production experience in JavaScript / TypeScript ecosystems.",
      "Demonstrated experience designing high-throughput relational schemas in PostgreSQL.",
      "Familiarity with containerized deployments (Docker, Kubernetes) on AWS or GCP.",
      "Solid foundation in data protection guidelines (GDPR / Data Protection Act Ghana)."
    ],
    perks: [
      "Full family private medical cover (including optical & dental)",
      "Annual GH₵ 15,000 professional hardware & desk stipend",
      "Flexible hybrid model with 2 days remote weekly",
      "Tier-1 Tier-3 pension matching contribution"
    ]
  },
  {
    _id: "mock-job-2",
    title: "DevOps & Cloud Infrastructure Lead",
    company: {
      companyName: "Hubtel Fintech Group",
      companyLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60",
      location: "Accra, Ghana",
      isVerified: true,
    },
    location: "Accra, Ghana (On-site • Kokomlemle)",
    workModel: "On-site",
    type: "Full-Time",
    category: "engineering",
    experienceLevel: "Lead / Staff",
    salaryMin: 55000,
    salaryMax: 85000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Kubernetes", "Docker", "Terraform", "Go", "Prometheus"],
    matchScore: 92,
    isUrgent: false,
    description:
      "Maintain 99.99% uptime across mission-critical SMS, payment gateway infrastructure, and telecom interconnect switches powering millions of daily transactions.",
    responsibilities: [
      "Manage high-availability Kubernetes clusters across multi-region datacenters.",
      "Automate zero-downtime CI/CD deployment pipelines using ArgoCD and GitHub Actions.",
      "Conduct security audits, penetration mitigation, and infrastructure disaster recovery."
    ],
    requirements: [
      "4+ years administering production Kubernetes & Linux kernel tuning.",
      "Strong coding proficiency in Go or Python for internal automation tools.",
      "Deep understanding of telecom networking protocols (SMPP, HTTP/2, gRPC)."
    ],
    perks: [
      "Stock option grants & executive profit-sharing tier",
      "Free daily gourmet lunch & transportation shuttle in Accra",
      "Unlimited paid time off (PTO) policy"
    ]
  },
  {
    _id: "mock-job-3",
    title: "Product Operations Manager",
    company: {
      companyName: "Paystack Ghana",
      companyLogo: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=120&auto=format&fit=crop&q=60",
      location: "Pan-African Remote",
      isVerified: true,
    },
    location: "Pan-African Remote",
    workModel: "Remote",
    type: "Full-Time",
    category: "product",
    experienceLevel: "Mid-Level",
    salaryMin: 45000,
    salaryMax: 70000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["SQL", "Metabase", "Fintech Rails", "Customer Journey", "Stripe API"],
    matchScore: 89,
    isUrgent: true,
    description:
      "Bridge customer feedback, settlement operations, and payment engineering to streamline dispute resolution and merchant integration across Ghana, Kenya, and Nigeria.",
    responsibilities: [
      "Analyze merchant settlement bottlenecks using SQL queries and internal dashboards.",
      "Collaborate with compliance and banking partners on regulatory clearing.",
      "Automate manual transaction verification workflows with Python and webhooks."
    ],
    requirements: [
      "3+ years in product operations, fintech consulting, or analytics roles.",
      "Advanced proficiency in writing analytical SQL queries against Snowflake/BigQuery.",
      "Strong empathetic customer communication skills."
    ],
    perks: [
      "Remote office setup bonus ($2,000 USD)",
      "Health & wellness wellness budget including gym memberships",
      "Annual team retreat in West Africa"
    ]
  },
  {
    _id: "mock-job-4",
    title: "Mobile Engineering Lead (Flutter)",
    company: {
      companyName: "Flutterwave",
      companyLogo: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=120&auto=format&fit=crop&q=60",
      location: "Nairobi, Kenya",
      isVerified: true,
    },
    location: "Nairobi, Kenya (Remote Eligible)",
    workModel: "Remote",
    type: "Full-Time",
    category: "engineering",
    experienceLevel: "Lead / Staff",
    salaryMin: 50000,
    salaryMax: 80000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Flutter", "Dart", "GraphQL", "CI/CD", "State Management"],
    matchScore: 88,
    isUrgent: false,
    description:
      "Lead cross-platform mobile application development for enterprise retail merchants and end-consumer virtual remittance cards across 15+ African currencies.",
    responsibilities: [
      "Architect clean Flutter architectures using BLoC or Riverpod state management.",
      "Ensure 60 FPS silky smooth UI performance across low-end Android devices.",
      "Direct security hardening including biometric auth, certificate pinning, and obfuscation."
    ],
    requirements: [
      "4+ years shipping production Flutter/Dart apps to Google Play and App Store.",
      "Familiarity with native platform channels (Swift/Kotlin) for SDK integrations."
    ],
    perks: [
      "Global travel opportunities for tech conferences",
      "Comprehensive family health insurance",
      "Generous learning stipend for certifications"
    ]
  },
  {
    _id: "mock-job-5",
    title: "Health Systems Data Architect",
    company: {
      companyName: "mPharma",
      companyLogo: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=60",
      location: "Accra, Ghana",
      isVerified: true,
    },
    location: "Accra, Ghana (Hybrid)",
    workModel: "Hybrid",
    type: "Full-Time",
    category: "engineering",
    experienceLevel: "Senior",
    salaryMin: 65000,
    salaryMax: 100000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Python", "Kafka", "Data Lakehouse", "Snowflake", "dbt"],
    matchScore: 94,
    isUrgent: false,
    description:
      "Design real-time medication supply chain data pipelines connecting over 850 retail pharmacies and community hospitals in Ghana, Nigeria, and Kenya.",
    responsibilities: [
      "Build fault-tolerant event streaming pipelines processing inventory logs via Apache Kafka.",
      "Develop dbt models to empower clinical analytics and predictive stockout forecasting."
    ],
    requirements: [
      "5+ years of data engineering experience with Apache Kafka, Spark, or dbt.",
      "Strong understanding of HIPAA/health data privacy concepts."
    ],
    perks: [
      "Subsidized prescription medicines for direct family",
      "Continuous education sponsorship",
      "Quarterly performance bonuses"
    ]
  },
  {
    _id: "mock-job-6",
    title: "Senior Core Fintech Engineer",
    company: {
      companyName: "Zeepay Ghana",
      companyLogo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=60",
      location: "Accra, Ghana",
      isVerified: true,
    },
    location: "Accra, Ghana (Cantonments HQ)",
    workModel: "Hybrid",
    type: "Full-Time",
    category: "engineering",
    experienceLevel: "Senior",
    salaryMin: 48000,
    salaryMax: 75000,
    currency: "GH₵",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ["Java", "Spring Boot", "Microservices", "ISO 8583", "Docker"],
    matchScore: 91,
    isUrgent: true,
    description:
      "Build high-volume international remittance payment bridges directly terminating funds into bank accounts and mobile money wallets across Africa & the Caribbean.",
    responsibilities: [
      "Implement ISO 8583 financial messaging protocols with partner switch networks.",
      "Design zero-loss idempotency systems preventing duplicate payment disbursements."
    ],
    requirements: [
      "4+ years with Java Spring Boot microservice architectures in banking or payments.",
      "Strong mastery of relational transactions, isolation levels, and locking models."
    ],
    perks: [
      "Annual wellness bonus and gym membership",
      "Performance-based annual salary review",
      "Work-from-home allowance"
    ]
  }
];

export const MOCK_COMPANIES = [
  {
    id: "spagad",
    name: "Spagad Technologies Ltd",
    logo: "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=60",
    hq: "Accra, Ghana (Ridge)",
    stage: "Series B",
    employees: "250-500",
    industry: "HealthTech & Fintech Systems",
    openRoles: 4,
    rating: 4.9,
    verified: true,
    description:
      "West Africa's leading healthcare technology and enterprise enterprise systems integrator, processing over 2.4 million protected medical and claims records monthly.",
    stack: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker"],
    perks: ["Private Health Insurance", "Hybrid Workplace", "Pension 3", "Hardware Stipend"]
  },
  {
    id: "paystack",
    name: "Paystack Ghana",
    logo: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=60",
    hq: "Accra & Lagos (Pan-African)",
    stage: "Acquired (Stripe)",
    employees: "500+",
    industry: "Modern Payments & Commerce",
    openRoles: 8,
    rating: 4.8,
    verified: true,
    description:
      "A Stripe company helping the most ambitious businesses in Africa solve complex payments, manage merchant tools, and build digital economies.",
    stack: ["Angular", "Node.js", "Ruby", "AWS", "Snowflake"],
    perks: ["Remote Work", "$2k Setup Bonus", "Health Care", "Team Retreats"]
  },
  {
    id: "hubtel",
    name: "Hubtel Fintech Group",
    logo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&auto=format&fit=crop&q=60",
    hq: "Accra, Ghana (Kokomlemle)",
    stage: "Profitable / Enterprise",
    employees: "300+",
    industry: "SuperApp & Telecoms",
    openRoles: 6,
    rating: 4.7,
    verified: true,
    description:
      "Ghana's first tech super-app for shopping, payments, and business communications. Pioneering localized fast commerce and carrier billing.",
    stack: ["Go", "Flutter", "Kubernetes", "C#", "Kafka"],
    perks: ["Free Gourmet Lunch", "Transportation Shuttle", "Stock Options", "Bonus"]
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    logo: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&fit=crop&q=60",
    hq: "Lagos & Nairobi (Pan-African)",
    stage: "Series D (Unicorn)",
    employees: "750+",
    industry: "Global Payments & Remittance",
    openRoles: 12,
    rating: 4.6,
    verified: true,
    description:
      "Connecting African businesses to the global digital economy with modern payment APIs and enterprise treasury management.",
    stack: ["React", "Python", "Java", "Docker", "GCP"],
    perks: ["Global Travel", "Learning Budget", "Wellness Cover", "Equity"]
  },
  {
    id: "andela",
    name: "Andela",
    logo: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=60",
    hq: "Pan-African Remote",
    stage: "Series E",
    employees: "1,000+",
    industry: "Global Tech Talent Network",
    openRoles: 15,
    rating: 4.8,
    verified: true,
    description:
      "The global talent network that connects high-performing technologists with leading enterprises worldwide.",
    stack: ["Full-Stack", "Cloud Native", "AI/ML", "DevOps"],
    perks: ["100% Remote", "Global Compensation", "Certification Grants"]
  },
  {
    id: "mpharma",
    name: "mPharma",
    logo: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60",
    hq: "Accra, Ghana (Airport)",
    stage: "Series C",
    employees: "400+",
    industry: "HealthTech & Pharmacy Supply Chain",
    openRoles: 5,
    rating: 4.7,
    verified: true,
    description:
      "Building an Africa in good health by increasing patient access to safe, affordable medicines through community clinics and data logistics.",
    stack: ["Python", "Django", "React", "PostgreSQL", "AWS"],
    perks: ["Prescription Discounts", "Health Insurance", "Stock Units"]
  },
  {
    id: "zeepay",
    name: "Zeepay Ghana",
    logo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=60",
    hq: "Accra, Ghana (Cantonments)",
    stage: "Growth / Pre-IPO",
    employees: "150+",
    industry: "Mobile Money & Cross-Border Remittance",
    openRoles: 3,
    rating: 4.8,
    verified: true,
    description:
      "The fastest growing fintech in Ghana focused on digital rails, terminating mobile money transfers into 20+ African countries directly.",
    stack: ["Java", "Spring Boot", "Microservices", "Docker"],
    perks: ["Annual Bonus", "Gym Access", "Work From Home Allowance"]
  },
  {
    id: "turaco",
    name: "Turaco",
    logo: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=60",
    cover: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60",
    hq: "Nairobi, Kenya",
    stage: "Series A",
    employees: "100+",
    industry: "Micro-InsurTech",
    openRoles: 2,
    rating: 4.9,
    verified: true,
    description:
      "Inclusive health and life insurance designed for emerging markets with simple, technology-powered fast claims disbursements.",
    stack: ["React Native", "Python", "GCP", "FastAPI"],
    perks: ["Health Shield", "Remote Flex", "Education Stipend"]
  }
];

export const SALARY_BENCHMARKS = {
  roles: [
    { role: "Senior Software Developer", p25: 45000, median: 58500, p75: 78000, p90: 110000 },
    { role: "DevOps / SRE Architect", p25: 48000, median: 65000, p75: 85000, p90: 125000 },
    { role: "Engineering Manager", p25: 60000, median: 80000, p75: 110000, p90: 160000 },
    { role: "Senior Product Designer", p25: 35000, median: 46000, p75: 62000, p90: 85000 },
    { role: "Data Engineer / AI", p25: 42000, median: 55000, p75: 75000, p90: 105000 },
    { role: "Mobile Lead (Flutter/iOS)", p25: 40000, median: 52000, p75: 70000, p90: 95000 },
  ],
  skillsPremium: [
    { skill: "Go (Golang)", premium: "+32%", demand: "High", reason: "Fintech switches & telecom backend scaling" },
    { skill: "Kubernetes & Terraform", premium: "+28%", demand: "Very High", reason: "Multi-region cloud infrastructure" },
    { skill: "Rust", premium: "+35%", demand: "High", reason: "High-frequency payment processing engines" },
    { skill: "React Native & Flutter", premium: "+19%", demand: "Moderate", reason: "Pan-African mobile-first experiences" },
    { skill: "PostgreSQL DBA Tuning", premium: "+22%", demand: "High", reason: "Financial transaction consistency" },
    { skill: "AWS Certified Solution Architect", premium: "+24%", demand: "High", reason: "Enterprise cloud compliance" }
  ]
};
