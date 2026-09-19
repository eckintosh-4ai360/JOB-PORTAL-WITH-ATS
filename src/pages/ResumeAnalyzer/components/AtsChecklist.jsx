import { useState } from "react";
import { ATS_STATUS_STYLES } from "../../../components/ai/scoreUtils";

/**
 * The ATS structural checklist.
 *
 * Every deduction in the ATS score appears here with the advice that fixes it.
 * Failures and warnings are shown first and expanded by default; passes are
 * collapsed, because a candidate needs their problems, not their wins.
 */
const AtsChecklist = ({ checks = [], signals = {} }) => {
  const [showPasses, setShowPasses] = useState(false);

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  const passes = checks.filter((check) => check.status === "pass");

  const Row = ({ check }) => {
    const style = ATS_STATUS_STYLES[check.status] || ATS_STATUS_STYLES.warn;
    return (
      <div className={`flex items-start gap-space-sm rounded-xl ${style.bg} p-space-sm`}>
        <span
          className={`material-symbols-outlined text-[19px] shrink-0 ${style.text}`}
          aria-hidden="true"
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-body-md font-semibold text-text-primary">{check.label}</span>
            <span className={`font-label-caps uppercase ${style.text}`}>{style.label}</span>
          </div>
          {check.status !== "pass" && (
            <p className="mt-0.5 font-body-sm text-text-secondary">{check.advice}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div>
          <h3 className="font-headline-sm font-bold text-text-primary">ATS compatibility checks</h3>
          <p className="font-body-sm text-text-muted">
            What an applicant tracking system can and cannot read in your file
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-label-md">
          <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
            {passes.length} pass
          </span>
          {warnings.length > 0 && (
            <span className="rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-700">
              {warnings.length} warn
            </span>
          )}
          {failures.length > 0 && (
            <span className="rounded-lg bg-rose-50 px-2 py-1 font-bold text-rose-700">
              {failures.length} fail
            </span>
          )}
        </div>
      </div>

      {/* Parsed-document facts. These are measurements, not judgements. */}
      {Object.keys(signals).length > 0 && (
        <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-4">
          {[
            { label: "Words", value: signals.wordCount },
            { label: "Pages", value: signals.pageCount },
            { label: "Bullets", value: signals.bulletCount },
            { label: "Quantified", value: signals.quantifiedCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border-default bg-surface-container-low p-space-sm"
            >
              <span className="block font-numeric-metric text-text-primary">{stat.value ?? "—"}</span>
              <span className="font-label-caps uppercase text-text-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {(failures.length > 0 || warnings.length > 0) && (
        <div className="flex flex-col gap-space-sm">
          {failures.map((check) => (
            <Row key={check.id} check={check} />
          ))}
          {warnings.map((check) => (
            <Row key={check.id} check={check} />
          ))}
        </div>
      )}

      {failures.length === 0 && warnings.length === 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-space-sm font-body-md text-emerald-700">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            task_alt
          </span>
          Every structural check passed. This resume will parse cleanly.
        </p>
      )}

      {passes.length > 0 && (
        <div className="flex flex-col gap-space-sm">
          <button
            type="button"
            onClick={() => setShowPasses((value) => !value)}
            className="flex items-center gap-1 self-start font-label-md font-bold text-primary hover:underline"
            aria-expanded={showPasses}
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
              {showPasses ? "expand_less" : "expand_more"}
            </span>
            {showPasses ? "Hide" : "Show"} the {passes.length} checks you passed
          </button>
          {showPasses && (
            <div className="flex flex-col gap-1.5">
              {passes.map((check) => (
                <Row key={check.id} check={check} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AtsChecklist;
