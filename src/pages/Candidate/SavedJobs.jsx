import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

import toast from "react-hot-toast";

const SavedJobs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("saved");
  const [savedJobs, setSavedJobs] = useState([]);
  const [filterSearch, setFilterSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSaved = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS);
        if (Array.isArray(res.data) && res.data.length > 0) {
          const formatted = res.data.map((item) => item.job || item);
          setSavedJobs(formatted);
        } else {
          setSavedJobs([]);
        }
      } catch {
        setSavedJobs([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSaved();
  }, []);

  const handleRemove = async (jobId) => {
    try {
      await axiosInstance.delete(API_PATHS.JOBS.UNSAVE_JOB(jobId));
    } catch {
      // optimistic
    }
    setSavedJobs((prev) => prev.filter((j) => (j._id || j.id) !== jobId));
    toast.success("Job removed from Career Cockpit");
  };

  const handleExportCSV = () => {
    const headers = "Title,Company,Location,SalaryMin,SalaryMax\n";
    const rows = savedJobs
      .map(
        (j) =>
          `"${j.title}","${j.company?.companyName || "Employer"}","${j.location}",${j.salaryMin || 0},${j.salaryMax || 0}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spg_saved_jobs.csv";
    a.click();
    toast.success("Exported saved jobs to CSV!");
  };

  const filteredList = savedJobs.filter(
    (j) =>
      !filterSearch ||
      j.title?.toLowerCase().includes(filterSearch.toLowerCase()) ||
      j.company?.companyName?.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO HEADER & COCKPIT STATS ================= */}
        <section className="relative w-full overflow-hidden bg-gradient-to-b from-surface-container-low via-surface to-surface pb-space-lg border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin pt-space-lg">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-space-xs font-label-md text-text-muted mb-space-sm">
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary font-bold">Saved Jobs</span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md mb-space-lg">
              <div>
                <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-brand-indigo-light text-primary font-label-caps uppercase tracking-wider mb-space-xs shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Career Cockpit • West Africa Executive Hub
                </div>
                <h1 className="font-headline-xl text-headline-xl text-text-primary tracking-tight">
                  Saved Jobs &amp; Applications
                </h1>
                <p className="font-body-lg text-body-lg text-text-secondary max-w-2xl mt-1">
                  Manage your bookmarked opportunities, track active submissions, and get automated salary/status updates.
                </p>
              </div>

              <div className="flex items-center gap-space-xs self-start lg:self-auto flex-wrap">
                <button
                  onClick={handleExportCSV}
                  type="button"
                  className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-xl bg-surface-card hover:bg-surface-container font-label-lg text-text-secondary border border-border-default shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => navigate("/resume-analyzer")}
                  type="button"
                  className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-xl bg-primary-container text-on-primary hover:bg-brand-indigo-dark font-label-lg shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>Batch AI Match</span>
                </button>
              </div>
            </div>

            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm md:gap-space-md">
              <div className="bg-surface-card rounded-2xl p-space-md shadow-xs border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted">Total Saved</span>
                  <div className="w-8 h-8 rounded-xl bg-brand-indigo-light flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">bookmark</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-headline-lg font-bold text-text-primary">
                    {savedJobs.length}
                  </span>
                  <span className="font-label-md text-text-secondary">Opportunities</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-salary-emerald font-label-md text-[11px]">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  <span>2 added this week</span>
                </div>
              </div>

              <div className="bg-surface-card rounded-2xl p-space-md shadow-xs border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted">Active Applications</span>
                  <div className="w-8 h-8 rounded-xl bg-secondary-fixed flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[18px]">outgoing_mail</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-headline-lg font-bold text-text-primary">3</span>
                  <span className="font-label-md text-text-secondary">In Review</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-secondary font-label-md text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                  <span>1 action pending</span>
                </div>
              </div>

              <div className="bg-surface-card rounded-2xl p-space-md shadow-xs border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted">Interviews</span>
                  <div className="w-8 h-8 rounded-xl bg-salary-surface flex items-center justify-center text-salary-emerald">
                    <span className="material-symbols-outlined text-[18px]">event_available</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-headline-lg font-bold text-text-primary">1</span>
                  <span className="font-label-md text-text-secondary">Scheduled</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-salary-emerald font-label-md text-[11px]">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  <span>Thu, Oct 24 • Hubtel</span>
                </div>
              </div>

              <div className="bg-surface-card rounded-2xl p-space-md shadow-xs border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted">Avg Response</span>
                  <div className="w-8 h-8 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">speed</span>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-headline-lg font-bold text-text-primary">4.2</span>
                  <span className="font-label-md text-text-secondary">Days</span>
                </div>
                <div className="mt-1 text-text-muted font-label-md text-[11px]">
                  <span>Market avg: 8.5 days</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= TABS & APPLICATION CARDS ================= */}
        <section className="max-w-[1280px] mx-auto w-full px-margin-mobile md:px-margin pt-space-lg">
          {/* Tabs row */}
          <div className="flex items-center gap-space-xs border-b border-border-default overflow-x-auto no-scrollbar mb-space-lg">
            {[
              { id: "saved", label: "Saved Jobs", count: savedJobs.length, icon: "bookmark" },
              { id: "active", label: "Active Applications", count: 3, icon: "mark_email_read" },
              { id: "archived", label: "Archived / Past", count: 8, icon: "inventory_2" },
              { id: "alerts", label: "Job Alert Feeds", count: 2, icon: "notifications_active" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                type="button"
                className={`inline-flex items-center gap-space-xs px-space-md py-space-sm font-label-lg transition-colors border-b-2 ${
                  activeTab === t.id
                    ? "font-bold text-primary border-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                <span>{t.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-text-secondary text-[11px] font-numeric-metric">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Two-Column Grid (8 col main / 4 col side) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* LEFT COLUMN: Saved Cards List */}
            <div className="lg:col-span-8 flex flex-col gap-space-md">
              {/* Search filter in saved */}
              <div className="bg-surface-card rounded-2xl p-space-md shadow-xs border border-border-default flex flex-col sm:flex-row items-center justify-between gap-space-sm">
                <div className="relative flex-1 w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Filter by title, company, or skill..."
                    className="w-full pl-10 pr-space-md py-2.5 rounded-xl bg-surface-container-low font-body-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border-default"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="py-20 text-center bg-surface-card rounded-2xl border border-border-default">
                  <p className="font-body-md text-text-muted">Loading saved bookmarks...</p>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="py-20 text-center bg-surface-card rounded-2xl border border-border-default px-4">
                  <span className="material-symbols-outlined text-[36px] text-text-muted mb-2">
                    bookmark_border
                  </span>
                  <h3 className="font-headline-md font-bold text-on-surface">
                    No jobs saved in this view
                  </h3>
                  <p className="font-body-md text-text-secondary mt-1 mb-4">
                    Explore available opportunities to bookmark roles you love.
                  </p>
                  <Link
                    to="/find-jobs"
                    className="px-space-md py-2.5 bg-primary text-on-primary font-label-md font-bold rounded-xl"
                  >
                    Browse Jobs
                  </Link>
                </div>
              ) : (
                filteredList.map((job) => (
                  <article
                    key={job._id || job.id}
                    className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm hover:shadow-md border border-border-default transition-all duration-200 relative group overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-space-md">
                      <div className="flex items-start gap-space-md flex-1">
                        <div className="w-14 h-14 rounded-2xl bg-brand-indigo-light flex items-center justify-center shrink-0 border border-border-default overflow-hidden">
                          {job.company?.companyLogo ? (
                            <img
                              src={job.company.companyLogo}
                              alt={job.company?.companyName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-primary text-[28px]">
                              terminal
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-space-xs mb-1">
                            <span className="font-label-lg font-bold text-text-primary hover:text-primary transition-colors cursor-pointer">
                              {job.company?.companyName || "Verified Partner"}
                            </span>
                            <span className="material-symbols-outlined text-verified-badge text-[18px]">
                              verified
                            </span>
                            <span className="text-text-muted">•</span>
                            <span className="font-body-sm text-text-muted">Saved</span>
                          </div>

                          <h2 className="font-headline-md font-bold text-text-primary hover:text-primary transition-colors truncate">
                            {job.title}
                          </h2>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-space-md mt-1 text-text-secondary font-body-sm">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-text-muted">
                                location_on
                              </span>
                              {job.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-text-muted">
                                schedule
                              </span>
                              {job.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Remove Bookmark Action */}
                      <div className="flex items-center gap-space-xs self-end md:self-start">
                        <button
                          onClick={() => handleRemove(job._id || job.id)}
                          type="button"
                          title="Remove bookmark"
                          className="w-10 h-10 rounded-xl bg-surface-container hover:bg-error-container text-text-secondary hover:text-error flex items-center justify-center transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            delete_outline
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Tags */}
                    {job.tags && (
                      <div className="flex flex-wrap gap-1.5 my-space-md">
                        {job.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-on-surface-variant"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Row */}
                    <div className="pt-space-sm border-t border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                      <div>
                        <span className="font-label-caps uppercase text-text-muted tracking-wider block">
                          Compensation
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-headline-sm font-bold text-salary-emerald">
                            GH₵ {job.salaryMin ? `${Math.round(job.salaryMin / 1000)}k` : "55k"}{" "}
                            - GH₵ {job.salaryMax ? `${Math.round(job.salaryMax / 1000)}k` : "90k"}
                          </span>
                          <span className="font-body-sm text-text-secondary">/ month</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-space-md">
                        <Link
                          to={`/job/${job._id || job.id}`}
                          className="inline-flex items-center justify-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-primary-container hover:bg-brand-indigo-dark text-on-primary font-label-lg shadow-sm transition-all"
                        >
                          <span>Apply Now</span>
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {/* RIGHT COLUMN: Upcoming Interview & Application Pipeline */}
            <div className="lg:col-span-4 flex flex-col gap-space-md">
              {/* Upcoming Interview Card */}
              <div className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm border border-border-default border-l-4 border-l-primary relative overflow-hidden">
                <div className="flex items-center justify-between mb-space-sm">
                  <span className="inline-flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-primary font-bold">
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    Upcoming Interview
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-md font-semibold">
                    2 Days Away
                  </span>
                </div>

                <div className="flex items-start gap-space-sm">
                  <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center shrink-0 text-secondary">
                    <span className="material-symbols-outlined text-[24px]">
                      video_camera_front
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline-sm font-bold text-text-primary truncate">
                      Hubtel • Architecture Round
                    </h3>
                    <p className="font-body-sm text-text-secondary mt-0.5">
                      High-Scale Go Systems Evaluation
                    </p>
                  </div>
                </div>

                <div className="mt-space-md space-y-2 text-body-sm bg-surface-container-low p-space-sm rounded-xl border border-border-default">
                  <div className="flex items-center gap-space-xs text-text-primary font-semibold">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      calendar_today
                    </span>
                    <span>Thursday, Oct 24 • 2:30 PM GMT</span>
                  </div>
                  <div className="flex items-center gap-space-xs text-text-secondary">
                    <span className="material-symbols-outlined text-text-muted text-[18px]">
                      videocam
                    </span>
                    <span>Google Meet (Encrypted Link)</span>
                  </div>
                  <div className="flex items-center gap-space-xs text-text-secondary">
                    <span className="material-symbols-outlined text-text-muted text-[18px]">
                      person
                    </span>
                    <span>Interviewer: Nana Osei (Eng. Director)</span>
                  </div>
                </div>

                <div className="mt-space-md flex flex-col gap-space-xs">
                  <button
                    onClick={() => toast.success("AI Talking Points loaded!")}
                    type="button"
                    className="w-full py-2.5 px-space-md rounded-xl bg-brand-indigo-light text-primary hover:bg-brand-indigo-subtle font-label-md font-bold text-center flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      auto_awesome
                    </span>
                    <span>Review AI Talking Points</span>
                  </button>
                  <button
                    onClick={() => toast.success("Event synced with calendar")}
                    type="button"
                    className="w-full py-2 px-space-md rounded-xl text-text-secondary hover:text-text-primary font-label-md text-center transition-colors"
                  >
                    Add to Calendar
                  </button>
                </div>
              </div>

              {/* Application Pipeline Card */}
              <div className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm border border-border-default">
                <div className="flex items-center justify-between mb-space-md">
                  <div>
                    <h3 className="font-headline-sm font-bold text-text-primary">
                      Application Pipeline
                    </h3>
                    <span className="font-body-sm text-text-muted">
                      3 active recruitment flows
                    </span>
                  </div>
                  <span className="text-primary font-label-md font-bold">Live</span>
                </div>

                <div className="space-y-space-md">
                  {/* Flow 1 */}
                  <div className="p-space-sm rounded-xl bg-surface-container-low border border-border-default">
                    <div className="flex items-center justify-between">
                      <span className="font-label-lg font-bold text-text-primary">
                        BrightPath Academy
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-md font-semibold">
                        Stage 1 of 4
                      </span>
                    </div>
                    <span className="font-body-sm text-text-secondary block mt-0.5">
                      Lead Systems Architect
                    </span>
                    <div className="mt-2 flex items-center justify-between text-body-sm">
                      <span className="text-primary font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Recruiter Screening
                      </span>
                      <span className="text-text-muted text-[11px]">Yesterday</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-primary-container h-full rounded-full w-[25%]" />
                    </div>
                  </div>

                  {/* Flow 2 */}
                  <div className="p-space-sm rounded-xl bg-surface-container-low border border-border-default">
                    <div className="flex items-center justify-between">
                      <span className="font-label-lg font-bold text-text-primary">
                        Zeepay Ghana
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-md font-semibold">
                        Stage 2 of 4
                      </span>
                    </div>
                    <span className="font-body-sm text-text-secondary block mt-0.5">
                      Hiring process update
                    </span>
                    <div className="mt-2 flex items-center justify-between text-body-sm">
                      <span className="text-secondary font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          check_circle
                        </span>
                        Skills assessment
                      </span>
                      <span className="text-text-muted text-[11px]">3 days ago</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-secondary-container h-full rounded-full w-[50%]" />
                    </div>
                  </div>

                  {/* Flow 3 */}
                  <div className="p-space-sm rounded-xl bg-surface-container-low border border-border-default">
                    <div className="flex items-center justify-between">
                      <span className="font-label-lg font-bold text-text-primary">
                        Turaco
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-salary-surface text-salary-emerald font-label-md font-semibold">
                        Stage 3 of 4
                      </span>
                    </div>
                    <span className="font-body-sm text-text-secondary block mt-0.5">
                      Customer Service Manager
                    </span>
                    <div className="mt-2 flex items-center justify-between text-body-sm">
                      <span className="text-salary-emerald font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">
                          schedule
                        </span>
                        Partner Final Round
                      </span>
                      <span className="text-text-muted text-[11px]">5 days ago</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-salary-emerald h-full rounded-full w-[75%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SavedJobs;
