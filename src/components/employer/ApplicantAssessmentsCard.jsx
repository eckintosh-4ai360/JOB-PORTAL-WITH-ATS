import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { AttemptStatusBadge, ScoreBar } from "../../pages/Employer/Assessments/components/AssessmentUI";

/**
 * This applicant's assessments and scores, on the applicant screen, each
 * linking to the full question-by-question result.
 */
const ApplicantAssessmentsCard = ({ applicationId }) => {
  // Keyed by application so a slow response never lands on the wrong applicant.
  const [byApplication, setByApplication] = useState({});
  const attempts = byApplication[applicationId];

  useEffect(() => {
    if (!applicationId || applicationId in byApplication) return undefined;
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.ATTEMPTS, { params: { applicationId } })
      .then((res) => {
        if (!cancelled) setByApplication((current) => ({ ...current, [applicationId]: res.data.attempts || [] }));
      })
      .catch(() => {
        if (!cancelled) setByApplication((current) => ({ ...current, [applicationId]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, byApplication]);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Assessments</h3>
        <Link to="/assessments" className="ml-auto text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Send an assessment
        </Link>
      </div>

      {attempts === undefined ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : attempts.length === 0 ? (
        <p className="text-sm text-gray-400">No assessment sent to this applicant yet.</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-800">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <Link
                to={`/assessments/${attempt.assessmentId}?attempt=${attempt.id}`}
                className="group flex items-center gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800 group-hover:text-indigo-600 dark:text-gray-200">
                    {attempt.assessmentTitle}
                  </p>
                  <div className="mt-1">
                    <AttemptStatusBadge status={attempt.status} awaiting={attempt.awaitingMarking} />
                  </div>
                </div>
                <ScoreBar percent={attempt.percent} score={attempt.score} maxScore={attempt.maxScore} passMark={attempt.passMark} />
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-indigo-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ApplicantAssessmentsCard;
