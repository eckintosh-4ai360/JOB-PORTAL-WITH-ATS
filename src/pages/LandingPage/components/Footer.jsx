import { BriefcaseBusiness } from "lucide-react";
import { useNavigate } from "react-router-dom";

const linkGroups = [
  {
    title: "Platform",
    links: [
      { label: "Find Jobs", path: "/find-jobs" },
      { label: "For Employers", path: "/login" },
      { label: "Create Account", path: "/signup" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", path: "/login" },
      { label: "Candidate Dashboard", path: "/find-jobs" },
      { label: "Employer Dashboard", path: "/employer-dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy Policy", path: "#privacy" },
      { label: "Terms of Service", path: "#terms" },
    ],
  },
];

const Footer = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const handleNavigate = (path) => {
    if (!path.startsWith("#")) {
      navigate(path);
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white py-14 md:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-3 text-left"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <span className="text-2xl font-bold tracking-normal text-secondary">
                SPG JobPortal
              </span>
            </button>

            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-600">
              A professional job portal for candidates looking for focused
              opportunities and employers managing active hiring work.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {linkGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-bold text-secondary">{group.title}</h3>
                <div className="mt-4 grid gap-3">
                  {group.links.map((link) =>
                    link.path.startsWith("#") ? (
                      <a
                        key={link.label}
                        href={link.path}
                        className="text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <button
                        key={link.label}
                        type="button"
                        onClick={() => handleNavigate(link.path)}
                        className="text-left text-sm font-medium text-slate-600 transition-colors hover:text-primary"
                      >
                        {link.label}
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright {year} SPG JobPortal. All rights reserved.</p>
          <p>Spagad Technologies Limited.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
