import { useState, useEffect, useRef } from "react";
import {
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ADMIN_NAVIGATION_MENU, NAVIGATION_MENU } from "../../utils/data";
import ProfileDropdown from "./ProfileDropdown";
import ThemeToggle from "./ThemeToggle";

const NavigationItem = ({ item, isActive, onClick, isCollapsed, isAdmin }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item.id)}
      aria-label={isCollapsed ? item.name : undefined}
      title={isCollapsed ? item.name : undefined}
      className={`w-full flex items-center text-xs rounded-xl transition-all duration-200 group ${
        isActive ? "font-bold" : "font-normal"
      } ${
        isCollapsed ? "justify-center px-3 py-1.5" : "px-4 py-2"
      } ${
        isAdmin
          ? isActive
            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_8px_18px_rgba(79,70,229,0.22)]"
            : "text-slate-600 hover:bg-violet-50 hover:text-violet-800 dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
          : isActive
            ? "bg-white text-secondary shadow-sm shadow-black/5 dark:bg-white/10 dark:text-white"
            : "text-slate-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon
        className={`${isCollapsed ? "h-5 w-5" : "h-4 w-4"} shrink-0 transition-colors duration-200 ${
          isAdmin
            ? isActive
              ? "text-white"
              : "text-slate-400 group-hover:text-violet-700 dark:group-hover:text-violet-300"
            : isActive
              ? "text-primary dark:text-indigo-300"
              : "text-slate-200 group-hover:text-white"
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
  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const navigationMenu = isAdmin ? ADMIN_NAVIGATION_MENU : NAVIGATION_MENU;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem("dashboard-sidebar-collapsed") === "true";
  });
  const [activeNavItem, setActiveNavItem] = useState(
    activeMenu || (user?.role === "admin" ? "admin-overview" : "employer-dashboard")
  );
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const adminThemeApplied = useRef(false);

  // The admin workspace always opens in its calm, high-contrast light theme.
  // Administrators can still switch themes explicitly with the header control.
  useEffect(() => {
    if (isAdmin && !adminThemeApplied.current) {
      setTheme("light");
      adminThemeApplied.current = true;
    }
  }, [isAdmin, setTheme]);

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

  const firstName = user?.name?.split(" ")[0] ?? (isAdmin ? "Admin" : "Employer");
  const isCollapsed = !isMobile && isSidebarCollapsed;
  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("dashboard-sidebar-collapsed", String(next));
      return next;
    });
  };
  const sidebarClass = isAdmin
    ? isMobile
      ? `fixed inset-y-0 left-0 z-50 w-[280px] transform border-r border-violet-100 bg-white p-4 shadow-[16px_0_40px_rgba(76,55,143,0.14)] dark:border-slate-800 dark:bg-slate-900 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`
      : `h-full shrink-0 rounded-[22px] border border-violet-100/90 shadow-[0_16px_36px_rgba(76,55,143,0.10)] backdrop-blur transition-[width,padding] duration-300 ${
          isCollapsed
            ? "w-20 p-3"
            : "w-64 p-4"
        } bg-[linear-gradient(155deg,rgba(255,255,255,0.98)_0%,rgba(245,243,255,0.96)_52%,rgba(238,242,255,0.94)_100%)] dark:border-slate-800 dark:bg-[linear-gradient(155deg,rgba(15,23,42,0.98)_0%,rgba(30,27,75,0.96)_54%,rgba(30,41,59,0.98)_100%)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.38)]`
    : isMobile
      ? `fixed inset-y-0 left-0 z-50 w-64 transform bg-[linear-gradient(155deg,#0f3a5c_0%,#1e3a8a_42%,#3730a3_100%)] p-5 shadow-[16px_0_42px_rgba(15,23,42,0.32)] transition-transform duration-300 dark:bg-[linear-gradient(155deg,#0f172a_0%,#1e1b4b_54%,#312e81_100%)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`
      : `h-full shrink-0 rounded-[22px] shadow-[0_16px_36px_rgba(15,23,42,0.18)] transition-[width,padding] duration-300 ${
          isCollapsed
            ? "w-20 p-3"
            : "w-64 p-5"
        } bg-[linear-gradient(155deg,#0f3a5c_0%,#1e3a8a_42%,#3730a3_100%)] dark:bg-[linear-gradient(155deg,#0f172a_0%,#1e1b4b_54%,#312e81_100%)]`;

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-display ${isAdmin ? "bg-[radial-gradient(circle_at_top_left,_#ede9fe_0%,_#f8fafc_42%,_#eef2ff_100%)] dark:bg-none dark:bg-slate-950" : "bg-secondary dark:bg-gray-900"} ${isMobile ? "p-0" : "p-3"}`}>
      {/* Mobile Drawer Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/*  Sidebar   */}
      <aside className={`${sidebarClass} relative isolate flex flex-col justify-between overflow-hidden`}>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full blur-3xl ${
            isAdmin ? "bg-violet-300/35 dark:bg-indigo-500/20" : "bg-cyan-300/20"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full blur-3xl ${
            isAdmin ? "bg-indigo-200/35 dark:bg-violet-500/15" : "bg-violet-300/20"
          }`}
        />
        {/* Top Branding Section */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className={`relative flex shrink-0 items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
            <Link to="/" className={`flex min-w-0 items-center group ${isCollapsed ? "justify-center" : "space-x-3"}`} title={isCollapsed ? (isAdmin ? "SPG Admin" : "SPG Portal") : undefined}>
              <div className={`h-9 w-9 flex items-center justify-center shadow-md transition-transform group-hover:scale-105 active:scale-100 ${
                isAdmin
                  ? "rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-violet-200"
                  : "rounded-full bg-primary shadow-primary/20"
              }`}>
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              {!isCollapsed && <div>
                <span className={`block text-xl font-bold tracking-tight ${isAdmin ? "text-slate-900 dark:text-white" : "text-white"}`}>
                  {isAdmin ? "SPG Admin" : "SPG Portal"}
                </span>
                {isAdmin && <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500 dark:text-violet-300">Platform control</span>}
              </div>}
            </Link>

            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${isAdmin ? "bg-violet-50 text-violet-500 hover:bg-violet-100 hover:text-violet-700 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-slate-700" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}
              >
                <X className="h-5 w-5" />
              </button>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={toggleSidebarCollapse}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`rounded-lg p-1.5 transition-colors ${
                  isAdmin
                    ? "bg-violet-100/70 text-violet-600 hover:bg-violet-200 dark:bg-slate-800/80 dark:text-violet-300 dark:hover:bg-slate-700"
                    : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                } ${isCollapsed ? "absolute right-0 top-1/2 -translate-y-1/2" : ""}`}
              >
                {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* Navigation Links — scroll inside the sidebar when the screen is too
              short for every item, rather than pushing the account button off. */}
          {isAdmin && !isCollapsed && <p className="mb-2 mt-6 shrink-0 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Workspace</p>}
          <nav
            className={`-mr-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-2 [scrollbar-width:thin] ${
              isAdmin && !isCollapsed ? "" : "mt-6"
            } ${
              isAdmin
                ? "[scrollbar-color:rgba(124,58,237,0.3)_transparent]"
                : "[scrollbar-color:rgba(255,255,255,0.3)_transparent]"
            }`}
          >
            {navigationMenu.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={activeNavItem === item.id}
                onClick={handleNavigation}
                isCollapsed={isCollapsed}
                isAdmin={isAdmin}
              />
            ))}
          </nav>
        </div>

        {/* Bottom Profile section matching image layout */}
        <div className={`relative z-10 mt-3 shrink-0 border-t pt-3 ${isAdmin ? "border-violet-100 dark:border-slate-800" : "border-white/15"}`}>
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Log out" : "Click to logout"}
            className={`w-full flex rounded-xl p-2 text-left transition-all duration-200 group ${
              isCollapsed ? "justify-center" : "gap-3"
            } ${isAdmin ? "hover:bg-rose-50 dark:hover:bg-rose-500/10" : "hover:bg-white/10"}`}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                className="h-9 w-9 rounded-full object-cover shrink-0"
                alt="Avatar"
              />
            ) : (
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${isAdmin ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "rounded-full bg-primary"}`}>
                {firstName.charAt(0).toUpperCase()}
              </div>
            )}
            {!isCollapsed && <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isAdmin ? "text-slate-800 dark:text-slate-100" : "text-white"}`}>{user?.name || (isAdmin ? "Administrator" : "Employer")}</p>
              <p className={`text-xs truncate capitalize ${isAdmin ? "text-slate-400 dark:text-slate-500" : "text-slate-200"}`}>{isAdmin ? "Administrator" : user?.role || "employer"}</p>
            </div>}
            {!isCollapsed && <LogOut className={`h-4 w-4 transition-colors ${isAdmin ? "text-slate-400 dark:text-slate-500 group-hover:text-rose-500" : "text-slate-200 group-hover:text-rose-200"}`} />}
          </button>
        </div>
      </aside>

      {/*  Main Inset Card Container   */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${
          isAdmin ? "bg-white/80 dark:bg-slate-950" : "bg-[#f8faf9] dark:bg-gray-950"
        } ${
          isMobile ? "rounded-none h-full" : isAdmin ? "h-[calc(100vh-24px)] rounded-[24px] border border-white/80 shadow-[0_18px_42px_rgba(76,55,143,0.10)] dark:border-slate-800 dark:shadow-[0_18px_42px_rgba(0,0,0,0.38)]" : "rounded-[24px] border border-white/5 h-[calc(100vh-24px)]"
        }`}
      >
        {/* Inner Top Navbar */}
        <header className={`h-16 flex items-center justify-between px-8 shrink-0 ${isAdmin ? "border-b border-violet-100 bg-white/90 dark:border-slate-800 dark:bg-slate-900" : "bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"}`}>
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className={`p-2 rounded-lg border transition-colors ${isAdmin ? "border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-violet-300" : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-150 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700"}`}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div>
              <h2 className={`text-lg font-bold tracking-tight ${isAdmin ? "text-slate-900 dark:text-white" : "text-secondary dark:text-gray-100"}`}>
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
        <main className={`flex-1 p-8 overflow-y-auto ${isAdmin ? "bg-[linear-gradient(135deg,_rgba(248,250,252,0.96),_rgba(245,243,255,0.74))] dark:bg-slate-950" : "bg-slate-50/50 dark:bg-gray-950"}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
