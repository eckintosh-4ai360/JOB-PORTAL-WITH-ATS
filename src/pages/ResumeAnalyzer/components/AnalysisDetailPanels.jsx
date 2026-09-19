import {
  IMPORTANCE_STYLES,
  PRIORITY_STYLES,
  scoreStyle,
} from "../../../components/ai/scoreUtils";

/**
 * The content-quality half of the analysis: writing quality, grammar, missing
 * skills, rewrite suggestions, and keyword coverage.
 *
 * Exported as separate panels so the page can lay them out independently.
 */

/** Weighted sub-scores behind the resume quality number. */
export const QualityBreakdown = ({ quality }) => {
  if (!quality?.breakdown) return null;

  const dimensions = [
    { key: "impact", label: "Impact", hint: "Achievements and measurable outcomes" },
    { key: "clarity", label: "Clarity", hint: "Direct, readable, active phrasing" },
    { key: "relevance", label: "Relevance", hint: "Fit to the role you are targeting" },
    { key: "structure", label: "Structure", hint: "Sections, order, and scannability" },
    { key: "brevity", label: "Brevity", hint: "Length appropriate to your experience" },
  ];

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div>
        <h3 className="font-headline-sm font-bold text-text-primary">Resume quality</h3>
        <p className="font-body-sm text-text-muted">
          How the writing itself reads to a recruiter, beyond machine parsing
        </p>
      </div>

      {quality.verdict && (
        <p className="rounded-xl bg-surface-container-low p-space-sm font-body-md text-text-secondary">
          {quality.verdict}
        </p>
      )}

      <div className="flex flex-col gap-space-sm">
        {dimensions.map((dimension) => {
          const score = Math.round(quality.breakdown[dimension.key] ?? 0);
          const style = scoreStyle(score);
          return (
            <div key={dimension.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-space-sm">
                <span className="font-body-md font-semibold text-text-primary">
                  {dimension.label}
                  <span className="ml-1.5 font-body-sm font-normal text-text-muted">
                    {dimension.hint}
                  </span>
                </span>
                <span className={`shrink-0 font-label-md font-bold ${style.text}`}>{score}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
                  style={{ width: `${score}%`, transition: "width 800ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {(quality.strengths?.length > 0 || quality.weaknesses?.length > 0) && (
        <div className="grid gap-space-sm sm:grid-cols-2">
          {quality.strengths?.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-space-sm">
              <span className="mb-1 block font-label-caps uppercase tracking-wider text-emerald-700">
                Working well
              </span>
              <ul className="flex flex-col gap-1">
                {quality.strengths.map((item) => (
                  <li key={item} className="flex gap-1.5 font-body-sm text-emerald-900">
                    <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
                      check
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quality.weaknesses?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-space-sm">
              <span className="mb-1 block font-label-caps uppercase tracking-wider text-amber-700">
                Holding you back
              </span>
              <ul className="flex flex-col gap-1">
                {quality.weaknesses.map((item) => (
                  <li key={item} className="flex gap-1.5 font-body-sm text-amber-900">
                    <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
                      priority_high
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Grammar, spelling, and wording problems, each quoting the offending text. */
export const GrammarPanel = ({ grammar }) => {
  if (!grammar) return null;

  // A null score means the AI review did not run — say so rather than showing 0.
  if (grammar.score === null || grammar.score === undefined) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-card p-space-md">
        <h3 className="font-headline-sm font-bold text-text-primary">Grammar &amp; spelling</h3>
        <p className="mt-1 font-body-sm text-text-muted">
          The writing check needs the AI service, which was unavailable for this run. Re-run the
          analysis to include it.
        </p>
      </div>
    );
  }

  const style = scoreStyle(grammar.score);

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div>
          <h3 className="font-headline-sm font-bold text-text-primary">Grammar &amp; spelling</h3>
          <p className="font-body-sm text-text-muted">
            {grammar.issueCount === 0
              ? "No writing errors found"
              : `${grammar.issueCount} issue${grammar.issueCount === 1 ? "" : "s"} to fix before you apply`}
          </p>
        </div>
        <span className={`rounded-xl px-2.5 py-1 font-label-md font-bold ${style.bg} ${style.text}`}>
          {grammar.score}/100
        </span>
      </div>

      {grammar.issueCount === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-space-sm font-body-md text-emerald-700">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            spellcheck
          </span>
          Your resume reads cleanly — no spelling or grammar problems detected.
        </p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {grammar.issues.map((issue, index) => {
            const severityStyle =
              issue.severity === "high"
                ? "border-rose-200 bg-rose-50"
                : issue.severity === "medium"
                  ? "border-amber-200 bg-amber-50"
                  : "border-sky-200 bg-sky-50";

            return (
              <li
                key={`${issue.excerpt}-${index}`}
                className={`rounded-xl border p-space-sm ${severityStyle}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-white/70 px-1.5 py-0.5 font-label-caps uppercase text-text-secondary">
                    {issue.type}
                  </span>
                  <span className="font-label-caps uppercase text-text-muted">
                    {issue.severity} severity
                  </span>
                </div>

                {issue.excerpt && (
                  <p className="font-body-sm text-text-secondary">
                    <span className="text-text-muted">Found: </span>
                    <span className="rounded bg-white/80 px-1 font-medium text-rose-800 line-through decoration-rose-400">
                      {issue.excerpt}
                    </span>
                  </p>
                )}
                {issue.suggestion && (
                  <p className="mt-0.5 font-body-sm text-text-secondary">
                    <span className="text-text-muted">Use: </span>
                    <span className="rounded bg-white/80 px-1 font-semibold text-emerald-800">
                      {issue.suggestion}
                    </span>
                  </p>
                )}
                {issue.explanation && (
                  <p className="mt-1 font-body-sm text-text-muted">{issue.explanation}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/** Skills the target role expects that the resume does not evidence. */
export const MissingSkillsPanel = ({ missingSkills = [], targetRole }) => {
  if (missingSkills.length === 0) return null;

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div>
        <h3 className="font-headline-sm font-bold text-text-primary">Missing skills</h3>
        <p className="font-body-sm text-text-muted">
          {targetRole
            ? `What ${targetRole} postings ask for that your resume does not yet show`
            : "What roles like yours ask for that your resume does not yet show"}
        </p>
      </div>

      <ul className="flex flex-col gap-space-sm">
        {missingSkills.map((item) => {
          const style = IMPORTANCE_STYLES[item.importance] || IMPORTANCE_STYLES.medium;
          return (
            <li
              key={item.skill}
              className={`rounded-xl border p-space-sm ${style.border} ${style.bg}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-body-md font-bold text-text-primary">{item.skill}</span>
                <span className={`rounded-md bg-white/70 px-1.5 py-0.5 font-label-caps uppercase ${style.text}`}>
                  {item.importance}
                </span>
              </div>
              {item.reason && (
                <p className="mt-1 font-body-sm text-text-secondary">{item.reason}</p>
              )}
              {item.howToAcquire && (
                <p className="mt-1 flex gap-1.5 font-body-sm text-text-muted">
                  <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
                    lightbulb
                  </span>
                  <span>{item.howToAcquire}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Prioritised, concrete rewrite actions. */
export const SuggestionsPanel = ({ suggestions = [] }) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div>
        <h3 className="font-headline-sm font-bold text-text-primary">How to improve it</h3>
        <p className="font-body-sm text-text-muted">
          Ordered by how much each change moves your score
        </p>
      </div>

      <ol className="flex flex-col gap-space-sm">
        {suggestions.map((suggestion, index) => {
          const style = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.medium;
          return (
            <li
              key={`${suggestion.title}-${index}`}
              className="flex gap-space-sm rounded-xl border border-border-default bg-surface-container-low p-space-sm"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary font-label-md font-bold text-on-primary">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body-md font-bold text-text-primary">
                    {suggestion.title}
                  </span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-label-caps uppercase ${style.border} ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </span>
                  {suggestion.area && (
                    <span className="font-label-caps uppercase text-text-muted">
                      {suggestion.area}
                    </span>
                  )}
                </div>

                {suggestion.action && (
                  <p className="mt-1 font-body-sm text-text-secondary">{suggestion.action}</p>
                )}
                {suggestion.example && (
                  <p className="mt-1.5 rounded-lg border-l-2 border-primary bg-brand-indigo-light p-2 font-body-sm italic text-primary">
                    {suggestion.example}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/** Keyword coverage against the target role. */
export const KeywordPanel = ({ keywords }) => {
  const present = keywords?.present || [];
  const missing = keywords?.missing || [];
  if (present.length === 0 && missing.length === 0) return null;

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div>
        <h3 className="font-headline-sm font-bold text-text-primary">Keyword coverage</h3>
        <p className="font-body-sm text-text-muted">
          The terms a recruiter or ATS searches for in your target role
        </p>
      </div>

      {present.length > 0 && (
        <div>
          <span className="mb-1.5 block font-label-caps uppercase tracking-wider text-emerald-700">
            Found in your resume ({present.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {present.map((keyword) => (
              <span
                key={keyword}
                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-label-md font-semibold text-emerald-700"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  check
                </span>
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <span className="mb-1.5 block font-label-caps uppercase tracking-wider text-amber-700">
            Worth adding ({missing.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((keyword) => (
              <span
                key={keyword}
                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 font-label-md font-semibold text-amber-700"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  add
                </span>
                {keyword}
              </span>
            ))}
          </div>
          <p className="mt-2 font-body-sm text-text-muted">
            Only add a keyword if it is genuinely true of you. A term you cannot defend in an
            interview costs more than a missing one.
          </p>
        </div>
      )}
    </div>
  );
};

/** Things an employer would question. Shown only when the AI found any. */
export const RedFlagsPanel = ({ redFlags = [] }) => {
  if (redFlags.length === 0) return null;

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-space-md">
      <h3 className="flex items-center gap-1.5 font-headline-sm font-bold text-rose-800">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          flag
        </span>
        What an employer will question
      </h3>
      <ul className="mt-space-sm flex flex-col gap-1.5">
        {redFlags.map((flag) => (
          <li key={flag} className="flex gap-1.5 font-body-sm text-rose-900">
            <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
              arrow_right
            </span>
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
