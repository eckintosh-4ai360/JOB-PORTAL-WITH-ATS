import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import toast from "react-hot-toast";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";

/**
 * Career paths: where the candidate's experience could take them next.
 *
 * The suggestions come from AI; the numbers around them do not. Open roles are
 * counted with the same search as Find Jobs, and pay is shown only when the
 * platform has real figures for the role — a salary benchmark, or live
 * adverts — with the source named.
 */

const TYPE = {
  step_up: { label: "Step up", icon: "trending_up", tone: "bg-brand-indigo-light text-primary" },
  lateral: { label: "Sideways move", icon: "swap_horiz", tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  pivot: { label: "Change direction", icon: "alt_route", tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
};

const READINESS = {
  ready: { label: "Ready now", tone: "bg-salary-surface text-salary-emerald" },
  close: { label: "A few gaps", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  stretch: { label: "A stretch", tone: "bg-surface-container text-text-secondary" },
};

const money = (value, currency = "GH₵") =>
  value >= 1000 ? `${currency} ${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `${currency} ${Math.round(value)}`;

const PathCard = ({ path }) => {
  const type = TYPE[path.type] || TYPE.lateral;
  const readiness = READINESS[path.readiness] || READINESS.close;

  return (
    <article className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_12px_28px_rgba(40,34,86,0.07)] md:p-space-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label-md font-bold ${type.tone}`}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{type.icon}</span>
          {type.label}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-label-md font-bold ${readiness.tone}`}>{readiness.label}</span>
        <span className="font-body-sm text-text-muted">About {path.timeframe}</span>
      </div>

      <div>
        <h3 className="font-headline-md font-bold text-text-primary">{path.title}</h3>
        {path.summary && <p className="mt-1 font-body-md text-text-secondary">{path.summary}</p>}
        {path.progression?.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 font-body-sm text-text-muted">
            <span className="font-semibold text-text-secondary">{path.title}</span>
            {path.progression.map((role) => (
              <span key={role} className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
                {role}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <div className="flex flex-col gap-space-sm">
          {path.whyYou?.length > 0 && (
            <div>
              <p className="font-label-caps uppercase text-text-muted">Why it fits you</p>
              <ul className="mt-1.5 space-y-1.5">
                {path.whyYou.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 font-body-sm text-text-secondary">
                    <span className="material-symbols-outlined mt-px text-[16px] text-primary" aria-hidden="true">check_circle</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {path.transferableSkills?.length > 0 && (
            <div>
              <p className="font-label-caps uppercase text-text-muted">Skills you already have</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {path.transferableSkills.map((skill) => (
                  <span key={skill} className="rounded-lg bg-salary-surface px-2.5 py-0.5 font-label-md text-salary-emerald">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-space-sm">
          {path.skillsToBuild?.length > 0 && (
            <div>
              <p className="font-label-caps uppercase text-text-muted">Skills to build</p>
              <ul className="mt-1.5 space-y-1.5">
                {path.skillsToBuild.map((item) => (
                  <li key={item.skill} className="font-body-sm text-text-secondary">
                    <span className="font-semibold text-text-primary">{item.skill}</span>
                    {item.why && <span> — {item.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {path.steps?.length > 0 && (
            <div>
              <p className="font-label-caps uppercase text-text-muted">Steps to get there</p>
              <ol className="mt-1.5 space-y-1.5">
                {path.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2 font-body-sm text-text-secondary">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container font-label-md font-bold text-text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-space-sm border-t border-border-default pt-space-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="font-body-sm text-text-secondary">
          {path.pay ? (
            <>
              <span className="font-numeric-metric font-bold text-salary-emerald">
                {money(path.pay.low, path.pay.currency)} – {money(path.pay.high, path.pay.currency)}
              </span>
              <span className="text-text-muted"> per month · {path.pay.label}</span>
            </>
          ) : (
            <span className="text-text-muted">No pay data on the platform for this role yet.</span>
          )}
        </div>
        <Link
          to={`/find-jobs?q=${encodeURIComponent(path.searchTerms)}`}
          className={`inline-flex items-center justify-center gap-1 rounded-xl px-space-md py-2 font-label-md font-bold transition-colors ${
            path.openRoles > 0
              ? "bg-primary text-on-primary hover:bg-brand-indigo-dark"
              : "bg-surface-container text-on-surface hover:bg-surface-container-high"
          }`}
        >
          {path.openRoles > 0 ? `See ${path.openRoles} open role${path.openRoles === 1 ? "" : "s"}` : "Search for this role"}
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
      {path.examples?.length > 0 && (
        <p className="-mt-2 font-body-sm text-text-muted">
          Hiring now: {path.examples.map((job) => `${job.title}${job.companyName ? ` at ${job.companyName}` : ""}`).join(" · ")}
        </p>
      )}
    </article>
  );
};

const CareerPathsPanel = ({ isAuthenticated }) => {
  const [state, setState] = useState({ loading: true, ready: false, plan: null, error: null });
  const [isWriting, setIsWriting] = useState(false);
  const autoWritten = useRef(false);

  const write = useCallback(async () => {
    setIsWriting(true);
    try {
      const res = await axiosInstance.post(API_PATHS.AI.CAREER_PATHS);
      setState({ loading: false, ready: res.data.ready, plan: res.data.plan, error: null });
    } catch (err) {
      toast.error(
        err.response?.status === 429
          ? "You've refreshed your career paths a lot this hour. Try again later."
          : err.response?.data?.message || "Could not write your career paths."
      );
    } finally {
      setIsWriting(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.AI.CAREER_PATHS)
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, ready: res.data.ready, plan: res.data.plan, error: null });
        // First visit with a profile to work from: write the paths straight away.
        if (!res.data.plan && res.data.ready && !autoWritten.current) {
          autoWritten.current = true;
          write();
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, ready: false, plan: null, error: err.response?.data?.message || "Could not load career paths." });
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, write]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-card p-space-xl text-center">
        <span className="material-symbols-outlined text-[48px] text-text-muted" aria-hidden="true">route</span>
        <h3 className="mt-2 font-headline-sm font-bold text-text-primary">Sign in to see your career paths</h3>
        <p className="mx-auto mt-1 max-w-md font-body-md text-text-secondary">
          Career paths are built from your saved CV analysis, so they need an account.
        </p>
        <Link to="/login" className="mt-space-md inline-block rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary">
          Sign in
        </Link>
      </div>
    );
  }

  if (state.loading || (isWriting && !state.plan)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border-default bg-surface-card p-space-xl text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="font-body-md text-text-secondary">
          {isWriting ? "Working out where your experience can take you…" : "Loading your career paths…"}
        </p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-card p-space-xl text-center">
        <p className="font-body-md text-text-secondary">{state.error}</p>
      </div>
    );
  }

  if (!state.ready) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-card p-space-xl text-center">
        <span className="material-symbols-outlined text-[48px] text-text-muted" aria-hidden="true">description</span>
        <h3 className="mt-2 font-headline-sm font-bold text-text-primary">Analyse your CV first</h3>
        <p className="mx-auto mt-1 max-w-md font-body-md text-text-secondary">
          Career paths are built from your skills and experience. Run a CV analysis on the Resume report tab, then come back.
        </p>
      </div>
    );
  }

  const plan = state.plan;

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-col gap-space-sm rounded-3xl border border-border-default bg-surface-card p-space-md sm:flex-row sm:items-center sm:justify-between md:p-space-lg">
        <div className="min-w-0">
          <h2 className="font-headline-sm font-bold text-text-primary">Where your experience can take you</h2>
          {plan?.summary && <p className="mt-1 font-body-md text-text-secondary">{plan.summary}</p>}
          {plan?.generatedAt && (
            <p className="mt-1 font-body-sm text-text-muted">Written {moment(plan.generatedAt).fromNow()} from your CV analysis.</p>
          )}
        </div>
        <button
          type="button"
          onClick={write}
          disabled={isWriting}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-surface-container px-space-md py-2.5 font-label-md font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${isWriting ? "animate-spin" : ""}`} aria-hidden="true">
            {isWriting ? "progress_activity" : "refresh"}
          </span>
          {isWriting ? "Rewriting…" : "Suggest again"}
        </button>
      </div>

      {plan?.stale && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-space-sm font-body-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">update</span>
          Your profile has changed since these were written. Suggest again to base them on your latest CV.
        </p>
      )}
      {plan?.degraded && (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-container p-space-sm font-body-sm text-text-secondary">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
          AI suggestions were not available, so this shows only the next step in your current work. Try again later for
          sideways moves and changes of direction.
        </p>
      )}

      {plan?.paths?.map((path) => <PathCard key={path.title} path={path} />)}

      <p className="font-body-sm text-text-muted">
        These are suggestions from AI based on your CV — a starting point for your own research, not a promise of any
        outcome. Pay figures come only from the platform&apos;s salary data or live adverts.
      </p>
    </div>
  );
};

export default CareerPathsPanel;
