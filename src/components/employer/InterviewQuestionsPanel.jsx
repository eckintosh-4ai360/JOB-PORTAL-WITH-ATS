import { useEffect, useState } from "react";
import { MessageSquareText, Loader2, Copy, RefreshCw, Sparkles, Lock, ChevronDown } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Interview questions for one applicant.
 *
 * The guide is saved per application, so an interviewer who comes back during
 * the interview sees the same questions they prepared with. It is for the
 * hiring team only — no candidate-facing page or email ever includes it.
 */

const CATEGORY_LABEL = {
  role: "About the role",
  behavioural: "Behavioural",
  candidate: "About this applicant",
};

const CATEGORY_ORDER = ["role", "behavioural", "candidate"];

const asText = (questions) =>
  CATEGORY_ORDER.flatMap((category) => {
    const items = questions.filter((q) => q.category === category);
    if (items.length === 0) return [];
    return [
      CATEGORY_LABEL[category].toUpperCase(),
      ...items.map((q, i) =>
        [
          `${i + 1}. ${q.question}`,
          q.lookFor ? `   Listen for: ${q.lookFor}` : "",
          q.followUp ? `   Follow-up: ${q.followUp}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      ),
      "",
    ];
  }).join("\n");

const InterviewQuestionsPanel = ({ applicationId, applicantName, canTailor, hasAssessment }) => {
  // Keyed by application, so a guide that arrives after the employer has moved
  // to another applicant lands on the right one. Absent means not loaded yet.
  const [guides, setGuides] = useState({});
  const [generatingFor, setGeneratingFor] = useState(null);
  const [tailor, setTailor] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const isLoading = !(applicationId in guides);
  const isGenerating = generatingFor === applicationId;
  const guide = guides[applicationId] || null;

  useEffect(() => {
    if (!applicationId || applicationId in guides) return undefined;
    let cancelled = false;

    axiosInstance
      .get(API_PATHS.AI.INTERVIEW_QUESTIONS(applicationId))
      .then((res) => {
        if (!cancelled) setGuides((current) => ({ ...current, [applicationId]: res.data.guide }));
      })
      .catch(() => {
        if (!cancelled) setGuides((current) => ({ ...current, [applicationId]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, guides]);

  const generate = async () => {
    const id = applicationId;
    setGeneratingFor(id);
    try {
      const res = await axiosInstance.post(API_PATHS.AI.INTERVIEW_QUESTIONS(id), {
        tailor: canTailor && tailor,
      });
      setGuides((current) => ({ ...current, [id]: res.data.guide }));
      setExpanded(true);
      if (res.data.guide?.degraded) {
        toast("AI is not available, so these were written from templates using the job's requirements.");
      }
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "You've generated a lot of questions this hour. Try again shortly."
          : err.response?.data?.message || "Could not generate interview questions."
      );
    } finally {
      setGeneratingFor((current) => (current === id ? null : current));
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(asText(guide.questions));
      toast.success("Questions copied");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  };

  const questions = guide?.questions || [];

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Interview questions</h3>
        {guide && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {guide.tailored ? "tailored" : "for the role"} · {moment(guide.updatedAt).fromNow()}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {questions.length > 0 && (
            <>
              <button
                type="button"
                onClick={copyAll}
                title="Copy all questions"
                aria-label="Copy all questions"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse questions" : "Expand questions"}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
        <Lock className="h-3 w-3" />
        Only your hiring team sees these. Every question is about the job.
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : guide ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGenerating ? "Writing questions…" : guide ? "Regenerate" : "Generate questions"}
            </button>

            {canTailor && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={tailor}
                  onChange={(e) => setTailor(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-indigo-600"
                />
                Tailor to {applicantName || "this applicant"}
                {!hasAssessment && <span className="text-gray-400">(uses their profile — no fit assessment yet)</span>}
              </label>
            )}
          </div>

          {expanded && questions.length > 0 && (
            <div className="mt-4 space-y-4">
              {CATEGORY_ORDER.map((category) => {
                const items = questions.filter((q) => q.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {CATEGORY_LABEL[category]}
                    </p>
                    <ol className="space-y-2.5">
                      {items.map((q, index) => (
                        <li
                          key={q.question}
                          className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40"
                        >
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            <span className="mr-1.5 text-indigo-500">{index + 1}.</span>
                            {q.question}
                          </p>
                          {q.lookFor && (
                            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Listen for: </span>
                              {q.lookFor}
                            </p>
                          )}
                          {q.followUp && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Follow-up: </span>
                              {q.followUp}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InterviewQuestionsPanel;
