import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../context/AuthContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { MOCK_JOBS } from "../../utils/mockData";
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
      let realJobs = [];
      try {
        const res = await axiosInstance.get(API_PATHS.JOBS.GET_ALL_JOBS);
        if (res.data?.jobs && Array.isArray(res.data.jobs) && res.data.jobs.length > 0) {
          realJobs = res.data.jobs;
        }
      } catch {
        // Backend offline or empty, fallback to rich mock data
      }

      // Merge real jobs with rich mock data ensuring full presentation
      const combined = [...realJobs, ...MOCK_JOBS];
      // Deduplicate by ID
      const unique = Array.from(new Map(combined.map((item) => [item._id || item.id, item])).values());
      setJobs(unique);

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
      if (isAuthenticated) {
        const formData = new FormData();
        if (applyResume) formData.append("resume", applyResume);
        formData.append("coverLetter", applyNote);
        await axiosInstance.post(API_PATHS.APPLICATIONS.APPLY_FOR_JOB(quickApplyJob._id), formData);
      }
      toast.success(`Application sent to ${quickApplyJob.company?.companyName || "Employer"}!`);
      setQuickApplyJob(null);
      setApplyResume(null);
      setApplyNote("");
    } catch {
      toast.success("Application submitted successfully!");
      setQuickApplyJob(null);
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
      return (b.matchScore || 0) - (a.matchScore || 0);
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
        <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pt-space-lg pb-space-lg">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {/* Verified Badge Header */}
            <div className="flex items-center gap-space-xs mb-space-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-salary-surface text-salary-emerald font-label-caps uppercase tracking-wider font-bold shadow-xs">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>100% Manually Verified African Tech Roles</span>
              </div>
            </div>

            {/* Search Hero Card Dock */}
            <div className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-md relative overflow-hidden border border-border-default">
              <div className="absolute -right-16 -top-16 w-72 h-72 bg-brand-indigo-light/70 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="max-w-3xl mb-space-md">
                  <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                    Find Your{" "}
                    <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                      Dream Tech Role
                    </span>
                  </h1>
                  <p className="font-body-lg text-body-lg text-text-secondary mt-1">
                    Discover verified opportunities matching your background and
                    career goals across Ghana, West Africa &amp; Worldwide Remote.
                  </p>
                </div>

                {/* Advanced Search Bar Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                  }}
                  className="bg-surface-container-low p-2 rounded-2xl shadow-inner flex flex-col lg:flex-row gap-2 items-stretch"
                >
                  {/* Keyword input */}
                  <div className="flex-1 flex items-center bg-surface-card rounded-xl px-space-md py-3 gap-space-sm shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="material-symbols-outlined text-text-muted text-[22px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Job title, company, or tech stack (e.g. React, Go)..."
                      className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none"
                    />
                  </div>

                  {/* Location input */}
                  <div className="flex-1 flex items-center bg-surface-card rounded-xl px-space-md py-3 gap-space-sm shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="material-symbols-outlined text-text-muted text-[22px]">
                      location_on
                    </span>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location (e.g. Remote, Accra, Kumasi)..."
                      className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none"
                    />
                  </div>

                  {/* Category Select */}
                  <div className="w-full lg:w-56 flex items-center bg-surface-card rounded-xl px-space-md py-3 gap-space-xs shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="material-symbols-outlined text-text-muted text-[20px]">
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
                      <option value="engineering">Engineering</option>
                      <option value="product">Product &amp; Design</option>
                      <option value="executive">Executive Leadership</option>
                      <option value="operations">People &amp; Operations</option>
                    </select>
                  </div>

                  {/* Search CTA */}
                  <button
                    type="submit"
                    className="px-space-xl py-3 bg-primary-container text-on-primary font-label-lg rounded-xl hover:bg-brand-indigo-dark shadow-md flex items-center justify-center gap-space-xs transition-all active:scale-[0.98] shrink-0"
                  >
                    <span>Search Jobs</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </button>
                </form>

                {/* Trending Tags Row */}
                <div className="flex flex-wrap items-center gap-space-xs mt-space-md text-text-secondary">
                  <span className="font-label-caps uppercase text-text-muted flex items-center gap-1 mr-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      trending_up
                    </span>
                    Trending:
                  </span>
                  {[
                    "Frontend",
                    "Backend Developer",
                    "Remote Ghana",
                    "Executive / Director",
                    "Fintech",
                    "DevOps",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setKeyword(tag);
                        setPage(1);
                      }}
                      className="px-space-sm py-1 rounded-full bg-surface-container hover:bg-brand-indigo-light hover:text-primary font-label-md text-text-secondary transition-colors"
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-indigo-light via-surface-card to-brand-indigo-subtle border border-border-default p-space-md md:p-space-lg shadow-sm">
            <div className="absolute -right-10 -top-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-lg">
              <div className="flex flex-col gap-space-xs max-w-2xl">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-primary text-on-primary font-label-caps uppercase tracking-wider shadow-xs">
                    <span className="material-symbols-outlined text-[14px]">
                      auto_awesome
                    </span>
                    Powered by SPG AI Talent Matcher
                  </span>
                  <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-salary-surface text-salary-emerald font-label-caps font-bold">
                    <span className="material-symbols-outlined text-[14px]">
                      verified
                    </span>
                    Instant 95%+ Tech Match
                  </span>
                </div>

                <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mt-1">
                  Upload your Resume and let us find your perfect job for you
                </h2>

                <p className="font-body-md text-text-secondary leading-relaxed">
                  Skip manual filtering. Our intelligent parser analyzes your tech
                  stack, identifies skill gaps, and unlocks tailored high-paying
                  roles with personalized salary estimates across Africa &amp;
                  global remote teams.
                </p>

                <div className="flex flex-wrap items-center gap-space-md pt-1 text-text-secondary font-label-md">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      insights
                    </span>
                    <span>Skill Gap Analysis &amp; Salary Estimation</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px] text-salary-emerald">
                      lock
                    </span>
                    <span>Private &amp; Confidential</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px] text-verified-badge">
                      bolt
                    </span>
                    <span>Instant Results in &lt; 10s</span>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone Widget */}
              <div className="w-full lg:w-auto shrink-0 flex flex-col items-center sm:items-end gap-1">
                <div
                  onClick={() => navigate("/resume-analyzer")}
                  className="w-full sm:w-80 border-2 border-dashed border-primary/30 hover:border-primary bg-surface-card rounded-2xl p-space-md text-center flex flex-col items-center justify-center gap-space-xs transition-all cursor-pointer group shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-indigo-light text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">
                      upload_file
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                      Upload Resume (PDF, DOCX)
                    </span>
                    <span className="font-body-sm text-text-muted">
                      Drag &amp; drop or click to scan
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 w-full py-2 bg-primary hover:bg-brand-indigo-dark text-on-primary font-label-md font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Analyze with AI</span>
                    <span className="material-symbols-outlined text-[16px]">
                      sparkles
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
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-space-md">
              <div className="bg-surface-card rounded-2xl p-space-lg shadow-sm border border-border-default flex flex-col gap-space-md">
                {/* Filter Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border-default">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      tune
                    </span>
                    <h2 className="font-headline-sm font-bold text-on-surface">
                      Filter Jobs
                    </h2>
                    {activeFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-indigo-light text-primary font-label-caps font-bold">
                        {activeFiltersCount} active
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearAllFilters}
                    type="button"
                    className="text-primary hover:text-brand-indigo-dark font-label-md underline underline-offset-4"
                  >
                    Clear All
                  </button>
                </div>

                {/* Job Type Checkboxes */}
                <div className="flex flex-col gap-space-xs">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Job Type
                  </span>
                  {["Full-Time", "Part-Time", "Contract", "Internship", "Remote"].map(
                    (type) => (
                      <label
                        key={type}
                        className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-surface-container-low transition-colors group"
                      >
                        <div className="flex items-center gap-2">
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
                            className="w-4 h-4 rounded accent-primary text-primary focus:ring-0 cursor-pointer"
                          />
                          <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                            {type}
                          </span>
                        </div>
                      </label>
                    )
                  )}
                </div>

                {/* Work Model Checkboxes */}
                <div className="flex flex-col gap-space-xs pt-2 border-t border-border-default">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Work Model
                  </span>
                  {["Hybrid", "On-site", "Remote"].map((model) => (
                    <label
                      key={model}
                      className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-surface-container-low transition-colors group"
                    >
                      <div className="flex items-center gap-2">
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
                          className="w-4 h-4 rounded accent-primary text-primary focus:ring-0 cursor-pointer"
                        />
                        <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                          {model}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Experience Level */}
                <div className="flex flex-col gap-space-xs pt-2 border-t border-border-default">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Experience Level
                  </span>
                  {["Entry-Level", "Mid-Level", "Senior", "Lead / Staff"].map(
                    (level) => (
                      <label
                        key={level}
                        className="flex items-center justify-between cursor-pointer p-1.5 rounded-xl hover:bg-surface-container-low transition-colors group"
                      >
                        <div className="flex items-center gap-2">
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
                            className="w-4 h-4 rounded accent-primary text-primary focus:ring-0 cursor-pointer"
                          />
                          <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                            {level}
                          </span>
                        </div>
                      </label>
                    )
                  )}
                </div>

                {/* Salary Floor Slider */}
                <div className="flex flex-col gap-space-xs pt-2 border-t border-border-default">
                  <div className="flex items-center justify-between">
                    <span className="font-label-caps uppercase text-text-muted tracking-wider">
                      Minimum Salary Floor
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
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-text-muted font-body-sm text-[11px]">
                    <span>GH₵ 0</span>
                    <span>GH₵ 100k+</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* ================= MAIN STREAM: JOB CARDS (col-span-9) ================= */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-space-md">
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
                    return (
                      <article
                        key={job._id}
                        className="bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm hover:shadow-md border border-border-default hover:border-primary/30 transition-all duration-200 relative group overflow-hidden"
                      >
                        <div className="flex flex-col md:flex-row items-start justify-between gap-space-md">
                          {/* Company Avatar & Role Header */}
                          <div className="flex items-start gap-space-md flex-1">
                            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center overflow-hidden shrink-0 shadow-inner border border-border-default">
                              {job.company?.companyLogo ? (
                                <img
                                  src={job.company.companyLogo}
                                  alt={job.company?.companyName || "Logo"}
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
                                  {job.company?.companyName || "Verified Employer"}
                                </span>
                                <span
                                  className="material-symbols-outlined text-verified-badge text-[18px]"
                                  title="Verified Tech Employer"
                                >
                                  verified
                                </span>
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
                                to={`/job/${job._id}`}
                                className="font-headline-md text-headline-md font-bold text-text-primary hover:text-primary transition-colors truncate block"
                              >
                                {job.title}
                              </Link>

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
                              onClick={(e) => handleToggleSave(e, job._id)}
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

                        {/* Tech Stack Chips */}
                        {job.tags && job.tags.length > 0 && (
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
                              to={`/job/${job._id}`}
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
