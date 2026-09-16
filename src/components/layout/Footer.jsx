import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="w-full bg-surface-card border-t border-border-default pt-space-xl pb-space-lg text-text-secondary">
      <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-lg mb-space-xl">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-2 flex flex-col gap-space-sm">
            <Link
              to="/find-jobs"
              className="flex items-center gap-space-sm w-fit group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center shadow-[0_2px_8px_rgba(53,37,205,0.25)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-on-primary text-[22px]">
                  work
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md font-bold tracking-tight bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent leading-none">
                  SPG
                </span>
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-muted leading-tight">
                  JobPortal
                </span>
              </div>
            </Link>

            <p className="font-body-md text-body-md text-text-secondary max-w-sm mt-2 leading-relaxed">
              West Africa's verified tech and executive career network. Connecting
              tier-1 African developers, managers, and designers with top
              enterprises and high-growth global ventures.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-salary-surface text-salary-emerald font-label-caps uppercase tracking-wider font-bold">
                <span className="w-2 h-2 rounded-full bg-salary-emerald animate-pulse" />
                Live Hub Network
              </span>
              <span className="text-text-muted text-xs">•</span>
              <span className="font-body-sm text-text-muted">
                Accra • Lagos • Nairobi • Remote
              </span>
            </div>
          </div>

          {/* Candidates Column */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-label-lg font-bold text-text-primary tracking-tight mb-2">
              Candidates
            </h4>
            <Link
              to="/find-jobs"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Browse All Jobs
            </Link>
            <Link
              to="/browse-companies"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Tech Companies
            </Link>
            <Link
              to="/salaries-insights"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Salary Benchmarks
            </Link>
            <Link
              to="/resume-analyzer"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1 flex items-center gap-1.5"
            >
              <span>AI Resume Analyzer</span>
              <span className="px-1.5 py-0.5 rounded-full bg-brand-indigo-light text-primary text-[10px] font-bold">
                AI
              </span>
            </Link>
            <Link
              to="/saved-jobs"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Saved Applications
            </Link>
          </div>

          {/* Employers Column */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-label-lg font-bold text-text-primary tracking-tight mb-2">
              Employers
            </h4>
            <Link
              to="/post-job"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Post a Tech Vacancy
            </Link>
            <Link
              to="/employer-dashboard"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Employer Dashboard
            </Link>
            <Link
              to="/applicants"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Applicant ATS Viewer
            </Link>
            <Link
              to="/salaries-insights"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Compensation Intelligence
            </Link>
            <Link
              to="/login"
              className="font-body-md text-text-secondary hover:text-primary transition-colors py-1"
            >
              Hiring Team Sign In
            </Link>
          </div>

          {/* Newsletter Column */}
          <div className="flex flex-col gap-space-xs">
            <h4 className="font-label-lg font-bold text-text-primary tracking-tight mb-2">
              Job Alerts & Insights
            </h4>
            <p className="font-body-sm text-text-muted leading-relaxed mb-2">
              Subscribe to weekly verified African engineering roles, salary updates, and tech hiring reports.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Thank you for subscribing to SPG JobPortal alerts!");
              }}
              className="flex flex-col gap-2"
            >
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@work-email.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container-low font-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border-default"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md font-semibold hover:bg-brand-indigo-dark shadow-sm transition-all text-center"
              >
                Get Weekly Job Alert
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-space-md border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-space-sm font-body-sm text-text-muted">
          <p>© {new Date().getFullYear()} SPG JobPortal. All verified rights reserved.</p>
          <div className="flex items-center gap-space-md">
            <Link to="/find-jobs" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/find-jobs" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link to="/salaries-insights" className="hover:text-primary transition-colors">
              Verified Trust Seal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
