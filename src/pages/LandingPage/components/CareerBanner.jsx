import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CareerBanner = () => {
  const navigate = useNavigate();

  return (
    <section className="relative isolate overflow-hidden bg-secondary py-20 text-white md:py-24">
      <img
        src="/video.png"
        alt="Professional interview meeting"
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-secondary/85" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-200">
            Move forward
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-normal text-white sm:text-4xl lg:text-5xl">
            Start with the path that matches your next goal.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/80 sm:text-lg">
            Explore open opportunities as a candidate or sign in as an employer to
            manage job posts and applications from the dashboard.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/find-jobs")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-bold text-secondary shadow-sm transition-colors hover:bg-orange-50"
            >
              <Search className="h-5 w-5" />
              Browse Jobs
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/35 px-6 text-sm font-bold text-white transition-colors hover:bg-white hover:text-secondary"
            >
              Employer Login
              <BriefcaseBusiness className="h-5 w-5" />
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CareerBanner;
