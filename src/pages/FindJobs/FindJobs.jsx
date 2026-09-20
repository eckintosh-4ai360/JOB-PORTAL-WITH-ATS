import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../context/AuthContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import MatchBadge from "../../components/ai/MatchBadge";

import toast from "react-hot-toast";

const FindJobs = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Search & Filter State
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(["Full-Time", "Remote"]);
  const [selectedWorkModels, setSelectedWorkModels] = useState([]);
  const [selectedExperience, setSelectedExperience] = useState([]);
  const [salaryFloor, setSalaryFloor] = useState(30000);
  const [sortBy, setSortBy] = useState("relevant");

  // Data & Async State
  const [jobs, setJobs] = useState([]);
  const [savedJobIds, setSavedJobIds] = useState(new Set());
  // AI match scores keyed by job id, merged into cards as they arrive.
  const [rawMatchScores, setMatchScores] = useState({});
  const [needsResumeAnalysis, setNeedsResumeAnalysis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [quickApplyJob, setQuickApplyJob] = useState(null);
  const [applyResume, setApplyResume] = useState(null);
  const [applyNote, setApplyNote] = useState("");
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch backend jobs and saved jobs
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      try {
        const res = await axiosInstance.get(API_PATHS.JOBS.GET_ALL_JOBS, {
          params: { limit: 100 }
        });
        if (res.data?.jobs && Array.isArray(res.data.jobs)) {
          setJobs(res.data.jobs);
        } else {
          setJobs([]);
        }
      } catch (err) {
        console.warn("Failed to load jobs:", err?.message || err);
        setJobs([]);
      }

      if (isAuthenticated) {
        try {
          const savedRes = await axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS);
          if (Array.isArray(savedRes.data)) {
            const ids = new Set(savedRes.data.map((item) => item.job?._id || item.job));
            setSavedJobIds(ids);
          }
        } catch {
          // Keep default saved state
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Load AI match scores for the signed-in candidate and merge them onto the
   * job cards. This runs separately from loadData so a slow or rate-limited
   * scoring call never delays the job list itself — badges appear when ready.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    axiosInstance
      .get(API_PATHS.AI.GET_JOB_MATCHES, { params: { limit: 40 } })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.needsProfile) {
          setNeedsResumeAnalysis(true);
          return;
        }
        const scores = {};
        for (const match of res.data?.matches || []) {
          scores[match.jobId] = {
            matchScore: match.matchScore,
            verdict: match.verdict,
            missingSkills: match.missingSkills || [],
          };
        }
        setMatchScores(scores);
        setNeedsResumeAnalysis(false);
      })
      .catch(() => {
        // Matching is an enhancement — the job list stands on its own.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Scores belong to the signed-in candidate, so a sign-out must not leave a
  // previous session's badges on the cards. Derived rather than reset in an
  // effect, which keeps sign-out to a single render.
  const matchScores = isAuthenticated ? rawMatchScores : {};

  // Bookmark Save Toggle
  const handleToggleSave = async (e, jobId) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast("Please sign in to bookmark jobs", { icon: "🔒" });
      navigate("/login", { state: { from: { pathname: "/find-jobs" } } });
      return;
    }

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
        toast.success("Job saved to your Career Cockpit!");
      }
    } catch {
      // Optimistic fallback toggle for visual demo
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(jobId);
        else next.add(jobId);
        return next;
      });
      toast.success(isSaved ? "Job removed from bookmarks" : "Job bookmarked!");
    }
  };

  // Quick Apply submission
  const handleQuickApplySubmit = async (e) => {
    e.preventDefault();
    if (!quickApplyJob) return;

    setIsSubmittingApply(true);
    try {
      const jobId = quickApplyJob._id || quickApplyJob.id;
      const formData = new FormData();
      if (applyResume) formData.append("resume", applyResume);
      if (applyNote) formData.append("coverLetter", applyNote);

      await axiosInstance.post(API_PATHS.APPLICATIONS.APPLY_FOR_JOB(jobId), formData);
      toast.success(`Application sent to ${quickApplyJob.company?.companyName || quickApplyJob.companyName || "Employer"}!`);
      setQuickApplyJob(null);
      setApplyResume(null);
      setApplyNote("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit quick application");
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // Filter & Search Logic
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchKeyword =
        !keyword ||
        j.title?.toLowerCase().includes(keyword.toLowerCase()) ||
        j.company?.companyName?.toLowerCase().includes(keyword.toLowerCase()) ||
        j.tags?.some((t) => t.toLowerCase().includes(keyword.toLowerCase()));

      const matchLocation =
        !location ||
        j.location?.toLowerCase().includes(location.toLowerCase());

      const matchCategory =
        !category ||
        j.category?.toLowerCase() === category.toLowerCase();

      const matchType =
        selectedTypes.length === 0 ||
        selectedTypes.some((t) => j.type?.toLowerCase().includes(t.toLowerCase()));

      const matchWorkModel =
        selectedWorkModels.length === 0 ||
        selectedWorkModels.some((m) =>
          j.workModel?.toLowerCase().includes(m.toLowerCase()) ||
          j.location?.toLowerCase().includes(m.toLowerCase())
        );

      const matchExp =
        selectedExperience.length === 0 ||
        selectedExperience.some((e) =>
          j.experienceLevel?.toLowerCase().includes(e.toLowerCase())
        );

      const matchSalary =
        !salaryFloor || (j.salaryMax || j.salaryMin || 0) >= salaryFloor;

      return (
        matchKeyword &&
        matchLocation &&
        matchCategory &&
        matchType &&
        matchWorkModel &&
        matchExp &&
        matchSalary
      );
    }).sort((a, b) => {
      if (sortBy === "salary") return (b.salaryMin || 0) - (a.salaryMin || 0);
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      // "Relevant" means AI match score when we have one, newest otherwise.
      const scoreA = matchScores[a._id || a.id]?.matchScore ?? -1;
      const scoreB = matchScores[b._id || b.id]?.matchScore ?? -1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [
    jobs,
    keyword,
    location,
    category,
    selectedTypes,
    selectedWorkModels,
    selectedExperience,
    salaryFloor,
    sortBy,
    matchScores,
  ]);

  // Paginated View
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1;
  const paginatedJobs = filteredJobs.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const clearAllFilters = () => {
    setKeyword("");
    setLocation("");
    setCategory("");
    setSelectedTypes([]);
    setSelectedWorkModels([]);
    setSelectedExperience([]);
    setSalaryFloor(0);
    setPage(1);
    toast.success("Filters reset");
  };

  const activeFiltersCount =
    (keyword ? 1 : 0) +
    (location ? 1 : 0) +
    (category ? 1 : 0) +
    selectedTypes.length +
    selectedWorkModels.length +
    selectedExperience.length +
    (salaryFloor > 0 ? 1 : 0);

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO SEARCH DOCK SECTION ================= */}
        <section className="w-full bg-gradient-to-b from-[#f4f0ff] via-surface to-surface pt-space-lg pb-space-xl dark:from-[#151d33]">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {/* Search Hero Card Dock */}
            <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#5927c7] via-[#8c4ed8] to-[#b982e8] px-space-md py-space-lg shadow-[0_24px_60px_rgba(99,52,180,0.28)] md:px-10 md:py-10">
              {/* Decorative forms inspired by the reference card */}
              <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full border-[28px] border-[#d6a6f5]/60 shadow-[-18px_18px_0_0_rgba(116,46,190,0.25)] pointer-events-none" />
              <div className="absolute right-20 top-[-8rem] h-56 w-56 rounded-full bg-[#7e3ed1]/70 blur-sm pointer-events-none" />
              <div className="absolute -bottom-20 left-[45%] h-36 w-36 rotate-45 rounded-[2rem] bg-[#d090ee]/40 pointer-events-none" />
              <div className="absolute bottom-[-3.5rem] right-[15%] h-40 w-20 -rotate-6 rounded-t-xl bg-gradient-to-b from-[#ffd99f] to-[#ed8a89]/80 opacity-90 pointer-events-none" />
              <div className="absolute bottom-[-3.5rem] right-[28%] h-32 w-20 rotate-2 rounded-t-xl bg-gradient-to-b from-[#a8f0dc] to-[#80bde1]/80 opacity-90 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_25%,rgba(255,255,255,0.17),transparent_26%)] pointer-events-none" />

              <div className="relative z-10">
                <div className="flex flex-col gap-space-md lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-space-sm inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 font-label-caps font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      Verified opportunities across every industry
                    </div>
                    <h1 className="font-headline-xl text-headline-xl tracking-tight text-white">
                      Find Your Next Opportunity
                    </h1>
                    <p className="mt-2 max-w-2xl font-body-lg text-body-lg leading-relaxed text-white/85">
                      Discover opportunities that match your skills and ambitions.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                    <div className="flex -space-x-2">
                      {["A", "K", "M"].map((initial, index) => (
                        <span key={initial} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#a963df] text-[11px] font-bold ${index === 0 ? "bg-[#ffd89e] text-[#6331b9]" : index === 1 ? "bg-[#99e7d5] text-[#4a1d8d]" : "bg-white text-[#6430b6]"}`}>
                          {initial}
                        </span>
                      ))}
                    </div>
                    <span className="font-label-md font-semibold leading-tight">Join thousands of<br />job seekers</span>
                  </div>
                </div>

                {/* Advanced Search Bar Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                  }}
                  className="mt-space-lg flex flex-col items-stretch gap-2 rounded-2xl border border-white/20 bg-white/15 p-2.5 shadow-[0_12px_30px_rgba(55,20,120,0.22)] backdrop-blur-md lg:flex-row"
                >
                  {/* Keyword input */}
                  <div className="flex flex-1 items-center gap-space-sm rounded-xl bg-white px-space-md py-3 shadow-sm ring-1 ring-white/40 transition focus-within:ring-2 focus-within:ring-[#efe1ff]">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Job title, company, skill, or profession..."
                      className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none dark:text-slate-900 dark:placeholder:text-slate-500"
                    />
                  </div>

                  {/* Location input */}
                  <div className="flex flex-1 items-center gap-space-sm rounded-xl bg-white px-space-md py-3 shadow-sm ring-1 ring-white/40 transition focus-within:ring-2 focus-within:ring-[#efe1ff]">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      location_on
                    </span>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location (e.g. Remote, Accra, Kumasi)..."
                      className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none dark:text-slate-900 dark:placeholder:text-slate-500"
                    />
                  </div>

                  {/* Category Select */}
                  <div className="flex w-full items-center gap-space-xs rounded-xl bg-white px-space-md py-3 shadow-sm ring-1 ring-white/40 transition focus-within:ring-2 focus-within:ring-[#efe1ff] lg:w-56">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      category
                    </span>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                      aria-label="Job Category Filter"
                      className="w-full bg-transparent font-body-md text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option value="">All Disciplines</option>
                      <option value="technology">Technology &amp; Engineering</option>
                      <option value="healthcare">Healthcare &amp; Social Care</option>
                      <option value="education">Education &amp; Training</option>
                      <option value="business">Business &amp; Professional Services</option>
                      <option value="sales">Sales, Marketing &amp; Customer Service</option>
                      <option value="finance">Finance, Legal &amp; Administration</option>
                      <option value="construction">Construction, Manufacturing &amp; Trades</option>
                      <option value="hospitality">Hospitality, Retail &amp; Tourism</option>
                      <option value="transport">Transport &amp; Logistics</option>
                      <option value="government">Government, Nonprofit &amp; Community</option>
                    </select>
                  </div>

                  {/* Search CTA */}
                  <button
                    type="submit"
                    className="flex shrink-0 items-center justify-center gap-space-xs rounded-xl bg-[#2e136a] px-space-xl py-3 font-label-lg text-white shadow-md transition-all hover:bg-[#220c56] active:scale-[0.98]"
                  >
                    <span>Search Jobs</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </button>
                </form>

                {/* Trending Tags Row */}
                <div className="mt-space-md flex flex-wrap items-center gap-space-xs text-white/90">
                  <span className="mr-1 flex items-center gap-1 font-label-caps uppercase text-white/75">
                    <span className="material-symbols-outlined text-[16px] text-white">
                      trending_up
                    </span>
                    Trending:
                  </span>
                  {[
                    "Customer Service",
                    "Healthcare",
                    "Remote Ghana",
                    "Teaching",
                    "Sales Manager",
                    "Skilled Trades",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setKeyword(tag);
                        setPage(1);
                      }}
                      className="rounded-full border border-white/20 bg-white/12 px-space-sm py-1 font-label-md text-white transition-colors hover:bg-white hover:text-[#5927c7]"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= RESUME MATCHER BANNER CALLOUT ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin mb-space-lg w-full">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-[#dfe5f7] bg-gradient-to-r from-[#f9faff] via-[#f4f6ff] to-[#dee6ff] p-space-md shadow-[0_10px_28px_rgba(50,71,125,0.10)] dark:border-gray-800 dark:from-[#111a2b] dark:via-[#131d33] dark:to-[#1b2340] md:p-10">
            <div className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-[#a6b8ff]/25 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-7rem] left-[36%] h-40 w-40 rounded-full bg-[#d9c6ff]/25 blur-3xl" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-lg">
              <div className="flex max-w-3xl flex-col gap-space-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2e1bc5] to-[#4d29d5] px-3 py-1.5 font-label-caps uppercase tracking-wider text-white shadow-[0_4px_10px_rgba(54,37,205,0.18)]">
                    <span className="material-symbols-outlined text-[14px]">
                      auto_awesome
                    </span>
                    Powered by SPG AI Talent Matcher
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9fbf4] px-3 py-1.5 font-label-caps font-bold text-[#009c70] dark:bg-emerald-950/50 dark:text-emerald-300">
                    <span className="material-symbols-outlined text-[14px]">
                      verified
                    </span>
                    Instant Role Match
                  </span>
                </div>

                <h2 className="mt-2 font-headline-lg text-headline-lg font-bold tracking-tight text-[#14233c] dark:text-gray-100 md:text-[2rem] md:leading-[1.28]">
                  Upload your resume and find your perfect job.
                </h2>

                <p className="max-w-3xl font-body-lg leading-relaxed text-[#53627d] dark:text-gray-300">
                  Our intelligent parser matches your skills to high-paying roles
                  and salary estimates from Ghanaian employers and Ghana-based remote teams.
                </p>

                <div className="flex flex-wrap items-center gap-x-7 gap-y-3 pt-3 font-label-lg text-[#526078] dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      insights
                    </span>
                    <span>Skill Gap Analysis &amp; Salary Estimation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-salary-emerald">
                      lock
                    </span>
                    <span>Private &amp; Confidential</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-verified-badge">
                      bolt
                    </span>
                    <span>Instant Results in &lt; 10s</span>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone Widget */}
              <div className="flex w-full shrink-0 flex-col items-center gap-2 lg:w-auto lg:items-end">
                <div
                  onClick={() => navigate("/resume-analyzer")}
                  className="group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.6rem] border-2 border-dashed border-[#b5abf4] bg-white/90 p-5 text-center shadow-[0_8px_20px_rgba(63,52,144,0.10)] transition-all hover:border-primary hover:bg-white dark:border-indigo-400/40 dark:bg-gray-900/70 dark:hover:bg-gray-900 hover:shadow-[0_12px_28px_rgba(63,52,144,0.16)] sm:w-[31.5rem]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef1ff] text-primary transition-transform group-hover:scale-110 dark:bg-indigo-950">
                    <span className="material-symbols-outlined text-[26px]">
                      upload_file
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-headline-sm font-bold text-[#14233c] transition-colors group-hover:text-primary dark:text-gray-100">
                      Upload Resume (PDF, DOCX)
                    </span>
                    <span className="font-body-md text-[#8b9ab5] dark:text-gray-400">
                      Drag &amp; drop or click to scan
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#2f1bc9] to-[#4430db] py-3 font-label-lg font-bold text-white shadow-[0_5px_12px_rgba(52,37,205,0.24)] transition hover:brightness-110"
                  >
                    <span>Analyze with SPG AI</span>
                    <span className=" text-[16px]">
                      {/* sparkles */}
                    </span>
                  </button>
                </div>
                <span className="font-label-caps text-text-muted">
                  Max file size: 10MB • No account required to scan
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= MAIN SPLIT LAYOUT (FILTERS + FEED) ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* ================= SIDEBAR: FILTERS (col-span-3) ================= */}
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-space-md lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-3xl border border-[#e9ddfb] bg-surface-card shadow-[0_16px_38px_rgba(79,43,139,0.10)] dark:border-gray-800 dark:shadow-[0_16px_38px_rgba(0,0,0,0.38)]">
                {/* Filter Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#5120ae] to-[#9c55dc] p-space-md text-white">
                  <div className="absolute -right-7 -top-9 h-24 w-24 rounded-full border-[14px] border-white/20" />
                  <div className="flex items-center gap-space-xs">
                    <span className="relative material-symbols-outlined text-[21px]">
                      tune
                    </span>
                    <h2 className="relative font-headline-sm font-bold">
                      Filter Jobs
                    </h2>
                    {activeFiltersCount > 0 && (
                      <span className="relative rounded-full bg-white/20 px-2 py-0.5 font-label-caps font-bold text-white">
                        {activeFiltersCount} active
                      </span>
                    )}
                  </div>
                  <p className="relative mt-1 font-body-sm text-white/75">Fine-tune the roles that fit your next move.</p>
                </div>
                <div className="flex flex-col gap-space-md p-space-md">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-text-secondary">Your preferences</span>
                  <button
                    onClick={clearAllFilters}
                    type="button"
                    className="rounded-lg px-2 py-1 font-label-md text-primary transition hover:bg-brand-indigo-light hover:text-brand-indigo-dark"
                  >
                    Reset all
                  </button>
                </div>

                {/* Job Type Checkboxes */}
                <div className="rounded-2xl bg-[#faf8ff] p-3 dark:bg-gray-800/40">
                  <span className="mb-2 flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-text-muted">
                    <span className="material-symbols-outlined text-[16px] text-primary">work</span>
                    Job type
                  </span>
                  <div className="flex flex-wrap gap-2">
                  {["Full-Time", "Part-Time", "Contract", "Internship", "Remote"].map(
                    (type) => (
                      <label
                        key={type}
                        className={`cursor-pointer rounded-xl border px-2.5 py-2 transition-all ${selectedTypes.includes(type) ? "border-primary bg-brand-indigo-light text-primary shadow-sm" : "border-transparent bg-white text-text-secondary hover:border-[#dfd0f7] dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={selectedTypes.includes(type)}
                            onChange={() => {
                              setSelectedTypes((prev) =>
                                prev.includes(type)
                                  ? prev.filter((t) => t !== type)
                                  : [...prev, type]
                              );
                              setPage(1);
                            }}
                            className="sr-only"
                          />
                          <span className="font-label-md font-semibold">
                            {type}
                          </span>
                        </div>
                      </label>
                    )
                  )}
                  </div>
                </div>

                {/* Work Model Checkboxes */}
                <div className="border-t border-border-default pt-space-md">
                  <span className="mb-2 flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-text-muted">
                    <span className="material-symbols-outlined text-[16px] text-primary">home_work</span>
                    Work model
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                  {["Hybrid", "On-site", "Remote"].map((model) => (
                    <label
                      key={model}
                      className={`cursor-pointer rounded-xl border px-1.5 py-2 text-center transition-all ${selectedWorkModels.includes(model) ? "border-primary bg-primary text-white shadow-sm dark:bg-indigo-500 dark:border-indigo-400" : "border-border-default bg-white text-text-secondary hover:border-primary/40 dark:bg-gray-900 dark:text-gray-300"}`}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={selectedWorkModels.includes(model)}
                          onChange={() => {
                            setSelectedWorkModels((prev) =>
                              prev.includes(model)
                                ? prev.filter((m) => m !== model)
                                : [...prev, model]
                            );
                            setPage(1);
                          }}
                          className="sr-only"
                        />
                        <span className="font-label-md font-semibold">
                          {model}
                        </span>
                      </div>
                    </label>
                  ))}
                  </div>
                </div>

                {/* Experience Level */}
                <div className="border-t border-border-default pt-space-md">
                  <span className="mb-2 flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-text-muted">
                    <span className="material-symbols-outlined text-[16px] text-primary">military_tech</span>
                    Experience level
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                  {["Entry-Level", "Mid-Level", "Senior", "Lead / Staff"].map(
                    (level) => (
                      <label
                        key={level}
                        className={`cursor-pointer rounded-xl border px-2.5 py-2 transition-all ${selectedExperience.includes(level) ? "border-primary bg-brand-indigo-light text-primary shadow-sm" : "border-border-default bg-white text-text-secondary hover:border-primary/40 dark:bg-gray-900 dark:text-gray-300"}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={selectedExperience.includes(level)}
                            onChange={() => {
                              setSelectedExperience((prev) =>
                                prev.includes(level)
                                  ? prev.filter((l) => l !== level)
                                  : [...prev, level]
                              );
                              setPage(1);
                            }}
                            className="sr-only"
                          />
                          <span className="font-label-md font-semibold">
                            {level}
                          </span>
                        </div>
                      </label>
                    )
                  )}
                  </div>
                </div>

                {/* Salary Floor Slider */}
                <div className="rounded-2xl bg-[#effaf5] p-3 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-text-muted">
                      <span className="material-symbols-outlined text-[16px] text-salary-emerald">payments</span>
                      Salary floor
                    </span>
                    <span className="font-numeric-metric text-salary-emerald text-sm">
                      GH₵ {(salaryFloor / 1000).toFixed(0)}k/mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="5000"
                    value={salaryFloor}
                    onChange={(e) => {
                      setSalaryFloor(Number(e.target.value));
                      setPage(1);
                    }}
                    className="mt-3 w-full cursor-pointer accent-[#6933c5]"
                  />
                  <div className="flex justify-between text-text-muted font-body-sm text-[11px]">
                    <span>GH₵ 0</span>
                    <span>GH₵ 100k+</span>
                  </div>
                </div>
              </div>
              </div>
            </aside>

            {/* ================= MAIN STREAM: JOB CARDS (col-span-9) ================= */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-space-md">
              {/* Prompt the one action that unlocks match scores on these cards */}
              {isAuthenticated && needsResumeAnalysis && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-brand-indigo-light border border-primary/20 rounded-2xl p-space-md">
                  <div className="flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-primary text-[22px] shrink-0">
                      auto_awesome
                    </span>
                    <div>
                      <p className="font-body-md font-bold text-primary">
                        See how well you match each role
                      </p>
                      <p className="font-body-sm text-text-secondary">
                        Analyse your resume once and every job here gets a match percentage.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/resume-analyzer"
                    className="shrink-0 px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold hover:bg-brand-indigo-dark transition-colors text-center"
                  >
                    Analyse my resume
                  </Link>
                </div>
              )}

              {/* Stream Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-card p-space-md rounded-2xl border border-border-default shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Showing {filteredJobs.length} Verified Roles
                  </span>
                  <span className="w-2 h-2 rounded-full bg-salary-emerald animate-pulse" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-label-md text-text-muted">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-surface-container text-on-surface font-label-md py-1.5 px-3 rounded-xl border border-border-default focus:outline-none cursor-pointer"
                  >
                    <option value="relevant">AI Match Relevance</option>
                    <option value="newest">Newest First</option>
                    <option value="salary">Highest Compensation</option>
                  </select>
                </div>
              </div>

              {/* Jobs Feed Grid */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-surface-card rounded-2xl border border-border-default shadow-xs">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="font-body-md text-text-muted">Loading verified jobs...</p>
                </div>
              ) : paginatedJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-surface-card rounded-2xl border border-border-default text-center px-4 shadow-xs">
                  <div className="w-16 h-16 rounded-2xl bg-brand-indigo-light text-primary flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[32px]">
                      work_off
                    </span>
                  </div>
                  <h3 className="font-headline-md font-bold text-on-surface">
                    No matching roles found
                  </h3>
                  <p className="font-body-md text-text-secondary max-w-md mt-1 mb-4">
                    Try broadening your search keywords, lowering the salary floor, or resetting the filters.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    type="button"
                    className="px-space-lg py-2.5 bg-primary-container text-on-primary font-label-md font-bold rounded-xl hover:bg-brand-indigo-dark shadow-sm transition-all"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-space-md">
                  {paginatedJobs.map((job) => {
                    const isSaved = savedJobIds.has(job._id);
                    const match = matchScores[job._id || job.id];
                    return (
                      <article
                        key={job._id}
                        className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm hover:shadow-md border border-border-default hover:border-primary/30 transition-all duration-200 relative group overflow-hidden"
                      >
                        <div className="flex flex-col md:flex-row items-start justify-between gap-space-md">
                          {/* Company Avatar & Role Header */}
                          <div className="flex items-start gap-space-md flex-1">
                            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden shrink-0 shadow-inner border border-border-default">
                              {job.companyLogo || job.company?.companyLogo ? (
                                <img
                                  src={job.companyLogo || job.company?.companyLogo}
                                  alt={job.companyName || job.company?.companyName || "Logo"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-primary text-[28px]">
                                  business
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-space-xs mb-1">
                                <span className="font-label-lg font-bold text-text-primary hover:text-primary transition-colors cursor-pointer">
                                  {job.companyName || job.company?.companyName || "Hiring Company"}
                                </span>
                                {job.companyProfile?.verified && (
                                  <span
                                    className="material-symbols-outlined text-verified-badge text-[18px]"
                                    title="Verified employer"
                                  >
                                    verified
                                  </span>
                                )}
                                <span className="text-text-muted">•</span>
                                <span className="font-body-sm text-text-muted">
                                  {job.workModel || "Hybrid"}
                                </span>
                                {job.isUrgent && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-caps font-bold animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                    Urgent
                                  </span>
                                )}
                              </div>

                              <Link
                                to={`/job/${job._id || job.id}`}
                                className="font-headline-md text-headline-md font-bold text-text-primary hover:text-primary transition-colors truncate block"
                              >
                                {job.title}
                              </Link>

                              {/* AI match score — only when we actually have one */}
                              {match && (
                                <div className="flex flex-wrap items-center gap-space-xs mt-1.5">
                                  <MatchBadge
                                    score={match.matchScore}
                                    verdict={match.verdict}
                                    size="sm"
                                  />
                                  {match.missingSkills?.length > 0 && (
                                    <span className="font-body-sm text-text-muted">
                                      Missing{" "}
                                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                                        {match.missingSkills.slice(0, 2).join(", ")}
                                      </span>
                                      {match.missingSkills.length > 2 &&
                                        ` +${match.missingSkills.length - 2}`}
                                    </span>
                                  )}
                                </div>
                              )}

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
                                {job.matchScore && (
                                  <span className="inline-flex items-center gap-1 text-salary-emerald font-semibold bg-salary-surface px-2 py-0.5 rounded-full text-[11px]">
                                    <span className="material-symbols-outlined text-[14px]">
                                      auto_awesome
                                    </span>
                                    {job.matchScore}% Match
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Top Right Save Bookmark button */}
                          <div className="flex items-center gap-space-xs self-end md:self-start">
                            <button
                              onClick={(e) => handleToggleSave(e, job._id || job.id)}
                              type="button"
                              title={isSaved ? "Saved" : "Save Job"}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                isSaved
                                  ? "bg-brand-indigo-light text-primary font-bold shadow-xs"
                                  : "bg-surface-container text-text-muted hover:text-primary hover:bg-brand-indigo-light"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                bookmark
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Skills and qualifications */}
                        {Array.isArray(job.tags) && job.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 my-space-md">
                            {job.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-on-surface-variant hover:bg-brand-indigo-light hover:text-primary transition-colors cursor-pointer"
                                onClick={() => {
                                  setKeyword(tag);
                                  setPage(1);
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Bottom Row: Salary & Action CTA */}
                        <div className="pt-space-sm border-t border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                          <div>
                            <span className="font-label-caps uppercase text-text-muted tracking-wider block">
                              Compensation Package
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="font-headline-sm font-bold text-salary-emerald">
                                {job.currency || "GH₵"}{" "}
                                {job.salaryMin
                                  ? `${Math.round(job.salaryMin / 1000)}k`
                                  : "Open"}
                                {job.salaryMax
                                  ? ` - ${Math.round(job.salaryMax / 1000)}k`
                                  : ""}
                              </span>
                              <span className="font-body-sm text-text-secondary">
                                / month (Verified)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-space-sm">
                            <button
                              onClick={() => setQuickApplyJob(job)}
                              type="button"
                              className="inline-flex items-center justify-center gap-1 px-space-md py-2.5 rounded-xl bg-brand-indigo-light text-primary hover:bg-brand-indigo-subtle font-label-md font-bold transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                bolt
                              </span>
                              <span>Quick Apply</span>
                            </button>

                            <Link
                              to={`/job/${job._id || job.id}`}
                              className="inline-flex items-center justify-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-primary-container hover:bg-brand-indigo-dark text-on-primary font-label-lg shadow-sm hover:shadow transition-all"
                            >
                              <span>View Details</span>
                              <span className="material-symbols-outlined text-[18px]">
                                arrow_forward
                              </span>
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-surface-card p-space-md rounded-2xl border border-border-default mt-space-md shadow-xs">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    type="button"
                    className="inline-flex items-center gap-1 px-space-md py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 font-label-md font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      chevron_left
                    </span>
                    Previous
                  </button>

                  <span className="font-label-md text-text-secondary">
                    Page <strong className="text-text-primary">{page}</strong> of{" "}
                    <strong>{totalPages}</strong>
                  </span>

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    type="button"
                    className="inline-flex items-center gap-1 px-space-md py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 font-label-md font-semibold transition-colors"
                  >
                    Next
                    <span className="material-symbols-outlined text-[18px]">
                      chevron_right
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ================= QUICK APPLY MODAL ================= */}
      {quickApplyJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-card rounded-2xl max-w-lg w-full p-space-lg shadow-2xl border border-border-default relative">
            <button
              onClick={() => setQuickApplyJob(null)}
              type="button"
              className="absolute top-4 right-4 text-text-muted hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">bolt</span>
              </div>
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Quick Apply
                </h3>
                <p className="font-body-sm text-text-secondary truncate max-w-xs">
                  {quickApplyJob.title} • {quickApplyJob.company?.companyName}
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickApplySubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps uppercase text-text-muted">
                  Attach CV / Resume (PDF, DOCX)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  required
                  onChange={(e) => setApplyResume(e.target.files[0])}
                  className="font-body-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-indigo-light file:text-primary hover:file:bg-brand-indigo-subtle cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps uppercase text-text-muted">
                  Personal Intro or Portfolio Link
                </label>
                <textarea
                  rows="3"
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="Share your GitHub, LinkedIn, or a brief note explaining why you're a great fit..."
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickApplyJob(null)}
                  className="px-4 py-2.5 rounded-xl font-label-md text-text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="px-space-lg py-2.5 rounded-xl bg-primary-container text-on-primary font-label-md font-bold hover:bg-brand-indigo-dark shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingApply ? "Submitting..." : "Send Application"}
                  <span className="material-symbols-outlined text-[16px]">
                    send
                  </span>
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

export default FindJobs;
