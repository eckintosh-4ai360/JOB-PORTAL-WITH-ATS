import { motion } from "framer-motion";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Search,
  Star,
  Users,
} from "lucide-react";
import { landingFeatures } from "../../../utils/data";

const iconMap = {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileText,
  MessageSquare,
  Search,
  Star,
  Users,
};

const accentClasses = {
  primary: {
    icon: "bg-orange-50 text-primary ring-orange-100",
    label: "text-primary",
  },
  secondary: {
    icon: "bg-slate-100 text-secondary ring-slate-200",
    label: "text-secondary",
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

const FeatureItem = ({ feature, accent }) => {
  const Icon = iconMap[feature.icon];
  const colors = accentClasses[accent] || accentClasses.primary;

  return (
    <motion.article
      variants={fadeUp}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-md ring-1 ${colors.icon}`}
      >
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </div>
      <h3 className="mt-5 text-lg font-bold text-secondary">{feature.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
    </motion.article>
  );
};

const Features = () => {
  return (
    <section className="bg-slate-50 py-20 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          variants={fadeUp}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">
            Platform capabilities
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-normal text-secondary sm:text-4xl lg:text-5xl">
            {landingFeatures.title}{" "}
            <span className="text-primary">{landingFeatures.highlightedTitle}</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            {landingFeatures.subtitle}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-10">
          {landingFeatures.groups.map((group, groupIndex) => {
            const colors = accentClasses[group.accent] || accentClasses.primary;

            return (
              <motion.div
                key={group.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      delayChildren: groupIndex * 0.08,
                      staggerChildren: 0.08,
                    },
                  },
                }}
              >
                <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-[0.16em] ${colors.label}`}>
                      {group.kicker}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-secondary">{group.title}</h3>
                  </div>
                  <span className="hidden text-sm font-semibold text-slate-500 sm:block">
                    {group.features.length} tools
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {group.features.map((feature) => (
                    <FeatureItem
                      key={feature.title}
                      feature={feature}
                      accent={group.accent}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
