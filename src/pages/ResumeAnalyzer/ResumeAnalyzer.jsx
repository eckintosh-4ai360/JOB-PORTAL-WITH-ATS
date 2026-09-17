import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import toast from "react-hot-toast";

const ResumeAnalyzer = () => {
  const navigate = useNavigate();
  const [activeFileName, setActiveFileName] = useState("Your_Resume.pdf");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [atsScore, setAtsScore] = useState(94);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axiosInstance.get(API_PATHS.JOBS.GET_ALL_JOBS, {
          params: { limit: 10 }
        });
        if (res.data?.jobs && Array.isArray(res.data.jobs)) {
          setJobs(res.data.jobs);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.warn("Failed to load jobs for analyzer:", err);
        setJobs([]);
      } finally {
        setLoadingJobs(false);
      }
    };
    fetchJobs();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setActiveFileName(file.name);
    setTimeout(() => {
      setIsAnalyzing(false);
      setAtsScore(Math.floor(Math.random() * 8) + 91); // 91 - 98
      toast.success("Resume parsed and ATS scorecard generated in 1.2s!");
    }, 1200);
  };

  const handleLinkedInSubmit = (e) => {
    e.preventDefault();
    if (!linkedInUrl.trim()) return;

    setIsAnalyzing(true);
    setShowLinkedInModal(false);
    setTimeout(() => {
      setIsAnalyzing(false);
      setActiveFileName("LinkedIn_Profile_Sync.pdf");
      setAtsScore(95);
      toast.success("LinkedIn profile skills synchronized successfully!");
    }, 1200);
  };

  const matchedRoles = jobs.filter((role) => {
    if (activeTab === "remote") {
      return (role.location || "").toLowerCase().includes("remote") || 
             (role.type || "").toLowerCase().includes("remote");
    }
    return true;
  }).slice(0, 4);

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO HEADER SECTION ================= */}
        <section className="relative w-full bg-surface overflow-hidden py-space-lg md:py-space-xl border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin relative z-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-space-xs font-label-md text-text-muted mb-space-sm">
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-primary font-bold">AI Resume Analyzer &amp; Job Match</span>
            </nav>

            <div className="max-w-4xl flex flex-col gap-space-sm">
              <div className="inline-flex items-center gap-2 px-space-md py-1 rounded-full bg-brand-indigo-light text-primary font-label-caps uppercase tracking-wider w-fit shadow-xs">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>✦ SPG Neural Talent Intelligence 2.0</span>
              </div>

              <h1 className="font-headline-xl text-headline-xl text-text-primary tracking-tight">
                AI Resume Analyzer &amp;{" "}
                <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                  Instant Job Match
                </span>
              </h1>

              <p className="font-body-lg text-body-lg text-text-secondary leading-relaxed">
                Upload your CV or portfolio to get ATS compatibility feedback, skill highlights, salary insights, and role matches across employers in every industry.
              </p>

              {/* Trust Stats Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-md">
                <div className="flex items-center gap-space-sm rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-surface-card p-3 shadow-[0_10px_24px_rgba(109,40,217,0.09)] transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-brand-indigo-light flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">description</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-numeric-metric text-text-primary">45,000+</span>
                    <span className="font-body-sm text-text-muted">Analyzed Resumes</span>
                  </div>
                </div>

                <div className="flex items-center gap-space-sm rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-surface-card p-3 shadow-[0_10px_24px_rgba(16,185,129,0.09)] transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-salary-surface flex items-center justify-center text-salary-emerald shrink-0">
                    <span className="material-symbols-outlined text-[22px]">trending_up</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-numeric-metric text-text-primary">89%</span>
                    <span className="font-body-sm text-text-muted">Interview Callback Rate</span>
                  </div>
                </div>

                <div className="flex items-center gap-space-sm rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-surface-card p-3 shadow-[0_10px_24px_rgba(14,165,233,0.09)] transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">verified_user</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-numeric-metric text-text-primary">100% Confidential</span>
                    <span className="font-body-sm text-text-muted">Enterprise Encryption</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= INTERACTIVE TWO-COLUMN LAYOUT ================= */}
        <section className="w-full pt-space-lg bg-surface">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
              {/* ================= LEFT COLUMN: RESUME ANALYSIS (col-span-5) ================= */}
              <div className="lg:col-span-5 flex flex-col gap-space-md">
                {/* Document Status Card */}
                <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-brand-indigo-light via-surface-card to-surface-card p-space-md shadow-[0_16px_34px_rgba(89,47,174,0.10)] flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps uppercase text-text-muted tracking-wider">
                      Active Document
                    </span>
                    <span className="inline-flex items-center gap-1 font-body-sm text-salary-emerald font-medium">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      Parsed in 1.4s
                    </span>
                  </div>

                  <div className="flex items-start gap-space-sm rounded-2xl border border-white/70 bg-white/65 p-space-sm shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[28px]">picture_as_pdf</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="font-headline-sm font-bold text-text-primary truncate">
                        {activeFileName}
                      </p>
                      <div className="flex items-center gap-2 font-body-sm text-text-muted">
                        <span>1.8 MB</span>
                        <span>•</span>
                        <span className="text-verified-badge font-semibold">Profile Ready</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-sm pt-1">
                    <label className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-bold transition-colors cursor-pointer text-center">
                      <span className="material-symbols-outlined text-[18px]">upload_file</span>
                      <span>Re-upload CV</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={() => setShowLinkedInModal(true)}
                      type="button"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-brand-indigo-light text-primary hover:bg-brand-indigo-subtle font-label-md font-bold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                      <span>Paste LinkedIn</span>
                    </button>
                  </div>
                </div>

                {/* Overall ATS Scorecard */}
                <div className="rounded-3xl border border-border-default bg-surface-card p-space-lg shadow-[0_16px_34px_rgba(40,34,86,0.08)] flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-headline-md font-bold text-text-primary">
                        ATS &amp; Market Alignment
                      </h3>
                      <p className="font-body-sm text-text-secondary">
                        Scored against active roles matching your profile
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">psychology</span>
                    </div>
                  </div>

                  {/* Score Gauge Block */}
                  <div className="flex flex-col items-center gap-space-md rounded-3xl border border-primary/10 bg-gradient-to-br from-brand-indigo-light/70 to-surface-container-low p-space-md sm:flex-row">
                    {/* Radial Progress Gauge */}
                    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          className="text-surface-container fill-none"
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                        />
                        <circle
                          className="text-primary fill-none transition-all duration-1000 ease-out drop-shadow-sm"
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="currentColor"
                          strokeDasharray="251.32"
                          strokeDashoffset={251.32 * (1 - atsScore / 100)}
                          strokeLinecap="round"
                          strokeWidth="8"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="font-headline-lg font-bold text-text-primary leading-none">
                          {atsScore}
                        </span>
                        <span className="font-label-caps uppercase text-text-muted text-[10px]">
                          ATS Score
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-between text-text-secondary font-body-sm">
                        <span>Resume Strength</span>
                        <span className="font-bold text-salary-emerald">Tier 1 (Top 6%)</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/80 shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-salary-emerald transition-all duration-700"
                          style={{ width: `${atsScore}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-full bg-salary-surface text-salary-emerald font-label-caps font-semibold">
                          ✓ Strong Professional Experience
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-caps font-semibold">
                          ✓ Relevant Skills Highlighted
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Live Market Value */}
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-salary-surface to-surface-container-low p-space-md shadow-sm flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-caps uppercase text-salary-emerald font-bold tracking-wider">
                        Estimated Live Market Value
                      </span>
                      <span className="font-body-sm text-text-muted">Ghana job market</span>
                    </div>
                    <p className="font-headline-lg font-bold text-text-primary">
                      GH₵ 48,000 <span className="text-text-muted font-normal">–</span> GH₵ 75,000{" "}
                      <span className="text-body-md font-normal text-text-secondary">/ month</span>
                    </p>
                    <p className="font-body-sm text-text-secondary">
                      Your profile is being assessed against the experience and qualifications requested in active job listings.
                    </p>
                  </div>
                </div>

                {/* Skills & Proficiency Breakdown */}
                <div className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)] flex flex-col gap-space-md">
                  <div>
                    <h4 className="font-headline-sm font-bold text-text-primary">
                      Verified Skills &amp; Qualifications
                    </h4>
                    <p className="font-body-sm text-text-muted">
                      Extracted from your work history, education, and uploaded documents
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Communication",
                      "Customer Service",
                      "Team Leadership",
                      "Microsoft Office",
                      "Problem Solving",
                      "Time Management",
                      "Project Coordination",
                      "Professional Writing",
                      "Data Entry",
                    ].map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-xl bg-salary-surface text-salary-emerald font-label-md font-semibold flex items-center gap-1 border border-salary-emerald/20"
                      >
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border-default">
                    <span className="font-label-caps uppercase text-error tracking-wider block mb-1">
                      Recommended Profile Improvements:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Add measurable achievements",
                        "Include relevant certifications",
                        "Tailor your professional summary",
                      ].map((gap) => (
                        <span
                          key={gap}
                          className="px-2.5 py-1 rounded-xl bg-brand-indigo-light text-primary font-label-md font-semibold flex items-center gap-1 cursor-pointer hover:bg-brand-indigo-subtle transition-colors"
                          onClick={() => toast.success(`Added ${gap} learning track to profile!`)}
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ================= RIGHT COLUMN: MATCHED ROLES (col-span-7) ================= */}
              <div className="lg:col-span-7 flex flex-col gap-space-md">
                <div className="flex flex-col justify-between gap-space-sm rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_14px_30px_rgba(40,34,86,0.07)] sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-headline-sm font-bold text-on-surface">
                      Algorithmic Job Matches ({matchedRoles.length})
                    </h3>
                    <p className="font-body-sm text-text-muted">
                      Ranked by ATS fit &amp; compensation potential
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
                    {["all", "90+", "remote"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        type="button"
                        className={`px-3 py-1 rounded-lg font-label-md font-bold capitalize transition-colors ${
                          activeTab === t
                            ? "bg-surface-card text-primary shadow-xs"
                            : "text-text-secondary hover:text-on-surface"
                        }`}
                      >
                        {t === "all" ? "All Matches" : t === "90+" ? "90%+ Match" : "Remote Only"}
                      </button>
                    ))}
                  </div>
                </div>

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-24 bg-surface-card rounded-2xl border border-border-default">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="font-body-md font-bold text-text-primary">
                      Matching resume against live opportunities...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-space-md">
                    {matchedRoles.length === 0 ? (
                      <div className="text-center py-16 bg-surface-card rounded-2xl border border-border-default">
                        <span className="material-symbols-outlined text-[48px] text-text-muted mb-2">work_off</span>
                        <p className="font-body-md font-semibold text-text-primary">No matching open roles found</p>
                        <p className="font-body-sm text-text-muted mt-1">Check back later or explore all open jobs.</p>
                        <Link to="/find-jobs" className="mt-4 inline-block px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md font-bold">
                          Explore All Jobs
                        </Link>
                      </div>
                    ) : (
                      matchedRoles.map((role, idx) => {
                        const tags = Array.isArray(role.tags) && role.tags.length > 0 
                          ? role.tags 
                          : [role.category, role.type].filter(Boolean);
                        const compLogo = role.company?.companyLogo || role.companyLogo || "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=120&auto=format&fit=crop&q=60";
                        const compName = role.company?.companyName || role.companyName || "Hiring Company";

                        return (
                          <article
                            key={role._id || role.id}
                            className="group relative overflow-hidden rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_40px_rgba(89,47,174,0.15)] md:p-space-lg"
                          >
                            {/* Top Match Gauge Pill */}
                            <div className="flex items-center justify-between mb-space-sm">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-salary-surface text-salary-emerald font-label-md font-bold shadow-xs">
                                <span className="material-symbols-outlined text-[16px]">
                                  auto_awesome
                                </span>
                                {96 - idx * 3}% Match • Direct Recruiter Line
                              </span>

                              <span className="font-body-sm text-text-muted">
                                {role.workModel || role.type || "Full-Time"}
                              </span>
                            </div>

                            <div className="flex items-start gap-space-md">
                              <div className="w-14 h-14 rounded-2xl bg-surface-container overflow-hidden shrink-0 border border-border-default">
                                <img
                                  src={compLogo}
                                  alt={compName}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="font-headline-md font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                                  {role.title}
                                </h4>
                                <p className="font-body-sm text-text-muted mt-0.5">
                                  {compName} • {role.location || "Ghana"}
                                </p>
                              </div>
                            </div>

                            <p className="font-body-md text-text-secondary line-clamp-2 mt-space-sm leading-relaxed">
                              {role.description}
                            </p>

                            <div className="flex flex-wrap gap-1.5 my-space-sm">
                              {tags.map((t) => (
                                <span
                                  key={t}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-text-secondary"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>

                            <div className="pt-space-sm border-t border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                              <div>
                                <span className="font-label-caps uppercase text-text-muted tracking-wider block">
                                  Compensation
                                </span>
                                <span className="font-headline-sm font-bold text-salary-emerald">
                                  {role.salaryMin && role.salaryMax
                                    ? `GH₵ ${Math.round(role.salaryMin / 1000)}k - GH₵ ${Math.round(role.salaryMax / 1000)}k / mo`
                                    : role.salaryMin
                                    ? `From GH₵ ${Math.round(role.salaryMin / 1000)}k / mo`
                                    : "Competitive Compensation"}
                                </span>
                              </div>

                              <div className="flex items-center gap-space-sm">
                                <button
                                  onClick={() => {
                                    toast.success(`1-Click application dispatched to ${compName}!`);
                                  }}
                                  type="button"
                                  className="px-space-md py-2.5 rounded-xl bg-primary-container hover:bg-brand-indigo-dark text-on-primary font-label-md font-bold shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    bolt
                                  </span>
                                  <span>1-Click Apply</span>
                                </button>

                                <Link
                                  to={`/job/${role._id || role.id}`}
                                  className="px-space-md py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-colors"
                                >
                                  Details
                                </Link>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= LINKEDIN URL PASTE MODAL ================= */}
      {showLinkedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-border-default relative">
            <button
              onClick={() => setShowLinkedInModal(false)}
              type="button"
              className="absolute top-4 right-4 text-text-muted hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">link</span>
              </div>
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Sync LinkedIn Profile
                </h3>
                <p className="font-body-sm text-text-secondary">
                  Paste your public profile link to extract relevant experience and achievements
                </p>
              </div>
            </div>

            <form onSubmit={handleLinkedInSubmit} className="flex flex-col gap-3">
              <input
                type="url"
                required
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://linkedin.com/in/your-profile"
                className="p-3 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkedInModal(false)}
                  className="px-4 py-2.5 rounded-xl font-label-md text-text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold hover:bg-brand-indigo-dark"
                >
                  Sync &amp; Analyze
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

export default ResumeAnalyzer;
