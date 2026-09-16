import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navLinks = [
    { label: "Find Jobs", path: "/find-jobs" },
    { label: "Browse Companies", path: "/browse-companies" },
    { label: "Salaries & Insights", path: "/salaries-insights" },
    { label: "AI Resume Match", path: "/resume-analyzer" },
    { label: "Saved Jobs", path: "/saved-jobs" },
  ];

  const isActive = (path) => {
    if (path === "/find-jobs") {
      return location.pathname === "/" || location.pathname === "/find-jobs";
    }
    return location.pathname.startsWith(path);
  };

  const handlePostJob = () => {
    if (isAuthenticated && user?.role === "employer") {
      navigate("/post-job");
    } else if (isAuthenticated) {
      navigate("/post-job");
    } else {
      navigate("/login", { state: { from: { pathname: "/post-job" } } });
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border-default shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 xl:gap-6">
        {/* Brand & Nav */}
        <div className="flex items-center gap-4 xl:gap-8 shrink-0">
          <Link
            to="/find-jobs"
            className="flex items-center gap-2.5 shrink-0 group focus:outline-none"
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

          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`whitespace-nowrap shrink-0 transition-all text-[13px] xl:text-[14px] px-3 xl:px-4 py-2 rounded-full font-medium ${
                    active
                      ? "bg-brand-indigo-light text-primary font-bold shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      : "text-text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle color mode"
            className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Saved Jobs shortcut with notification dot */}
          <Link
            to="/saved-jobs"
            aria-label="Saved Jobs shortcut"
            className="relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              bookmark
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-verified-badge animate-pulse" />
          </Link>

          <div className="h-6 w-px bg-border-default hidden sm:block shrink-0" />

          {/* User Auth or Sign In */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-container transition-colors"
                type="button"
              >
                <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-label-md text-text-primary truncate max-w-[120px]">
                    {user?.name || "User"}
                  </span>
                  <span className="font-label-caps text-text-muted capitalize">
                    {user?.role || "Candidate"}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-text-muted">
                  expand_more
                </span>
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-card border border-border-default shadow-xl py-2 z-50"
                  onMouseLeave={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-border-default">
                    <p className="font-label-md text-text-primary font-bold">
                      {user?.name}
                    </p>
                    <p className="font-body-sm text-text-muted truncate">
                      {user?.email}
                    </p>
                  </div>

                  {user?.role === "employer" || user?.role === "admin" ? (
                    <>
                      <Link
                        to="/employer-dashboard"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          dashboard
                        </span>
                        {user?.role === "admin" ? "Admin Dashboard" : "Employer Dashboard"}
                      </Link>
                      <Link
                        to="/manage-jobs"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          work_history
                        </span>
                        Manage Jobs
                      </Link>
                      <Link
                        to="/post-job"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          add_circle
                        </span>
                        Post a Job
                      </Link>
                      <Link
                        to="/applicants"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          groups
                        </span>
                        Applicants
                      </Link>
                      <Link
                        to="/company-profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          business
                        </span>
                        Company Profile
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          account_circle
                        </span>
                        Candidate Profile
                      </Link>
                      <Link
                        to="/saved-jobs"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          bookmark
                        </span>
                        Saved & Applied
                      </Link>
                      <Link
                        to="/documents"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 font-label-md text-text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          description
                        </span>
                        My Documents
                      </Link>
                    </>
                  )}

                  <div className="border-t border-border-default my-1" />
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    type="button"
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 font-label-md text-error hover:bg-error-container/20 transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      logout
                    </span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 text-text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Post a Job CTA */}
          <button
            onClick={handlePostJob}
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-primary-container text-on-primary text-sm font-semibold whitespace-nowrap shrink-0 hover:bg-brand-indigo-dark shadow-sm transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span className="whitespace-nowrap">Post a Job</span>
          </button>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface-card border-b border-border-default px-margin-mobile py-space-md shadow-xl animate-fadeIn">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-xl font-label-lg flex items-center justify-between ${
                  isActive(link.path)
                    ? "bg-brand-indigo-light text-primary font-bold"
                    : "text-text-secondary hover:bg-surface-container"
                }`}
              >
                <span>{link.label}</span>
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </Link>
            ))}

            {!isAuthenticated && (
              <div className="pt-2 border-t border-border-default mt-2 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 rounded-xl text-center font-label-lg bg-surface-container text-on-surface"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 rounded-xl text-center font-label-lg bg-primary-container text-on-primary font-bold"
                >
                  Create Account
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
