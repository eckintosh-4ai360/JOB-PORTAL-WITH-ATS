import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Put an applicant on the employer's shortlist, or take them off it. The
 * shortlist is private: nothing here reaches the candidate. `compact` shows
 * the star alone, for table rows.
 */
const ShortlistToggle = ({ applicationId, shortlisted, disabled = false, disabledReason = "", onChange, compact = false }) => {
  const [busy, setBusy] = useState(false);

  const toggle = async (event) => {
    event.stopPropagation();
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await axiosInstance.post(
        shortlisted ? API_PATHS.SHORTLISTS.REMOVE : API_PATHS.SHORTLISTS.ADD,
        { applicationIds: [applicationId] }
      );
      if (!shortlisted && res.data.added === 0) {
        const reason = res.data.skipped?.[0]?.reason;
        if (reason === "Already on the shortlist") {
          onChange?.(true);
          toast.success("Already on your shortlist");
        } else {
          toast.error(reason || "Could not add to the shortlist.");
        }
        return;
      }
      onChange?.(!shortlisted);
      toast.success(shortlisted ? "Removed from your shortlist" : "Added to your shortlist");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the shortlist.");
    } finally {
      setBusy(false);
    }
  };

  const title = disabled
    ? disabledReason
    : shortlisted
      ? "On your shortlist — click to remove. The candidate is not told either way."
      : "Add to your shortlist. The candidate is not told.";

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy || disabled}
        title={title}
        aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
        aria-pressed={shortlisted}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
          shortlisted
            ? "text-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
            : "text-gray-300 hover:bg-gray-100 hover:text-amber-500 dark:text-gray-600 dark:hover:bg-gray-800"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={`h-4 w-4 ${shortlisted ? "fill-current" : ""}`} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || disabled}
      title={title}
      aria-pressed={shortlisted}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        shortlisted
          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${shortlisted ? "fill-current" : ""}`} />}
      {shortlisted ? "On shortlist" : "Shortlist"}
    </button>
  );
};

export default ShortlistToggle;
