import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";
import JobAlertsCard from "../../components/alerts/JobAlertsCard";
import Footer from "../../components/layout/Footer";
import Navbar from "../../components/layout/Navbar";
import {
  candidateStatusDisplay,
  hasUpcomingInterview,
  isActiveApplication,
} from "../../utils/candidateStatus";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

const jobIdOf = (job) => job?._id || job?.id;
const applicationIdOf = (application) => application?._id || application?.id;
const companyNameOf = (job) =>
  job?.company?.companyName || job?.company?.name || "Hiring company";

const salaryText = (job) => {
  if (!job?.salaryMin && !job?.salaryMax) return "Not disclosed";

  const formatter = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  });
  if (job.salaryMin && job.salaryMax) {
    return `${formatter.format(job.salaryMin)} – ${formatter.format(job.salaryMax)}`;
  }
  return formatter.format(job.salaryMin || job.salaryMax);
};

const interviewMoment = (application) => {
  const date = application?.interview?.date;
  if (!date) return null;

  const value = moment(date);
  const [hours, minutes] = String(application.interview.time || "")
    .split(":")
    .map(Number);
  if (Number.isFinite(hours)) value.hours(hours);
  if (Number.isFinite(minutes)) value.minutes(minutes);
  return value.isValid() ? value : null;
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const EmptyPanel = ({ icon, title, description, children }) => (
  <div className="rounded-3xl border border-dashed border-border-default bg-surface-card px-5 py-16 text-center">
    <span className="material-symbols-outlined mb-2 text-[38px] text-text-muted">{icon}</span>
    <h3 className="font-headline-md font-bold text-text-primary">{title}</h3>
    <p className="mx-auto mt-1 max-w-md font-body-md text-text-secondary">{description}</p>
    {children && <div className="mt-5">{children}</div>}
  </div>
);

const SavedJobCard = ({ job, application, isRemoving, onRemove }) => {
  const jobId = jobIdOf(job);
  const companyName = companyNameOf(job);
  const logo = job.companyLogo || job.company?.companyLogo;
  const skills = Array.from(
    new Set([...(job.searchSkills || []), ...(job.tags || [])])
  ).slice(0, 8);
  const deadlinePassed =
    job.deadline && moment(job.deadline).endOf("day").isBefore(moment());
  const unavailable = job.isClosed || deadlinePassed;

  return (
    <article className="group overflow-hidden rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_40px_rgba(89,47,174,0.14)] md:p-space-lg">
      <div className="flex flex-col items-start justify-between gap-space-md md:flex-row">
        <div className="flex min-w-0 flex-1 items-start gap-space-md">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-brand-indigo-light to-secondary-fixed shadow-sm">
            {logo ? (
              <img src={logo} alt={companyName} className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[28px] text-primary">business</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-space-xs">
              <span className="font-label-lg font-bold text-text-primary">{companyName}</span>
              <span className="text-text-muted">•</span>
              <span className="font-body-sm text-text-muted">
                Saved {job.savedAt ? moment(job.savedAt).fromNow() : "recently"}
              </span>
              {unavailable && (
                <span className="rounded-full bg-error-container px-2 py-0.5 text-[11px] font-bold text-error">
                  No longer accepting applications
                </span>
              )}
            </div>

            <Link
              to={`/job/${jobId}`}
              className="block truncate font-headline-md font-bold text-text-primary transition-colors hover:text-primary"
            >
              {job.title || "Untitled position"}
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-text-muted">location_on</span>
                {job.location || "Location not specified"}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-text-muted">schedule</span>
                {job.type || "Job type not specified"}
              </span>
              {job.workModel && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-text-muted">home_work</span>
                  {job.workModel}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onRemove(jobId)}
          disabled={isRemoving}
          type="button"
          title="Remove saved job"
          aria-label={`Remove ${job.title || "job"} from saved jobs`}
          className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl bg-surface-container text-text-secondary transition-colors hover:bg-error-container hover:text-error disabled:cursor-wait disabled:opacity-60 md:self-start"
        >
          <span className={`material-symbols-outlined text-[20px] ${isRemoving ? "animate-pulse" : ""}`}>
            {isRemoving ? "hourglass_top" : "bookmark_remove"}
          </span>
        </button>
      </div>

      {skills.length > 0 && (
        <div className="my-space-md flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-xl border border-primary/10 bg-brand-indigo-light px-2.5 py-1 font-label-md capitalize text-primary"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className={`flex flex-col justify-between gap-space-sm border-t border-border-default pt-space-sm sm:flex-row sm:items-center ${skills.length === 0 ? "mt-space-md" : ""}`}>
        <div>
          <span className="block font-label-caps uppercase tracking-wider text-text-muted">Compensation</span>
          <span className="mt-0.5 block font-headline-sm font-bold text-salary-emerald">
            {salaryText(job)}
          </span>
        </div>

        {application ? (
          <Link
            to="/applications"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-text-secondary transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-[17px]">task_alt</span>
            Application submitted
          </Link>
        ) : unavailable ? (
          <span className="inline-flex items-center justify-center rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-text-muted">
            Applications closed
          </span>
        ) : (
          <Link
            to={`/job/${jobId}`}
            className="inline-flex items-center justify-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-2.5 font-label-lg text-on-primary shadow-sm transition-all hover:bg-brand-indigo-dark"
          >
            View and apply
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        )}
      </div>
    </article>
  );
};

const ApplicationCard = ({ application }) => {
  const job = application.job || {};
  const status = candidateStatusDisplay(application);
  const progress = application.candidateStatus || { step: 1, totalSteps: 5 };
  const interview = interviewMoment(application);

  return (
    <article className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)] md:p-space-lg">
      <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="font-label-md font-bold text-primary">{companyNameOf(job)}</p>
          {jobIdOf(job) ? (
            <Link
              to={`/job/${jobIdOf(job)}`}
              className="mt-1 block truncate font-headline-md font-bold text-text-primary transition-colors hover:text-primary"
            >
              {job.title || "Position"}
            </Link>
          ) : (
            <p className="mt-1 truncate font-headline-md font-bold text-text-primary">
              {job.title || "Position no longer listed"}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-space-md gap-y-1 font-body-sm text-text-muted">
            <span>Applied {moment(application.createdAt).fromNow()}</span>
            {job.location && <span>{job.location}</span>}
            {job.type && <span>{job.type}</span>}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${status.badge}`}>
          <span className="material-symbols-outlined text-[15px]">{status.icon}</span>
          {status.label}
        </span>
      </div>

      <div className="mt-space-md rounded-2xl bg-surface-container-low p-space-sm">
        <div className="flex items-center justify-between gap-3 font-label-md">
          <span className="font-bold text-text-primary">
            {application.candidateStatus?.outcomeLabel || application.candidateStatus?.label || status.label}
          </span>
          <span className="text-text-muted">
            Step {progress.step || 1} of {progress.totalSteps || 5}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, ((progress.step || 1) / (progress.totalSteps || 5)) * 100)}%` }}
          />
        </div>
        {interview && hasUpcomingInterview(application) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span className="material-symbols-outlined text-[16px]">event</span>
            Interview {interview.format("ddd, D MMM YYYY")}
            {application.interview?.time ? ` at ${application.interview.time}` : ""}
          </p>
        )}
      </div>

      <div className="mt-space-md flex justify-end">
        <Link to="/applications" className="inline-flex items-center gap-1.5 font-label-md font-bold text-primary hover:underline">
          Manage application
          <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
};

const SavedJobs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("saved");
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filterSearch, setFilterSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [removingJobIds, setRemovingJobIds] = useState(new Set());

  const fetchPage = useCallback(async () => {
    setIsLoading(true);
    setFetchError("");

    const [savedResult, applicationResult] = await Promise.allSettled([
      axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS),
      axiosInstance.get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS),
    ]);
    const failed = [];

    if (savedResult.status === "fulfilled") {
      const records = Array.isArray(savedResult.value.data) ? savedResult.value.data : [];
      setSavedJobs(
        records
          .filter((record) => record?.job || jobIdOf(record))
          .map((record) => ({
            ...(record.job || record),
            savedAt: record.createdAt || record.savedAt || record.job?.createdAt,
          }))
      );
    } else {
      setSavedJobs([]);
      failed.push("saved jobs");
    }

    if (applicationResult.status === "fulfilled") {
      setApplications(
        Array.isArray(applicationResult.value.data) ? applicationResult.value.data : []
      );
    } else {
      setApplications([]);
      failed.push("applications");
    }

    if (failed.length > 0) {
      setFetchError(`We could not load your ${failed.join(" and ")}.`);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(fetchPage);
    return () => window.cancelAnimationFrame(loadFrame);
  }, [fetchPage]);

  const activeApplications = useMemo(
    () => applications.filter(isActiveApplication),
    [applications]
  );
  const archivedApplications = useMemo(
    () => applications.filter((application) => !isActiveApplication(application)),
    [applications]
  );
  const applicationByJobId = useMemo(
    () => new Map(applications.map((application) => [jobIdOf(application.job), application])),
    [applications]
  );
  const upcomingInterviews = useMemo(
    () => applications
      .filter((application) => {
        const date = interviewMoment(application);
        return hasUpcomingInterview(application) && date?.clone().endOf("day").isSameOrAfter(moment());
      })
      .sort((a, b) => interviewMoment(a).valueOf() - interviewMoment(b).valueOf()),
    [applications]
  );

  const savedThisWeek = useMemo(
    () => savedJobs.filter((job) =>
      job.savedAt && moment(job.savedAt).isSameOrAfter(moment().subtract(7, "days"))
    ).length,
    [savedJobs]
  );
  const progressedApplications = useMemo(
    () => activeApplications.filter((application) =>
      application.candidateStatus?.phase !== "received"
    ).length,
    [activeApplications]
  );
  const positiveOutcomes = useMemo(
    () => archivedApplications.filter((application) =>
      ["offer", "hired"].includes(application.candidateStatus?.outcome)
    ).length,
    [archivedApplications]
  );

  const visibleRecords = useMemo(() => {
    const records = activeTab === "saved"
      ? savedJobs
      : activeTab === "active"
        ? activeApplications
        : activeTab === "archived"
          ? archivedApplications
          : [];
    const query = filterSearch.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) => {
      const job = activeTab === "saved" ? record : record.job || {};
      return [
        job.title,
        companyNameOf(job),
        job.location,
        job.type,
        ...(job.searchSkills || []),
        ...(job.tags || []),
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [activeApplications, activeTab, archivedApplications, filterSearch, savedJobs]);

  const handleRemove = async (jobId) => {
    setRemovingJobIds((current) => new Set(current).add(jobId));
    try {
      await axiosInstance.delete(API_PATHS.JOBS.UNSAVE_JOB(jobId));
      setSavedJobs((current) => current.filter((job) => jobIdOf(job) !== jobId));
      toast.success("Job removed from saved jobs.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove this saved job.");
    } finally {
      setRemovingJobIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ["Title", "Company", "Location", "Job type", "Salary minimum", "Salary maximum", "Saved on"];
    const rows = savedJobs.map((job) => [
      job.title,
      companyNameOf(job),
      job.location,
      job.type,
      job.salaryMin,
      job.salaryMax,
      job.savedAt ? moment(job.savedAt).format("YYYY-MM-DD") : "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "spg-saved-jobs.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Saved jobs exported.");
  };

  const addInterviewToCalendar = (application) => {
    const start = interviewMoment(application);
    if (!start) return;
    const escapeCalendar = (value) => String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replaceAll("\n", "\\n");
    const details = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SPG Talent Network//Interview//EN",
      "BEGIN:VEVENT",
      `UID:${applicationIdOf(application)}@spg-talent`,
      `DTSTAMP:${moment.utc().format("YYYYMMDDTHHmmss[Z]")}`,
      `DTSTART:${start.clone().utc().format("YYYYMMDDTHHmmss[Z]")}`,
      `DTEND:${start.clone().add(1, "hour").utc().format("YYYYMMDDTHHmmss[Z]")}`,
      `SUMMARY:${escapeCalendar(`Interview — ${application.job?.title || "Job application"}`)}`,
      `LOCATION:${escapeCalendar(application.interview?.location)}`,
      `DESCRIPTION:${escapeCalendar(application.interview?.notes)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([details], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "spg-interview.ics";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const nearestInterview = upcomingInterviews[0];
  const nearestInterviewDate = interviewMoment(nearestInterview);
  const tabs = [
    { id: "saved", label: "Saved jobs", count: savedJobs.length, icon: "bookmark" },
    { id: "active", label: "Active applications", count: activeApplications.length, icon: "mark_email_read" },
    { id: "archived", label: "Completed / past", count: archivedApplications.length, icon: "inventory_2" },
    { id: "alerts", label: "Job updates", count: null, icon: "notifications_active" },
  ];
  const stats = [
    {
      label: "Total saved",
      value: savedJobs.length,
      suffix: savedJobs.length === 1 ? "Opportunity" : "Opportunities",
      detail: `${savedThisWeek} saved in the last 7 days`,
      icon: "bookmark",
      card: "border-violet-100 from-violet-50 dark:border-violet-500/20 dark:from-violet-500/10",
      iconStyle: "bg-primary",
    },
    {
      label: "Active applications",
      value: activeApplications.length,
      suffix: "In progress",
      detail: `${progressedApplications} beyond the received stage`,
      icon: "outgoing_mail",
      card: "border-sky-100 from-sky-50 dark:border-sky-500/20 dark:from-sky-500/10",
      iconStyle: "bg-sky-500",
    },
    {
      label: "Interviews",
      value: upcomingInterviews.length,
      suffix: "Upcoming",
      detail: nearestInterviewDate
        ? `Next ${nearestInterviewDate.calendar(null, {
            sameDay: "[today]",
            nextDay: "[tomorrow]",
            nextWeek: "ddd, D MMM",
            sameElse: "D MMM YYYY",
          })}`
        : "No interviews scheduled",
      icon: "event_available",
      card: "border-emerald-100 from-emerald-50 dark:border-emerald-500/20 dark:from-emerald-500/10",
      iconStyle: "bg-emerald-500",
    },
    {
      label: "Completed",
      value: archivedApplications.length,
      suffix: "Outcomes",
      detail: `${positiveOutcomes} offer${positiveOutcomes === 1 ? "" : "s"} or hire${positiveOutcomes === 1 ? "" : "s"}`,
      icon: "task_alt",
      card: "border-amber-100 from-amber-50 dark:border-amber-500/20 dark:from-amber-500/10",
      iconStyle: "bg-amber-500",
    },
  ];

  const emptyCopy = activeTab === "saved"
    ? {
        icon: "bookmark_border",
        title: filterSearch ? "No saved jobs match your search" : "No saved jobs yet",
        description: filterSearch
          ? "Try a different title, company, location, or skill."
          : "Save roles from the job search and they will appear here.",
      }
    : activeTab === "active"
      ? {
          icon: "send",
          title: filterSearch ? "No active applications match your search" : "No active applications",
          description: filterSearch
            ? "Try a different title, company, or location."
            : "Applications that are still moving through the hiring process will appear here.",
        }
      : {
          icon: "inventory_2",
          title: filterSearch ? "No past applications match your search" : "No completed applications",
          description: filterSearch
            ? "Try a different title, company, or location."
            : "Applications with a final outcome will appear here.",
        };

  return (
    <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
      <Navbar />

      <main className="w-full flex-1 pb-space-xl">
        <section className="relative w-full overflow-hidden border-b border-border-default bg-gradient-to-b from-surface-container-low via-surface to-surface pb-space-lg">
          <div className="mx-auto max-w-[1280px] px-margin-mobile pt-space-lg md:px-margin">
            <nav className="mb-space-sm flex items-center gap-space-xs font-label-md text-text-muted">
              <Link to="/find-jobs" className="transition-colors hover:text-primary">Home</Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="font-bold text-primary">Saved jobs</span>
            </nav>

            <div className="mb-space-lg flex flex-col justify-between gap-space-md lg:flex-row lg:items-end">
              <div>
                <div className="mb-space-xs inline-flex items-center gap-space-xs rounded-full bg-brand-indigo-light px-3 py-1 font-label-caps uppercase tracking-wider text-primary shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Career cockpit
                </div>
                <h1 className="font-headline-xl text-headline-xl tracking-tight text-text-primary">
                  Saved jobs &amp; applications
                </h1>
                <p className="mt-1 max-w-2xl font-body-lg text-body-lg text-text-secondary">
                  Keep saved opportunities, application progress, interviews, and job updates in one live view.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-space-xs self-start lg:self-auto">
                <button
                  onClick={handleExportCSV}
                  disabled={savedJobs.length === 0}
                  type="button"
                  className="inline-flex items-center gap-space-xs rounded-xl border border-border-default bg-surface-card px-space-md py-2.5 font-label-lg text-text-secondary shadow-xs transition-all hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Export saved jobs
                </button>
                <button
                  onClick={() => navigate("/resume-analyzer")}
                  type="button"
                  className="inline-flex items-center gap-space-xs rounded-xl bg-primary-container px-space-md py-2.5 font-label-lg text-on-primary shadow-sm transition-all hover:bg-brand-indigo-dark"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  Check resume match
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-space-sm md:grid-cols-4 md:gap-space-md">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-3xl border bg-gradient-to-br via-surface-card to-surface-card p-space-md shadow-[0_10px_24px_rgba(40,34,86,0.08)] ${stat.card}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-caps uppercase text-text-muted">{stat.label}</span>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${stat.iconStyle}`}>
                      <span className="material-symbols-outlined text-[18px]">{stat.icon}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-headline-lg font-bold text-text-primary">{isLoading ? "—" : stat.value}</span>
                    <span className="font-label-md text-text-secondary">{stat.suffix}</span>
                  </div>
                  <p className="mt-1 truncate font-label-md text-[11px] text-text-muted">
                    {isLoading ? "Loading live data…" : stat.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1280px] px-margin-mobile pt-space-lg md:px-margin">
          {fetchError && (
            <div className="mb-space-md flex flex-col items-start justify-between gap-3 rounded-2xl border border-error/20 bg-error-container/30 px-4 py-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 font-body-sm text-error">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {fetchError} The data shown may be incomplete.
              </p>
              <button type="button" onClick={fetchPage} className="font-label-md font-bold text-error hover:underline">
                Try again
              </button>
            </div>
          )}

          <div className="mb-space-lg flex items-center gap-space-xs overflow-x-auto border-b border-border-default no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilterSearch("");
                }}
                type="button"
                className={`inline-flex shrink-0 items-center gap-space-xs border-b-2 px-space-md py-space-sm font-label-lg transition-colors ${
                  activeTab === tab.id
                    ? "border-primary font-bold text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                {tab.label}
                {tab.count !== null && (
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] text-text-secondary">
                    {isLoading ? "—" : tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
            <div className="flex flex-col gap-space-md lg:col-span-8">
              {activeTab !== "alerts" && (
                <div className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_26px_rgba(40,34,86,0.06)]">
                  <label className="relative block">
                    <span className="sr-only">Filter this list</span>
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-text-muted">search</span>
                    <input
                      type="search"
                      value={filterSearch}
                      onChange={(event) => setFilterSearch(event.target.value)}
                      placeholder="Filter by title, company, location, or skill…"
                      className="w-full rounded-xl border border-border-default bg-surface-container-low py-2.5 pl-10 pr-space-md font-body-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </div>
              )}

              {activeTab === "alerts" ? (
                <JobAlertsCard />
              ) : isLoading ? (
                <div className="rounded-3xl border border-border-default bg-surface-card py-20 text-center">
                  <span className="material-symbols-outlined animate-spin text-[30px] text-primary">progress_activity</span>
                  <p className="mt-2 font-body-md text-text-muted">Loading your latest data…</p>
                </div>
              ) : visibleRecords.length === 0 ? (
                <EmptyPanel {...emptyCopy}>
                  {!filterSearch && activeTab !== "archived" && (
                    <Link to="/find-jobs" className="rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary">
                      Browse jobs
                    </Link>
                  )}
                </EmptyPanel>
              ) : activeTab === "saved" ? (
                visibleRecords.map((job) => (
                  <SavedJobCard
                    key={jobIdOf(job)}
                    job={job}
                    application={applicationByJobId.get(jobIdOf(job))}
                    isRemoving={removingJobIds.has(jobIdOf(job))}
                    onRemove={handleRemove}
                  />
                ))
              ) : (
                visibleRecords.map((application) => (
                  <ApplicationCard key={applicationIdOf(application)} application={application} />
                ))
              )}
            </div>

            <aside className="flex flex-col gap-space-md lg:col-span-4">
              <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-brand-indigo-light via-surface-card to-surface-card p-space-md shadow-[0_16px_34px_rgba(89,47,174,0.12)] md:p-space-lg">
                <div className="mb-space-sm flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-label-caps font-bold uppercase tracking-wider text-primary">
                    <span className={`h-2 w-2 rounded-full bg-primary ${nearestInterview ? "animate-pulse" : ""}`} />
                    Upcoming interview
                  </span>
                  {nearestInterviewDate && (
                    <span className="rounded-full bg-brand-indigo-light px-2 py-0.5 font-label-md font-semibold text-primary">
                      {nearestInterviewDate.fromNow()}
                    </span>
                  )}
                </div>

                {isLoading ? (
                  <p className="py-8 text-center font-body-sm text-text-muted">Checking your schedule…</p>
                ) : nearestInterview ? (
                  <>
                    <div className="flex items-start gap-space-sm">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_8px_16px_rgba(89,47,174,0.25)]">
                        <span className="material-symbols-outlined text-[24px]">event</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-headline-sm font-bold text-text-primary">
                          {nearestInterview.job?.title || "Interview"}
                        </h3>
                        <p className="mt-0.5 font-body-sm text-text-secondary">{companyNameOf(nearestInterview.job)}</p>
                      </div>
                    </div>

                    <div className="mt-space-md space-y-2 rounded-2xl border border-white/80 bg-white/70 p-space-sm text-body-sm shadow-sm dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-space-xs font-semibold text-text-primary">
                        <span className="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
                        <span>
                          {nearestInterviewDate.format("dddd, D MMMM YYYY")}
                          {nearestInterview.interview?.time ? ` • ${nearestInterview.interview.time}` : ""}
                        </span>
                      </div>
                      <div className="flex items-start gap-space-xs text-text-secondary">
                        <span className="material-symbols-outlined text-[18px] text-text-muted">location_on</span>
                        <span>{nearestInterview.interview?.location || "Location to be confirmed"}</span>
                      </div>
                      {nearestInterview.interview?.notes && (
                        <div className="flex items-start gap-space-xs text-text-secondary">
                          <span className="material-symbols-outlined text-[18px] text-text-muted">notes</span>
                          <span>{nearestInterview.interview.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-space-md grid grid-cols-2 gap-space-xs">
                      <Link to="/applications" className="rounded-xl bg-brand-indigo-light px-3 py-2.5 text-center font-label-md font-bold text-primary transition-colors hover:bg-brand-indigo-subtle">
                        View details
                      </Link>
                      <button type="button" onClick={() => addInterviewToCalendar(nearestInterview)} className="rounded-xl px-3 py-2.5 text-center font-label-md font-bold text-text-secondary transition-colors hover:bg-surface-container">
                        Add to calendar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-7 text-center">
                    <span className="material-symbols-outlined text-[34px] text-text-muted">event_busy</span>
                    <p className="mt-2 font-label-lg font-bold text-text-primary">Nothing scheduled</p>
                    <p className="mt-1 font-body-sm text-text-muted">Your next interview will appear here when an employer schedules it.</p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)] md:p-space-lg">
                <div className="mb-space-md flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline-sm font-bold text-text-primary">Application pipeline</h3>
                    <span className="font-body-sm text-text-muted">
                      {isLoading ? "Loading…" : `${activeApplications.length} active ${activeApplications.length === 1 ? "application" : "applications"}`}
                    </span>
                  </div>
                  <Link to="/applications" className="font-label-md font-bold text-primary hover:underline">View all</Link>
                </div>

                {isLoading ? (
                  <p className="py-8 text-center font-body-sm text-text-muted">Loading your pipeline…</p>
                ) : activeApplications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-default p-5 text-center">
                    <span className="material-symbols-outlined text-[30px] text-text-muted">inbox</span>
                    <p className="mt-1 font-body-sm text-text-muted">No active applications yet.</p>
                  </div>
                ) : (
                  <div className="space-y-space-sm">
                    {activeApplications.slice(0, 4).map((application) => {
                      const status = candidateStatusDisplay(application);
                      const step = application.candidateStatus?.step || 1;
                      const total = application.candidateStatus?.totalSteps || 5;
                      return (
                        <div key={applicationIdOf(application)} className="rounded-2xl border border-primary/10 bg-brand-indigo-light/35 p-space-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-label-lg font-bold text-text-primary">{application.job?.title || "Position"}</p>
                              <p className="mt-0.5 truncate font-body-sm text-text-secondary">{companyNameOf(application.job)}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-primary">{step} / {total}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                            <span className="flex min-w-0 items-center gap-1 font-semibold text-primary">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                              <span className="truncate">{status.label}</span>
                            </span>
                            <span className="shrink-0 text-text-muted">{moment(application.createdAt).fromNow()}</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (step / total) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SavedJobs;
