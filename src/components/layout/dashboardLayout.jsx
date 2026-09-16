import { useState, useEffect, useRef } from "react";
import {
  Briefcase,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ADMIN_NAVIGATION_MENU, NAVIGATION_MENU } from "../../utils/data";
import ProfileDropdown from "./ProfileDropdown";
import ThemeToggle from "./ThemeToggle";

const NavigationItem = ({ item, isActive, onClick, isCollapsed }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item.id)}
      className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group ${
        isActive
          ? "bg-white text-secondary shadow-sm shadow-black/5"
          : "text-gray-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon
        className={`h-5 w-5 flex-shrink-0 transition-colors duration-200 ${
          isActive ? "text-primary" : "text-gray-400 group-hover:text-white"
        }`}
      />

      {!isCollapsed && (
        <span className="ml-3 truncate">{item.name}</span>
      )}
    </button>
  );
};

const DashboardLayout = ({ children, activeMenu }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navigationMenu = user?.role === "admin" ? ADMIN_NAVIGATION_MENU : NAVIGATION_MENU;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState(
    activeMenu || (user?.role === "admin" ? "admin-email-templates" : "employer-dashboard")
  );
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive resize behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024; // 1024px for smoother tablet/desktop split
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close profile dropdown when clicking outside
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigation = (itemId) => {
    setActiveNavItem(itemId);
    navigate(`/${itemId}`);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const firstName = user?.name?.split(" ")[0] ?? "Employer";

  return (
    <div className={`h-screen w-screen bg-secondary flex overflow-hidden font-display ${isMobile ? "p-0" : "p-3"}`}>
      {/* Mobile Drawer Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/*  Sidebar   */}
      <aside
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              } w-64 bg-secondary p-5`
            : "w-64 h-full flex flex-col shrink-0 bg-transparent p-5"
        } flex flex-col justify-between`}
      >
        {/* Top Branding Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="h-9 w-9 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/20 transition-transform group-hover:scale-105 active:scale-100">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                SPG Portal
              </span>
            </Link>

            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navigationMenu.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={activeNavItem === item.id}
                onClick={handleNavigation}
                isCollapsed={false}
              />
            ))}
          </nav>
        </div>

        {/* Bottom Profile section matching image layout */}
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 text-left transition-all duration-200 group"
            title="Click to logout"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                className="h-9 w-9 rounded-full object-cover shrink-0"
                alt="Avatar"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name || "Employer"}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user?.role || "employer"}</p>
            </div>
            <LogOut className="h-4 w-4 text-gray-500 group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </aside>

      {/*  Main Inset Card Container   */}
      <div
        className={`flex-1 bg-[#f8faf9] dark:bg-gray-950 flex flex-col overflow-hidden ${
          isMobile ? "rounded-none h-full" : "rounded-[24px] border border-white/5 h-[calc(100vh-24px)]"
        }`}
      >
        {/* Inner Top Navbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-150 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div>
              <h2 className="text-lg font-bold text-secondary dark:text-gray-100 tracking-tight">
                {activeNavItem === "employer-dashboard" ? "Hiring Dashboard" : navigationMenu.find(m => m.id === activeNavItem)?.name || "Dashboard"}
              </h2>
            </div>
          </div>

          {/* Profile Dropdown */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative" ref={dropdownRef}>
              <ProfileDropdown
                isOpen={profileDropdownOpen}
                onToggle={() => setProfileDropdownOpen(!profileDropdownOpen)}
                avatar={user?.avatar || ""}
                companyName={user?.name || ""}
                email={user?.email || ""}
                onLogout={logout}
              />
            </div>
          </div>
        </header>

        {/* Nested Page Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-slate-50/50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
