import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardCheck, Plus, Loader2, Inbox, Clock, ListChecks, Search, ArrowUpDown, Briefcase,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../../components/layout/dashboardLayout";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { ASSESSMENT_STATUS, ATTEMPT_STATUS, formatDuration } from "../../../utils/assessments";
import { AttemptStatusBadge, ResultBadge, ScoreBar } from "./components/AssessmentUI";

/**
 * Assessments home.
 *
 * Two views of the same work: the assessments themselves, and every candidate
 * who has been sent one — with their status and score — in one table, so an
 * employer can see who still needs marking and who did best without opening
 * each assessment in turn.
 */

const TABS = [
  { id: "assessments", label: "Assessments" },
  { id: "scores", label: "Candidate scores" },
];

const AssessmentCard = ({ assessment }) => {
  const stats = assessment.stats || {};
  const status = ASSESSMENT_STATUS[assessment.status] || ASSESSMENT_STATUS.draft;
  return (
    <Link
      to={`/assessments/${assessment.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-gray-900 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
            {assessment.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400 dark:text-gray-500">
            <Briefcase className="h-3 w-3 shrink-0" />
            {assessment.jobTitle || "Not linked to a job"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.badge}`}>{status.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="h-3.5 w-3.5" />
          {assessment.questionCount} question{assessment.questionCount === 1 ? "" : "s"} · {assessment.totalPoints} pts
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "Untimed"}
        </span>
        <span>Pass mark {assessment.passMark}%</span>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-gray-50 pt-3 text-center dark:border-gray-800">
        {[
          { label: "Sent", value: stats.sent ?? 0 },
          { label: "Done", value: stats.completed ?? 0 },
          { label: "To mark", value: stats.awaitingMarking ?? 0, warn: stats.awaitingMarking > 0 },
          { label: "Average", value: stats.averagePercent !== null && stats.averagePercent !== undefined ? `${stats.averagePercent}%` : "—" },
        ].map((item) => (
          <div key={item.label}>
            <p className={`text-base font-bold ${item.warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}>
              {item.value}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
};

const ScoresTable = ({ assessments }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentId, setAssessmentId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sortByScore, setSortByScore] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ASSESSMENTS.ATTEMPTS, {
        params: { assessmentId: assessmentId || undefined, status: status || undefined },
      });
      setRows(res.data.attempts || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load candidate scores.");
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, status]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((row) => `${row.candidateName} ${row.jobTitle} ${row.assessmentTitle}`.toLowerCase().includes(q))
      : rows;
    if (!sortByScore) return filtered;
    // Marked results first, best first; then those still to mark; then the rest.
    const rank = (row) => (row.percent !== null ? 2 : row.status === "submitted" ? 1 : 0);
    return [...filtered].sort((a, b) => rank(b) - rank(a) || (b.percent ?? -1) - (a.percent ?? -1));
  }, [rows, search, sortByScore]);

  const selectClass =
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Candidate, job or assessment"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className={selectClass} aria-label="Assessment">
          <option value="">All assessments</option>
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.title}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(ATTEMPT_STATUS).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortByScore((value) => !value)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            sortByScore
              ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
              : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
          }`}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortByScore ? "Best score first" : "Most recent first"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Inbox className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="font-semibold text-gray-700 dark:text-gray-200">No candidates here yet</p>
            <p className="mt-1 text-sm text-gray-400">Send an assessment to applicants and their results appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/40">
                <tr>
                  <th className="px-4 py-3 font-bold">Candidate</th>
                  <th className="px-4 py-3 font-bold">Assessment</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">Result</th>
                  <th className="px-4 py-3 font-bold">Time taken</th>
                  <th className="px-4 py-3 font-bold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/assessments/${row.assessmentId}?attempt=${row.id}`)}
                    className="cursor-pointer transition hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{row.candidateName}</p>
                      <p className="text-xs text-gray-400">
                        {row.jobTitle}
                        {row.stage ? ` · ${row.stage}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.assessmentTitle}</td>
                    <td className="px-4 py-3">
                      <AttemptStatusBadge status={row.status} awaiting={row.awaitingMarking} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar percent={row.percent} score={row.score} maxScore={row.maxScore} passMark={row.passMark} />
                    </td>
                    <td className="px-4 py-3">
                      <ResultBadge passed={row.passed} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDuration(row.timeTakenSeconds)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {row.submittedAt
                        ? moment(row.submittedAt).format("D MMM, HH:mm")
                        : row.status === "invited"
                          ? `Due ${moment(row.dueAt).fromNow()}`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Assessments = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "scores" ? "scores" : "assessments";
  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.LIST)
      .then((res) => {
        if (!cancelled) setAssessments(res.data.assessments || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.response?.data?.message || "Could not load assessments.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toMark = assessments.reduce((sum, assessment) => sum + (assessment.stats?.awaitingMarking || 0), 0);

  return (
    <DashboardLayout activeMenu="assessments">
      <div className="mx-auto max-w-6xl space-y-5 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <ClipboardCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              Assessments
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Build skills tests, send them to applicants, and compare everyone&apos;s scores.
            </p>
          </div>
          <Link
            to="/assessments/new"
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New assessment
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1 self-start rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSearchParams(option.id === "scores" ? { tab: "scores" } : {})}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                tab === option.id
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-gray-900 dark:text-indigo-300"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {option.label}
              {option.id === "scores" && toMark > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  {toMark} to mark
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "scores" ? (
          <ScoresTable assessments={assessments} />
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
            <ClipboardCheck className="mb-3 h-10 w-10 text-indigo-300" />
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Create your first assessment</p>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Write your own questions or have AI draft them from a job, then send the test to applicants and score
              their answers side by side.
            </p>
            <Link
              to="/assessments/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              New assessment
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assessments.map((assessment) => (
              <AssessmentCard key={assessment.id} assessment={assessment} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Assessments;
