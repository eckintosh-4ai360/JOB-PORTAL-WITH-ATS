import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import JobMatchPanel from "../../components/ai/JobMatchPanel";
import toast from "react-hot-toast";

const parseList = (val, defaultList = []) => {
  if (!val) return defaultList;
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return defaultList;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    if (trimmed.includes("\n") || trimmed.includes("•") || trimmed.includes("*")) {
      const items = trimmed
        .split(/\r?\n|•|\*/)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter(Boolean);
      if (items.length > 0) return items;
    }
    if (trimmed.includes(";")) {
      const items = trimmed.split(";").map((s) => s.trim()).filter(Boolean);
      if (items.length > 0) return items;
    }
    return [trimmed];
  }
  return defaultList;
};

const parseTags = (tags, defaultList = []) => {
  if (!tags) return defaultList;
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === "string") {
    const parts = tags.split(/[,|;]/).map((t) => t.trim()).filter(Boolean);
    return parts.length > 0 ? parts : defaultList;
  }
  return defaultList;
};

const JobDetails = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [job, setJob] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Application Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyResume, setApplyResume] = useState(null);
  const [coverNote, setCoverNote] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      setIsLoading(true);
      try {
        try {
          const res = await axiosInstance.get(API_PATHS.JOBS.GET_JOB_BY_ID(jobId));
          if (res.data) {
            setJob(res.data);
          } else {
            setJob(null);
          }
        } catch (err) {
          console.error("Error fetching job details:", err);
          setJob(null);
        }

        if (isAuthenticated) {
          try {
            const savedRes = await axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS);
            if (Array.isArray(savedRes.data)) {
              const ids = savedRes.data.map((item) => item.job?._id || item.job?.id || item.job);
              setIsSaved(ids.includes(jobId));
            }
          } catch {
            // Keep default
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId, isAuthenticated]);

  const handleToggleSave = async () => {
    if (!isAuthenticated) {
      toast("Please sign in to save this opportunity", { icon: "🔒" });
      navigate("/login", { state: { from: { pathname: `/job/${jobId}` } } });
      return;
    }

    try {
      if (isSaved) {
        await axiosInstance.delete(API_PATHS.JOBS.UNSAVE_JOB(jobId));
        setIsSaved(false);
        toast.success("Job removed from bookmarks");
      } else {
        await axiosInstance.post(API_PATHS.JOBS.SAVE_JOB(jobId));
        setIsSaved(true);
        toast.success("Job saved to your Career Cockpit!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update bookmark");
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: job?.title || "Job Opportunity",
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Job link copied to clipboard!");
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (applyResume) formData.append("resume", applyResume);
      if (coverNote) formData.append("coverLetter", coverNote);

      if (!isAuthenticated) {
        if (!applicantName || !applicantEmail) {
          toast.error("Please enter your name and email address.");
          setIsSubmitting(false);
          return;
        }
        formData.append("guestName", applicantName);
        formData.append("guestEmail", applicantEmail);
      }

      await axiosInstance.post(API_PATHS.APPLICATIONS.APPLY_FOR_JOB(jobId), formData);
      toast.success("Application successfully submitted!");
      setShowApplyModal(false);
      setCoverNote("");
      setApplyResume(null);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to submit application. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface min-h-screen flex flex-col pt-20">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-body-md text-text-muted">Loading role details...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-surface min-h-screen flex flex-col pt-20">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-text-muted mb-4">
            <span className="material-symbols-outlined text-[36px]">work_off</span>
          </div>
          <h2 className="font-headline-md font-bold text-text-primary mb-2">Job Not Found</h2>
          <p className="font-body-md text-text-secondary max-w-md mb-6">
            The opportunity you are looking for may have expired, been removed, or does not exist.
          </p>
          <Link
            to="/find-jobs"
            className="px-6 py-3 rounded-xl bg-primary text-white font-label-md font-bold hover:bg-brand-indigo-dark transition-colors"
          >
            Explore Active Jobs
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const companyName =
    job.companyProfile?.name ||
    job.company?.companyName ||
    job.company?.name ||
    job.companyName ||
    "Hiring Company";

  const companyLogo =
    job.companyProfile?.logo ||
    job.company?.companyLogo ||
    job.companyLogo ||
    "";

  const companyHq = job.companyProfile?.hq || job.location || "Accra, Ghana";
  const companyEmployees = job.companyProfile?.employees || "20 - 100";
  const companyIndustry = job.companyProfile?.industry || job.category || "General Services";
  const companyDesc =
    job.companyProfile?.description ||
    job.company?.companyDescription ||
    `${companyName} has opportunities for qualified candidates.`;

  const responsibilitiesList = parseList(job.responsibilities, [
    "Deliver high-quality work that supports the team and the organisation's goals.",
    "Collaborate with colleagues, customers, and stakeholders in a professional manner.",
    "Follow relevant procedures, safety standards, and quality requirements.",
    "Optimize core web vitals, state management, caching mechanisms (Redis), and event queues across low-bandwidth environments.",
  ]);

  const requirementsList = parseList(job.requirements, [
    "Relevant experience, training, or qualifications for this position.",
    "Strong communication, organisation, and problem-solving skills.",
    "Ability to work reliably as part of a team and independently when needed.",
  ]);

  const perksList = parseList(job.perks || job.companyProfile?.perks, [
    "Full family private medical cover (including optical & dental)",
    "Annual GH₵ 15,000 professional hardware & desk stipend",
    "Flexible hybrid model with 2 days remote weekly",
    "Tier-1 Tier-3 pension matching contribution",
  ]);

  const tagsList = parseTags(job.tags || job.companyProfile?.stack, [
    [],
  ]);

  const formatSalary = (val, fallback) => {
    if (!val) return fallback;
    const num = Number(val);
    if (isNaN(num)) return fallback;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return `${num}`;
  };

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= TOP HERO BANNER ================= */}
        <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pt-space-lg pb-space-lg border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-space-xs font-label-md text-text-muted mb-space-sm">
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                {job.category || "Jobs"}
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary font-bold truncate max-w-[200px]">
                {job.title}
              </span>
            </nav>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
              {/* Left Title & Employer Info */}
              <div className="flex items-start gap-space-md">
                <div className="w-16 h-16 rounded-2xl bg-surface-card p-1 shadow-md border border-border-default overflow-hidden shrink-0 flex items-center justify-center">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt={companyName}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[32px]">
                      business
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-space-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                      Active Opportunity
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-caps font-semibold">
                      {job.category || "Department"}
                    </span>
                  </div>

                  <h1 className="font-headline-xl text-headline-xl text-text-primary tracking-tight font-bold">
                    {job.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-text-secondary font-body-md pt-0.5">
                    <span className="font-semibold text-text-primary flex items-center gap-1">
                      {companyName}
                      <span className="material-symbols-outlined text-verified-badge text-[18px]">
                        verified
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-text-muted">
                        location_on
                      </span>
                      {job.location || "Accra, Ghana"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-text-muted">
                        schedule
                      </span>
                      {job.type || job.jobType || "Full-Time"}
                    </span>
                  </div>

                  {/* Chips Cluster */}
                  <div className="flex flex-wrap items-center gap-2 pt-space-xs">
                    <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-md flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">work</span>
                      {job.type || job.jobType || "Full-Time"}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-md flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">home_work</span>
                      {job.workModel || "Hybrid"}
                    </span>
                    <span className="px-3.5 py-1 rounded-full bg-salary-surface text-salary-emerald font-numeric-metric flex items-center gap-1.5 shadow-xs">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      GH₵ {formatSalary(job.salaryMin, "50k")} - GH₵ {formatSalary(job.salaryMax, "85k")} / mo
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Action Cluster */}
              <div className="flex flex-col sm:flex-row lg:flex-col shrink-0 gap-space-sm items-stretch lg:min-w-[220px]">
                <button
                  onClick={() => setShowApplyModal(true)}
                  type="button"
                  className="w-full h-12 px-6 rounded-xl bg-primary-container text-on-primary font-label-lg font-bold flex items-center justify-center gap-2 shadow-md hover:bg-brand-indigo-dark transition-all transform active:scale-98 cursor-pointer"
                >
                  <span>Apply Now</span>
                  <span className="material-symbols-outlined text-[20px]">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => setShowApplyModal(true)}
                  type="button"
                  className="w-full h-11 px-5 rounded-xl bg-brand-indigo-light text-primary font-label-lg font-bold flex items-center justify-center gap-2 hover:bg-brand-indigo-subtle transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Quick Apply with CV</span>
                </button>

                <div className="grid grid-cols-2 gap-space-xs pt-1">
                  <button
                    onClick={handleToggleSave}
                    type="button"
                    className={`h-10 px-3 rounded-xl border border-border-default flex items-center justify-center gap-1 font-label-md transition-colors cursor-pointer ${
                      isSaved
                        ? "bg-brand-indigo-light text-primary font-bold"
                        : "bg-surface-card hover:bg-surface-container text-text-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      bookmark
                    </span>
                    <span>{isSaved ? "Saved" : "Save"}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    type="button"
                    className="h-10 px-3 rounded-xl bg-surface-card hover:bg-surface-container border border-border-default text-text-secondary flex items-center justify-center gap-1 font-label-md transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= TWO-COLUMN DETAILS GRID ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin mt-space-lg w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* MAIN COLUMN (col-span-8) */}
            <div className="lg:col-span-8 flex flex-col gap-space-lg">
              {/* Role Overview */}
              <div className="bg-surface-card rounded-2xl p-space-lg md:p-space-xl border border-border-default shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center gap-space-xs text-primary font-label-caps uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[18px]">description</span>
                  Executive Brief
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Role Overview
                </h2>
                <p className="font-body-lg text-body-lg text-text-secondary leading-relaxed whitespace-pre-line">
                  {job.description ||
                    `${companyName} is seeking a motivated candidate to join its team.`}
                </p>

                {/* Impact Metrics Mini Bento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
                  <div className="p-space-md rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-1">
                    <span className="font-headline-lg font-bold text-primary">2.4M+</span>
                    <span className="font-body-sm text-text-secondary">
                      Protected records processed monthly
                    </span>
                  </div>
                  <div className="p-space-md rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-1">
                    <span className="font-headline-lg font-bold text-salary-emerald">
                      99.98%
                    </span>
                    <span className="font-body-sm text-text-secondary">
                      Uptime SLA standard target
                    </span>
                  </div>
                  <div className="p-space-md rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-1">
                    <span className="font-headline-lg font-bold text-secondary">
                      120ms
                    </span>
                    <span className="font-body-sm text-text-secondary">
                      Sub-second latency target
                    </span>
                  </div>
                </div>
              </div>

              {/* Responsibilities */}
              <div className="bg-surface-card rounded-2xl p-space-lg md:p-space-xl border border-border-default shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center gap-space-xs text-primary font-label-caps uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  Accountability
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Key Responsibilities
                </h2>
                <ul className="flex flex-col gap-space-sm font-body-md text-text-secondary">
                  {responsibilitiesList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-indigo-light text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[15px]">check</span>
                      </div>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skills and qualifications */}
              <div className="bg-surface-card rounded-2xl p-space-lg md:p-space-xl border border-border-default shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center gap-space-xs text-primary font-label-caps uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                  Requirements
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Skills, Qualifications &amp; Requirements
                </h2>

                <div className="flex flex-wrap gap-2 my-1">
                  {tagsList.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-surface-container font-label-md text-on-surface font-semibold"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <ul className="flex flex-col gap-space-sm font-body-md text-text-secondary mt-2">
                  {requirementsList.map((r, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-salary-surface text-salary-emerald flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[15px]">check</span>
                      </div>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Benefits & Perks */}
              <div className="bg-surface-card rounded-2xl p-space-lg md:p-space-xl border border-border-default shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center gap-space-xs text-salary-emerald font-label-caps uppercase tracking-wider font-bold">
                  <span className="material-symbols-outlined text-[18px]">card_giftcard</span>
                  Compensation &amp; Perks
                </div>
                <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                  Employee Benefits Package
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  {perksList.map((p, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-surface-container-low border border-border-default flex items-center gap-2.5 font-body-sm text-text-secondary"
                    >
                      <span className="material-symbols-outlined text-salary-emerald text-[20px]">
                        verified
                      </span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR (col-span-4) */}
            <div className="lg:col-span-4 flex flex-col gap-space-md">
              {/* Real AI match score for this role, scored against the
                  candidate's analysed resume across six dimensions. */}
              <JobMatchPanel jobId={jobId} isAuthenticated={isAuthenticated} />

              {/* Company Profile Card */}
              <div className="bg-surface-card rounded-2xl p-space-md md:p-space-lg border border-border-default shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden border border-border-default shrink-0">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={companyName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-[24px]">
                        business
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-headline-sm font-bold text-on-surface">
                      About {companyName}
                    </h3>
                    <span className="font-body-sm text-text-muted">{companyIndustry}</span>
                  </div>
                </div>

                <p className="font-body-sm text-text-secondary leading-relaxed mt-2">
                  {companyDesc}
                </p>

                <div className="flex flex-col gap-2 pt-2 border-t border-border-default text-body-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Headquarters</span>
                    <span className="font-semibold text-text-primary">{companyHq}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Organization Size</span>
                    <span className="font-semibold text-text-primary">{companyEmployees}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Verification Status</span>
                    <span className="font-semibold text-salary-emerald flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      Certified Employer
                    </span>
                  </div>
                </div>

                <Link
                  to="/browse-companies"
                  className="mt-2 w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold text-center transition-colors block"
                >
                  View Company Profile
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= APPLY MODAL ================= */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-modal-title"
            className="animate-slide-in-right ml-auto flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-2xl md:w-1/2"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-5 md:px-8 md:py-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[26px]">send</span>
                </div>
                <div className="min-w-0">
                  <h3 id="apply-modal-title" className="font-headline-md font-bold text-on-surface truncate">
                    Apply for {job.title}
                  </h3>
                  <p className="font-body-md text-text-secondary truncate">{companyName}</p>
                </div>
              </div>
            <button
              onClick={() => setShowApplyModal(false)}
              type="button"
              aria-label="Close application form"
              className="shrink-0 text-text-muted hover:text-on-surface p-1 rounded-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
            </div>

            <form onSubmit={handleApplySubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
              {!isAuthenticated && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps uppercase text-text-muted">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. Kwame Mensah"
                      className="w-full p-3 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="font-label-caps uppercase text-text-muted">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="kwame@example.com"
                      className="w-full p-3 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2">
                <label className="font-label-caps uppercase text-text-muted">
                  Attach Resume / CV (PDF, DOCX) *
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  required
                  onChange={(e) => setApplyResume(e.target.files[0])}
                  className="font-body-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-indigo-light file:text-primary hover:file:bg-brand-indigo-subtle cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-caps uppercase text-text-muted">
                  Why are you a strong fit? (Optional)
                </label>
                <textarea
                  rows="3"
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Summarize your relevant skills, tools, and background..."
                  className="w-full min-h-32 resize-y p-3 rounded-xl bg-surface-container-low border border-border-default font-body-md text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-border-default px-6 py-5 sm:flex-row sm:items-center sm:justify-end md:px-8">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="w-full px-4 py-3 rounded-xl font-label-md text-text-secondary hover:bg-surface-container cursor-pointer sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-space-lg py-3 rounded-xl bg-primary-container text-on-primary font-label-md font-bold hover:bg-brand-indigo-dark shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer sm:w-auto"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default JobDetails;
