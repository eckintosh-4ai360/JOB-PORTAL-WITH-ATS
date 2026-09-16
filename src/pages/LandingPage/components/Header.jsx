import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
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

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAuthenticated = Boolean(user);

  const closeAndNavigate = (path) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const employerPath =
    isAuthenticated && user?.role === "employer" ? "/employer-dashboard" : "/login";

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setIsMenuOpen(false);
    navigate("/");
  };

  return (
    <motion.header
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => closeAndNavigate("/")}
            className="flex min-w-0 items-center gap-3 text-left"
            aria-label="Go to homepage"
          >
            <img
              src="/spg-logo.png"
              alt="SPG JobPortal"
              className="h-9 w-9 shrink-0 object-contain"
            />
            <span className="truncate text-lg font-bold tracking-normal text-secondary">
              SPG JobPortal
            </span>
          </button>

          <nav className="hidden items-center gap-8 lg:flex">
            <button
              type="button"
              onClick={() => closeAndNavigate("/find-jobs")}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-secondary"
            >
              Find Jobs
            </button>
            <button
              type="button"
              onClick={() => closeAndNavigate(employerPath)}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-secondary"
            >
              For Employers
            </button>
          </nav>

          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-40 truncate text-sm font-medium text-slate-600 md:inline">
                  {user?.fullName ? `Hi, ${user.fullName}` : "Welcome back"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    closeAndNavigate(
                      user?.role === "employer" ? "/employer-dashboard" : "/find-jobs"
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-bold text-slate-600 transition-colors hover:text-secondary"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => closeAndNavigate("/login")}
                  className="text-sm font-bold text-slate-700 transition-colors hover:text-secondary"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => closeAndNavigate("/signup")}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-secondary transition-colors hover:bg-slate-50 lg:hidden"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 bg-white px-4 py-4 shadow-sm lg:hidden"
          >
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => closeAndNavigate("/find-jobs")}
                className="rounded-md px-3 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Find Jobs
              </button>
              <button
                type="button"
                onClick={() => closeAndNavigate(employerPath)}
                className="rounded-md px-3 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                For Employers
              </button>

              <div className="mt-2 grid gap-2 border-t border-slate-200 pt-4">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        closeAndNavigate(
                          user?.role === "employer" ? "/employer-dashboard" : "/find-jobs"
                        )
                      }
                      className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white"
                    >
                      Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => closeAndNavigate("/signup")}
                      className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white"
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAndNavigate("/login")}
                      className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;
