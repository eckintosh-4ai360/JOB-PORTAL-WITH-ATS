
import { scoreStyle } from "./scoreUtils";

/**
 * Compact match percentage pill for job cards and applicant rows.
 *
 * `size="sm"` fits inside a dense list; `size="md"` is for card headers.
 * Renders nothing when there is no score, so a card never shows an empty
 * badge — the absence of a badge is itself the honest signal.
 */
const MatchBadge = ({ score, verdict, size = "md", showLabel = true, className = "" }) => {
  if (score === null || score === undefined) return null;

  const safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const style = scoreStyle(safeScore);

  const sizing =
    size === "sm"
      ? "px-2 py-0.5 gap-1 font-label-caps"
      : "px-3 py-1 gap-1.5 font-label-md";
  const iconSize = size === "sm" ? "text-[13px]" : "text-[15px]";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold ${style.bg} ${style.text} ${style.border} ${sizing} ${className}`}
      title={verdict || `${safeScore}% match`}
    >
      <span className={`material-symbols-outlined ${iconSize}`} aria-hidden="true">
        {safeScore >= 80 ? "verified" : safeScore >= 65 ? "trending_up" : "adjust"}
      </span>
      <span>{safeScore}% match</span>
      {showLabel && verdict && size !== "sm" && (
        <span className="font-normal opacity-75 hidden sm:inline">· {verdict}</span>
      )}
    </span>
  );
};

export default MatchBadge;
