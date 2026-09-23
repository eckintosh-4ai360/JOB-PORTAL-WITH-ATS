import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Send, Search } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import { ATTEMPT_STATUS } from "../../../../utils/assessments";

/**
 * Choose applicants to send an assessment to. Each is emailed a link; someone
 * who was sent it but never started can be sent it again with a new deadline.
 */
const SendAssessmentDialog = ({ assessment, onClose, onSent }) => {
  const [applicants, setApplicants] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [dueInDays, setDueInDays] = useState(assessment.defaultDueDays || 7);
  const [search, setSearch] = useState("");
  const [hideRejected, setHideRejected] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.ASSESSMENTS.ELIGIBLE(assessment.id))
      .then((res) => {
        if (!cancelled) setApplicants(res.data.applicants || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Could not load applicants.");
        setApplicants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assessment.id]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (applicants || []).filter(
      (applicant) =>
        (!hideRejected || !applicant.rejected) &&
        (!q || `${applicant.name} ${applicant.jobTitle} ${applicant.stage}`.toLowerCase().includes(q))
    );
  }, [applicants, search, hideRejected]);

  const eligibleVisible = visible.filter((applicant) => applicant.eligible);
  const allSelected = eligibleVisible.length > 0 && eligibleVisible.every((a) => selected.has(a.applicationId));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      for (const applicant of eligibleVisible) {
        if (allSelected) next.delete(applicant.applicationId);
        else next.add(applicant.applicationId);
      }
      return next;
    });

  const send = async () => {
    setIsSending(true);
    try {
      const res = await axiosInstance.post(API_PATHS.ASSESSMENTS.SEND(assessment.id), {
        applicationIds: [...selected],
        dueInDays: Number(dueInDays),
      });
      toast.success(res.data.message);
      if (res.data.skipped?.length) {
        toast(`${res.data.skipped.length} skipped: ${res.data.skipped[0].reason}${res.data.skipped.length > 1 ? "…" : ""}`);
      }
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send the assessment.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-assessment-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div>
            <h3 id="send-assessment-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Send &ldquo;{assessment.title}&rdquo;
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {assessment.jobTitle ? `Applicants for ${assessment.jobTitle}.` : "Any of your applicants."} Each one gets an
              email with a link to take it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 px-6 py-3 dark:border-gray-800">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applicants"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} className="accent-indigo-600" />
            Hide rejected
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {applicants === null ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            </div>
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-400">No applicants to show.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 dark:bg-gray-800">
                <tr>
                  <th className="w-10 px-6 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={eligibleVisible.length === 0}
                      aria-label="Select everyone"
                      className="accent-indigo-600"
                    />
                  </th>
                  <th className="px-2 py-2 text-left font-bold">Applicant</th>
                  <th className="px-2 py-2 text-left font-bold">Stage</th>
                  <th className="px-6 py-2 text-left font-bold">Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {visible.map((applicant) => (
                  <tr
                    key={applicant.applicationId}
                    className={applicant.eligible ? "cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5" : "opacity-50"}
                    onClick={() => applicant.eligible && toggle(applicant.applicationId)}
                    title={applicant.reason || undefined}
                  >
                    <td className="px-6 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(applicant.applicationId)}
                        disabled={!applicant.eligible}
                        onChange={() => toggle(applicant.applicationId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${applicant.name}`}
                        className="accent-indigo-600"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{applicant.name}</p>
                      <p className="text-xs text-gray-400">{applicant.jobTitle}</p>
                    </td>
                    <td className="px-2 py-2.5 text-gray-500 dark:text-gray-400">{applicant.stage}</td>
                    <td className="px-6 py-2.5 text-xs text-gray-500">
                      {applicant.attemptStatus ? ATTEMPT_STATUS[applicant.attemptStatus]?.label : applicant.reason || "Not sent"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            Due in
            <input
              type="number"
              min={1}
              max={30}
              value={dueInDays}
              onChange={(e) => setDueInDays(e.target.value)}
              className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center dark:border-gray-700 dark:bg-gray-800"
            />
            days
          </label>
          <button
            type="button"
            onClick={send}
            disabled={selected.size === 0 || isSending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to {selected.size || "…"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendAssessmentDialog;
