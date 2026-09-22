import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

import ScoreRing from "../../components/ai/ScoreRing";
import { scoreStyle } from "../../components/ai/scoreUtils";
import ResumeUploadPanel from "./components/ResumeUploadPanel";
import AtsChecklist from "./components/AtsChecklist";
import MatchProfileEditor from "./components/MatchProfileEditor";
import JobMatchList from "./components/JobMatchList";
import {
  GrammarPanel,
  KeywordPanel,
  MissingSkillsPanel,
  QualityBreakdown,
  RedFlagsPanel,
  SuggestionsPanel,
} from "./components/AnalysisDetailPanels";

/**
 * AI resume analyzer and job matching page.
 *
 * Public: a guest can analyse a resume and see the full report, but nothing is
 * stored and no job matches are produced. Signed in: the analysis is saved, the
 * parsed profile feeds the matching engine, and every open role is scored.
 */
const TABS = [
  { id: "analysis", label: "Resume report", icon: "fact_check" },
  { id: "matches", label: "Job matches", icon: "join_inner" },
];

const ResumeAnalyzer = () => {
  const { isAuthenticated, user } = useAuth();

  const [activeTab, setActiveTab] = useState("analysis");
  const [analysis, setAnalysis] = useState(null);
  const [fileName, setFileName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [history, setHistory] = useState([]);

  const [matchProfile, setMatchProfile] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [matches, setMatches] = useState([]);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isRefreshingMatches, setIsRefreshingMatches] = useState(false);

  // --- Initial load -------------------------------------------------------

  useEffect(() => {
    axiosInstance
      .get(API_PATHS.AI.STATUS)
      .then((res) => setAiStatus(res.data))
      .catch(() => setAiStatus({ enabled: false }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // A previous analysis means the page is useful immediately on return.
    axiosInstance
      .get(API_PATHS.AI.GET_ANALYSIS)
      .then((res) => {
        if (res.data?.analysis) {
          setAnalysis(res.data.analysis);
          setFileName(res.data.analysis.fileName || "");
          setTargetRole(res.data.analysis.targetRole || "");
        }
      })
      .catch(() => {});

    axiosInstance
      .get(API_PATHS.AI.GET_MATCH_PROFILE)
      .then((res) => setMatchProfile(res.data?.profile || null))
      .catch(() => {});

    axiosInstance
      .get(API_PATHS.AI.GET_ANALYSIS_HISTORY)
      .then((res) => setHistory(res.data?.history || []))
      .catch(() => {});

    axiosInstance
      .get(API_PATHS.DOCUMENTS.GET_DOCUMENTS)
      .then((res) => setDocuments(res.data?.documents || []))
      .catch(() => {});
  }, [isAuthenticated]);

  // --- Matching -----------------------------------------------------------

  const loadMatches = useCallback(
    async ({ refresh = false } = {}) => {
      if (!isAuthenticated) return;

      refresh ? setIsRefreshingMatches(true) : setIsLoadingMatches(true);
      try {
        const res = await axiosInstance.get(API_PATHS.AI.GET_JOB_MATCHES, {
          params: { limit: 20, ...(refresh ? { refresh: "true" } : {}) },
        });
        setMatches(res.data?.matches || []);
        setNeedsProfile(Boolean(res.data?.needsProfile));
        if (refresh) toast.success("Matches rescored against your current profile");
      } catch (error) {
        const message = error.response?.data?.message || "Could not load your job matches";
        toast.error(message);
      } finally {
        refresh ? setIsRefreshingMatches(false) : setIsLoadingMatches(false);
      }
    },
    [isAuthenticated]
  );

  /**
   * Open the matches tab, scoring on first view.
   *
   * Deliberately driven by the click rather than by an effect watching the tab:
   * scoring is the expensive call, and loading it lazily on an explicit user
   * action is both cheaper and easier to reason about than a render-triggered
   * fetch.
   */
  const openMatchesTab = () => {
    setActiveTab("matches");
    if (isAuthenticated && matches.length === 0 && !needsProfile && !isLoadingMatches) {
      loadMatches();
    }
  };

  // --- Analysis -----------------------------------------------------------

  const handleAnalyze = async ({ file, resumeText, documentId, useSavedResume } = {}) => {
    setIsAnalyzing(true);
    const toastId = toast.loading("Reading your resume…");

    try {
      let response;

      if (file) {
        const formData = new FormData();
        formData.append("resume", file);
        if (targetRole) formData.append("targetRole", targetRole);

        response = await axiosInstance.post(API_PATHS.AI.ANALYZE_RESUME, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFileName(file.name);
      } else {
        const payload = { targetRole };
        if (resumeText) payload.resumeText = resumeText;
        if (documentId) payload.documentId = documentId;
        // An empty body makes the server fall back to the profile resume.
        if (useSavedResume) payload.resumeUrl = user?.resume || "";

        response = await axiosInstance.post(API_PATHS.AI.ANALYZE_RESUME, payload);
      }

      const result = response.data?.analysis;
      if (!result) throw new Error("The analysis came back empty");

      setAnalysis(result);
      setFileName(result.fileName || fileName);

      if (result.degraded) {
        toast.error(
          "Structural checks completed, but the AI review was unavailable. Try again shortly.",
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.success(`Analysis complete — overall score ${result.overallScore}/100`, { id: toastId });
      }

      // A new analysis replaces the profile snapshot, so cached matches are gone.
      if (isAuthenticated) {
        setMatches([]);
        setNeedsProfile(false);
        axiosInstance
          .get(API_PATHS.AI.GET_MATCH_PROFILE)
          .then((res) => setMatchProfile(res.data?.profile || null))
          .catch(() => {});
        axiosInstance
          .get(API_PATHS.AI.GET_ANALYSIS_HISTORY)
          .then((res) => setHistory(res.data?.history || []))
          .catch(() => {});
      }
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || "Could not analyse that resume";
      toast.error(message, { id: toastId, duration: 6000 });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveProfile = async (values) => {
    setIsSavingProfile(true);
    try {
      const res = await axiosInstance.put(API_PATHS.AI.UPDATE_MATCH_PROFILE, values);
      setMatchProfile(res.data?.profile || null);
      toast.success("Criteria saved — rescoring your matches");
      setMatches([]);
      if (activeTab === "matches") await loadMatches({ refresh: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save your criteria");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Derived ------------------------------------------------------------

  const overall = analysis?.overallScore ?? null;
  const previous = history.length > 1 ? history[1] : null;
  const delta = previous && overall !== null ? overall - previous.overallScore : null;

  return (
    <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
      <Navbar />

      <main className="w-full flex-1 pb-space-xl">
        {/* ================= HERO ================= */}
        <section className="w-full border-b border-border-default bg-surface py-space-lg">
          <div className="mx-auto max-w-[1280px] px-margin-mobile md:px-margin">
            <nav className="mb-space-sm flex items-center gap-space-xs font-label-md text-text-muted">
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                chevron_right
              </span>
              <span className="font-bold text-primary">AI Resume Analyzer &amp; Job Match</span>
            </nav>

            <div className="flex flex-col gap-space-sm">

              <h1 className="font-headline-xl text-headline-xl tracking-tight text-text-primary">
                AI Resume Analyzer &amp;{" "}
                <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                  Job Match
                </span>
              </h1>

              <p className="max-w-3xl font-body-lg text-body-lg leading-relaxed text-text-secondary">
                Get a real ATS score from 18 structural checks, a resume quality review, grammar
                corrections, and the skills you are missing — then see every open role scored against
                your profile on six weighted dimensions.
              </p>

              {/* Honest capability claims, not invented social proof. */}
              <div className="grid grid-cols-1 gap-space-md pt-space-sm sm:grid-cols-3">
                {[
                  {
                    icon: "checklist",
                    tone: "text-primary bg-brand-indigo-light",
                    metric: "18 checks",
                    label: "ATS structural rules",
                  },
                  {
                    icon: "balance",
                    tone: "text-salary-emerald bg-salary-surface",
                    metric: "6 dimensions",
                    label: "Weighted match scoring",
                  },
                  {
                    icon: "lock",
                    tone: "text-secondary bg-surface-container",
                    metric: "Nothing stored",
                    label: "When you are not signed in",
                  },
                ].map((stat) => (
                  <div
                    key={stat.metric}
                    className="flex items-center gap-space-sm rounded-2xl border border-border-default bg-surface-card p-3 shadow-xs"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}
                    >
                      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                        {stat.icon}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-numeric-metric text-text-primary">{stat.metric}</span>
                      <span className="font-body-sm text-text-muted">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {aiStatus && !aiStatus.enabled && (
          <div className="mx-auto mt-space-md max-w-[1280px] px-margin-mobile md:px-margin">
            <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-space-md font-body-md text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/25">
              <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
                warning
              </span>
              <span>
                The AI service is not configured on this server, so grammar checks and AI review are
                unavailable. Structural ATS scoring and rule-based job matching still work.
              </span>
            </p>
          </div>
        )}

        {/* ================= TABS ================= */}
        <section className="w-full pt-space-lg">
          <div className="mx-auto max-w-[1280px] px-margin-mobile md:px-margin">
            <div className="mb-space-md flex w-fit items-center gap-1 rounded-xl bg-surface-container p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => (tab.id === "matches" ? openMatchesTab() : setActiveTab(tab.id))}
                  className={`flex items-center gap-1.5 rounded-lg px-space-md py-2 font-label-md font-bold transition-colors ${
                    activeTab === tab.id
                      ? "bg-surface-card text-primary shadow-xs"
                      : "text-text-secondary hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {tab.icon}
                  </span>
                  {tab.label}
                  {tab.id === "matches" && matches.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 font-label-caps text-on-primary">
                      {matches.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ---------------- ANALYSIS TAB ---------------- */}
            {activeTab === "analysis" && (
              <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
                <div className="flex flex-col gap-space-md lg:col-span-5">
                  <ResumeUploadPanel
                    onAnalyze={handleAnalyze}
                    isAnalyzing={isAnalyzing}
                    isAuthenticated={isAuthenticated}
                    savedResumeUrl={user?.resume}
                    documents={documents}
                    targetRole={targetRole}
                    onTargetRoleChange={setTargetRole}
                    activeFileName={fileName}
                  />

                  {/* Score summary */}
                  {analysis && (
                    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
                      <div className="flex items-center justify-between gap-space-sm">
                        <div>
                          <h3 className="font-headline-sm font-bold text-text-primary">
                            Overall resume score
                          </h3>
                          <p className="font-body-sm text-text-muted">
                            45% ATS structure · 40% content quality · 15% writing
                          </p>
                        </div>
                        {delta !== null && delta !== 0 && (
                          <span
                            className={`shrink-0 rounded-lg px-2 py-1 font-label-md font-bold ${
                              delta > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                            }`}
                            title="Change since your previous analysis"
                          >
                            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-space-md rounded-2xl border border-primary/10 bg-gradient-to-br from-brand-indigo-light/70 to-surface-container-low p-space-md sm:flex-row">
                        <ScoreRing score={overall} size={118} label="Overall" />

                        <div className="flex w-full flex-col gap-space-sm">
                          {[
                            { label: "ATS compatibility", value: analysis.atsScore },
                            { label: "Content quality", value: analysis.quality?.score },
                            { label: "Grammar & spelling", value: analysis.grammar?.score },
                          ].map((row) => {
                            const value = row.value;
                            const rowStyle = scoreStyle(value);
                            return (
                              <div key={row.label} className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between">
                                  <span className="font-body-sm text-text-secondary">{row.label}</span>
                                  <span className={`font-label-md font-bold ${rowStyle.text}`}>
                                    {value ?? "n/a"}
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-white/80 shadow-inner dark:bg-white/10">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${rowStyle.bar}`}
                                    style={{
                                      width: `${value ?? 0}%`,
                                      transition: "width 800ms cubic-bezier(0.22,1,0.36,1)",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* What the parser actually read — the ground truth for
                          everything else on this page. */}
                      {analysis.profile && (
                        <div className="rounded-2xl border border-border-default bg-surface-container-low p-space-sm">
                          <span className="mb-1.5 block font-label-caps uppercase tracking-wider text-text-muted">
                            What we read from your resume
                          </span>

                          {/* Without the AI pass these fields were never
                              extracted. Printing "Not detected" would blame the
                              resume for our own failure, so say what happened. */}
                          {analysis.degraded && (
                            <p className="mb-space-sm flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 font-body-sm text-amber-900 dark:bg-amber-500/10">
                              <span
                                className="material-symbols-outlined text-[15px] shrink-0"
                                aria-hidden="true"
                              >
                                warning
                              </span>
                              <span>
                                The AI review did not run for this attempt, so these fields were not
                                extracted. Your ATS checks below are still accurate — re-run the
                                analysis to fill this in.
                              </span>
                            </p>
                          )}

                          <dl className="grid grid-cols-2 gap-x-space-md gap-y-1">
                            {[
                              { label: "Name", value: analysis.profile.fullName },
                              { label: "Email", value: analysis.profile.email },
                              { label: "Phone", value: analysis.profile.phone },
                              { label: "Location", value: analysis.profile.location },
                              {
                                label: "Experience",
                                value: analysis.profile.yearsOfExperience
                                  ? `${analysis.profile.yearsOfExperience} years`
                                  : "",
                              },
                              {
                                label: "Education",
                                value:
                                  analysis.profile.highestEducationLevel === "none"
                                    ? ""
                                    : analysis.profile.highestEducationLevel,
                              },
                            ].map((field) => {
                              const placeholder = analysis.degraded ? "Not checked" : "Not detected";
                              return (
                                <div key={field.label} className="min-w-0">
                                  <dt className="font-label-caps uppercase text-text-muted">
                                    {field.label}
                                  </dt>
                                  <dd
                                    className={`truncate font-body-sm ${
                                      field.value
                                        ? "text-text-primary"
                                        : analysis.degraded
                                          ? "text-text-muted"
                                          : "text-error"
                                    }`}
                                    title={field.value || placeholder}
                                  >
                                    {field.value || placeholder}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>

                          {analysis.profile.skills?.length > 0 && (
                            <div className="mt-space-sm border-t border-border-default pt-space-sm">
                              <span className="mb-1 block font-label-caps uppercase text-text-muted">
                                Skills detected ({analysis.profile.skills.length})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {analysis.profile.skills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-label-md font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-300"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!isAuthenticated && (
                        <div className="rounded-2xl border border-primary/20 bg-brand-indigo-light p-space-sm">
                          <p className="font-body-sm text-primary">
                            This report is not saved. Sign in to keep it, track your score over time,
                            and see your job matches.
                          </p>
                          <div className="mt-space-sm flex gap-space-sm">
                            <Link
                              to="/signup"
                              className="rounded-xl bg-primary px-space-md py-2 font-label-md font-bold text-on-primary"
                            >
                              Create account
                            </Link>
                            <Link
                              to="/login"
                              className="rounded-xl bg-surface-card px-space-md py-2 font-label-md font-bold text-primary"
                            >
                              Sign in
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isAuthenticated && analysis && (
                    <MatchProfileEditor
                      profile={matchProfile}
                      onSave={handleSaveProfile}
                      isSaving={isSavingProfile}
                    />
                  )}
                </div>

                {/* Right column — the report */}
                <div className="flex flex-col gap-space-md lg:col-span-7">
                  {!analysis && !isAnalyzing && (
                    <div className="rounded-3xl border border-dashed border-border-default bg-surface-card p-space-xl text-center">
                      <span
                        className="material-symbols-outlined text-[48px] text-text-muted"
                        aria-hidden="true"
                      >
                        description
                      </span>
                      <h3 className="mt-2 font-headline-sm font-bold text-text-primary">
                        Your report will appear here
                      </h3>
                      <p className="mx-auto mt-1 max-w-md font-body-sm text-text-muted">
                        Upload or paste a resume to get an ATS score, a quality review, grammar
                        corrections, missing skills, and prioritised fixes.
                      </p>
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-border-default bg-surface-card py-space-xl">
                      <div className="h-11 w-11 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="font-body-md font-bold text-text-primary">
                        Running ATS checks and AI review…
                      </p>
                      <p className="font-body-sm text-text-muted">This usually takes 5–15 seconds</p>
                    </div>
                  )}

                  {analysis && !isAnalyzing && (
                    <>
                      <RedFlagsPanel redFlags={analysis.redFlags} />
                      <AtsChecklist checks={analysis.atsChecks} signals={analysis.atsSignals} />
                      <QualityBreakdown quality={analysis.quality} />
                      <SuggestionsPanel suggestions={analysis.suggestions} />
                      <GrammarPanel grammar={analysis.grammar} />
                      <MissingSkillsPanel
                        missingSkills={analysis.missingSkills}
                        targetRole={analysis.targetRole || targetRole}
                      />
                      <KeywordPanel keywords={analysis.keywords} />

                      {isAuthenticated && (
                        <button
                          type="button"
                          onClick={openMatchesTab}
                          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-space-md py-3 font-label-lg font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark"
                        >
                          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                            join_inner
                          </span>
                          See jobs matched to this profile
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- MATCHES TAB ---------------- */}
            {activeTab === "matches" && (
              <>
                {!isAuthenticated ? (
                  <div className="rounded-3xl border border-border-default bg-surface-card p-space-xl text-center">
                    <span
                      className="material-symbols-outlined text-[48px] text-text-muted"
                      aria-hidden="true"
                    >
                      lock
                    </span>
                    <h3 className="mt-2 font-headline-sm font-bold text-text-primary">
                      Sign in to see your job matches
                    </h3>
                    <p className="mx-auto mt-1 max-w-md font-body-sm text-text-muted">
                      Matching scores every open role against your skills, experience, education,
                      certifications, location, and pay expectation.
                    </p>
                    <div className="mt-space-md flex justify-center gap-space-sm">
                      <Link
                        to="/signup"
                        className="rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary"
                      >
                        Create account
                      </Link>
                      <Link
                        to="/login"
                        className="rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-on-surface"
                      >
                        Sign in
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
                    <div className="lg:col-span-4">
                      <MatchProfileEditor
                        profile={matchProfile}
                        onSave={handleSaveProfile}
                        isSaving={isSavingProfile}
                      />
                    </div>
                    <div className="lg:col-span-8">
                      <JobMatchList
                        matches={matches}
                        isLoading={isLoadingMatches}
                        onRefresh={() => loadMatches({ refresh: true })}
                        isRefreshing={isRefreshingMatches}
                        needsProfile={needsProfile}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ResumeAnalyzer;
