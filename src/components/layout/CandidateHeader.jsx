import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Briefcase, Bookmark, Bell, Menu, X, LogOut, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ProfileDropdown from "./ProfileDropdown";
import ThemeToggle from "./ThemeToggle";

const CandidateHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none transition-transform group-hover:scale-105 active:scale-100">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              SPG <span className="text-indigo-600 dark:text-indigo-400">JobPortal</span>
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              to="/find-jobs"
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                isActive("/find-jobs")
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              }`}
            >
              Find Jobs
            </Link>
            {user && (
              <Link
                to="/saved-jobs"
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                  isActive("/saved-jobs")
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                Saved Jobs
              </Link>
            )}
            {user && (
              <Link
                to="/documents"
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                  isActive("/documents") || isActive("/my-applications")
                    ? "bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                My Applications & Docs
              </Link>
            )}
          </nav>

          {/* Right section actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <>
                {/* Saved Jobs Icon Shortcut — only for logged-in candidates */}
                <Link
                  to="/saved-jobs"
                  title="Saved Jobs"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-500/10 dark:hover:border-indigo-500/40 ${
                    isActive("/saved-jobs") ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/40 dark:text-indigo-400" : "bg-white text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                  }`}
                >
                  <Bookmark className="h-4.5 w-4.5" />
                </Link>

                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <ProfileDropdown
                    isOpen={profileDropdownOpen}
                    onToggle={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    avatar={user?.avatar || ""}
                    companyName={user?.name || "User"}
                    email={user?.email || ""}
                    onLogout={handleLogout}
                  />
                </div>
              </>
            ) : (
              /* Not logged in — show auth buttons */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-all"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-100"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default CandidateHeader;
