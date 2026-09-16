import { useEffect, useState, useCallback } from "react";
import {
  Search, MapPin, Briefcase, Bookmark, Calendar,
  DollarSign, ArrowUpDown, ChevronLeft, ChevronRight,
  Loader2, Filter, X, Eye, BookmarkCheck, ArrowRight,
  TrendingUp, Award, Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import CandidateHeader from "../../components/layout/CandidateHeader";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import moment from "moment";

//  Constants 
const JOB_TYPES = [
  { value: "Full-Time", label: "Full-Time" },
  { value: "Part-Time", label: "Part-Time" },
  { value: "Contract", label: "Contract" },
  { value: "Internship", label: "Internship" },
  { value: "Remote", label: "Remote" },
];

const CATEGORIES = [
  { value: "technology", label: "Technology & Software" },
  { value: "design", label: "Design & Creative" },
  { value: "marketing", label: "Marketing & Sales" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "healthcare", label: "Healthcare & Medical" },
  { value: "education", label: "Education & Training" },
  { value: "engineering", label: "Engineering" },
  { value: "operations", label: "Operations & Logistics" },
  { value: "hr", label: "Human Resources" },
  { value: "other", label: "Other" },
];

// Currency badge component
const GhsIcon = () => (
  <span className="text-xs font-extrabold text-gray-400 dark:text-gray-500 mr-0.5">GH₵</span>
);

//   Status Badge
const STATUS_CONFIGS = {
  Applied: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  "Under Review": "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  Interviewing: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  Offered: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-250 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  Rejected: "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
};

// Main Component   
const CandidateDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Search & Filter state
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, salary

  // Data fetching state
  const [jobs, setJobs] = useState([]);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  const [appliedJobsMap, setAppliedJobsMap] = useState({}); // jobId -> status
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const limit = 6;

  //  Fetch Jobs, Saved State, and Applications   
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query string
      let query = `?page=${page}&limit=${limit}`;
      if (keyword.trim()) query += `&keyword=${encodeURIComponent(keyword.trim())}`;
      if (location.trim()) query += `&location=${encodeURIComponent(location.trim())}`;
      if (selectedCategory) query += `&category=${selectedCategory}`;
      
      // If job types selected, query with the first one or client filter
      if (selectedTypes.length > 0) {
        query += `&type=${selectedTypes[0]}`;
      }

      const requests = [
        axiosInstance.get(`${API_PATHS.JOBS.GET_ALL_JOBS}${query}`)
      ];

      if (isAuthenticated) {
        requests.push(
          axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS),
          axiosInstance.get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS)
        );
      }

      const results = await Promise.allSettled(requests);
      const jobsRes = results[0];
      const savedRes = isAuthenticated ? results[1] : null;
      const appRes = isAuthenticated ? results[2] : null;

      // Handle Jobs response
      if (jobsRes.status === "fulfilled") {
        const data = jobsRes.value.data;
        setJobs(data.jobs || []);
        setTotalPages(data.pages || 1);
        setTotalJobs(data.total || 0);
      }

      // Handle Saved Jobs response
      if (savedRes && savedRes.status === "fulfilled") {
        const savedData = Array.isArray(savedRes.value.data) ? savedRes.value.data : [];
        const ids = new Set(savedData.map((item) => item.job?._id || item.job));
        setSavedJobIds(ids);
      }

      // Handle My Applications response
      if (appRes && appRes.status === "fulfilled") {
        const appData = Array.isArray(appRes.value.data) ? appRes.value.data : [];
        const appMap = {};
        appData.forEach((app) => {
          const jId = app.job?._id || app.job;
          if (jId) {
            appMap[jId] = app.status;
          }
        });
        setAppliedJobsMap(appMap);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, [page, keyword, location, selectedCategory, selectedTypes, isAuthenticated]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  //  Toggle Bookmark Saved Job   
  const handleToggleSave = async (jobId) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/find-jobs" } } });
      return;
    }
    if (isActionLoading) return;
    setIsActionLoading(true);
    const isSaved = savedJobIds.has(jobId);

    try {
      if (isSaved) {
        await axiosInstance.delete(API_PATHS.JOBS.UNSAVE_JOB(jobId));
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        toast.success("Job removed from bookmarks");
      } else {
        await axiosInstance.post(API_PATHS.JOBS.SAVE_JOB(jobId));
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jobId);
          return next;
        });
        toast.success("Job bookmarked successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update bookmark status");
    } finally {
      setIsActionLoading(false);
    }
  };

  //  Filter Handlers 
  const handleTypeChange = (typeVal) => {
    setSelectedTypes((prev) =>
      prev.includes(typeVal) ? prev.filter((t) => t !== typeVal) : [typeVal] // API currently filters single type
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setKeyword("");
    setLocation("");
    setSelectedTypes([]);
    setSelectedCategory("");
    setSalaryMin("");
    setPage(1);
    toast.success("Filters cleared");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
  };

  // Client side sorting
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === "salary") return (b.salaryMin || 0) - (a.salaryMin || 0);
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-gray-950 flex flex-col">
      <CandidateHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/*  Hero Search Box  */}
        <div className="rounded-2xl border border-indigo-50 dark:border-indigo-500/20 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Find Your Dream Job</h1>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Discover verified opportunities matching your background and career goals
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Title / Keyword search */}
            <div className="relative md:col-span-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Job title, company, or keywords…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
              />
            </div>

            {/* Location search */}
            <div className="relative md:col-span-4">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Location (e.g. Remote, Accra)…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
              />
            </div>

            {/* Search Button */}
            <button
              type="submit"
              className="md:col-span-3 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white  hover:bg-indigo-700 hover:scale-[1.02] active:scale-100 transition-all"
            >
              Search Jobs
            </button>
          </form>
        </div>

        {/*  Main content grid  */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Left panel: Filters Sidebar  */}
          <aside className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span>Filter Jobs</span>
              </div>
              <button
                onClick={handleClearFilters}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
              >
                Clear All
              </button>
            </div>

            {/* Job Types Filters */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Job Type</h4>
              <div className="space-y-2">
                {JOB_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t.value)}
                      onChange={() => handleTypeChange(t.value)}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 transition">
                      {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Categories Filters */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Category</h4>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:border-indigo-400"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sorting */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Sort By</h4>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:border-indigo-400"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="salary">Highest Salary</option>
              </select>
            </div>
          </aside>

          {/* Right panel: Jobs Listings   */}
          <section className="lg:col-span-3 space-y-5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500">
              <span>Showing {sortedJobs.length} of {totalJobs} jobs available</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Searching for jobs…</p>
              </div>
            ) : sortedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs px-4">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                  <Briefcase className="h-8 w-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No jobs found</h3>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  Try adjusting your search criteria, clearing filters, or checking back later.
                </p>
                <button
                  onClick={handleClearFilters}
                  className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedJobs.map((job) => {
                  const isSaved = savedJobIds.has(job._id);
                  const appliedStatus = appliedJobsMap[job._id];
                  const hasLogo = !!(job.companyLogo || job.company?.companyLogo);
                  const logoUrl = job.companyLogo || job.company?.companyLogo;
                  
                  return (
                    <div
                      key={job._id}
                      className="group flex flex-col justify-between rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm transition hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 relative overflow-hidden"
                    >
                      {/* Top Header Row inside card */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          {/* Company Logo or Icon */}
                          <div className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-gray-800 flex items-center justify-center border border-slate-100 dark:border-gray-700 shrink-0">
                            {hasLogo ? (
                              <img
                                src={logoUrl}
                                alt="Company Logo"
                                className="h-full w-full object-cover rounded-xl"
                              />
                            ) : (
                              <Briefcase className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            )}
                          </div>

                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 transition-colors text-base line-clamp-1">
                              {job.title}
                            </h3>
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                              {job.company?.companyName || job.company?.name || "SPG Member"}
                            </p>
                          </div>
                        </div>

                        {/* Save Bookmark button */}
                        <button
                          disabled={isActionLoading}
                          onClick={() => handleToggleSave(job._id)}
                          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition ${
                            isSaved
                              ? "bg-indigo-50 border-indigo-150 text-indigo-600 hover:bg-indigo-100/50 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:hover:bg-indigo-500/20"
                              : "bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:bg-indigo-50/20 hover:text-indigo-600 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-500 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                          }`}
                        >
                          <Bookmark className={`h-4.5 w-4.5 ${isSaved ? "fill-current" : ""}`} />
                        </button>
                      </div>

                      {/* Job Metadata Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50/50 border border-indigo-100/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400">
                          <Clock className="h-3 w-3" />
                          {job.type}
                        </span>
                      </div>

                      {/* Salary & Action button */}
                      <div className="flex items-center justify-between border-t border-slate-50 dark:border-gray-800 pt-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold">Salary Range</p>
                          <div className="flex items-center mt-0.5">
                            <GhsIcon />
                            <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                              {job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : "Open"}
                            </span>
                            {(job.salaryMin && job.salaryMax) && (
                              <>
                                <span className="mx-1 text-gray-400 dark:text-gray-500 text-xs">-</span>
                                <GhsIcon />
                                <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">
                                  {`${Math.round(job.salaryMax / 1000)}k`}
                                </span>
                              </>
                            )}
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">/mo</span>
                          </div>
                        </div>

                        {/* Status Label or View Action */}
                        <div className="flex items-center gap-2">
                          {appliedStatus ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                              STATUS_CONFIGS[appliedStatus] || STATUS_CONFIGS.Applied
                            }`}>
                              {appliedStatus}
                            </span>
                          ) : (
                            <button
                              onClick={() => navigate(`/job/${job._id}`)}
                              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition"
                            >
                              <span>View Details</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default CandidateDashboard;
