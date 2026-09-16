import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

const proofPoints = [
  { icon: CheckCircle2, text: "Verified employer profiles" },
  { icon: BriefcaseBusiness, text: "Focused job discovery" },
  { icon: Building2, text: "Tools for active hiring teams" },
];

const Hero = () => {
  const navigate = useNavigate();
  const [user] = useState(() => getStoredUser());
  const isAuthenticated = Boolean(user);

  const employerPath =
    isAuthenticated && user?.role === "employer" ? "/employer-dashboard" : "/login";

  return (
    <section className="relative isolate flex min-h-[82svh] items-center overflow-hidden bg-secondary pt-24 pb-14 text-white sm:min-h-[84svh] md:pt-28 lg:pb-16">
      <img
        src="/bg.jpg"
        alt="Hiring interview in progress"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,13,18,0.92),rgba(10,13,18,0.74)_48%,rgba(10,13,18,0.32))]" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="text-sm font-bold uppercase tracking-[0.18em] text-orange-200"
          >
            Professional recruitment platform
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: "easeOut" }}
            className="mt-5 max-w-2xl text-5xl font-bold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl"
          >
            SPG JobPortal
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.6, ease: "easeOut" }}
            className="mt-6 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl"
          >
            A focused workspace for finding the right roles, presenting stronger
            candidate profiles, and managing employer hiring activity with clarity.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.6, ease: "easeOut" }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={() => navigate("/find-jobs")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              <Search className="h-5 w-5" />
              Find Jobs
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate(employerPath)}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/35 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white hover:text-secondary"
            >
              Post a Job
            </button>
          </motion.div>

          {!isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.34, duration: 0.55 }}
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-white/72"
            >
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-bold text-white transition-colors hover:text-orange-200"
              >
                Login
              </button>
              <span className="h-1 w-1 rounded-full bg-white/45" />
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="font-bold text-white transition-colors hover:text-orange-200"
              >
                Create an account
              </button>
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.55, ease: "easeOut" }}
            className="mt-10 grid max-w-3xl gap-3 border-t border-white/20 pt-6 sm:grid-cols-3"
          >
            {proofPoints.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.text} className="flex items-center gap-3 text-sm text-white/80">
                  <Icon className="h-5 w-5 shrink-0 text-orange-200" />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
