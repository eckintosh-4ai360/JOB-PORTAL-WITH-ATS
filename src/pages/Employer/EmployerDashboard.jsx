import { useEffect, useState } from "react";
import {
  Briefcase, Users, TrendingUp, Plus, ChevronUp,
  ChevronDown, BarChart3, Bell, ArrowRight, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import DashboardLayout from "../../components/layout/dashboardLayout";
import JobDashboardCard from "../../components/cards/JobDashboardCard";
import ApplicantDashboardCard from "../../components/cards/ApplicantDashboardCard";
import { useAuth } from "../../context/AuthContext";
import { RECENT_JOBS, RECENT_APPLICATIONS } from "../../utils/data";

//  Stat Card 
const StatCard = ({ title, value, icon: Icon, trendValue, trendUp, color = "blue", delay = 0 }) => {
  const gradients = {
    blue:   "from-blue-500 via-blue-600 to-indigo-600",
    green:  "from-emerald-400 via-emerald-500 to-teal-600",
    purple: "from-violet-500 via-purple-500 to-indigo-500",
    orange: "from-orange-400 via-orange-500 to-amber-500",
  };
  const glows = {
    blue:   "shadow-blue-200",
    green:  "shadow-emerald-200",
    purple: "shadow-violet-200",
    orange: "shadow-orange-200",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradients[color]} p-6 text-white  ${glows[color]}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-4 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-white/75">{title}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight">{value}</p>
          {trendValue != null && (
            <div className="mt-3 flex items-center gap-1.5">
              <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${trendUp ? "bg-white/20" : "bg-black/20"}`}>
                {trendUp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {trendValue}%
              </div>
              <span className="text-xs text-white/60">this week</span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

//  Quick Action Button 
const QuickAction = ({ icon: Icon, label, description, onClick, color = "blue" }) => {
  const colors = {
    blue:   "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    green:  "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    purple: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white",
  };

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left transition-all duration-200 hover:border-transparent hover:shadow-md w-full"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{description}</p>
      </div>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
    </button>
  );
};

//  Inline Loader 
const InlineLoader = () => (
  <div className="flex flex-col items-center justify-center py-32 gap-4">
    <div className="relative h-14 w-14">
      <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-100 border-t-blue-600" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Briefcase className="h-6 w-6 text-blue-600" />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Loading your dashboard…</p>
  </div>
);

//  Main Component 
export const EmployerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getDashboardOverview = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(API_PATHS.DASHBOARD.OVERVIEW);
      if (response.status === 200) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.log("error fetching dashboard overview:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getDashboardOverview();
  }, []);

  const counts = dashboardData?.counts ?? {};
  // Fall back to static data so the dashboard is always populated
  const recentJobs = dashboardData?.recentJobs?.length
    ? dashboardData.recentJobs
    : RECENT_JOBS;
  const recentApplications = dashboardData?.recentApplications?.length
    ? dashboardData.recentApplications
    : RECENT_APPLICATIONS;

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const greeting =
    new Date().getHours() < 12 ? "Good morning" :
    new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <DashboardLayout activeMenu="employer-dashboard">
      {isLoading ? (
        <InlineLoader />
      ) : (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">

          {/*  Welcome Banner  */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary via-secondary to-secondary px-8 py-7 shadow-xl">
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-indigo-500/20 blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-1">
                  {/* <Sparkles className="h-4 w-4" /> */}
                  {greeting}, {firstName}!
                </div>
                <h1 className="text-2xl font-bold text-white">
                  Welcome back to your dashboard
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  Here's what's happening with your hiring today.
                </p>
              </div>
              <button
                onClick={() => navigate("/post-job")}
                className="hidden sm:flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-100"
              >
                <Plus className="h-4 w-4" />
                Post a Job
              </button>
            </div>
          </div>

          {/*  Stat Cards  */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Active Jobs"
              value={counts.totalActiveJobs ?? 0}
              icon={Briefcase}
              trendValue={counts.trends?.activeJobs ?? 0}
              trendUp={(counts.trends?.activeJobs ?? 0) >= 0}
              color="blue"
              delay={0}
            />
            <StatCard
              title="Total Applicants"
              value={counts.totalApplicants ?? 0}
              icon={Users}
              trendValue={counts.trends?.applicants ?? 0}
              trendUp={(counts.trends?.applicants ?? 0) >= 0}
              color="green"
              delay={80}
            />
            <StatCard
              title="Hiring Rate"
              value={`${counts.hiringRate ?? 0}%`}
              icon={TrendingUp}
              trendValue={counts.trends?.hiringRate ?? 0}
              trendUp={(counts.trends?.hiringRate ?? 0) >= 0}
              color="purple"
              delay={160}
            />
          </div>

          {/*  Content Grid  */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Left column — Jobs + Applications stacked */}
            <div className="flex flex-col gap-6 lg:col-span-2">

              {/* Recent Job Posts */}
              <JobDashboardCard jobs={recentJobs} />

              {/* Recent Applications */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent Applications</h3>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Latest candidate applications</p>
                  </div>
                  <button
                    onClick={() => navigate("/applicants")}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* List */}
                {recentApplications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                      <Users className="h-7 w-7 text-indigo-400 dark:text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No applications yet</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Applications will appear here once candidates apply</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {recentApplications.slice(0, 5).map((data, index) => (
                      <ApplicantDashboardCard
                        key={index}
                        index={index}
                        applicant={data?.applicant || ""}
                        position={data?.job?.title || ""}
                        time={data?.updatedAt}
                        status={data?.status || "pending"}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column — Quick Actions */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Quick Actions</h3>
                </div>
                <div className="flex flex-col gap-3">
                  <QuickAction
                    icon={Plus}
                    label="Post a New Job"
                    description="Reach thousands of candidates"
                    onClick={() => navigate("/post-job")}
                    color="blue"
                  />
                  <QuickAction
                    icon={Briefcase}
                    label="Manage Jobs"
                    description="Edit, close or review postings"
                    onClick={() => navigate("/manage-jobs")}
                    color="green"
                  />
                  <QuickAction
                    icon={Users}
                    label="View Applicants"
                    description="Review and respond to candidates"
                    onClick={() => navigate("/applicants")}
                    color="purple"
                  />
                  <QuickAction
                    icon={Bell}
                    label="Notifications"
                    description="Stay updated on activity"
                    onClick={() => navigate("/employer-dashboard")}
                    color="orange"
                  />
                </div>
              </div>

              {/* Stats summary card */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border border-indigo-100 dark:border-indigo-500/30 p-5">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">At a Glance</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Active Jobs</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{counts.totalActiveJobs ?? 0}</span>
                  </div>
                  <div className="h-px bg-indigo-100 dark:bg-indigo-500/20" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Total Applicants</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{counts.totalApplicants ?? 0}</span>
                  </div>
                  <div className="h-px bg-indigo-100 dark:bg-indigo-500/20" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Hiring Rate</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{counts.hiringRate ?? 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default EmployerDashboard;

