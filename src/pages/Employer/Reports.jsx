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



const REPORT_ICONS = {
  applicants: Users,
  shortlist: Star,
  pipeline: Workflow,
  jobs: Briefcase,
  assessments: ClipboardCheck,
};
const FORMAT_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileDown };
const REPORT_EXPORT_FORMATS = REPORT_FORMATS.filter((format) => format.id !== "csv");

const DEFAULT_REPORT_CARD_STYLE = {
  // accent: "bg-primary",
  icon: "bg-brand-indigo-light text-primary dark:bg-indigo-500/15 dark:text-indigo-300",
  inactive: "border-indigo-100/80 bg-gradient-to-br from-indigo-50/80 via-white/90 to-white/70 hover:border-indigo-200/90 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-gray-900/95 dark:to-gray-900/75",
  active: "border-primary/40 bg-gradient-to-br from-brand-indigo-light via-indigo-50/90 to-white/80 ring-1 ring-primary/15 dark:border-indigo-400/50 dark:from-indigo-500/20 dark:via-gray-900/95 dark:to-gray-900/80",
  activeIcon: "bg-primary text-on-primary shadow-[0_10px_20px_rgba(79,70,229,0.28)]",
  glow: "bg-indigo-300/30 dark:bg-indigo-400/15",
};

const REPORT_CARD_STYLES = {
  applicants: {
    // accent: "bg-sky-500",
    icon: "bg-sky-100/80 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    inactive: "border-sky-100/80 bg-gradient-to-br from-sky-50/80 via-white/90 to-white/70 hover:border-sky-200/90 dark:border-sky-500/20 dark:from-sky-500/10 dark:via-gray-900/95 dark:to-gray-900/75",
    active: "border-sky-300/90 bg-gradient-to-br from-sky-100/90 via-sky-50/75 to-white/80 ring-1 ring-sky-300/40 dark:border-sky-400/50 dark:from-sky-500/20 dark:via-gray-900/95 dark:to-gray-900/80",
    activeIcon: "bg-sky-600 text-white shadow-[0_10px_20px_rgba(2,132,199,0.28)]",
    glow: "bg-sky-300/30 dark:bg-sky-400/15",
  },
  shortlist: {
    // accent: "bg-violet-500",
    icon: "bg-violet-100/80 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    inactive: "border-violet-100/80 bg-gradient-to-br from-violet-50/80 via-white/90 to-white/70 hover:border-violet-200/90 dark:border-violet-500/20 dark:from-violet-500/10 dark:via-gray-900/95 dark:to-gray-900/75",
    active: "border-violet-300/90 bg-gradient-to-br from-violet-100/90 via-violet-50/75 to-white/80 ring-1 ring-violet-300/40 dark:border-violet-400/50 dark:from-violet-500/20 dark:via-gray-900/95 dark:to-gray-900/80",
    activeIcon: "bg-violet-600 text-white shadow-[0_10px_20px_rgba(124,58,237,0.28)]",
    glow: "bg-violet-300/30 dark:bg-violet-400/15",
  },
  pipeline: DEFAULT_REPORT_CARD_STYLE,
  jobs: {
    // accent: "bg-emerald-500",
    icon: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    inactive: "border-emerald-100/80 bg-gradient-to-br from-emerald-50/80 via-white/90 to-white/70 hover:border-emerald-200/90 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-gray-900/95 dark:to-gray-900/75",
    active: "border-emerald-300/90 bg-gradient-to-br from-emerald-100/90 via-emerald-50/75 to-white/80 ring-1 ring-emerald-300/40 dark:border-emerald-400/50 dark:from-emerald-500/20 dark:via-gray-900/95 dark:to-gray-900/80",
    activeIcon: "bg-emerald-600 text-white shadow-[0_10px_20px_rgba(5,150,105,0.28)]",
    glow: "bg-emerald-300/30 dark:bg-emerald-400/15",
  },
  assessments: {
    // accent: "bg-amber-500",
    icon: "bg-amber-100/80 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    inactive: "border-amber-100/80 bg-gradient-to-br from-amber-50/80 via-white/90 to-white/70 hover:border-amber-200/90 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-gray-900/95 dark:to-gray-900/75",
    active: "border-amber-300/90 bg-gradient-to-br from-amber-100/90 via-amber-50/75 to-white/80 ring-1 ring-amber-300/40 dark:border-amber-400/50 dark:from-amber-500/20 dark:via-gray-900/95 dark:to-gray-900/80",
    activeIcon: "bg-amber-500 text-white shadow-[0_10px_20px_rgba(217,119,6,0.28)]",
    glow: "bg-amber-300/30 dark:bg-amber-400/15",
  },
};

const SUMMARY_CARD_STYLES = [
  { accent: "bg-primary", icon: "bg-brand-indigo-light text-primary", value: "text-primary", glow: "bg-indigo-300/25", Icon: Users },
  { accent: "bg-sky-500", icon: "bg-sky-100 text-sky-600", value: "text-sky-700", glow: "bg-sky-300/25", Icon: Workflow },
  { accent: "bg-emerald-500", icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700", glow: "bg-emerald-300/25", Icon: ClipboardCheck },
  { accent: "bg-rose-500", icon: "bg-rose-100 text-rose-600", value: "text-rose-700", glow: "bg-rose-300/25", Icon: AlertCircle },
  { accent: "bg-amber-500", icon: "bg-amber-100 text-amber-600", value: "text-amber-700", glow: "bg-amber-300/25", Icon: Star },
];

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

   const params = cleanParams({
    jobId: supports("jobId") ? filters.jobId : "",
    from: supports("from") ? filters.from : "",
    to: supports("to") ? filters.to : "",
    status: supports("status") ? filters.status : "",
    shortlisted: supports("shortlisted") && filters.shortlisted ? "true" : "",
  });
  const paramsKey = JSON.stringify(params);
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
            Choose a report, filter it and check the preview, then download it as a PDF or Excel workbook.
          </p>
        </div>

        {/* Report types */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(reports.length ? reports : Object.keys(REPORT_ICONS).map((key) => ({ type: key, title: "…", description: "" }))).map((entry) => {
            const Icon = REPORT_ICONS[entry.type] || FileText;
            const isActive = entry.type === type;
            const style = REPORT_CARD_STYLES[entry.type] || DEFAULT_REPORT_CARD_STYLE;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => setSearchParams({ type: entry.type })}
                aria-pressed={isActive}
                className={`group relative flex min-h-52 flex-col items-start gap-space-sm overflow-hidden rounded-3xl border p-space-md text-left shadow-[0_10px_24px_rgba(40,34,86,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(40,34,86,0.12)] ${
                  isActive ? style.active : style.inactive
                }`}
              >
                {/* <span className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} /> */}
                {/* <span className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${style.glow}`} /> */}
                <span
                  className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${
                    isActive ? style.activeIcon : style.icon
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="relative font-headline-sm font-bold text-text-primary">{entry.title}</span>
                <span className="relative font-body-sm leading-relaxed text-text-secondary">{entry.description}</span>
                {isActive && (
                  <span className="relative mt-auto rounded-full bg-primary/10 px-2.5 py-1 font-label-md font-bold text-primary dark:bg-indigo-400/15 dark:text-indigo-300">
                    Selected report
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters and downloads */}
        <div className="relative overflow-hidden rounded-3xl border border-border-default bg-gradient-to-br from-surface-card/95 via-surface-card/85 to-brand-indigo-light/45 p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)] backdrop-blur-sm lg:flex lg:flex-row lg:items-end lg:justify-between dark:from-gray-900/95 dark:via-gray-900/85 dark:to-indigo-500/10">
          <span className="pointer-events-none absolute right-8 top-0 h-24 w-24 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-400/10" />
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
            {REPORT_EXPORT_FORMATS.map((format) => {
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
              <div className="grid grid-cols-2 gap-space-md md:grid-cols-5">
                {preview.summary.map((item, index) => {
                  const style = SUMMARY_CARD_STYLES[index % SUMMARY_CARD_STYLES.length];
                  const Icon = style.Icon;

                  return (
                    <div
                      key={item.label}
                      className="group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-surface-card/90 to-surface-container-low/65 p-space-md shadow-[0_10px_24px_rgba(40,34,86,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(40,34,86,0.10)] dark:border-gray-700/70 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-gray-800/80"
                    >
                      {/* <span className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} /> */}
                      <span className={`absolute -right-5 -top-5 h-20 w-20 rounded-full blur-2xl ${style.glow}`} />
                      <div className="relative flex items-start justify-between gap-2 pt-1">
                        <p className="font-label-caps font-bold uppercase tracking-wider text-text-muted">{item.label}</p>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.icon}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className={`relative mt-3 font-headline-lg font-bold tracking-tight ${style.value}`}>{item.value}</p>
                    </div>
                  );
                })}
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
