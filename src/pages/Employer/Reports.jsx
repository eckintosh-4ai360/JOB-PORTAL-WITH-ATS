import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users, Star, Workflow, Briefcase, ClipboardCheck, FileText, FileSpreadsheet, FileDown, Loader2,
  AlertCircle, Info, X,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { REPORT_FORMATS, cleanParams, downloadReport } from "../../utils/reportDownload";

/**
 * Reports: pick one, filter it, check the preview, and download it as a PDF,
 * an Excel workbook or a CSV file. Every file is built on the server from the
 * same data as the preview.
 */

const REPORT_ICONS = {
  applicants: Users,
  shortlist: Star,
  pipeline: Workflow,
  jobs: Briefcase,
  assessments: ClipboardCheck,
};
const FORMAT_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileDown };

// A PDF lists at most this many rows (utils/reportWriters on the API).
const PDF_MAX_ROWS = 1000;

const EMPTY_FILTERS = { jobId: "", from: "", to: "", status: "", shortlisted: false };

const inputClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";

const formatCell = (column, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "date") return moment(value).format("D MMM YYYY");
  if (column.type === "datetime") return moment(value).format("D MMM YYYY, HH:mm");
  if (column.type === "percent") return `${value}%`;
  if (column.type === "number") return Number(value).toLocaleString();
  return String(value);
};

const Reports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("type") || "applicants";

  const [reports, setReports] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      axiosInstance.get(API_PATHS.REPORTS.LIST),
      axiosInstance.get(API_PATHS.JOBS.GET_JOBS_EMPLOYER),
      axiosInstance.get(API_PATHS.APPLICATIONS.GET_PIPELINE),
    ]).then(([reportsResult, jobsResult, pipelineResult]) => {
      if (cancelled) return;
      if (reportsResult.status === "fulfilled") setReports(reportsResult.value.data?.reports || []);
      if (jobsResult.status === "fulfilled") setJobs(Array.isArray(jobsResult.value.data) ? jobsResult.value.data : []);
      if (pipelineResult.status === "fulfilled") setPipeline(pipelineResult.value.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = reports.find((entry) => entry.type === type);
  const supports = (key) => Boolean(report?.filters?.includes(key));
  const reportReady = Boolean(report);

  // Only the filters this report reads are sent — and so named in its file.
  const params = cleanParams({
    jobId: supports("jobId") ? filters.jobId : "",
    from: supports("from") ? filters.from : "",
    to: supports("to") ? filters.to : "",
    status: supports("status") ? filters.status : "",
    shortlisted: supports("shortlisted") && filters.shortlisted ? "true" : "",
  });
  const paramsKey = JSON.stringify(params);

  // The preview follows the report and its filters, after a short pause so
  // typing a date does not build a report per keystroke.
  useEffect(() => {
    if (!reportReady) return undefined;
    const timer = setTimeout(() => {
      const requestId = ++requestRef.current;
      setLoading(true);
      axiosInstance
        .get(API_PATHS.REPORTS.GET(type), { params: { ...JSON.parse(paramsKey), format: "json" } })
        .then((res) => {
          if (requestId !== requestRef.current) return;
          setPreview(res.data);
          setError("");
        })
        .catch((err) => {
          if (requestId !== requestRef.current) return;
          setPreview(null);
          setError(err.response?.data?.message || "Could not build this report.");
        })
        .finally(() => {
          if (requestId === requestRef.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [reportReady, type, paramsKey]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const hasFilters = Object.keys(params).length > 0;

  const download = async (format) => {
    setDownloading(format);
    try {
      const filename = await downloadReport(type, format, params);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
    }
  };

  const stages = pipeline ? [...pipeline.stages, pipeline.rejectedStage] : [];
  const total = preview?.total ?? 0;
  const shownRows = preview?.rows || [];

  return (
    <DashboardLayout activeMenu="reports">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Choose a report, filter it and check the preview, then download it as a PDF, Excel workbook or CSV file.
          </p>
        </div>

        {/* Report types */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(reports.length ? reports : Object.keys(REPORT_ICONS).map((key) => ({ type: key, title: "…", description: "" }))).map((entry) => {
            const Icon = REPORT_ICONS[entry.type] || FileText;
            const isActive = entry.type === type;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => setSearchParams({ type: entry.type })}
                aria-pressed={isActive}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/10"
                    : "border-gray-100 bg-white hover:border-indigo-200 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/30"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isActive ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{entry.title}</span>
                <span className="text-xs leading-snug text-gray-500 dark:text-gray-400">{entry.description}</span>
              </button>
            );
          })}
        </div>

        {/* Filters and downloads */}
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-3">
            {supports("jobId") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-400">Job</span>
                <select value={filters.jobId} onChange={(event) => setFilter("jobId", event.target.value)} className={`${inputClass} max-w-64`}>
                  <option value="">All jobs</option>
                  {jobs.map((job) => (
                    <option key={job._id} value={job._id}>
                      {job.title}
                      {job.isClosed ? " (closed)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {supports("from") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-400">{type === "assessments" ? "Sent from" : "Applied from"}</span>
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(event) => setFilter("from", event.target.value)}
                  className={inputClass}
                />
              </label>
            )}
            {supports("to") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-400">to</span>
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(event) => setFilter("to", event.target.value)}
                  className={inputClass}
                />
              </label>
            )}
            {supports("status") && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-400">Stage</span>
                <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)} className={inputClass}>
                  <option value="">All stages</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>
            )}
            {supports("shortlisted") && (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.shortlisted}
                  onChange={(event) => setFilter("shortlisted", event.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                On my shortlist only
              </label>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1 pb-2.5 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {REPORT_FORMATS.map((format) => {
              const Icon = FORMAT_ICONS[format.id] || FileDown;
              const busy = downloading === format.id;
              return (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => download(format.id)}
                  disabled={Boolean(downloading) || !preview || loading}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    format.id === "pdf"
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {busy ? "Preparing…" : format.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {error ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-100 bg-white py-16 text-center dark:border-rose-500/20 dark:bg-gray-900">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{error}</p>
          </div>
        ) : !preview ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-20 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
            <Loader2 className="h-5 w-5 animate-spin" /> Building the preview…
          </div>
        ) : (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{preview.title} report</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {[preview.company, preview.subtitle].filter(Boolean).join(" · ")}
              </p>
            </div>

            {preview.summary?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {preview.summary.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {shownRows.length === 0 ? (
                <p className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nothing to report{hasFilters ? " with these filters" : " yet"}.
                </p>
              ) : (
                <div className="max-h-[32rem] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wider text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                      <tr>
                        {preview.columns.map((column) => (
                          <th
                            key={column.key}
                            scope="col"
                            className={`whitespace-nowrap px-4 py-3 ${column.type === "number" || column.type === "percent" ? "text-right" : ""}`}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {shownRows.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-gray-800/40">
                          {preview.columns.map((column) => (
                            <td
                              key={column.key}
                              className={`max-w-xs truncate px-4 py-2.5 text-gray-700 dark:text-gray-300 ${
                                column.type === "number" || column.type === "percent" ? "text-right tabular-nums" : ""
                              }`}
                              title={typeof row[column.key] === "string" ? row[column.key] : undefined}
                            >
                              {formatCell(column, row[column.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {shownRows.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {total > shownRows.length
                  ? `Showing the first ${shownRows.length} of ${total.toLocaleString()} rows. Downloads include all of them`
                  : `${total.toLocaleString()} row${total === 1 ? "" : "s"}`}
                {total > PDF_MAX_ROWS ? ` — a PDF lists the first ${PDF_MAX_ROWS.toLocaleString()}; use Excel or CSV for the rest.` : "."}
                {" "}PDFs leave out the widest columns to fit the page; Excel and CSV keep every column.
              </p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
