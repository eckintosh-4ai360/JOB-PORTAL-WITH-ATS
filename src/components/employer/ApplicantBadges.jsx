import { stageStyle, fitTone, avatarGradient, getInitials, assessmentLabel, ASSESSMENT_TONES } from "../../utils/stageStyles";

/** Small pieces of an applicant row, shared by the applicant and shortlist lists. */

export const StageBadge = ({ stage }) => {
  const cfg = stageStyle(stage);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
      <Icon className="h-3 w-3" />
      {stage?.name || "…"}
    </span>
  );
};

export const FitPill = ({ score, verdict }) =>
  score === null || score === undefined ? (
    <span className="text-xs text-gray-400 dark:text-gray-500" title="Not scored by AI yet">—</span>
  ) : (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${fitTone(score)}`}
      title={verdict ? `${verdict} — AI fit against this role's requirements` : "AI fit against this role's requirements"}
    >
      {score}% fit
    </span>
  );

export const AssessmentResult = ({ assessment }) => {
  const label = assessmentLabel(assessment);
  const title =
    assessment?.bestPercent !== null && assessment?.bestPercent !== undefined
      ? `${assessment.bestTitle}: ${assessment.passed ? "passed" : "below the pass mark"}`
      : assessment?.pending
        ? "Sent, not finished or marked yet"
        : undefined;
  return (
    <span className={`text-xs font-semibold ${ASSESSMENT_TONES[label.tone]}`} title={title}>
      {label.text}
    </span>
  );
};

export const ApplicantAvatar = ({ name, seed, size = "md" }) => (
  <div
    className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm ${avatarGradient(seed || name)} ${
      size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
    }`}
  >
    {getInitials(name)}
  </div>
);

export const GuestBadge = () => (
  <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
    Guest
  </span>
);
