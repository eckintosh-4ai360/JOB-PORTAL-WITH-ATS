import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Send, Pencil, Archive, RotateCcw, Trash2, Clock, ListChecks, Briefcase, Check, BookOpen, Inbox,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../../components/layout/dashboardLayout";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { ASSESSMENT_STATUS, formatDuration, isChoice, typeOf } from "../../../utils/assessments";
import { AttemptStatusBadge, ResultBadge, ScoreBar, StatTile } from "./components/AssessmentUI";
import AttemptReview from "./components/AttemptReview";
import SendAssessmentDialog from "./components/SendAssessmentDialog";

/**
 * One assessment: who it was sent to and how they did, and the questions
 * themselves with the answer key. Opening a candidate shows their answers with
 * the marks beside them.
 */

const QuestionSheet = ({ questions }) => (
  <ol className="space-y-3">
    {questions.map((question, index) => (
      <li key={question.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            Q{index + 1}
          </span>
          {typeOf(question.type).label}
          <span className="ml-auto font-bold text-gray-500">
            {question.points} pt{question.points === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-gray-900 dark:text-gray-100">{question.prompt}</p>
        {isChoice(question) ? (
          <ul className="mt-3 space-y-1.5">
            {question.options.map((option) => {
              const right = question.correct.includes(option.id);
              return (
                <li
                  key={option.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    right
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-gray-100 text-gray-600 dark:border-gray-800 dark:text-gray-400"
                  }`}
                >
                  {right ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                  {option.text}
                </li>
              );
            })}
          </ul>
        ) : (
          question.guidance && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-bold">Marking guide: </span>
                {question.guidance}
              </span>
            </p>
          )
        )}
      </li>
    ))}
  </ol>
);

const AssessmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openAttempt = searchParams.get("attempt");

  const [assessment, setAssessment] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [tab, setTab] = useState("candidates");
  const [isSendOpen, setIsSendOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.ASSESSMENTS.GET(id));
      setAssessment(res.data.assessment);
      setCandidates(res.data.candidates || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load this assessment.");
      navigate("/assessments");
    }
  }, [id, navigate]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const closeReview = useCallback(() => setSearchParams({}), [setSearchParams]);

  const setStatus = async (status) => {
    try {
      await axiosInstance.patch(API_PATHS.ASSESSMENTS.SET_STATUS(id), { status });
      toast.success(status === "archived" ? "Assessment archived" : "Assessment reactivated");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the assessment.");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this assessment? This cannot be undone.")) return;
    try {
      await axiosInstance.delete(API_PATHS.ASSESSMENTS.DELETE(id));
      toast.success("Assessment deleted");
      navigate("/assessments");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete the assessment.");
    }
  };

  if (!assessment) {
    return (
      <DashboardLayout activeMenu="assessments">
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = assessment.stats || {};
  const status = ASSESSMENT_STATUS[assessment.status] || ASSESSMENT_STATUS.draft;

  return (
    <DashboardLayout activeMenu="assessments">
      <div className="mx-auto max-w-6xl space-y-5 pb-12">
        <Link to="/assessments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4" />
          All assessments
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{assessment.title}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.badge}`}>{status.label}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {assessment.jobTitle || "Not linked to a job"}
              </span>
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-4 w-4" />
                {assessment.questionCount} questions · {assessment.totalPoints} points
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutes` : "Untimed"}
              </span>
              <span>Pass mark {assessment.passMark}%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {assessment.status !== "archived" && (
              <button
                type="button"
                onClick={() => setIsSendOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Send className="h-4 w-4" />
                Send to candidates
              </button>
            )}
            <Link
              to={`/assessments/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
            {assessment.status === "archived" ? (
              <button type="button" onClick={() => setStatus("active")} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                <RotateCcw className="h-4 w-4" />
                Reactivate
              </button>
            ) : (
              <button type="button" onClick={() => setStatus("archived")} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                <Archive className="h-4 w-4" />
                Archive
              </button>
            )}
            {stats.sent === 0 && (
              <button type="button" onClick={remove} aria-label="Delete assessment" className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-gray-900">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Sent" value={stats.sent ?? 0} />
          <StatTile label="Completed" value={stats.completed ?? 0} hint={stats.inProgress ? `${stats.inProgress} taking it now` : undefined} />
          <StatTile label="To mark" value={stats.awaitingMarking ?? 0} tone={stats.awaitingMarking ? "warn" : undefined} />
          <StatTile label="Average" value={stats.averagePercent !== null && stats.averagePercent !== undefined ? `${stats.averagePercent}%` : "—"} />
          <StatTile label="Pass rate" value={stats.passRate !== null && stats.passRate !== undefined ? `${stats.passRate}%` : "—"} />
        </div>

        <div className="flex items-center gap-1 self-start rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          {[
            { id: "candidates", label: `Candidates (${candidates.length})` },
            { id: "questions", label: `Questions (${assessment.questionCount})` },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                tab === option.id
                  ? "bg-white text-indigo-700 shadow-xs dark:bg-gray-900 dark:text-indigo-300"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {tab === "questions" ? (
          <QuestionSheet questions={assessment.questions} />
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Inbox className="mb-2 h-8 w-8 text-gray-300" />
            <p className="font-semibold text-gray-800 dark:text-gray-100">Not sent to anyone yet</p>
            <p className="mt-1 text-sm text-gray-400">Send it to applicants and their scores appear here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:bg-gray-800/40">
                  <tr>
                    <th className="px-4 py-3 font-bold">Candidate</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Score</th>
                    <th className="px-4 py-3 font-bold">Result</th>
                    <th className="px-4 py-3 font-bold">Time taken</th>
                    <th className="px-4 py-3 font-bold">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {[...candidates]
                    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
                    .map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSearchParams({ attempt: row.id })}
                        className="cursor-pointer transition hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{row.candidateName}</p>
                          <p className="text-xs text-gray-400">
                            {row.jobTitle}
                            {row.stage ? ` · ${row.stage}` : ""}
                          </p>
                        </td>
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
          </div>
        )}
      </div>

      {isSendOpen && (
        <SendAssessmentDialog
          assessment={assessment}
          onClose={() => setIsSendOpen(false)}
          onSent={() => {
            setIsSendOpen(false);
            load();
          }}
        />
      )}

      {openAttempt && <AttemptReview attemptId={openAttempt} onClose={closeReview} onSaved={load} />}
    </DashboardLayout>
  );
};

export default AssessmentDetail;
