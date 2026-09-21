import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, Copy, FileWarning, Loader2, RefreshCw, ShieldAlert,
  ShieldCheck, UserX, X, Check, ChevronRight, Inbox, Sparkles,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * The human half of the fraud pipeline.
 *
 * Automated screening opens cases; this is where a person decides them. The
 * screen is built around one idea: a reviewer should never have to take the
 * score on trust. Every rule that fired, its weight, and whatever the model
 * added are all on the page before any action button is reachable.
 */

const CATEGORY_META = {
  fake_company: { label: "Fake company", icon: Building2 },
  duplicate_job: { label: "Duplicate job", icon: Copy },
  spam_recruiter: { label: "Spam recruiter", icon: UserX },
  fake_resume: { label: "Fake resume", icon: FileWarning },
};

const BAND_STYLES = {
  critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  high: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  medium: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  low: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
};

const VERDICT_COPY = {
  likely_fraud: "Model agrees this is likely fraud",
  suspicious: "Model finds it suspicious but not conclusive",
  likely_legitimate: "Model believes this is legitimate",
};

/** Which actions make sense for which kind of subject. */
const ACTIONS_FOR = (entityType, subject) => {
  const dismiss = { id: "dismiss", label: "Dismiss", tone: "neutral" };
  const escalate = { id: "escalate", label: "Escalate", tone: "neutral" };

  if (entityType === "job") {
    return [
      subject?.moderationState === "hidden"
        ? { id: "restore_job", label: "Restore job", tone: "safe" }
        : { id: "hide_job", label: "Hide job", tone: "danger" },
      dismiss,
      escalate,
    ];
  }
  if (entityType === "user") {
    return [
      subject?.trustState === "suspended"
        ? { id: "reinstate_recruiter", label: "Reinstate recruiter", tone: "safe" }
        : { id: "suspend_recruiter", label: "Suspend recruiter", tone: "danger" },
      dismiss,
      escalate,
    ];
  }
  if (entityType === "company") {
    return [
      subject?.trustState === "flagged"
        ? { id: "clear_company", label: "Clear company", tone: "safe" }
        : { id: "flag_company", label: "Flag company", tone: "danger" },
      dismiss,
      escalate,
    ];
  }
  return [{ id: "reject_resume", label: "Reject resume", tone: "danger" }, dismiss, escalate];
};

const Band = ({ band, score }) => (
  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${BAND_STYLES[band] || BAND_STYLES.low}`}>
    {band} · {score}
  </span>
);

const StatTile = ({ label, value, hint, tone = "default" }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
    <p className={`mt-1 text-2xl font-extrabold ${tone === "danger" ? "text-rose-600 dark:text-rose-400" : "text-gray-900 dark:text-gray-100"}`}>
      {value}
    </p>
    {hint && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

const ModerationQueue = () => {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ state: "open", category: "", band: "" });

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [note, setNote] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);

  const loadQueue = useCallback(async (isCancelled = () => false) => {
    setIsLoading(true);
    try {
      const params = {};
      if (filters.state) params.state = filters.state;
      if (filters.category) params.category = filters.category;
      if (filters.band) params.band = filters.band;

      const [caseRes, statRes] = await Promise.all([
        axiosInstance.get(API_PATHS.MODERATION.GET_CASES, { params }),
        axiosInstance.get(API_PATHS.MODERATION.GET_STATS),
      ]);
      // Filters can change while a request is in flight; without this a slow
      // earlier response can land after a newer one and show the wrong queue.
      if (isCancelled()) return;
      setCases(caseRes.data?.cases || []);
      setStats(statRes.data || null);
    } catch (err) {
      if (isCancelled()) return;
      console.error("Failed to load moderation queue:", err);
      toast.error(err.response?.data?.message || "Could not load the moderation queue.");
    } finally {
      if (!isCancelled()) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    // Deferred so the fetch does not set state synchronously inside the effect.
    const run = Promise.resolve().then(() => {
      if (!cancelled) return loadQueue(() => cancelled);
      return undefined;
    });
    return () => {
      cancelled = true;
      void run;
    };
  }, [loadQueue]);

  const openCase = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setNote("");
    setIsLoadingDetail(true);
    try {
      const res = await axiosInstance.get(API_PATHS.MODERATION.GET_CASE(id));
      setDetail(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not open that case.");
      setSelectedId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const decide = async (action) => {
    if (!selectedId) return;
    setIsDeciding(true);
    try {
      const res = await axiosInstance.post(API_PATHS.MODERATION.DECIDE_CASE(selectedId), { action, note });
      toast.success(res.data?.message || "Decision recorded.");
      setSelectedId(null);
      setDetail(null);
      loadQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not record that decision.");
    } finally {
      setIsDeciding(false);
    }
  };

  const rescan = async () => {
    if (!detail?.case) return;
    setIsRescanning(true);
    try {
      await axiosInstance.post(API_PATHS.MODERATION.RESCAN, {
        entityType: detail.case.entityType,
        entityId: detail.case.entityId,
      });
      toast.success("Rescan complete.");
      openCase(selectedId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Rescan failed.");
    } finally {
      setIsRescanning(false);
    }
  };

  const signals = useMemo(() => {
    const raw = detail?.case?.assessment?.signals;
    return Array.isArray(raw) ? [...raw].sort((a, b) => b.weight - a.weight) : [];
  }, [detail]);

  const aiReasons = useMemo(() => {
    const raw = detail?.case?.assessment?.aiReasons;
    return Array.isArray(raw) ? raw : [];
  }, [detail]);

  const subject = detail?.case?.subject;
  const assessment = detail?.case?.assessment;

  return (
    <DashboardLayout activeMenu="admin-moderation">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <ShieldAlert className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Trust &amp; Safety
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cases raised by automated screening. Every rule that fired is shown before you decide.
            </p>
          </div>
          <button
            type="button"
            onClick={loadQueue}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Headline numbers */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Open cases" value={stats.openCases ?? 0} tone={stats.openCases ? "danger" : "default"} />
            <StatTile label="Hidden jobs" value={stats.hiddenJobs ?? 0} />
            <StatTile label="Suspended" value={stats.suspendedRecruiters ?? 0} hint="recruiters" />
            <StatTile label="Scanned" value={stats.assessmentsLast30Days ?? 0} hint="last 30 days" />
            <StatTile
              label="Dismissed"
              value={stats.falsePositiveRate === null ? "—" : `${stats.falsePositiveRate}%`}
              hint="of decided cases"
            />
          </div>
        )}

        {stats && !stats.aiEnabled && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            No AI key is configured, so cases are scored by the deterministic rules alone. Detection still works;
            adjudication notes will be missing.
          </p>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "state", value: "", label: "All states" },
            { key: "state", value: "open", label: "Open" },
            { key: "state", value: "in_review", label: "In review" },
            { key: "state", value: "actioned", label: "Actioned" },
            { key: "state", value: "dismissed", label: "Dismissed" },
          ].map((tab) => {
            const active = filters.state === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, state: tab.value }))}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-indigo-500"
                    : "border border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="ml-auto rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Loading cases…</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-4 py-20 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <ShieldCheck className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Nothing to review</h3>
            <p className="mt-1 max-w-sm text-xs text-gray-400 dark:text-gray-500">
              No cases match this filter. Screening runs automatically whenever a job, company profile or
              resume is submitted.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cases.map((item) => {
              const meta = CATEGORY_META[item.category] || { label: item.category, icon: Inbox };
              const Icon = meta.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openCase(item.id)}
                  className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-500/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {meta.label}
                      </span>
                      <Band band={item.band} score={item.score} />
                      {item.autoAction && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                          auto: {item.autoAction.replace(/_/g, " ")}
                        </span>
                      )}
                      {item.state === "in_review" && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                          escalated
                        </span>
                      )}
                    </div>

                    <p className="mt-1 truncate font-bold text-gray-900 dark:text-gray-100">{item.summary}</p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {moment(item.createdAt).fromNow()}
                      {item.assessment?.degraded && " · scored without AI"}
                    </p>
                  </div>

                  <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Case detail */}
      {selectedId && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative my-8 w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => { setSelectedId(null); setDetail(null); }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>

            {isLoadingDetail || !detail ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="text-xs font-semibold text-gray-400">Loading case…</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {(CATEGORY_META[detail.case.category] || {}).label || detail.case.category}
                    </span>
                    <Band band={detail.case.band} score={detail.case.score} />
                  </div>
                  <h2 className="mt-1.5 pr-8 text-lg font-extrabold text-gray-900 dark:text-gray-100">
                    {detail.case.summary}
                  </h2>
                </div>

                {/* How the score was built — rules first, AI second, always visible. */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      How this score was built
                    </p>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      rules {assessment?.ruleScore ?? "—"}
                      {typeof assessment?.aiAdjustment === "number" && assessment.aiAdjustment !== 0 && (
                        <> {assessment.aiAdjustment > 0 ? "+" : ""}{assessment.aiAdjustment} AI</>
                      )}
                      {" = "}{detail.case.score}
                    </p>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {signals.map((sig) => (
                      <li key={sig.id} className="flex items-start gap-3">
                        <span className="mt-0.5 w-9 shrink-0 rounded-md bg-gray-200 px-1 py-0.5 text-center font-mono text-[11px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          {sig.weight}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{sig.label}</p>
                          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">{sig.detail}</p>
                        </div>
                      </li>
                    ))}
                    {signals.length === 0 && (
                      <li className="text-xs text-gray-400">No deterministic signals recorded.</li>
                    )}
                  </ul>
                </div>

                {/* AI adjudication */}
                {assessment?.aiVerdict ? (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI adjudication · {assessment.aiConfidence}% confident
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                      {VERDICT_COPY[assessment.aiVerdict] || assessment.aiVerdict}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {aiReasons.map((reason, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs leading-5">
                          <span className={reason.supports === "fraud"
                            ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                            : "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"} />
                          <span className="text-gray-700 dark:text-gray-300">{reason.point}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-violet-700/70 dark:text-violet-300/70">
                      The model may move the score by at most ±{stats?.thresholds?.aiMaxAdjustment ?? 15} points.
                      The rules decide the rest.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                    No AI adjudication on this case — it scored below the review threshold, or the model was
                    unavailable.
                  </p>
                )}

                {/* Subject */}
                {subject && (
                  <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {detail.case.entityType}
                    </p>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      {Object.entries({
                        Name: subject.title || subject.name || subject.fileName,
                        Email: subject.email || subject.contactEmail || subject.user?.email,
                        Company: subject.companyName || subject.company?.name,
                        Location: subject.location || subject.hq,
                        Website: subject.website,
                        State: subject.moderationState || subject.trustState,
                        Created: subject.createdAt ? moment(subject.createdAt).format("DD MMM YYYY") : null,
                      })
                        .filter(([, value]) => value)
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-3 border-b border-gray-50 py-1 dark:border-gray-800/60">
                            <dt className="text-xs font-semibold text-gray-400 dark:text-gray-500">{key}</dt>
                            <dd className="truncate text-xs font-bold text-gray-800 dark:text-gray-200">{String(value)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                )}

                {/* History */}
                {detail.case.events?.length > 0 && (
                  <details className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                    <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      History ({detail.case.events.length})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {detail.case.events.map((event) => (
                        <li key={event.id} className="text-xs">
                          <span className="font-bold text-gray-800 dark:text-gray-200">{event.action}</span>
                          <span className="text-gray-400 dark:text-gray-500">
                            {" · "}{event.actorName || "system"}{" · "}{moment(event.createdAt).fromNow()}
                          </span>
                          {event.note && <p className="mt-0.5 text-gray-500 dark:text-gray-400">{event.note}</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Decision */}
                {["open", "in_review"].includes(detail.case.state) ? (
                  <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <textarea
                      rows="2"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Why are you deciding this way? Recorded against the case."
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {ACTIONS_FOR(detail.case.entityType, subject).map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          disabled={isDeciding}
                          onClick={() => decide(action.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                            action.tone === "danger"
                              ? "bg-rose-600 text-white hover:bg-rose-700"
                              : action.tone === "safe"
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                          }`}
                        >
                          {action.tone === "safe" && <Check className="h-4 w-4" />}
                          {action.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={rescan}
                        disabled={isRescanning || detail.case.entityType === "user"}
                        title={detail.case.entityType === "user" ? "Rescan a job or company instead" : "Re-run screening"}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin" : ""}`} />
                        Rescan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-gray-100 pt-4 text-sm font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    Decided {moment(detail.case.decidedAt).fromNow()} — {detail.case.decision}.
                    {detail.case.decisionNote && ` "${detail.case.decisionNote}"`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ModerationQueue;
