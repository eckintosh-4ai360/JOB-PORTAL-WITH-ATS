
import {
  DIMENSION_ICONS,
  DIMENSION_LABELS,
  orderedDimensions,
  scoreStyle,
} from "./scoreUtils";

/**
 * The six weighted dimensions behind a match score.
 *
 * This is the component that makes a match percentage trustworthy rather than
 * magic: every dimension shows its own score, its weight in the total, and the
 * one-line reason the engine gave it. A candidate who disagrees can see exactly
 * which input to fix.
 */
const DimensionBreakdown = ({ dimensions = {}, compact = false, className = "" }) => {
  const rows = orderedDimensions(dimensions);
  if (rows.length === 0) return null;

  return (
    <div className={`flex flex-col gap-space-sm ${className}`}>
      {rows.map((dimension) => {
        const score = Math.max(0, Math.min(100, Math.round(dimension.score || 0)));
        const style = scoreStyle(score);
        const label = DIMENSION_LABELS[dimension.key] || dimension.key;

        return (
          <div key={dimension.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-body-sm text-text-secondary">
                <span
                  className="material-symbols-outlined text-[16px] text-text-muted shrink-0"
                  aria-hidden="true"
                >
                  {DIMENSION_ICONS[dimension.key] || "check_circle"}
                </span>
                <span className="truncate font-medium text-text-primary">{label}</span>
                {/* Weight is what stops the breakdown from looking arbitrary. */}
                {dimension.weight ? (
                  <span className="shrink-0 rounded-md bg-surface-container px-1.5 py-0.5 font-label-caps text-text-muted">
                    {dimension.weight}% of score
                  </span>
                ) : null}
              </span>

              <span className={`shrink-0 font-label-md font-bold ${style.text}`}>{score}</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
                style={{ width: `${score}%`, transition: "width 800ms cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </div>

            {!compact && (dimension.detail || dimension.label) && (
              <p className="font-body-sm text-text-muted">
                {dimension.label && (
                  <span className="font-semibold text-text-secondary">{dimension.label}. </span>
                )}
                {dimension.detail}
              </p>
            )}

            {!compact && dimension.missing?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {dimension.missing.slice(0, 6).map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 font-label-caps font-semibold text-rose-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DimensionBreakdown;
