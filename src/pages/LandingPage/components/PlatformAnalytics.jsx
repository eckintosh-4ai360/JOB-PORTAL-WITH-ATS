import { motion } from "framer-motion";
import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleCheck,
  Clock,
} from "lucide-react";

const workflowItems = [
  {
    icon: BriefcaseBusiness,
    title: "Publish and manage roles",
    description:
      "Employers can create job posts, keep listings organized, and return to active hiring work quickly.",
  },
  {
    icon: CircleCheck,
    title: "Review applications clearly",
    description:
      "Applicant information is grouped around each opening so hiring teams can compare next steps.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Track hiring activity",
    description:
      "Dashboard views make job performance, recent activity, and applicant flow easier to monitor.",
  },
  {
    icon: Clock,
    title: "Reduce manual follow-up",
    description:
      "Saved jobs, profiles, and application views keep both sides aligned during the hiring process.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const PlatformAnalytics = () => {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={fadeUp}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
              Operational clarity
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-normal text-secondary sm:text-4xl lg:text-5xl">
              Built around the hiring work that happens every day.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
              The landing experience now mirrors the product promise: practical tools,
              clear routes, and a confident tone for both employers and job seekers.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.08,
                },
              },
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {workflowItems.map((item) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.title}
                  variants={fadeUp}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-secondary ring-1 ring-slate-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-secondary">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PlatformAnalytics;
