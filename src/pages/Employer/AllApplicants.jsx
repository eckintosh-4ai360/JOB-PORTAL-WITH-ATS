import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, X, Loader2, ChevronLeft, ChevronRight, Star, AlertCircle, Inbox, ArrowRight, RefreshCw,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import ShortlistToggle from "../../components/employer/ShortlistToggle";
import ExportMenu from "../../components/employer/ExportMenu";
import {
  StageBadge, FitPill, AssessmentResult, ApplicantAvatar, GuestBadge,
} from "../../components/employer/ApplicantBadges";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { cleanParams } from "../../utils/reportDownload";

/**
 * Every applicant to every one of the employer's jobs, in one list: filter by
 * job, stage, account and date, sort by AI fit, shortlist, and open anyone in
 * the full applicant view for their job.
 */

const PAGE_SIZE = 25;

const EMPTY_FILTERS = { jobId: "", status: "", source: "", shortlisted: false, from: "", to: "" };

const selectClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

/** "2 already on the shortlist, 1 settled as Hired" from the API's skipped list. */
const describeSkipped = (skipped = []) => {
  const counts = new Map();
  for (const entry of skipped) counts.set(entry.reason, (counts.get(entry.reason) || 0) + 1);
  return [...counts.entries()].map(([reason, count]) => `${count} — ${reason.toLowerCase()}`).join("; ");
};

const AllApplicants = () => {
  const navigate = useNavigate();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ applications: [], total: 0, pages: 1, stageCounts: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [pipeline, setPipeline] = useState(null);

  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const requestRef = useRef(0);

  // Search as the employer types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === q) return;
      setQ(next);
      setPage(1);
      setSelected(new Set());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, q]);

  const listParams = cleanParams({
    ...filters,
    shortlisted: filters.shortlisted ? "true" : "",
    q,
  });

  const fetchApplications = useCallback(() => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    axiosInstance
      .get(API_PATHS.APPLICATIONS.GET_EMPLOYER_APPLICATIONS, {
        params: cleanParams({
          ...filters,
          shortlisted: filters.shortlisted ? "true" : "",
          q,
          sort,
          page,
          limit: PAGE_SIZE,
        }),
      })
      .then((res) => {
        if (requestId !== requestRef.current) return;
        setData({
          applications: res.data?.applications || [],
          total: res.data?.total || 0,
          pages: Math.max(res.data?.pages || 1, 1),
          stageCounts: res.data?.stageCounts || {},
        });
        setLoadError("");
      })
      .catch((err) => {
        if (requestId !== requestRef.current) return;
        setLoadError(err.response?.data?.message || "Could not load your applicants.");
      })
      .finally(() => {
        if (requestId === requestRef.current) setIsLoading(false);
      });
  }, [filters, q, sort, page]);

  useEffect(() => {
    const timer = setTimeout(fetchApplications, 0);
    return () => clearTimeout(timer);
  }, [fetchApplications]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      axiosInstance.get(API_PATHS.JOBS.GET_JOBS_EMPLOYER),
      axiosInstance.get(API_PATHS.APPLICATIONS.GET_PIPELINE),
    ]).then(([jobsResult, pipelineResult]) => {
      if (cancelled) return;
      if (jobsResult.status === "fulfilled") setJobs(Array.isArray(jobsResult.value.data) ? jobsResult.value.data : []);
      if (pipelineResult.status === "fulfilled") setPipeline(pipelineResult.value.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allStages = pipeline ? [...pipeline.stages, pipeline.rejectedStage] : [];
  const stageById = (id) => allStages.find((stage) => stage.id === id);
  const countAll = Object.values(data.stageCounts).reduce((sum, n) => sum + n, 0);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelected(new Set());
  };

  const hasFilters =
    q || Object.entries(filters).some(([key, value]) => value !== EMPTY_FILTERS[key]);

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setQ("");
    setPage(1);
    setSelected(new Set());
  };

  const rows = data.applications;
  const pageIds = rows.map((row) => row._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleOne = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const bulkShortlist = async (add) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await axiosInstance.post(add ? API_PATHS.SHORTLISTS.ADD : API_PATHS.SHORTLISTS.REMOVE, {
        applicationIds: ids,
      });
      toast.success(res.data?.message || "Shortlist updated.");
      if (add && res.data?.skipped?.length) {
        toast(`Not added: ${describeSkipped(res.data.skipped)}`, { icon: "ℹ️", duration: 6000 });
      }
      setSelected(new Set());
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the shortlist.");
    } finally {
      setBulkBusy(false);
    }
  };

  const setRowShortlisted = (id, on) => {
    if (filters.shortlisted && !on) {
      fetchApplications();
      return;
    }
    const shortlistedAt = on ? new Date().toISOString() : null;
    setData((current) => ({
      ...current,
      applications: current.applications.map((row) => (row._id === id ? { ...row, shortlistedAt } : row)),
    }));
  };

  const openApplicant = (row) =>
    navigate(`/applicants?jobId=${row.jobId}&application=${row._id}&from=applicants`);

  const firstShown = data.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(page * PAGE_SIZE, data.total);

  return (
    <DashboardLayout activeMenu="applicants">
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Applicants</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Everyone who has applied to your jobs. Open anyone to review them in full.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchApplications}
              title="Refresh"
              aria-label="Refresh"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <ExportMenu type="applicants" params={listParams} disabled={!data.total} />
          </div>
        </div>

        {/* Stage pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "", name: "All", count: countAll }, ...allStages.map((stage) => ({ ...stage, count: data.stageCounts[stage.id] || 0 }))].map(
            (entry) => {
              const isActive = filters.status === entry.id;
              return (
                <button
                  key={entry.id || "all"}
                  type="button"
                  onClick={() => updateFilter("status", isActive && entry.id ? "" : entry.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                      : "border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                  }`}
                >
                  {entry.name}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {entry.count}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.jobId}
                onChange={(event) => updateFilter("jobId", event.target.value)}
                className={`${selectClass} max-w-64`}
                aria-label="Job"
              >
                <option value="">All jobs</option>
                {jobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.title}
                    {job.isClosed ? " (closed)" : ""}
                  </option>
                ))}
              </select>
              <select
                value={filters.source}
                onChange={(event) => updateFilter("source", event.target.value)}
                className={selectClass}
                aria-label="Account"
              >
                <option value="">Everyone</option>
                <option value="registered">Registered</option>
                <option value="guest">Guests</option>
              </select>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className={selectClass}
                aria-label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="fit">Best AI fit</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span className="text-xs font-semibold text-gray-400">Applied</span>
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => updateFilter("from", event.target.value)}
                className={selectClass}
                aria-label="Applied from"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => updateFilter("to", event.target.value)}
                className={selectClass}
                aria-label="Applied to"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={filters.shortlisted}
                onChange={(event) => updateFilter("shortlisted", event.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <Star className="h-3.5 w-3.5 text-amber-500" />
              On my shortlist
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => bulkShortlist(true)}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Add to shortlist
            </button>
            <button
              type="button"
              onClick={() => bulkShortlist(false)}
              disabled={bulkBusy}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-transparent dark:text-indigo-300"
            >
              Remove from shortlist
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loadError ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-rose-400" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{loadError}</p>
              <button
                type="button"
                onClick={fetchApplications}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Try again
              </button>
            </div>
          ) : isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-24">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-400">Loading applicants…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                {hasFilters ? <Search className="h-8 w-8 text-indigo-400" /> : <Inbox className="h-8 w-8 text-indigo-400" />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {hasFilters ? "No applicants match these filters" : "No applications yet"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                {hasFilters
                  ? "Try a different search, job or date range."
                  : "When people apply to your jobs, they appear here — across every job in one list."}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto transition-opacity ${isLoading ? "opacity-60" : ""}`}>
                <table className="w-full min-w-220 text-left text-sm">
                  <thead className="border-b border-gray-100 bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-500">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={togglePage}
                          aria-label="Select every applicant on this page"
                          className="h-4 w-4 accent-indigo-600"
                        />
                      </th>
                      <th scope="col" className="px-3 py-3">Applicant</th>
                      <th scope="col" className="px-3 py-3">Job</th>
                      <th scope="col" className="px-3 py-3">Stage</th>
                      <th scope="col" className="px-3 py-3">Applied</th>
                      <th scope="col" className="px-3 py-3">AI fit</th>
                      <th scope="col" className="px-3 py-3">Assessment</th>
                      <th scope="col" className="px-3 py-3 text-center">Shortlist</th>
                      <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {rows.map((row) => {
                      const stage = stageById(row.status);
                      const settled = stage?.type === "rejected" || stage?.type === "hired";
                      return (
                        <tr
                          key={row._id}
                          className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-gray-800/40 ${
                            selected.has(row._id) ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(row._id)}
                              onChange={() => toggleOne(row._id)}
                              aria-label={`Select ${row.applicantName || "applicant"}`}
                              className="h-4 w-4 accent-indigo-600"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => openApplicant(row)}
                              className="group flex items-center gap-3 text-left"
                            >
                              <ApplicantAvatar name={row.applicantName || "Applicant"} seed={row.applicantEmail || row._id} size="sm" />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
                                    {row.applicantName || "Applicant"}
                                  </span>
                                  {row.isGuest && <GuestBadge />}
                                </span>
                                <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{row.applicantEmail}</span>
                              </span>
                            </button>
                          </td>
                          <td className="max-w-56 px-3 py-3">
                            <span className="block truncate text-gray-700 dark:text-gray-300" title={row.job?.title}>
                              {row.job?.title || "—"}
                            </span>
                            {row.job?.isClosed && <span className="text-[11px] text-gray-400">Closed</span>}
                          </td>
                          <td className="px-3 py-3">
                            <StageBadge stage={stage || { id: row.status, name: row.status }} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">
                            <span title={moment(row.createdAt).format("D MMM YYYY, h:mm A")}>{moment(row.createdAt).fromNow()}</span>
                          </td>
                          <td className="px-3 py-3">
                            <FitPill score={row.aiScore?.matchScore} verdict={row.aiScore?.verdict} />
                          </td>
                          <td className="px-3 py-3">
                            <AssessmentResult assessment={row.assessment} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ShortlistToggle
                              compact
                              applicationId={row._id}
                              shortlisted={Boolean(row.shortlistedAt)}
                              disabled={settled && !row.shortlistedAt}
                              disabledReason={`Settled as ${stage?.name} — past shortlisting`}
                              onChange={(on) => setRowShortlisted(row._id, on)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openApplicant(row)}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                            >
                              Open
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paging */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 sm:flex-row dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{firstShown}</span>–
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{lastShown}</span> of{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{data.total}</span> applicant
                  {data.total === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={page <= 1 || isLoading}
                    aria-label="Previous page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Page {page} of {data.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(current + 1, data.pages))}
                    disabled={page >= data.pages || isLoading}
                    aria-label="Next page"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Users className="h-3.5 w-3.5" />
          Your shortlist is private — applicants are only told when you move them to a stage.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default AllApplicants;
