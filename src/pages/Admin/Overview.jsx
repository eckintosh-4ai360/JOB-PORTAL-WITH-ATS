import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building2, ChevronRight, LayoutDashboard, Loader2, RefreshCw, ShieldAlert, Users } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { StatTile } from "./components/AdminUI";

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
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <LayoutDashboard className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Platform Control
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The state of the platform, and anything waiting on a decision.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {pending > 0 && (
              <Link
                to="/admin-companies"
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100/70 dark:border-amber-500/25 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
              >
                <Building2 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="flex-1 text-sm font-bold text-amber-800 dark:text-amber-300">
                  {pending} company{pending === 1 ? "" : " profiles"} awaiting review
                  {pending === 1 ? " is" : " are"} blocked from posting until you decide.
                </p>
                <ChevronRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              </Link>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Awaiting review"
                value={pending}
                tone={pending ? "warn" : "default"}
                hint="companies"
              />
              <StatTile label="Approved companies" value={data?.companies?.approved ?? 0} />
              <StatTile label="Live postings" value={data?.jobs?.live ?? 0} />
              <StatTile
                label="Hidden postings"
                value={data?.jobs?.hidden ?? 0}
                tone={data?.jobs?.hidden ? "danger" : "default"}
              />
              <StatTile label="Employers" value={data?.people?.employers ?? 0} />
              <StatTile label="Jobseekers" value={data?.people?.jobseekers ?? 0} />
              <StatTile label="Applications" value={data?.applications ?? 0} hint="all time" />
              <StatTile
                label="Setup unfinished"
                value={data?.companies?.awaitingSetup ?? 0}
                hint="never submitted"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {destinations.map(({ to, icon: Icon, title, description }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{title}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">{description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Overview;
