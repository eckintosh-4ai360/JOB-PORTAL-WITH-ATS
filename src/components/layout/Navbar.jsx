import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const needsCompanySetup =
    user?.role === "employer" && user?.employerOnboardingComplete === false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    setIsVisible(true);

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY.current;

      setIsVisible(currentScrollY < 8 || isScrollingUp);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

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
    if (isAuthenticated && needsCompanySetup) {
      navigate("/company-setup");
    } else if (isAuthenticated && user?.role === "employer") {
      navigate("/post-job");
    } else if (isAuthenticated) {
      navigate("/post-job");
    } else {
      navigate("/login", { state: { from: { pathname: "/post-job" } } });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 z-50 w-full px-3 pt-2 transition-transform duration-200 ease-out will-change-transform sm:px-5 sm:pt-3 ${
        isVisible ? "translate-y-0" : "-translate-y-[calc(100%+1rem)]"
      }`}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1360px] items-center justify-between gap-3 rounded-2xl border border-white/80 bg-surface-card/90 px-3 shadow-[0_12px_32px_rgba(53,37,120,0.12)] backdrop-blur-xl sm:px-5 xl:gap-6">
        {/* Brand & Nav */}
        <div className="flex items-center gap-4 xl:gap-8 shrink-0">
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1 focus:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3a1b8a] via-[#6833c4] to-[#b26ee9] shadow-[0_5px_14px_rgba(90,45,180,0.35)] transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-on-primary text-[22px]">
                work
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md bg-gradient-to-r from-[#3d197f] via-primary to-[#b15adf] bg-clip-text font-bold leading-none tracking-tight text-transparent">
                SPG
              </span>
              <span className="font-label-caps text-label-caps leading-tight tracking-[0.16em] text-text-muted uppercase">
                Talent network
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
                      ? "bg-gradient-to-r from-[#f0e8ff] to-brand-indigo-light text-primary font-bold shadow-[0_2px_6px_rgba(82,42,173,0.10)]"
                      : "text-text-secondary hover:bg-[#f7f3ff] hover:text-primary transition-colors"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-[#f5f1ff] hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Saved Jobs shortcut with notification dot */}
          <Link
            to="/saved-jobs"
            aria-label="Saved Jobs shortcut"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-[#f5f1ff] hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">
              bookmark
            </span>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-[#ea8d76] animate-pulse" />
          </Link>

          <div className="h-6 w-px bg-border-default hidden sm:block shrink-0" />

          {/* User Auth or Sign In */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-[#f7f3ff]"
                type="button"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#a55adc] text-sm font-bold text-on-primary shadow-sm">
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
                  className="absolute right-0 z-50 mt-3 w-56 rounded-2xl border border-[#e6d9f7] bg-surface-card py-2 shadow-[0_18px_44px_rgba(61,31,113,0.18)]"
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

                  {needsCompanySetup ? (
                    <>
                      <div className="mx-3 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-xs font-bold text-amber-900">Company setup required</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-amber-700">
                          Finish your organisation profile before accessing hiring tools.
                        </p>
                      </div>
                      <Link
                        to="/company-setup"
                        onClick={() => setUserDropdownOpen(false)}
                        className="mx-2 mt-1 flex items-center gap-2.5 rounded-xl bg-primary px-3 py-2.5 font-label-md font-bold text-on-primary transition-colors hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          checklist
                        </span>
                        Finish company setup
                      </Link>
                    </>
                  ) : user?.role === "employer" || user?.role === "admin" ? (
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
              className="hidden shrink-0 items-center justify-center rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap text-text-secondary transition-colors hover:bg-[#f7f3ff] hover:text-primary sm:inline-flex"
            >
              Sign In
            </Link>
          )}

          {/* Post a Job CTA */}
          <button
            onClick={handlePostJob}
            type="button"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3d197f] to-[#6b35c6] px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_12px_rgba(72,35,154,0.28)] transition-all hover:brightness-110 active:scale-[0.98] sm:px-4"
          >
            <span className="material-symbols-outlined text-[18px]">
              {needsCompanySetup ? "checklist" : "add_circle"}
            </span>
            <span className="whitespace-nowrap">
              {needsCompanySetup ? "Finish setup" : "Post a Job"}
            </span>
          </button>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-[#f5f1ff] lg:hidden"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mx-auto mt-2 max-w-[1360px] rounded-2xl border border-[#e6d9f7] bg-surface-card px-margin-mobile py-space-md shadow-[0_18px_44px_rgba(61,31,113,0.18)] animate-fadeIn lg:hidden">
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
