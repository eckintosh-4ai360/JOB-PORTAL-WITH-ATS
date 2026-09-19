import { useEffect, useRef } from "react";
import { scoreStyle } from "./scoreUtils";

/**
 * Circular score gauge.
 *
 * Sweeps up from zero on mount so a score reads as a measurement being taken
 * rather than a number that was always there. The sweep is written straight to
 * the DOM node rather than held in state — an animation frame is not
 * application state, and this keeps the component to a single render.
 *
 * Colour follows the score band, but the number is always shown; colour is
 * never the only signal.
 */
const ScoreRing = ({
  score = 0,
  size = 112,
  strokeWidth = 8,
  label = "Match",
  sublabel = null,
  animate = true,
  className = "",
}) => {
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const style = scoreStyle(safeScore);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - safeScore / 100);

  const arcRef = useRef(null);

  useEffect(() => {
    const arc = arcRef.current;
    if (!arc) return;

    if (!animate) {
      arc.style.strokeDashoffset = String(targetOffset);
      return;
    }

    // Paint the empty ring first, then let the CSS transition run to the
    // target on the next frame.
    arc.style.strokeDashoffset = String(circumference);
    const frame = requestAnimationFrame(() => {
      arc.style.strokeDashoffset = String(targetOffset);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetOffset, circumference, animate]);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${safeScore} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={style.track}
          strokeWidth={strokeWidth}
        />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={style.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? circumference : targetOffset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <span className={`font-bold ${style.text}`} style={{ fontSize: size * 0.28 }}>
          {safeScore}
          <span className="font-normal" style={{ fontSize: size * 0.13 }}>
            %
          </span>
        </span>
        <span
          className="mt-0.5 font-label-caps uppercase tracking-wider text-text-muted"
          style={{ fontSize: Math.max(9, size * 0.085) }}
        >
          {label}
        </span>
        {sublabel && (
          <span className="text-text-muted" style={{ fontSize: Math.max(8, size * 0.075) }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreRing;
