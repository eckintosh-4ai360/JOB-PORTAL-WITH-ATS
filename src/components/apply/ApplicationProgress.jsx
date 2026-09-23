import { CANDIDATE_STEPS, candidateStatusDisplay } from "../../utils/candidateStatus";

/**
 * The five steps a candidate sees, with where their application stands.
 *
 * Application received → Under review → Shortlisted → Interview → Decision.
 * Once there is an outcome the last step says what it was. A rejection shows
 * where it happened rather than pretending the candidate reached the end.
 */
const ApplicationProgress = ({ application }) => {
  const status = application?.candidateStatus;
  if (!status) return null;

  const display = candidateStatusDisplay(application);
  const unsuccessful = status.outcome === "unsuccessful";
  const successful = status.outcome === "offer" || status.outcome === "hired";
  const current = status.step - 1;

  return (
    <ol className="flex items-start gap-1" aria-label={`Application progress: ${display.label}`}>
      {CANDIDATE_STEPS.map((step, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        const isLast = index === CANDIDATE_STEPS.length - 1;

        let bar = "bg-surface-container";
        if (reached) bar = unsuccessful && isCurrent ? "bg-red-400" : successful ? "bg-salary-emerald" : "bg-primary";

        const label = isLast && status.outcomeLabel ? status.outcomeLabel : step.label;

        return (
          <li key={step.phase} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={isCurrent ? "step" : undefined}>
            <span className={`h-1.5 w-full rounded-full ${bar}`} />
            <span
              className={`truncate text-[11px] leading-tight ${
                isCurrent ? "font-bold text-on-surface" : reached ? "text-text-secondary" : "text-text-muted"
              }`}
              title={label}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default ApplicationProgress;
