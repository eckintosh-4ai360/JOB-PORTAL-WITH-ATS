import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users, Briefcase, Search, FileText, Mail, Phone,
  MapPin, Calendar, Clock, ChevronRight, ArrowLeft,
  CheckCircle2, Loader2, Eye, Download,
  RefreshCw, SlidersHorizontal, X, Star, TrendingUp,
  ExternalLink, ChevronDown, AlertCircle, Inbox, Lock,
  Workflow, ClipboardList,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { resolveFileUrl, downloadFileUrl } from "../../utils/fileUrl";
import PipelineEditor from "../../components/employer/PipelineEditor";
import InterviewQuestionsPanel from "../../components/employer/InterviewQuestionsPanel";
import ApplicantAssessmentsCard from "../../components/employer/ApplicantAssessmentsCard";
import DuplicateApplicantCard from "../../components/employer/DuplicateApplicantCard";
import { stageStyle, fitTone, AVATAR_GRADIENTS, getInitials } from "../../utils/stageStyles";

// Mirrors the rule the API enforces (utils/hiringPipeline.canTransition): the
// pipeline runs forwards only, rejection is reachable from anywhere, and a
// rejected or hired application is settled. Greying out the impossible buttons
// is a courtesy — the server is what actually holds the line.
const canMoveTo = (stages, from, to) => {
  if (from === to) return false;
  const fromStage = stages.find((stage) => stage.id === from);
  if (!fromStage || fromStage.type === "rejected" || fromStage.type === "hired") return false;
  if (to === "rejected") return true;

  const fromIndex = stages.findIndex((stage) => stage.id === from);
  const toIndex = stages.findIndex((stage) => stage.id === to);
  return fromIndex !== -1 && toIndex > fromIndex;
};

// Mirrors notifyCandidate in the application controller: what a move looks
// like from the candidate's side, and whether it emails them.
const candidateEffect = (phases, fromStage, toStage) => {
  const phaseLabel = (stage) => phases.find((phase) => phase.key === stage?.phase)?.label || "Application received";
  const outcomeLabel = { rejected: "Not selected", offer: "Offer made", hired: "Hired" }[toStage?.type];
  const sees = outcomeLabel ? `${phaseLabel(toStage)} · ${outcomeLabel}` : phaseLabel(toStage);
  const alwaysEmails = ["rejected", "interview", "offer", "hired"].includes(toStage?.type);
  return { sees, emails: alwaysEmails || fromStage?.phase !== toStage?.phase };
};

const formatAnswer = (entry) => {
  if (entry.type === "yes_no") return entry.answer ? "Yes" : "No";
  if (entry.type === "salary") return `GH₵ ${Number(entry.answer).toLocaleString()}`;
  if (entry.type === "date") return moment(entry.answer).format("D MMM YYYY");
  return String(entry.answer);
};

//  Status Badge 
const StatusBadge = ({ stage, size = "sm" }) => {
  const cfg = stageStyle(stage);
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.badge} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {stage?.name || "…"}
    </span>
  );
};

//   Inline Loader  
const InlineLoader = ({ message = "Loading…" }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <div className="relative h-14 w-14">
      <div className="animate-spin rounded-full h-14 w-14 border-4 border-indigo-100 dark:border-indigo-500/20 border-t-indigo-600 dark:border-t-indigo-400" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{message}</p>
  </div>
);

//   Empty State
const EmptyState = ({ title, description, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center px-4">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
      <Icon className="h-8 w-8 text-indigo-400 dark:text-indigo-400" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
    <p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500 max-w-xs">{description}</p>
  </div>
);

//   Applicant List Item  
const RECOMMENDATION_TONE = {
  shortlist: { label: "Shortlist", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30" },
  interview: { label: "Interview", tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30" },
  hold: { label: "Hold", tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30" },
  reject: { label: "Not a fit", tone: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30" },
};

/**
 * AI fit assessment for the selected applicant.
 *
 * Written for the recruiter: a score, a recommendation, the dimension
 * breakdown behind it, and what to probe in an interview. The breakdown is
 * what makes the recommendation reviewable rather than an opaque verdict — a
 * hiring decision should never rest on a number nobody can question.
 */
const AiFitPanel = ({ score, isLoading, jobSpec }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (isLoading && !score) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Scoring this applicant against the role…
        </span>
      </div>
    );
  }

  if (!score) return null;

  const recommendation = RECOMMENDATION_TONE[score.recommendation] || null;
  const dimensions = Object.entries(score.dimensions || {}).sort(
    (a, b) => (b[1].weight || 0) - (a[1].weight || 0)
  );

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI fit assessment</h3>
        {score.degraded && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            rule-based only
          </span>
        )}
      </div>

      <div className="flex items-start gap-4 flex-wrap">
        <div
          className={`flex flex-col items-center justify-center rounded-2xl px-4 py-3 ring-1 ${fitTone(score.matchScore)}`}
        >
          <span className="text-2xl font-bold leading-none">{score.matchScore}%</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">fit</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {score.verdict}
            </span>
            {recommendation && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${recommendation.tone}`}
              >
                {recommendation.label}
              </span>
            )}
          </div>
          {score.aiSummary && (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {score.aiSummary}
            </p>
          )}
        </div>
      </div>

      {/* Strengths and gaps side by side — a recruiter reads both. */}
      {(score.strengths?.length > 0 || score.gaps?.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {score.strengths?.length > 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1.5">
                Strengths
              </p>
              <ul className="space-y-1">
                {score.strengths.map((item) => (
                  <li
                    key={item}
                    className="flex gap-1.5 text-xs text-emerald-900 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {score.gaps?.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5">
                Gaps
              </p>
              <ul className="space-y-1">
                {score.gaps.map((item) => (
                  <li
                    key={item}
                    className="flex gap-1.5 text-xs text-amber-900 dark:text-amber-300"
                  >
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {score.interviewFocus?.length > 0 && (
        <div className="mt-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400 mb-1.5">
            Worth probing in an interview
          </p>
          <ul className="space-y-1">
            {score.interviewFocus.map((item) => (
              <li key={item} className="flex gap-1.5 text-xs text-indigo-900 dark:text-indigo-300">
                <Star className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dimensions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowBreakdown((value) => !value)}
            aria-expanded={showBreakdown}
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
            />
            {showBreakdown ? "Hide score breakdown" : "Show score breakdown"}
          </button>

          {showBreakdown && (
            <div className="mt-3 space-y-2.5 border-t border-gray-100 dark:border-gray-800 pt-3">
              {dimensions.map(([key, dimension]) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold capitalize text-gray-700 dark:text-gray-300">
                      {key}
                      <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">
                        {dimension.weight}% of score · {dimension.label}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {dimension.score}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${
                        dimension.score >= 80
                          ? "bg-emerald-500"
                          : dimension.score >= 65
                            ? "bg-sky-500"
                            : dimension.score >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                      }`}
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                </div>
              ))}

              {jobSpec?.requiredSkills?.length > 0 && (
                <p className="pt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Scored against: {jobSpec.requiredSkills.join(", ")}
                  {jobSpec.requiredYears ? ` · ${jobSpec.requiredYears}+ yrs` : ""}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
        This is decision support, not a decision. Review the resume yourself before rejecting anyone.
      </p>
    </div>
  );
};

const ApplicantListItem = ({ app, stage, index, isSelected, onClick, aiScore, duplicate }) => {
  const name = app.applicantName || app.applicant?.name || "Unknown Applicant";
  const initials = getInitials(name);
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const cfg = stageStyle(stage);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 flex items-center gap-3.5 transition-all duration-200 border-b border-gray-50 dark:border-gray-800 last:border-none hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 group ${
        isSelected ? "bg-indigo-50 dark:bg-indigo-500/10 border-l-2 border-l-indigo-500" : "border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar */}
      <div
        className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white shadow-sm`}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${isSelected ? "text-indigo-700 dark:text-indigo-400" : "text-gray-900 dark:text-gray-100"} group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors`}>
          {name}
          {app.isGuest && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">Guest</span>
          )}
          {duplicate && (
            <span
              title="Looks like another of your applicants — see the details"
              className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
            >
              Possible duplicate
            </span>
          )}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{moment(app.createdAt).fromNow()}</span>
          {/* AI fit score — absent until the applicant has been scored */}
          {aiScore && (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${fitTone(aiScore.matchScore)}`}
              title={`${aiScore.verdict} — AI fit score against this role's requirements`}
            >
              {aiScore.matchScore}% fit
            </span>
          )}
        </div>
      </div>

      {/* Status dot + chevron */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
        <ChevronRight className={`h-3.5 w-3.5 text-gray-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5 ${isSelected ? "text-indigo-400" : ""}`} />
      </div>
    </button>
  );
};

//   Info Row
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-none">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
      <Icon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
    </div>
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200 break-all">{value || "—"}</p>
    </div>
  </div>
);

//   Main Component   
const ApplicationViewer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get("jobId");
  // Another page can link straight to one applicant, e.g. from Duplicates.
  const linkedApplicationId = searchParams.get("application");

  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [interviewDetails, setInterviewDetails] = useState({ date: "", time: "", location: "", notes: "" });
  //   The status awaiting confirmation, or null when no dialog is open
  const [pendingStatus, setPendingStatus] = useState(null);
  //   The interview stage the scheduling dialog will move the application to
  const [interviewStageId, setInterviewStageId] = useState(null);

  //   The employer's stages, and what each one shows the candidate
  const [pipeline, setPipeline] = useState(null);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);

  //   AI fit scoring, keyed by application id
  const [aiScores, setAiScores] = useState({});

  //   Applicants who look like another of this employer's applicants, by application id
  const [duplicates, setDuplicates] = useState({});
  const [jobSpec, setJobSpec] = useState(null);
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [sortByFit, setSortByFit] = useState("fit");

  //   Fetch Applications   
  const fetchApplications = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.APPLICATIONS.GET_APPLICANT(jobId));
      const data = Array.isArray(res.data) ? res.data : [];
      setApplications(data);
      const linked = linkedApplicationId && data.find((a) => (a._id || a.id) === linkedApplicationId);
      if (linked) {
        setSelectedApp(linked);
      } else if (data.length > 0 && !selectedApp) {
        setSelectedApp(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load applications.");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, linkedApplicationId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.APPLICATIONS.GET_PIPELINE)
      .then((res) => {
        if (!cancelled) setPipeline(res.data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load your hiring pipeline.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stages = pipeline?.stages || [];
  const allStages = pipeline ? [...pipeline.stages, pipeline.rejectedStage] : [];
  const phases = pipeline?.phases || [];
  const stageById = (id) => allStages.find((stage) => stage.id === id);

  const fetchDuplicates = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await axiosInstance.get(API_PATHS.APPLICATIONS.DUPLICATES, { params: { jobId } });
      setDuplicates(res.data.matches || {});
    } catch {
      // A duplicate check is a courtesy; the applicant list works without it.
      setDuplicates({});
    }
  }, [jobId]);

  useEffect(() => {
    const timer = setTimeout(fetchDuplicates, 0);
    return () => clearTimeout(timer);
  }, [fetchDuplicates]);

  /**
   * Load AI fit scores for this job's applicants.
   *
   * Runs after the applicant list so the roster is never blocked by scoring —
   * the first call scores any unscored applicant, which costs one AI request
   * each, so it is deliberately separate and cached server-side.
   */
  const fetchAiScores = useCallback(
    async ({ refresh = false } = {}) => {
      if (!jobId) return;
      refresh ? setIsRescoring(true) : setIsLoadingScores(true);
      try {
        const res = refresh
          ? await axiosInstance.post(API_PATHS.AI.RESCORE_APPLICANTS(jobId))
          : await axiosInstance.get(API_PATHS.AI.GET_SCORED_APPLICANTS(jobId));

        const scores = {};
        for (const applicant of res.data?.applicants || []) {
          if (applicant.aiScore) scores[applicant._id || applicant.id] = applicant.aiScore;
        }
        setAiScores(scores);
        setJobSpec(res.data?.jobSpec || null);
        if (refresh) toast.success("Applicants rescored");
      } catch (err) {
        if (err.response?.status === 429) {
          toast.error("AI scoring limit reached. Try again shortly.");
        }
        // Otherwise stay quiet: scoring is an enhancement, not the page.
      } finally {
        refresh ? setIsRescoring(false) : setIsLoadingScores(false);
      }
    },
    [jobId]
  );

  useEffect(() => {
    if (applications.length > 0) fetchAiScores();
  }, [applications.length, fetchAiScores]);

  //   Filter Logic
  const filtered = applications
    .filter((app) => {
      const name = (app.applicantName || app.applicant?.name || "").toLowerCase();
      const email = (app.applicantEmail || app.applicant?.email || "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);
      const matchesStatus = statusFilter === "All" || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortByFit !== "fit") return 0;
      // Unscored applicants sort last rather than being treated as a zero.
      const scoreA = aiScores[a._id || a.id]?.matchScore ?? -1;
      const scoreB = aiScores[b._id || b.id]?.matchScore ?? -1;
      return scoreB - scoreA;
    });

  //   Summary counts   
  const counts = allStages.reduce((acc, stage) => {
    acc[stage.id] = applications.filter((a) => a.status === stage.id).length;
    return acc;
  }, {});
  const offerCount = allStages
    .filter((stage) => stage.type === "offer" || stage.type === "hired")
    .reduce((sum, stage) => sum + (counts[stage.id] || 0), 0);

  //   Update Status   
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedApp || newStatus === selectedApp.status) return;
    setIsUpdatingStatus(true);
    const id = toast.loading("Updating status…");
    try {
      await axiosInstance.patch(API_PATHS.APPLICATIONS.UPDATE_STATUS(selectedApp._id), {
        status: newStatus,
      });
      toast.dismiss(id);
      toast.success(`Moved to ${stageById(newStatus)?.name || newStatus}`);
      const updated = applications.map((a) =>
        a._id === selectedApp._id ? { ...a, status: newStatus } : a
      );
      setApplications(updated);
      setSelectedApp((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      toast.dismiss(id);
      toast.error(err.response?.data?.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };
  
  //   Ask before moving  
  //   A move is one-way, so nothing is sent until it has been confirmed.
  //   An interview stage is confirmed by the scheduling dialog instead, which
  //   cannot be submitted without real interview details.
  const requestStatusChange = (next) => {
    if (!selectedApp || !canMoveTo(allStages, selectedApp.status, next)) return;

    if (stageById(next)?.type === "interview") {
      if (selectedApp.isGuest) {
        toast.error("Interviews can only be scheduled for candidates with registered accounts.");
        return;
      }
      setInterviewDetails({
        date: selectedApp.interview?.date ? moment(selectedApp.interview.date).format("YYYY-MM-DD") : "",
        time: selectedApp.interview?.time || "",
        location: selectedApp.interview?.location || "",
        notes: selectedApp.interview?.notes || "",
      });
      setInterviewStageId(next);
      setIsSchedulingModalOpen(true);
      return;
    }

    setPendingStatus(next);
  };

  const confirmStatusChange = async () => {
    const next = pendingStatus;
    setPendingStatus(null);
    if (next) await handleUpdateStatus(next);
  };

  //   Schedule/Update Interview  
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!interviewDetails.date || !interviewDetails.time || !interviewDetails.location) {
      toast.error("Date, Time, and Location/Link are required.");
      return;
    }

    const targetStatus = interviewStageId || selectedApp.status;
    setIsUpdatingStatus(true);
    const id = toast.loading("Saving interview schedule…");
    try {
      const res = await axiosInstance.patch(API_PATHS.APPLICATIONS.UPDATE_STATUS(selectedApp._id), {
        status: targetStatus,
        interview: interviewDetails,
      });
      toast.dismiss(id);
      toast.success("Interview scheduled successfully!");
      
      const updatedApp = res.data.application || {
        ...selectedApp,
        status: targetStatus,
        interview: {
          date: new Date(interviewDetails.date),
          time: interviewDetails.time,
          location: interviewDetails.location,
          notes: interviewDetails.notes,
        }
      };
      
      const updated = applications.map((a) =>
        a._id === selectedApp._id ? { ...a, status: targetStatus, interview: updatedApp.interview } : a
      );
      setApplications(updated);
      setSelectedApp(updatedApp);
      setIsSchedulingModalOpen(false);
    } catch (err) {
      toast.dismiss(id);
      toast.error(err.response?.data?.message || "Failed to schedule interview.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  //   Job Info (from first application)  
  const jobInfo = applications[0]?.job;
  const selectedIndex = filtered.findIndex((a) => a._id === selectedApp?._id);
  const selectedGradient = AVATAR_GRADIENTS[selectedIndex % AVATAR_GRADIENTS.length];
  const selectedInitials = getInitials(selectedApp?.applicantName || selectedApp?.applicant?.name);

  if (!jobId) {
    return (
      <DashboardLayout activeMenu="manage-jobs">
        <EmptyState
          icon={AlertCircle}
          title="No Job Selected"
          description="Please navigate here from the Manage Jobs page by clicking on an applicant count."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu="manage-jobs">
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-0 max-w-7xl mx-auto">

        {/*    Top Bar   */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => navigate("/manage-jobs")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group shrink-0"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Jobs
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {jobInfo ? (
                <>
                  Applicants for{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">{jobInfo.title}</span>
                </>
              ) : (
                "Application Viewer"
              )}
            </h1>
            {jobInfo && (
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{jobInfo.location}</span>
                <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{jobInfo.type}</span>
              </div>
            )}
          </div>

          {/* Stat Pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 shadow-sm">
              <Users className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{applications.length}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 shadow-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{offerCount}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Offers</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPipelineOpen(true)}
              disabled={!pipeline}
              title="Customise the stages applications move through"
              className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all disabled:opacity-50"
            >
              <Workflow className="h-4 w-4" />
              Pipeline
            </button>
            <button
              onClick={fetchApplications}
              title="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-400 dark:text-gray-500 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/*    Status Filter Pills   */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {["All", ...allStages.map((stage) => stage.id)].map((s) => {
            const count = s === "All" ? applications.length : (counts[s] || 0);
            const isActive = statusFilter === s;
            const cfg = s !== "All" ? stageStyle(stageById(s)) : null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                {cfg && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : cfg.dot}`} />
                )}
                {s === "All" ? "All" : stageById(s)?.name}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/*    Main Split Layout   */}
        {isLoading ? (
          <div className="flex-1 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <InlineLoader message="Loading applications…" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex-1 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <EmptyState
              icon={Inbox}
              title="No Applications Yet"
              description="No candidates have applied for this position yet. Share the job to attract talent."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex min-h-0">

            {/*    Left Panel: Applicant List    */}
            <div className="w-[300px] xl:w-[340px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
              {/* Search bar */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search applicants…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-9 pr-8 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Count label + AI sort controls */}
              <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                  {filtered.length} applicant{filtered.length !== 1 ? "s" : ""}
                  {statusFilter !== "All" && ` · ${stageById(statusFilter)?.name || statusFilter}`}
                </p>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Ranking by fit is the whole point of scoring, so it is the
                      default — but a recruiter can always go back to recency. */}
                  <button
                    type="button"
                    onClick={() => setSortByFit((v) => (v === "fit" ? "recent" : "fit"))}
                    title={
                      sortByFit === "fit"
                        ? "Sorted by AI fit score — click to sort by most recent"
                        : "Sorted by most recent — click to rank by AI fit score"
                    }
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                      sortByFit === "fit"
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    }`}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {sortByFit === "fit" ? "By fit" : "By date"}
                  </button>

                  <button
                    type="button"
                    onClick={() => fetchAiScores({ refresh: true })}
                    disabled={isRescoring || isLoadingScores}
                    title="Rescore every applicant against this role"
                    className="rounded-lg p-1 text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400 disabled:opacity-40 transition-colors"
                    aria-label="Rescore all applicants"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isRescoring || isLoadingScores ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                    <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No matches found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search or filter.</p>
                  </div>
                ) : (
                  filtered.map((app, i) => (
                    <ApplicantListItem
                      key={app._id}
                      app={app}
                      stage={stageById(app.status)}
                      index={i}
                      isSelected={selectedApp?._id === app._id}
                      onClick={() => setSelectedApp(app)}
                      aiScore={aiScores[app._id || app.id]}
                      duplicate={Boolean(duplicates[app._id || app.id]?.length)}
                    />
                  ))
                )}
              </div>
            </div>

            {/*  Right Panel: Detail View  */}
            {selectedApp ? (
              <div className="flex-1 overflow-y-auto min-w-0">
                {/* Detail Header */}
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-7 py-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className={`h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br ${selectedGradient} flex items-center justify-center text-lg font-bold text-white shadow-md`}
                    >
                      {selectedInitials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                        {selectedApp.applicantName || selectedApp.applicant?.name || "Unknown Applicant"}
                        {selectedApp.isGuest && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">Guest Applicant</span>
                        )}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Mail className="h-3 w-3" />
                          {selectedApp.applicantEmail || selectedApp.applicant?.email || "—"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Calendar className="h-3 w-3" />
                          Applied {moment(selectedApp.createdAt).fromNow()}
                        </span>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="shrink-0">
                      <StatusBadge stage={stageById(selectedApp.status)} size="md" />
                    </div>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="px-7 py-6 space-y-6">

                  {/*  AI fit assessment for this applicant  */}
                  <AiFitPanel
                    score={aiScores[selectedApp._id || selectedApp.id]}
                    isLoading={isLoadingScores}
                    jobSpec={jobSpec}
                  />

                  {/*  Other applicants who look like this one  */}
                  <DuplicateApplicantCard
                    matches={duplicates[selectedApp._id || selectedApp.id]}
                    currentJobId={jobId}
                    onSelectApplication={(applicationId) => {
                      const other = applications.find((a) => (a._id || a.id) === applicationId);
                      if (other) setSelectedApp(other);
                    }}
                    onDecided={fetchDuplicates}
                  />

                  {/*  Interview questions for this applicant  */}
                  <InterviewQuestionsPanel
                    applicationId={selectedApp._id || selectedApp.id}
                    applicantName={(selectedApp.applicantName || selectedApp.applicant?.name || "").split(" ")[0]}
                    canTailor={!selectedApp.isGuest}
                    hasAssessment={Boolean(aiScores[selectedApp._id || selectedApp.id])}
                  />

                  {/*  Assessment results for this applicant  */}
                  <ApplicantAssessmentsCard applicationId={selectedApp._id || selectedApp.id} />

                  {/*  Change Status ─ */}
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <SlidersHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Update Application Status</h3>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2 mb-4">
                      Each move is confirmed first and cannot be undone — an application only ever moves forward.
                      Candidates never see these stage names, only the step shown under each one.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {allStages.map((stage) => {
                        const s = stage.id;
                        const cfg = stageStyle(stage);
                        const isActive = selectedApp.status === s;
                        const isLocked = !isActive && !canMoveTo(allStages, selectedApp.status, s);
                        const currentStage = stageById(selectedApp.status);
                        const isSettled = currentStage?.type === "rejected" || currentStage?.type === "hired";
                        const Icon = isLocked ? Lock : cfg.icon;
                        const seen = phases.find((phase) => phase.key === stage.phase)?.label;
                        return (
                          <button
                            key={s}
                            disabled={isUpdatingStatus || isActive || isLocked}
                            title={
                              isLocked
                                ? isSettled
                                  ? `This application is settled as "${currentStage.name}" and can no longer be moved`
                                  : `Already past "${stage.name}" — the pipeline only moves forward`
                                : `Candidate sees: ${seen}`
                            }
                            onClick={() => requestStatusChange(s)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 text-xs font-bold transition-all duration-200 ${
                              isActive
                                ? `${cfg.bg} ${cfg.text} ${cfg.ring} border-current shadow-sm cursor-default`
                                : isLocked
                                  ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed dark:bg-gray-800/50 dark:border-gray-800 dark:text-gray-600"
                                  : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300 hover:text-gray-600 hover:bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                            } ${isUpdatingStatus ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <Icon className="h-4.5 w-4.5" />
                            <span className="text-center leading-tight">{stage.name}</span>
                            {!isActive && !isLocked && seen && (
                              <span className="text-[10px] font-normal opacity-70 text-center leading-tight">
                                Sees: {seen}
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] font-normal opacity-70">Current</span>
                            )}
                            {isLocked && (
                              <span className="text-[10px] font-normal opacity-70">Locked</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/*  Scheduled Interview Details ─ */}
                  {stageById(selectedApp.status)?.phase === "interview" && selectedApp.interview && (
                    <div className="rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5 p-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 hidden md:block">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                          Interview Scheduled
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Scheduled Interview Details</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Date</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {moment(selectedApp.interview.date).format("dddd, MMMM D, YYYY")}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Time</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {selectedApp.interview.time
                              ? (() => {
                                  const [h, m] = selectedApp.interview.time.split(":").map(Number);
                                  const ampm = h >= 12 ? "PM" : "AM";
                                  const hour = h % 12 || 12;
                                  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
                                })()
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Location / Link</p>
                          <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{selectedApp.interview.location}</span>
                            {selectedApp.interview.location?.startsWith("http") && (
                              <a
                                href={selectedApp.interview.location}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 shrink-0"
                                title="Open Link"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {selectedApp.interview.notes && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-amber-100/50 dark:border-amber-500/20 shadow-xs mb-4">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">Instructions / Notes</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {selectedApp.interview.notes}
                          </p>
                        </div>
                      )}
                      {stageById(selectedApp.status)?.type === "interview" && (
                      <button
                        onClick={() => {
                          setInterviewDetails({
                            date: moment(selectedApp.interview.date).format("YYYY-MM-DD"),
                            time: selectedApp.interview.time,
                            location: selectedApp.interview.location,
                            notes: selectedApp.interview.notes || "",
                          });
                          setInterviewStageId(selectedApp.status);
                          setIsSchedulingModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-900 hover:bg-amber-50 dark:hover:bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 transition"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Edit Interview Details
                      </button>
                      )}
                    </div>
                  )}

                  {/*  Two-col Grid  */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Applicant Info */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Applicant Details</h3>
                      </div>
                      <div>
                        <InfoRow icon={Mail} label="Email Address" value={selectedApp.applicantEmail || selectedApp.applicant?.email} />
                        {selectedApp.isGuest && selectedApp.applicantPhone && (
                          <InfoRow icon={Phone} label="Phone Number" value={selectedApp.applicantPhone} />
                        )}
                        <InfoRow icon={Calendar} label="Applied On" value={moment(selectedApp.createdAt).format("MMM D, YYYY · h:mm A")} />
                        <InfoRow icon={Clock} label="Last Updated" value={moment(selectedApp.updatedAt).fromNow()} />
                        <InfoRow icon={Briefcase} label="Applied For" value={selectedApp.job?.title} />
                        {selectedApp.job?.location && (
                          <InfoRow icon={MapPin} label="Job Location" value={selectedApp.job.location} />
                        )}
                      </div>
                    </div>

                    {/* Resume Card */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Resume / CV</h3>
                      </div>

                      {selectedApp.resume ? (
                        <>
                          {/* Preview card */}
                          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5 p-6 text-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Resume Attached</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 break-all max-w-[200px] mx-auto truncate">
                                {selectedApp.resume.split("/").pop()}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-center">
                              <a
                                href={resolveFileUrl(selectedApp.resume)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </a>
                              <a
                                href={downloadFileUrl(selectedApp.resume)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 text-center">
                          <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No resume uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/*  Screening answers  */}
                  {Array.isArray(selectedApp.screeningAnswers) && selectedApp.screeningAnswers.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Screening answers</h3>
                      </div>
                      <dl className="divide-y divide-gray-50 dark:divide-gray-800">
                        {selectedApp.screeningAnswers.map((entry) => (
                          <div key={entry.questionId} className="py-2.5 grid gap-1 sm:grid-cols-[1fr_auto] sm:gap-4">
                            <dt className="text-xs text-gray-500 dark:text-gray-400">{entry.prompt}</dt>
                            <dd className="text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-right whitespace-pre-wrap">
                              {formatAnswer(entry)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/*  Cover Letter  */}
                  {(selectedApp.coverLetter || selectedApp.coverLetterFile) && (
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-400 dark:text-amber-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Cover Letter</h3>
                      </div>

                      {/* Typed cover letter text */}
                      {selectedApp.coverLetter && (
                        <div className="rounded-xl bg-slate-50 dark:bg-gray-800/60 p-4 border border-slate-100 dark:border-gray-700">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {selectedApp.coverLetter}
                          </p>
                        </div>
                      )}

                      {/* Uploaded cover letter document */}
                      {selectedApp.coverLetterFile && (
                        <div className={`flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5 p-4 ${selectedApp.coverLetter ? "mt-3" : ""}`}>
                          <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Cover Letter Document</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate break-all mt-0.5">
                              {selectedApp.coverLetterFile.split("/").pop()}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <a
                              href={resolveFileUrl(selectedApp.coverLetterFile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </a>
                            <a
                              href={downloadFileUrl(selectedApp.coverLetterFile)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/*  Timeline  */}
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Application Timeline</h3>
                    </div>
                    <div className="relative pl-5">
                      {/* Vertical line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-indigo-100 dark:bg-indigo-500/20" />

                      {/* Timeline events */}
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-gray-900 shadow-sm mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Application Submitted</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{moment(selectedApp.createdAt).format("MMM D, YYYY · h:mm A")}</p>
                          </div>
                        </div>

                        {selectedApp.status !== stages[0]?.id && (
                          <div className="flex items-start gap-3">
                            <span className={`relative z-10 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900 shadow-sm mt-0.5 ${stageStyle(stageById(selectedApp.status)).dot}`} />
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                Moved to{" "}
                                <span className={stageStyle(stageById(selectedApp.status)).text}>
                                  {stageById(selectedApp.status)?.name || selectedApp.status}
                                </span>
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{moment(selectedApp.updatedAt).format("MMM D, YYYY · h:mm A")}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={Users}
                  title="Select an Applicant"
                  description="Click on any applicant from the list to view their full application details."
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/*  Scheduling Modal  */}
      {isSchedulingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-100 dark:border-gray-800 shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsSchedulingModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Schedule Interview</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Specify details for candidate: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedApp?.applicantName || selectedApp?.applicant?.name}</span></p>
                {selectedApp?.status !== interviewStageId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Confirming moves this application to {stageById(interviewStageId)?.name} for good — it cannot go
                    back to {stageById(selectedApp?.status)?.name}. The candidate is emailed the details.
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interview Date</label>
                  <input
                    type="date"
                    required
                    value={interviewDetails.date}
                    onChange={(e) => setInterviewDetails((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition scheme-light dark:scheme-dark"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interview Time</label>
                  <input
                    type="time"
                    required
                    value={interviewDetails.time}
                    onChange={(e) => setInterviewDetails((prev) => ({ ...prev, time: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition cursor-pointer scheme-light dark:scheme-dark"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Location / Meet Link</label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet URL, Zoom link, or Office Location Address"
                  required
                  value={interviewDetails.location}
                  onChange={(e) => setInterviewDetails((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes & Instructions (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Provide meeting password, preparation guide, or notes for the candidate..."
                  value={interviewDetails.notes}
                  onChange={(e) => setInterviewDetails((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsSchedulingModalOpen(false)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-100 transition disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Saving..." : "Confirm & Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Status Change Confirmation  */}
      {pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full border border-gray-100 dark:border-gray-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stageStyle(stageById(pendingStatus)).bg}`}>
                <AlertCircle className={`h-5 w-5 ${stageStyle(stageById(pendingStatus)).text}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Move to {stageById(pendingStatus)?.name}?
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedApp?.applicantName || selectedApp?.applicant?.name || "This applicant"}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 p-4 mb-4">
              <div className="flex items-center justify-center gap-3 text-xs font-bold">
                <span className={`px-2.5 py-1 rounded-lg ${stageStyle(stageById(selectedApp?.status)).badge}`}>
                  {stageById(selectedApp?.status)?.name}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                <span className={`px-2.5 py-1 rounded-lg ${stageStyle(stageById(pendingStatus)).badge}`}>
                  {stageById(pendingStatus)?.name}
                </span>
              </div>
            </div>

            {(() => {
              const effect = candidateEffect(phases, stageById(selectedApp?.status), stageById(pendingStatus));
              const settles = ["rejected", "hired"].includes(stageById(pendingStatus)?.type);
              return (
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
                  The candidate {effect.emails ? "will be emailed and" : "is not notified —"} will see{" "}
                  <span className="font-bold text-gray-700 dark:text-gray-200">{effect.sees}</span>.{" "}
                  {settles
                    ? "This settles the application — no further moves will be possible."
                    : `Once confirmed, this application can no longer be moved back to ${stageById(selectedApp?.status)?.name}.`}
                </p>
              );
            })()}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={confirmStatusChange}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-100 dark:shadow-none transition disabled:opacity-50"
              >
                {isUpdatingStatus ? "Updating..." : `Confirm ${stageById(pendingStatus)?.name || ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {isPipelineOpen && pipeline && (
        <PipelineEditor
          stages={pipeline.stages}
          phases={pipeline.phases}
          defaults={pipeline.defaults}
          rejectedStage={pipeline.rejectedStage}
          onClose={() => setIsPipelineOpen(false)}
          onSaved={(savedStages) => {
            setPipeline((current) => ({ ...current, stages: savedStages }));
            // A filter on a stage that no longer exists would show nothing.
            if (statusFilter !== "All" && !savedStages.some((stage) => stage.id === statusFilter) && statusFilter !== "rejected") {
              setStatusFilter("All");
            }
            setIsPipelineOpen(false);
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default ApplicationViewer;