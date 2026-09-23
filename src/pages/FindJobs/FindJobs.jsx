import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useAuth } from "../../context/AuthContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import ApplyDrawer from "../../components/apply/ApplyDrawer";
import { useAppliedJobs } from "../../hooks/useAppliedJobs";
import { useJobSearch } from "../../hooks/useJobSearch";
import SearchBox from "./components/SearchBox";
import SearchFilterRail from "./components/SearchFilterRail";
import JobResultCard from "./components/JobResultCard";

import toast from "react-hot-toast";

/**
 * Find Jobs.
 *
 * Searching happens on the server (see backend/services/jobSearchService), so
 * this page holds no job list to filter and no ranking of its own — it renders
 * what the search returned and sends back what the candidate changed. Every
 * piece of search state lives in the URL, which is what makes a search
 * shareable and survivable across a refresh.
 */

/** Stable empty values, so signing out does not hand the cards a new object. */
const EMPTY_SET = new Set();
const EMPTY_SCORES = {};

const SORT_OPTIONS = [
  { key: "relevance", label: "Best match" },
  { key: "match", label: "My AI match score", requiresAuth: true },
  { key: "newest", label: "Newest first" },
  { key: "salary", label: "Highest paying" },
];

const TRENDING = [
  "Customer Service",
  "Registered Nurse",
  "Remote in Ghana",
  "Teaching",
  "Sales Manager",
  "Software Engineer",
];

/**
 * Which URL parameter each relaxable filter lives in, so the empty state can
 * offer to drop it. The names on the left are what the search service calls
 * them when it reports what is costing the candidate their results.
 */
const RELAXATION = {
  query: { param: "q", label: "your search words" },
  location: { param: "location", label: "the location" },
  workModels: { param: "workModel", label: "the work model" },
  employmentTypes: { param: "type", label: "the employment type" },
  seniority: { param: "experienceLevel", label: "the experience level" },
  education: { param: "education", label: "the qualification" },
  industries: { param: "industry", label: "the industry" },
  companyStages: { param: "companyStage", label: "the company stage" },
  skills: { param: "skills", label: "the skills" },
  company: { param: "company", label: "the company" },
  salaryMin: { param: "salaryMin", label: "the salary floor" },
  salaryMax: { param: "salaryMax", label: "the salary ceiling" },
  datePosted: { param: "datePosted", label: "the date posted" },
  verifiedOnly: { param: "verified", label: "verified employers only" },
};

const FindJobs = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const canApply = user?.role === "jobseeker";

  const {
    draft,
    setDraft,
    locationDraft,
    setLocationDraft,
    sort,
    page,
    filters,
    searchParams,
    results,
    isLoading,
    isRefreshing,
    error,
    activeFilterCount,
    commit,
    toggleListValue,
    clearAll,
    readList,
  } = useJobSearch();

  const [fetchedSavedJobIds, setSavedJobIds] = useState(EMPTY_SET);
  const [rawMatchScores, setMatchScores] = useState({});
  const [needsResumeAnalysis, setNeedsResumeAnalysis] = useState(false);

  const [applyJob, setApplyJob] = useState(null);

  //   An account can only apply once per job; show that on the card.
  const { hasApplied, markApplied } = useAppliedJobs();

  const companyFilterName = searchParams.get("companyName") || "";
  const companyFilter = searchParams.get("company") || "";

  //   Saved jobs are the candidate's, so they are loaded once per session
  //   rather than with every search.
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;
    axiosInstance
      .get(API_PATHS.JOBS.GET_SAVED_JOBS)
      .then((response) => {
        if (cancelled || !Array.isArray(response.data)) return;
        setSavedJobIds(new Set(response.data.map((item) => item.job?._id || item.job)));
      })
      .catch(() => {
        // Bookmarks are not essential to browsing.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /**
   * AI match scores for the signed-in candidate, merged onto the cards. Kept
   * separate from the search request so a slow or rate-limited scoring call
   * never delays the results — badges appear when they are ready.
   */
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;
    axiosInstance
      .get(API_PATHS.AI.GET_JOB_MATCHES, { params: { limit: 40 } })
      .then((response) => {
        if (cancelled) return;
        if (response.data?.needsProfile) {
          setNeedsResumeAnalysis(true);
          return;
        }
        const scores = {};
        for (const match of response.data?.matches || []) {
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

  //   Bookmarks and match scores both belong to the signed-in candidate, so a
  //   sign-out must not leave the previous session's state on the cards.
  //   Derived rather than cleared in an effect, which keeps sign-out to a
  //   single render.
  const savedJobIds = isAuthenticated ? fetchedSavedJobIds : EMPTY_SET;
  const matchScores = isAuthenticated ? rawMatchScores : EMPTY_SCORES;

  const handleToggleSave = async (event, jobId) => {
    event.stopPropagation();
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
      toast.error("Could not update your bookmarks. Please try again.");
    }
  };

  const handleQuickApplySubmit = async (event) => {
    event.preventDefault();
    if (!quickApplyJob) return;

    if (!canApply) {
      toast.error("Only jobseekers can apply for jobs.");
      setQuickApplyJob(null);
      return;
    }

    setIsSubmittingApply(true);
    try {
      if (!resumeChoice.url && !resumeChoice.file) {
        toast.error("Please attach a resume or pick one you have already uploaded.");
        setIsSubmittingApply(false);
        return;
      }

      const jobId = quickApplyJob._id || quickApplyJob.id;
      const formData = new FormData();
      // A saved file travels as its URL; a fresh one as the file itself.
      formData.append("resume", resumeChoice.file || resumeChoice.url);
      if (coverChoice.file || coverChoice.url) {
        formData.append("coverLetterFile", coverChoice.file || coverChoice.url);
      }
      if (applyNote) formData.append("coverLetter", applyNote);

      await axiosInstance.post(API_PATHS.APPLICATIONS.APPLY_FOR_JOB(jobId), formData);
      toast.success(
        `Application sent to ${quickApplyJob.companyName || quickApplyJob.company?.companyName || "Employer"}!`
      );
      markApplied(jobId);
      setQuickApplyJob(null);
      setResumeAttachment(emptyAttachment);
      setCoverAttachment(emptyAttachment);
      setApplyNote("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit quick application");
    } finally {
      setIsSubmittingApply(false);
    }
  };

  const clearCompanyFilter = useCallback(() => {
    commit({ company: null, companyName: null });
  }, [commit]);

  //   The engine's reading of the query — the filters it inferred, the
  //   spellings it corrected, the titles it expanded into — is applied on the
  //   server and deliberately not shown. Only the results of it are.
  const { jobs, total, pages, facets, relaxations } = results;

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO SEARCH DOCK ================= */}
        <section className="w-full bg-gradient-to-b from-[#f4f0ff] via-surface to-surface pt-space-lg pb-space-xl dark:from-[#151d33]">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#5927c7] via-[#8c4ed8] to-[#b982e8] px-space-md py-space-lg shadow-[0_24px_60px_rgba(99,52,180,0.28)] md:px-10 md:py-10">
              <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full border-[28px] border-[#d6a6f5]/60 shadow-[-18px_18px_0_0_rgba(116,46,190,0.25)] pointer-events-none" />
              <div className="absolute right-20 top-[-8rem] h-56 w-56 rounded-full bg-[#7e3ed1]/70 blur-sm pointer-events-none" />
              <div className="absolute -bottom-20 left-[45%] h-36 w-36 rotate-45 rounded-[2rem] bg-[#d090ee]/40 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_25%,rgba(255,255,255,0.17),transparent_26%)] pointer-events-none" />

              <div className="relative z-10">
                <div className="max-w-3xl">
                  <div className="mb-space-sm inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 font-label-caps font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    Search the way you would ask a person
                  </div>
                  <h1 className="font-headline-xl text-headline-xl tracking-tight text-white">
                    Find Your Next Opportunity
                  </h1>
                  <p className="mt-2 max-w-2xl font-body-lg text-body-lg leading-relaxed text-white/85">
                    Describe the role you want — the place, the pay, the level, the kind of
                    company. We read the sentence and do the rest.
                  </p>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    commit({ q: draft });
                  }}
                  className="mt-space-lg flex flex-col items-stretch gap-2 rounded-2xl border border-white/20 bg-white/15 p-2.5 shadow-[0_12px_30px_rgba(55,20,120,0.22)] backdrop-blur-md lg:flex-row"
                >
                  <SearchBox
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => commit({ q: draft })}
                  />

                  <div className="flex w-full items-center gap-space-sm rounded-xl bg-white px-space-md py-3 shadow-sm ring-1 ring-white/40 transition focus-within:ring-2 focus-within:ring-[#efe1ff] lg:w-64">
                    <span className="material-symbols-outlined text-primary text-[22px]">location_on</span>
                    <input
                      type="text"
                      value={locationDraft}
                      onChange={(event) => setLocationDraft(event.target.value)}
                      placeholder="Anywhere in Ghana"
                      aria-label="Location"
                      className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none dark:text-slate-900 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex shrink-0 items-center justify-center gap-space-xs rounded-xl bg-[#2e136a] px-space-xl py-3 font-label-lg text-white shadow-md transition-all hover:bg-[#220c56] active:scale-[0.98] cursor-pointer"
                  >
                    <span>Search</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </form>

                <div className="mt-space-md flex flex-wrap items-center gap-space-xs text-white/90">
                  <span className="mr-1 flex items-center gap-1 font-label-caps uppercase text-white/75">
                    <span className="material-symbols-outlined text-[16px] text-white">trending_up</span>
                    Trending:
                  </span>
                  {TRENDING.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setDraft(tag);
                        commit({ q: tag });
                      }}
                      className="rounded-full border border-white/20 bg-white/12 px-space-sm py-1 font-label-md text-white transition-colors hover:bg-white hover:text-[#5927c7] cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= RESULTS ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-space-md lg:sticky lg:top-24">
              <SearchFilterRail
                facets={facets}
                filters={filters}
                activeFilterCount={activeFilterCount}
                onToggle={toggleListValue}
                onCommit={commit}
                onClear={clearAll}
                readList={readList}
              />
            </aside>

            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-space-md">
              {isAuthenticated && needsResumeAnalysis && (
                <div className="flex flex-col justify-between gap-space-sm rounded-2xl border border-primary/20 bg-brand-indigo-light p-space-md sm:flex-row sm:items-center">
                  <div className="flex items-start gap-space-sm">
                    <span className="material-symbols-outlined shrink-0 text-[22px] text-primary">auto_awesome</span>
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
                    className="shrink-0 rounded-xl bg-primary px-space-md py-2.5 text-center font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark"
                  >
                    Analyse my resume
                  </Link>
                </div>
              )}

              {/* Stream header */}
              <div className="flex flex-col justify-between gap-space-sm rounded-2xl border border-border-default bg-surface-card p-space-md shadow-xs sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {isLoading ? "Searching…" : `${total} ${total === 1 ? "role" : "roles"} found`}
                  </span>
                  {!isLoading && total > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-salary-emerald" />}
                  {isRefreshing && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  )}
                  {companyFilter && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-indigo-light px-space-sm py-1 font-label-md font-bold text-primary">
                      <span className="material-symbols-outlined text-[16px]">business</span>
                      <span className="max-w-[16rem] truncate">{companyFilterName || "Selected company"}</span>
                      <button
                        type="button"
                        onClick={clearCompanyFilter}
                        aria-label="Show roles from all companies"
                        className="text-primary hover:text-brand-indigo-dark cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="job-sort" className="font-label-md text-text-muted">Sort by:</label>
                  <select
                    id="job-sort"
                    value={sort}
                    onChange={(event) => commit({ sort: event.target.value })}
                    className="cursor-pointer rounded-xl border border-border-default bg-surface-container px-3 py-1.5 font-label-md text-on-surface focus:outline-none"
                  >
                    {SORT_OPTIONS.filter((option) => !option.requiresAuth || isAuthenticated).map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Results */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-surface-card py-24 shadow-xs">
                  <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="font-body-md text-text-muted">Searching verified jobs…</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-surface-card px-4 py-20 text-center shadow-xs">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-container text-on-error-container">
                    <span className="material-symbols-outlined text-[32px]">error</span>
                  </div>
                  <h3 className="font-headline-md font-bold text-on-surface">Search is unavailable</h3>
                  <p className="mt-1 max-w-md font-body-md text-text-secondary">{error}</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-surface-card px-4 py-16 text-center shadow-xs">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-indigo-light text-primary">
                    <span className="material-symbols-outlined text-[32px]">work_off</span>
                  </div>
                  <h3 className="font-headline-md font-bold text-on-surface">No matching roles found</h3>

                  {relaxations.length > 0 ? (
                    <>
                      <p className="mt-1 mb-4 max-w-md font-body-md text-text-secondary">
                        One filter is doing the damage. Drop it and there are results waiting:
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {relaxations.slice(0, 4).map((relaxation) => {
                          const mapping = RELAXATION[relaxation.filter];
                          if (!mapping) return null;
                          return (
                            <button
                              key={relaxation.filter}
                              type="button"
                              onClick={() => {
                                if (mapping.param === "q") setDraft("");
                                commit({ [mapping.param]: null });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-brand-indigo-light px-space-md py-2 font-label-md font-bold text-primary transition-colors hover:bg-brand-indigo-subtle cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                              Drop {mapping.label}
                              <span className="rounded-full bg-white/70 px-1.5 font-numeric-metric text-[11px] dark:bg-black/30">
                                {relaxation.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 mb-4 max-w-md font-body-md text-text-secondary">
                      Try different words, or reset the filters and start again.
                    </p>
                  )}

                  <button
                    onClick={clearAll}
                    type="button"
                    className="mt-4 rounded-xl bg-primary-container px-space-lg py-2.5 font-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-brand-indigo-dark cursor-pointer"
                  >
                    Reset everything
                  </button>
                </div>
              ) : (
                <div className={`flex flex-col gap-space-md transition-opacity ${isRefreshing ? "opacity-60" : ""}`}>
                  {jobs.map((job) => (
                    <JobResultCard
                      key={job._id || job.id}
                      job={job}
                      isSaved={savedJobIds.has(job._id || job.id)}
                      match={matchScores[job._id || job.id]}
                      canApply={canApply}
                      hasApplied={canApply && hasApplied(job._id || job.id)}
                      onToggleSave={handleToggleSave}
                      onApply={setApplyJob}
                      onSkillClick={(skill) => toggleListValue("skills", skill)}
                    />
                  ))}
                </div>
              )}

              {pages > 1 && !isLoading && (
                <div className="mt-space-md flex items-center justify-between rounded-2xl border border-border-default bg-surface-card p-space-md shadow-xs">
                  <button
                    disabled={page <= 1}
                    onClick={() => commit({ page: page - 1 }, { resetPage: false })}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl bg-surface-container px-space-md py-2 font-label-md font-semibold transition-colors hover:bg-surface-container-high disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    Previous
                  </button>

                  <span className="font-label-md text-text-secondary">
                    Page <strong className="text-text-primary">{page}</strong> of <strong>{pages}</strong>
                  </span>

                  <button
                    disabled={page >= pages}
                    onClick={() => commit({ page: page + 1 }, { resetPage: false })}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl bg-surface-container px-space-md py-2 font-label-md font-semibold transition-colors hover:bg-surface-container-high disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {applyJob && canApply && (
        <ApplyDrawer
          job={applyJob}
          onClose={() => setApplyJob(null)}
          onApplied={markApplied}
        />
      )}

      <Footer />
    </div>
  );
};

export default FindJobs;
