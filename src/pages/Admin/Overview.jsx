import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building2, ChevronRight, FileCheck2, LayoutDashboard, Loader2, RefreshCw, ShieldAlert, Users } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { AdminPageHeader, StatTile } from "./components/AdminUI";
import JobAlertsPanel from "./components/JobAlertsPanel";

/**
 * Where an administrator lands.
 *
 * Its job is to answer "is anything waiting for me?" in one screen. Companies
 * awaiting review come first because nothing else on the platform blocks a real
 * person from working: an unapproved employer cannot post at all until someone
 * here looks at them.
 */

const Overview = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.OVERVIEW);
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load the overview.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kicked off a tick later so the fetch never writes state inside the
    // effect's synchronous path.
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const pending = data?.companies?.pending ?? 0;

  const destinations = [
    {
      to: "/admin-companies",
      icon: Building2,
      title: "Companies",
      description: "Review registration details and decide who may post.",
    },
    {
      to: "/admin-accounts",
      icon: Users,
      title: "Accounts",
      description: "Everyone signed up, with their role and trust state.",
    },
    {
      to: "/admin-jobs",
      icon: Briefcase,
      title: "Job Postings",
      description: "Every posting, including hidden and deleted ones.",
    },
    {
      to: "/admin-moderation",
      icon: ShieldAlert,
      title: "Trust & Safety",
      description: "Cases raised by automated fraud screening.",
    },
  ];

  return (
    <DashboardLayout activeMenu="admin-overview">
      <div className="mx-auto max-w-7xl space-y-7 pb-12">
        <AdminPageHeader
          icon={LayoutDashboard}
          title="Platform Control"
          description="A clear view of platform health, the people on it, and decisions that need your attention."
          actions={(
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-bold text-text-secondary shadow-sm transition-all hover:border-primary/25 hover:bg-surface-container-low hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/80 dark:bg-[#111b2d] dark:text-slate-200 dark:hover:border-primary/50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        />

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {pending > 0 && (
              <Link
                to="/admin-companies"
                className="group flex items-center gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.28),rgba(69,26,3,0.18))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)] dark:hover:border-amber-400/50 dark:hover:bg-amber-500/15"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <FileCheck2 className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Review queue needs attention</p>
                  <p className="mt-0.5 text-sm text-amber-800/80 dark:text-amber-200/80">
                    {pending} company{pending === 1 ? "" : " profiles"} {pending === 1 ? "is" : "are"} waiting before they can post a job.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5 dark:text-amber-400" />
              </Link>
            )}

            <section>
              <div className="mb-3">
                <p className="text-sm font-extrabold text-text-primary">Platform snapshot</p>
                <p className="mt-0.5 text-xs text-text-muted">Live totals across the marketplace.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Awaiting review" value={pending} tone={pending ? "warn" : "default"} hint="companies" icon={Building2} />
                <StatTile label="Approved companies" value={data?.companies?.approved ?? 0} tone="success" icon={FileCheck2} />
                <StatTile label="Live postings" value={data?.jobs?.live ?? 0} tone="info" icon={Briefcase} />
                <StatTile label="Hidden postings" value={data?.jobs?.hidden ?? 0} tone={data?.jobs?.hidden ? "danger" : "default"} icon={ShieldAlert} />
                <StatTile label="Employers" value={data?.people?.employers ?? 0} icon={Building2} />
                <StatTile label="Jobseekers" value={data?.people?.jobseekers ?? 0} icon={Users} />
                <StatTile label="Applications" value={data?.applications ?? 0} hint="all time" tone="info" icon={FileCheck2} />
                <StatTile label="Setup unfinished" value={data?.companies?.awaitingSetup ?? 0} hint="never submitted" icon={LayoutDashboard} />
              </div>
            </section>

            <JobAlertsPanel />

            <section>
              <div className="mb-3">
                <p className="text-sm font-extrabold text-text-primary">Manage the platform</p>
                <p className="mt-0.5 text-xs text-text-muted">Jump directly to the workspace you need.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {destinations.map(({ to, icon: Icon, title, description }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group flex items-center gap-4 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-slate-700/80 dark:bg-[#111b2d] dark:shadow-[0_10px_24px_rgba(0,0,0,0.2)] dark:hover:border-primary/50 dark:hover:bg-[#142037] dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.34)]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-light text-primary dark:bg-indigo-400/15 dark:text-indigo-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-text-primary">{title}</p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Overview;
