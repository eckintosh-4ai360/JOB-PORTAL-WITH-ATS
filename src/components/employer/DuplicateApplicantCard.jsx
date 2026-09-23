import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, X, Loader2 } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { EVIDENCE_ICONS, FALLBACK_EVIDENCE_ICON } from "../../utils/duplicateEvidence";

/**
 * Other applicants who look like this one — the same person applying twice,
 * as a guest and with an account, or under two emails. Only this employer's
 * own applicants are compared, using only what those applicants sent them.
 */

const DuplicateApplicantCard = ({ matches, currentJobId, onSelectApplication, onDecided }) => {
  const [busy, setBusy] = useState(null);

  const decide = async (match, decision) => {
    setBusy(`${match.otherKey}:${decision}`);
    try {
      const res = await axiosInstance.post(API_PATHS.APPLICATIONS.DUPLICATES_REVIEW, {
        keys: [match.key, match.otherKey],
        decision,
      });
      toast.success(res.data.message);
      onDecided?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save that.");
    } finally {
      setBusy(null);
    }
  };

  if (!matches?.length) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/5">
      <div className="mb-3 flex items-center gap-2">
        <Copy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {matches.some((m) => m.decision === "same") ? "Same person as another applicant" : "Possible duplicate applicant"}
        </h3>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <div key={match.otherKey} className="rounded-xl border border-amber-100 bg-white p-4 dark:border-amber-500/20 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{match.otherName}</p>
              {match.otherIsGuest && (
                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
                  Guest
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  match.decision === "same"
                    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    : match.confidence === "high"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                {match.decision === "same" ? "You confirmed: same person" : match.confidence === "high" ? "Very likely the same person" : "Possibly the same person"}
              </span>
            </div>

            <ul className="mt-2 space-y-1">
              {match.otherApplications.map((app) =>
                app.jobId === currentJobId ? (
                  <li key={app.applicationId}>
                    <button
                      type="button"
                      onClick={() => onSelectApplication?.(app.applicationId)}
                      className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Also applied for this job · {app.stage} · {moment(app.appliedAt).fromNow()} — view
                    </button>
                  </li>
                ) : (
                  <li key={app.applicationId}>
                    <Link
                      to={`/applicants?jobId=${app.jobId}&application=${app.applicationId}`}
                      className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400"
                    >
                      Applied for {app.jobTitle} · {app.stage} · {moment(app.appliedAt).fromNow()}
                    </Link>
                  </li>
                )
              )}
            </ul>

            <ul className="mt-3 space-y-1.5">
              {match.evidence.map((item, index) => {
                const Icon = EVIDENCE_ICONS[item.code] || FALLBACK_EVIDENCE_ICON;
                return (
                  <li
                    key={`${item.code}-${index}`}
                    className={`flex items-start gap-2 text-xs ${
                      item.strength === "against" ? "text-sky-700 dark:text-sky-300" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{item.label}</span>
                      {item.detail ? ` — ${item.detail}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>

            {match.decision !== "same" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => decide(match, "distinct")}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {busy === `${match.otherKey}:distinct` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  Not the same person
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => decide(match, "same")}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === `${match.otherKey}:same` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Same person
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DuplicateApplicantCard;
