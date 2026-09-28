import { useCallback, useEffect, useState } from "react";
import { Briefcase, ExternalLink, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { AdminPageHeader, StatTile, StatePill, FilterTabs, SearchBox, EmptyRow, Pagination } from "./components/AdminUI";

/**
 * Every posting on the platform, including the ones the public cannot see.
 *
 * Soft-deleted jobs are reachable from the Deleted tab — keeping the row is
 * pointless if nobody can look at it. Hiding a job is a moderation decision, so
 * it stays in Trust & Safety where the case evidence lives.
 */

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "live", label: "Live" },
  { id: "closed", label: "Closed" },
  { id: "flagged", label: "Flagged" },
  { id: "hidden", label: "Hidden" },
  { id: "deleted", label: "Deleted" },
];

const JobsOversight = () => {
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsRes, overviewRes] = await Promise.all([
        axiosInstance.get(API_PATHS.ADMIN.GET_JOBS, {
          params: { status: status || undefined, search: search || undefined, page },
        }),
        axiosInstance.get(API_PATHS.ADMIN.OVERVIEW).catch(() => null),
      ]);
      setJobs(jobsRes.data.jobs || []);
      setTotal(jobsRes.data.total || 0);
      setPages(jobsRes.data.pages || 1);
      if (overviewRes) setOverview(overviewRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load postings.");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const jobState = (job) => {
    if (job.deletedAt) return { tone: "rejected", label: "deleted" };
    if (job.moderationState === "hidden") return { tone: "rejected", label: "hidden" };
    if (job.moderationState === "flagged") return { tone: "pending", label: "flagged" };
    if (job.isClosed) return { tone: "neutral", label: "closed" };
    return { tone: "approved", label: "live" };
  };

  return (
    <DashboardLayout activeMenu="admin-jobs">
      <div className="mx-auto max-w-7xl space-y-7 pb-12">
        <AdminPageHeader
          icon={Briefcase}
          title="Job Postings"
          description="Every posting on the platform, including listings that are hidden or have been deleted."
          actions={(
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-bold text-text-secondary shadow-sm transition-all hover:border-primary/25 hover:bg-surface-container-low hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        />

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Live postings" value={overview.jobs?.live ?? 0} tone="success" icon={Briefcase} />
            <StatTile
              label="Hidden"
              value={overview.jobs?.hidden ?? 0}
              tone={overview.jobs?.hidden ? "danger" : "default"}
              hint="by moderation"
              icon={Briefcase}
            />
            <StatTile label="Applications" value={overview.applications ?? 0} hint="all time" tone="info" icon={Briefcase} />
            <StatTile label="Matching" value={total} hint="this filter" icon={Briefcase} />
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs
            options={STATUS_TABS}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
          />
          <SearchBox
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Title or location"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyRow icon={Inbox} title="No postings here" description="Nothing matches this filter." />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const state = jobState(job);
              const employer = job.companyProfile?.name || job.company?.companyName || job.company?.name;
              return (
                <div
                  key={job.id}
                  className="flex items-center gap-4 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                        {job.title}
                      </span>
                      <StatePill tone={state.tone} label={state.label} />
                      {job.companyProfile && job.companyProfile.approvalState !== "approved" && (
                        <StatePill state={job.companyProfile.approvalState} />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                      {employer || "Unknown employer"} · {job.location || "no location"} ·{" "}
                      {job._count?.applications ?? 0} applicant
                      {(job._count?.applications ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 sm:block">
                    <p>posted {moment(job.createdAt).fromNow()}</p>
                  </div>

                  {!job.deletedAt && (
                    <Link
                      to={`/job/${job.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${job.title}`}
                      className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-violet-600 dark:hover:bg-gray-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              );
            })}

            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default JobsOversight;
