import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ListChecks, Star, Sparkles, Hand, Loader2, AlertCircle, Check, X, HelpCircle, ChevronDown, ChevronRight,
  ArrowRight, Trash2, Pencil, Search, Info, Wand2, Users, Lock,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import ExportMenu from "../../components/employer/ExportMenu";
import ShortlistCriteriaPanel from "../../components/employer/ShortlistCriteriaPanel";
import {
  StageBadge, FitPill, AssessmentResult, ApplicantAvatar, GuestBadge,
} from "../../components/employer/ApplicantBadges";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { toApiCriteria, loadCriteria, saveCriteria } from "../../utils/shortlistCriteria";


const RESULT_STYLES = {
  met: { icon: Check, className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
  unmet: { icon: X, className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30" },
  unknown: { icon: HelpCircle, className: "bg-gray-50 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700" },
};

const GROUPS = [
  { verdict: "suggested", title: "Suggested", hint: "Meet every criterion", open: true },
  { verdict: "needs_data", title: "Need more information", hint: "Nothing failed, but something couldn't be checked yet", open: true },
  { verdict: "not_suggested", title: "Don't match", hint: "Miss at least one criterion", open: false },
];

const SHORTLIST_KPI_TONES = {
  sky: {
    // accent: "bg-sky-500",
    icon: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    value: "text-sky-700 dark:text-sky-300",
    glow: "bg-sky-300/25 dark:bg-sky-400/15",
  },
  violet: {
    // accent: "bg-violet-500",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    value: "text-violet-700 dark:text-violet-300",
    glow: "bg-violet-300/25 dark:bg-violet-400/15",
  },
  amber: {
    // accent: "bg-amber-500",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    value: "text-amber-700 dark:text-amber-300",
    glow: "bg-amber-300/25 dark:bg-amber-400/15",
  },
};

const ShortlistKpiCard = ({ label, value, detail, icon: Icon, tone, children }) => {
  const style = SHORTLIST_KPI_TONES[tone];

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-surface-card/90 to-surface-container-low/65 p-space-md shadow-[0_10px_24px_rgba(40,34,86,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(40,34,86,0.10)] dark:border-gray-700/70 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-gray-800/80 md:p-space-lg">
      <span className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} />
      <span className={`absolute -right-5 -top-5 h-20 w-20 rounded-full blur-2xl ${style.glow}`} />
      <div className="relative flex items-start justify-between gap-space-sm pt-1">
        <div className="min-w-0">
          <p className="font-label-caps font-bold uppercase tracking-wider text-text-muted">{label}</p>
          <p className={`mt-2 font-headline-xl font-bold tracking-tight ${style.value}`}>{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="relative mt-2 min-h-5 font-body-sm text-text-muted">{children || detail}</div>
    </article>
  );
};

const candidateEffect = (phases, fromStage, toStage) => {
  const phaseLabel = (stage) => phases.find((phase) => phase.key === stage?.phase)?.label || "Application received";
  const outcome = { offer: "Offer made", hired: "Hired" }[toStage?.type];
  const emails = ["offer", "hired"].includes(toStage?.type) || fromStage?.phase !== toStage?.phase;
  return { sees: outcome ? `${phaseLabel(toStage)} · ${outcome}` : phaseLabel(toStage), emails };
};

const canAdvance = (stages, candidate, target) => {
  if (candidate.stage.type === "rejected" || candidate.stage.type === "hired") return "settled";
  const from = stages.findIndex((stage) => stage.id === candidate.stage.id);
  const to = stages.findIndex((stage) => stage.id === target.id);
  if (from === to) return "there";
  if (from > to) return "past";
  return "ok";
};

const CheckChips = ({ checks }) => (
  <div className="flex flex-wrap gap-1">
    {checks.map((item) => {
      const style = RESULT_STYLES[item.result] || RESULT_STYLES.unknown;
      const Icon = style.icon;
      return (
        <span
          key={item.key}
          title={item.label}
          className={`inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${style.className}`}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{item.detail || item.label}</span>
        </span>
      );
    })}
  </div>
);

const ApplicantCell = ({ candidate, jobId }) => (
  <div className="flex min-w-0 items-center gap-3">
    <ApplicantAvatar name={candidate.name} seed={candidate.email || candidate.id} size="sm" />
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Link
          to={`/applicants?jobId=${jobId}&application=${candidate.id}`}
          className="truncate text-sm font-semibold text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
        >
          {candidate.name}
        </Link>
        {candidate.isGuest && <GuestBadge />}
      </div>
      <p className="truncate text-xs text-gray-400 dark:text-gray-500">{candidate.email}</p>
    </div>
  </div>
);

const ShortlistNote = ({ candidate, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(candidate.shortlist?.note || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.patch(API_PATHS.SHORTLISTS.NOTE(candidate.id), { note: value });
      onSaved(res.data?.note ?? value.trim());
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          maxLength={500}
          autoFocus
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Why they're on the shortlist, what to ask them…"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(candidate.shortlist?.note || "");
              setEditing(false);
            }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="group w-full text-left" title="Edit note">
      {candidate.shortlist?.note ? (
        <span className="line-clamp-2 whitespace-pre-line text-xs text-gray-600 group-hover:text-gray-900 dark:text-gray-300">
          {candidate.shortlist.note}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-indigo-600">
          <Pencil className="h-3 w-3" /> Add a note
        </span>
      )}
    </button>
  );
};

const AdvanceDialog = ({ jobId, stages, phases, candidates: chosen, onClose, onDone }) => {
  // Fixed when the dialog opens, so the summary survives the list refreshing behind it.
  const [candidates] = useState(chosen);
  const movable = stages.filter((stage) => stage.type !== "interview");
  const [stageId, setStageId] = useState(
    () => (movable.find((stage) => stage.phase === "shortlisted") || movable[1] || movable[0])?.id || ""
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const target = movable.find((stage) => stage.id === stageId);
  const plan = candidates.map((candidate) => ({ candidate, verdict: target ? canAdvance(stages, candidate, target) : "past" }));
  const moving = plan.filter((entry) => entry.verdict === "ok");
  const effects = moving.map((entry) => candidateEffect(phases, entry.candidate.stage, target));
  const emailed = effects.filter((effect) => effect.emails).length;
  const hasInterviewStage = stages.some((stage) => stage.type === "interview");

  const submit = async () => {
    if (!target || moving.length === 0) return;
    setBusy(true);
    try {
      const res = await axiosInstance.post(API_PATHS.SHORTLISTS.ADVANCE(jobId), {
        applicationIds: moving.map((entry) => entry.candidate.id),
        stageId: target.id,
      });
      setResult(res.data);
      toast.success(res.data?.message || "Moved.");
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not move them.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="advance-title" className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <h3 id="advance-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Move {candidates.length} shortlisted applicant{candidates.length === 1 ? "" : "s"} to a stage
        </h3>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">{result.message}</p>
            {result.skipped?.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {result.skipped.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-semibold">{entry.name}:</span> {entry.reason}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label htmlFor="advance-stage" className="mt-4 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Stage
            </label>
            <select
              id="advance-stage"
              value={stageId}
              onChange={(event) => setStageId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {movable.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
            {hasInterviewStage && (
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                Interview stages aren't listed — each interview needs its own date and place, set from the applicant view.
              </p>
            )}

            {target && (
              <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-bold">{moving.length}</span> will move to <span className="font-semibold">{target.name}</span>.
                  {moving.length > 0 && (
                    <>
                      {" "}They'll see <span className="font-semibold">"{effects[0]?.sees}"</span>
                      {emailed > 0 ? `, and ${emailed === moving.length ? "each" : emailed} will get an email.` : ". No email is sent."}
                    </>
                  )}
                </p>
                {plan.filter((entry) => entry.verdict !== "ok").map((entry) => (
                  <p key={entry.candidate.id} className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.candidate.name} —{" "}
                    {entry.verdict === "there"
                      ? `already in ${target.name}`
                      : entry.verdict === "settled"
                        ? `settled as ${entry.candidate.stage.name}`
                        : `already past ${target.name} (in ${entry.candidate.stage.name})`}
                  </p>
                ))}
              </div>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" />
              Moves can't be undone — applications only ever move forward. They stay on your shortlist.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || moving.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Move {moving.length || ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Shortlisting = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsFailed, setJobsFailed] = useState(false);
  const jobId = searchParams.get("jobId") || "";

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState("shortlist");
  const [mode, setMode] = useState("assisted");

  const [criteria, setCriteria] = useState(null);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(GROUPS.map((group) => [group.verdict, group.open])));
  const [manualQuery, setManualQuery] = useState("");

  const [pickSelection, setPickSelection] = useState(() => new Set());
  const [listSelection, setListSelection] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const runRef = useRef(0);

  // Jobs, and which one is open
  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.SHORTLISTS.OVERVIEW)
      .then((res) => {
        if (!cancelled) setJobs(res.data?.jobs || []);
      })
      .catch(() => {
        if (!cancelled) setJobsFailed(true);
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // With no job in the address, open the first one people have applied to.
  useEffect(() => {
    if (jobId || jobs.length === 0) return;
    const first = jobs.find((entry) => entry.applicants > 0) || jobs[0];
    setSearchParams({ jobId: first.id }, { replace: true });
  }, [jobId, jobs, setSearchParams]);

  const loadDetail = useCallback(() => {
    if (!jobId) return;
    setDetailLoading(true);
    axiosInstance
      .get(API_PATHS.SHORTLISTS.JOB(jobId))
      .then((res) => setDetail(res.data))
      .catch((err) => {
        setDetail(null);
        toast.error(err.response?.data?.message || "Could not load this shortlist.");
      })
      .finally(() => setDetailLoading(false));
  }, [jobId]);

  // A different job starts clean: its own shortlist, criteria and results.
  useEffect(() => {
    const timer = setTimeout(() => {
      setResults(null);
      setPickSelection(new Set());
      setListSelection(new Set());
      setCriteria(jobId ? loadCriteria(jobId) : null);
      loadDetail();
    }, 0);
    return () => clearTimeout(timer);
  }, [jobId, loadDetail]);

  const runSearch = useCallback(
    (nextMode = mode, nextCriteria = criteria) => {
      if (!jobId || !nextCriteria) return;
      const runId = ++runRef.current;
      const apiCriteria = nextMode === "assisted" ? toApiCriteria(nextCriteria) : {};
      setRunning(true);
      axiosInstance
        .post(API_PATHS.SHORTLISTS.CANDIDATES(jobId), { criteria: apiCriteria })
        .then((res) => {
          if (runId !== runRef.current) return;
          setResults({ ...res.data, mode: nextMode });
          // Tick the top suggestions, as many as the employer asked for.
          const suggested = (res.data?.candidates || []).filter((candidate) => candidate.verdict === "suggested");
          setPickSelection(
            nextMode === "assisted" && res.data?.assisted
              ? new Set(suggested.slice(0, nextCriteria.topN).map((candidate) => candidate.id))
              : new Set()
          );
        })
        .catch((err) => {
          if (runId === runRef.current) toast.error(err.response?.data?.message || "Could not check the applicants.");
        })
        .finally(() => {
          if (runId === runRef.current) setRunning(false);
        });
    },
    [jobId, mode, criteria]
  );

  // Opening "Find candidates" runs the search once for this job and mode.
  useEffect(() => {
    if (tab !== "find" || !criteria || results?.mode === mode) return undefined;
    const timer = setTimeout(() => runSearch(mode, criteria), 0);
    return () => clearTimeout(timer);
  }, [tab, mode, criteria, results, runSearch]);

  const updateCriteria = (next) => {
    setCriteria(next);
    saveCriteria(jobId, next);
  };

  const selectJob = (id) => {
    setSearchParams(id ? { jobId: id } : {});
    setTab("shortlist");
  };

  const refreshAll = () => {
    loadDetail();
    setResults(null);
    // Keep the overview counts current.
    axiosInstance.get(API_PATHS.SHORTLISTS.OVERVIEW).then((res) => setJobs(res.data?.jobs || [])).catch(() => {});
  };

  const addSelected = async () => {
    const ids = [...pickSelection];
    if (!ids.length) return;
    setAdding(true);
    try {
      const body = { applicationIds: ids };
      if (results?.mode === "assisted" && results?.assisted) {
        body.assisted = { jobId, criteria: toApiCriteria(criteria) };
      }
      const res = await axiosInstance.post(API_PATHS.SHORTLISTS.ADD, body);
      toast.success(res.data?.message || "Added to the shortlist.");
      if (res.data?.skipped?.length) {
        toast(`${res.data.skipped.length} not added: ${res.data.skipped.map((entry) => `${entry.name} (${entry.reason.toLowerCase()})`).join(", ")}`, {
          icon: "ℹ️",
          duration: 6000,
        });
      }
      setPickSelection(new Set());
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not add to the shortlist.");
    } finally {
      setAdding(false);
    }
  };

  const removeFromShortlist = async (ids) => {
    if (!ids.length) return;
    setRemoving(true);
    try {
      const res = await axiosInstance.post(API_PATHS.SHORTLISTS.REMOVE, { applicationIds: ids });
      toast.success(res.data?.message || "Removed from the shortlist.");
      setListSelection((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      refreshAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the shortlist.");
    } finally {
      setRemoving(false);
    }
  };

  const scoreApplicants = async () => {
    setScoring(true);
    try {
      await axiosInstance.get(API_PATHS.AI.GET_SCORED_APPLICANTS(jobId), { timeout: 300000 });
      toast.success("Applicants scored.");
      refreshAll();
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "AI scoring limit reached. Try again later."
          : err.response?.data?.message || "Scoring didn't finish. Scores already made are kept — try again to finish."
      );
      refreshAll();
    } finally {
      setScoring(false);
    }
  };

  const toggle = (setter) => (id) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePick = toggle(setPickSelection);
  const toggleListed = toggle(setListSelection);

  const job = jobs.find((entry) => entry.id === jobId);
  const shortlist = detail?.shortlist || [];
  const counts = detail?.counts;
  const stages = detail?.stages || [];
  const phases = detail?.phases || [];
  const selectedShortlisted = shortlist.filter((candidate) => listSelection.has(candidate.id));
  const allListedSelected = shortlist.length > 0 && shortlist.every((candidate) => listSelection.has(candidate.id));

  const candidates = results?.candidates || [];
  const manualShown = candidates.filter((candidate) => {
    const q = manualQuery.trim().toLowerCase();
    return !q || candidate.name.toLowerCase().includes(q) || candidate.email.toLowerCase().includes(q);
  });

  const renderCandidateRow = (candidate, showChecks) => (
    <li
      key={candidate.id}
      className={`flex flex-col gap-2 px-4 py-3 transition sm:flex-row sm:items-center ${
        pickSelection.has(candidate.id) ? "bg-indigo-50/50 dark:bg-indigo-500/5" : "hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={pickSelection.has(candidate.id)}
          onChange={() => togglePick(candidate.id)}
          aria-label={`Select ${candidate.name}`}
          className="mt-2.5 h-4 w-4 shrink-0 accent-indigo-600"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <ApplicantCell candidate={candidate} jobId={jobId} />
          {showChecks && candidate.checks?.length > 0 && <CheckChips checks={candidate.checks} />}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 pl-7 sm:pl-0">
        <StageBadge stage={candidate.stage} />
        <FitPill score={candidate.fit?.matchScore} verdict={candidate.fit?.verdict} />
        <span className="w-16 text-right"><AssessmentResult assessment={candidate.assessment} /></span>
      </div>
    </li>
  );

  return (
    <DashboardLayout activeMenu="shortlisting">
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shortlisting</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Build a private shortlist for each job — pick people yourself, or let suggestions check applicants against
              your criteria. Applicants aren't told until you move them to a stage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={jobId}
              onChange={(event) => selectJob(event.target.value)}
              disabled={jobsLoading || jobs.length === 0}
              aria-label="Job"
              className="max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-sm outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {!jobId && <option value="">Choose a job</option>}
              {jobs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title} — {entry.shortlisted}/{entry.applicants}
                  {entry.isClosed ? " (closed)" : ""}
                </option>
              ))}
            </select>
            {jobId && <ExportMenu type="shortlist" params={{ jobId }} label="Export shortlist" disabled={!shortlist.length} />}
          </div>
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-24 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading your jobs…
          </div>
        ) : jobsFailed ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-100 bg-white py-20 text-center dark:border-rose-500/20 dark:bg-gray-900">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Could not load your jobs.</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center dark:border-gray-700 dark:bg-gray-900">
            <ListChecks className="mb-3 h-10 w-10 text-indigo-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No jobs to shortlist for yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Post a job; once people apply you can shortlist them here.</p>
            <button
              type="button"
              onClick={() => navigate("/post-job")}
              className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Post a job
            </button>
          </div>
        ) : (
          <>
            {/* Figures */}
            <div className="grid gap-3 sm:grid-cols-3">
              <ShortlistKpiCard
                label="Open applicants"
                value={counts ? counts.open : "—"}
                detail={counts ? `${counts.applicants} applied in total` : ""}
                icon={Users}
                tone="sky"
              />
              <ShortlistKpiCard
                label="On the shortlist"
                value={counts ? counts.shortlisted : "—"}
                detail="Private to you"
                icon={Star}
                tone="violet"
              />
              <ShortlistKpiCard
                label="Not scored by AI"
                value={counts ? counts.unscored : "—"}
                icon={Wand2}
                tone="amber"
              >
                {counts?.unscored > 0 ? (
                  <button
                    type="button"
                    onClick={scoreApplicants}
                    disabled={scoring}
                    className="inline-flex items-center gap-1 font-label-md font-bold text-primary transition-colors hover:text-brand-indigo-dark hover:underline disabled:opacity-60 dark:text-indigo-300"
                  >
                    {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    {scoring ? "Scoring — this can take a minute…" : "Score them now"}
                  </button>
                ) : (
                  <span>{counts ? "Everyone open has a fit score" : ""}</span>
                )}
              </ShortlistKpiCard>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
              {[
                { id: "shortlist", label: `Shortlist${counts ? ` (${counts.shortlisted})` : ""}`, icon: Star },
                { id: "find", label: "Find candidates", icon: Search },
              ].map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setTab(entry.id)}
                    className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                      tab === entry.id
                        ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                        : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {entry.label}
                  </button>
                );
              })}
            </div>

            {detailLoading && !detail ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : tab === "shortlist" ? (
              /* ---------------- The shortlist ---------------- */
              <div className="space-y-3">
                {listSelection.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                    <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{listSelection.size} selected</span>
                    <button
                      type="button"
                      onClick={() => setAdvancing(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> Move to a stage…
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromShortlist([...listSelection])}
                      disabled={removing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-transparent dark:text-indigo-300"
                    >
                      {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Remove from shortlist
                    </button>
                    <button
                      type="button"
                      onClick={() => setListSelection(new Set())}
                      className="ml-auto text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                {shortlist.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                    <Star className="mb-3 h-10 w-10 text-amber-300" />
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Nobody on the shortlist for {job?.title || "this job"} yet</h3>
                    <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                      Get suggestions checked against your criteria, or pick applicants yourself. You can also star anyone
                      from the Applicants list.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("find")}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <Sparkles className="h-4 w-4" /> Find candidates
                    </button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-220 text-left text-sm">
                        <thead className="border-b border-gray-100 bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-500">
                          <tr>
                            <th scope="col" className="w-10 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={allListedSelected}
                                onChange={() =>
                                  setListSelection(allListedSelected ? new Set() : new Set(shortlist.map((candidate) => candidate.id)))
                                }
                                aria-label="Select everyone on the shortlist"
                                className="h-4 w-4 accent-indigo-600"
                              />
                            </th>
                            <th scope="col" className="px-3 py-3">Applicant</th>
                            <th scope="col" className="px-3 py-3">Stage</th>
                            <th scope="col" className="px-3 py-3">AI fit</th>
                            <th scope="col" className="px-3 py-3">Assessment</th>
                            <th scope="col" className="px-3 py-3">Added</th>
                            <th scope="col" className="w-72 px-3 py-3">Note</th>
                            <th scope="col" className="px-4 py-3"><span className="sr-only">Remove</span></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {shortlist.map((candidate) => (
                            <tr key={candidate.id} className={listSelection.has(candidate.id) ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""}>
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={listSelection.has(candidate.id)}
                                  onChange={() => toggleListed(candidate.id)}
                                  aria-label={`Select ${candidate.name}`}
                                  className="mt-2 h-4 w-4 accent-indigo-600"
                                />
                              </td>
                              <td className="max-w-64 px-3 py-3 align-top"><ApplicantCell candidate={candidate} jobId={jobId} /></td>
                              <td className="px-3 py-3 align-top"><StageBadge stage={candidate.stage} /></td>
                              <td className="px-3 py-3 align-top"><FitPill score={candidate.fit?.matchScore} verdict={candidate.fit?.verdict} /></td>
                              <td className="px-3 py-3 align-top"><AssessmentResult assessment={candidate.assessment} /></td>
                              <td className="whitespace-nowrap px-3 py-3 align-top">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                    candidate.shortlist?.source === "assisted"
                                      ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                  }`}
                                  title={candidate.shortlist?.source === "assisted" ? "Added from suggestions that met every criterion" : "Added by hand"}
                                >
                                  {candidate.shortlist?.source === "assisted" ? <Sparkles className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
                                  {candidate.shortlist?.source === "assisted" ? "Assisted" : "Manual"}
                                </span>
                                <p className="mt-1 text-xs text-gray-400">{moment(candidate.shortlist?.at).fromNow()}</p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <ShortlistNote
                                  candidate={candidate}
                                  onSaved={(note) =>
                                    setDetail((current) => ({
                                      ...current,
                                      shortlist: current.shortlist.map((entry) =>
                                        entry.id === candidate.id ? { ...entry, shortlist: { ...entry.shortlist, note } } : entry
                                      ),
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-4 py-3 text-right align-top">
                                <button
                                  type="button"
                                  onClick={() => removeFromShortlist([candidate.id])}
                                  disabled={removing}
                                  title="Remove from shortlist"
                                  aria-label={`Remove ${candidate.name} from the shortlist`}
                                  className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Info className="h-3.5 w-3.5" />
                  Select people and choose "Move to a stage" when you're ready to tell them — for example, to your
                  Shortlisted stage.
                </p>
              </div>
            ) : (
              /*  Finding candidates  */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
                    {[
                      { id: "assisted", label: "Assisted", icon: Sparkles },
                      { id: "manual", label: "Manual", icon: Hand },
                    ].map((entry) => {
                      const Icon = entry.icon;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setMode(entry.id)}
                          aria-pressed={mode === entry.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                            mode === entry.id
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          }`}
                        >
                          <Icon className="h-4 w-4" /> {entry.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {mode === "assisted"
                      ? "Every open applicant is checked against your criteria. Nothing is added until you choose."
                      : "Every open applicant not yet on the shortlist, best AI fit first."}
                  </p>
                </div>

                <div className={`grid gap-4 ${mode === "assisted" ? "lg:grid-cols-[20rem_1fr]" : ""}`}>
                  {mode === "assisted" && criteria && (
                    <div className="lg:sticky lg:top-0 lg:self-start">
                      <ShortlistCriteriaPanel
                        criteria={criteria}
                        onChange={updateCriteria}
                        questions={detail?.job?.screeningQuestions || []}
                        onRun={() => runSearch("assisted", criteria)}
                        running={running}
                      />
                    </div>
                  )}

                  <div className="min-w-0 space-y-3">
                    {/* Add bar */}
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      {results?.mode === "assisted" && results.assisted ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{results.counts.suggested}</span> suggested ·{" "}
                          <span className="font-bold text-gray-700 dark:text-gray-200">{results.counts.needsData}</span> need more information ·{" "}
                          <span className="font-bold text-rose-600 dark:text-rose-400">{results.counts.notSuggested}</span> don't match
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <Users className="mr-1 inline h-4 w-4 text-gray-400" />
                          {results ? `${results.counts.total} open applicant${results.counts.total === 1 ? "" : "s"} not on the shortlist` : "…"}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={addSelected}
                        disabled={adding || pickSelection.size === 0}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                        Add {pickSelection.size || ""} to shortlist
                      </button>
                    </div>

                    {mode === "manual" && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={manualQuery}
                          onChange={(event) => setManualQuery(event.target.value)}
                          placeholder="Search applicants by name or email…"
                          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {running && !results ? (
                      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-20 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                        <Loader2 className="h-5 w-5 animate-spin" /> Checking applicants…
                      </div>
                    ) : !results ? null : candidates.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No open applicants left to add</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Everyone still open is already on the shortlist, or nobody has applied yet.
                        </p>
                      </div>
                    ) : results.mode === "assisted" && results.assisted ? (
                      <div className={`space-y-3 transition-opacity ${running ? "opacity-60" : ""}`}>
                        {GROUPS.map((group) => {
                          const members = candidates.filter((candidate) => candidate.verdict === group.verdict);
                          if (members.length === 0) return null;
                          const isOpen = openGroups[group.verdict];
                          const allTicked = members.every((candidate) => pickSelection.has(candidate.id));
                          return (
                            <section key={group.verdict} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                                <button
                                  type="button"
                                  onClick={() => setOpenGroups((current) => ({ ...current, [group.verdict]: !current[group.verdict] }))}
                                  className="flex flex-1 items-center gap-2 text-left"
                                  aria-expanded={isOpen}
                                >
                                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {group.title} <span className="text-gray-400">({members.length})</span>
                                  </span>
                                  <span className="hidden text-xs text-gray-400 sm:inline">{group.hint}</span>
                                </button>
                                {isOpen && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPickSelection((current) => {
                                        const next = new Set(current);
                                        members.forEach((candidate) => (allTicked ? next.delete(candidate.id) : next.add(candidate.id)));
                                        return next;
                                      })
                                    }
                                    className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                                  >
                                    {allTicked ? "Untick all" : "Tick all"}
                                  </button>
                                )}
                              </div>
                              {isOpen && (
                                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                                  {members.map((candidate) => renderCandidateRow(candidate, true))}
                                </ul>
                              )}
                            </section>
                          );
                        })}
                        {results.counts.unscored > 0 && (
                          <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {results.counts.unscored} applicant{results.counts.unscored === 1 ? " has" : "s have"} no AI score yet, so
                            fit, skills and experience can't be checked for them. Use "Score them now" above.
                          </p>
                        )}
                      </div>
                    ) : results.mode === "assisted" ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                        Turn on at least one criterion and choose <span className="font-semibold">Find matches</span>.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        {manualShown.length === 0 ? (
                          <p className="px-6 py-12 text-center text-sm text-gray-500">No applicant matches “{manualQuery}”.</p>
                        ) : (
                          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                            {[...manualShown]
                              .sort((a, b) => (b.fit?.matchScore ?? -1) - (a.fit?.matchScore ?? -1))
                              .map((candidate) => renderCandidateRow(candidate, false))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {advancing && detail && (
        <AdvanceDialog
          jobId={jobId}
          stages={stages}
          phases={phases}
          candidates={selectedShortlisted}
          onClose={() => setAdvancing(false)}
          onDone={() => {
            setListSelection(new Set());
            loadDetail();
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default Shortlisting;
