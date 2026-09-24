import { useState, useEffect } from "react";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import toast from "react-hot-toast";

const EMPTY_FILTERS = { role: "", location: "", seniority: "", industry: "" };

const money = (value) => `GH₵ ${Math.round(value).toLocaleString("en-GB")}`;

/** "GH₵ 6.5k", for the tight spots where the full figure does not fit. */
const moneyShort = (value) =>
  value >= 1000
    ? `GH₵ ${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`
    : `GH₵ ${Math.round(value)}`;

const signed = (percent) => `${percent > 0 ? "+" : ""}${percent}%`;

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const SalariesInsights = () => {
  // `draft` is what the form shows; `filters` is what the figures are for, so
  // the cards do not change under the candidate while they are still typing.
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [options, setOptions] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Modal form state
  const [subRole, setSubRole] = useState("");
  const [subComp, setSubComp] = useState("");
  const [subExp, setSubExp] = useState("3-5");
  const [subLoc, setSubLoc] = useState("Accra, Ghana");

  // The same vocabularies job search filters on, so "Senior" or "Healthcare"
  // here means exactly what it means there.
  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.JOBS.SEARCH_OPTIONS)
      .then((response) => {
        if (!cancelled) setOptions(response.data);
      })
      .catch(() => {
        // The selects fall back to "any"; the figures still load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

    axiosInstance
      .get(API_PATHS.SALARIES.GET_INSIGHTS, { params })
      .then((response) => {
        if (cancelled) return;
        setInsights(response.data);
        setLoadFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Failed to load salary insights:", err?.message || err);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const applyFilters = (next) => {
    const cleaned = { ...next, role: next.role.trim() };
    setDraft(cleaned);
    setIsLoading(true);
    setFilters(cleaned);
  };

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(API_PATHS.SALARIES.SUBMIT, {
        role: subRole,
        compensation: subComp,
        experience: subExp,
        location: subLoc,
      });
      toast.success("Thank you! Your salary was recorded anonymously.");
      setShowSubmitModal(false);
      setSubRole("");
      setSubComp("");
    } catch {
      toast.error("Your salary could not be recorded. Please try again.");
    }
  };

  const summary = insights?.summary;
  const pay = summary?.pay;
  const flexiblePay = summary?.flexiblePay;
  const minSample = insights?.minSample ?? 3;
  const roles = insights?.roles || [];
  const skills = insights?.skills || [];
  const popularRoles = insights?.popularRoles || [];
  const scope = filters.location ? `in ${filters.location}` : "across Ghana";
  const notEnough = `Needs ${minSample}+ adverts with pay`;
  const roleScale = Math.max(...roles.map((r) => r.p90), 1);
  const hasFigures = Boolean(insights) && !loadFailed;
  const fade = isLoading && insights ? "opacity-60" : "";

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO & SEARCH DOCK ================= */}
        <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pb-space-xl border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin pt-space-lg flex flex-col gap-space-lg">
            {/* Headline & Subtitle Group */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
              <div className="max-w-3xl flex flex-col gap-space-xs">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-indigo-light text-primary font-label-md font-bold w-fit shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  TRANSPARENT TALENT INTELLIGENCE
                </div>

                <h1 className="font-headline-lg text-headline-xl text-on-surface tracking-tight">
                  Real Ghana Salary Insights,{" "}
                  <span className="bg-primary bg-clip-text text-transparent">
                    Verified &amp; Open.
                  </span>
                </h1>

                <p className="font-body-lg text-body-lg text-text-secondary leading-relaxed">
                  Explore salary insights across Ghana's industries.
                </p>
              </div>

              {/* Data Source Badge */}
              <div className="flex items-center gap-space-sm shrink-0 bg-surface-card p-3 rounded-2xl border border-border-default shadow-xs">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-indigo-light text-primary">
                  <span className="material-symbols-outlined text-[22px]">monitoring</span>
                </span>
                <div className="flex flex-col">
                  <span className="font-label-lg text-on-surface font-bold">
                    {hasFigures
                      ? `${insights.dataPoints.toLocaleString("en-GB")} ${insights.dataPoints === 1 ? "Advert" : "Adverts"} with Pay`
                      : "—"}
                  </span>
                  <span className="font-body-sm text-text-muted">
                    Live from job adverts, last 12 months
                  </span>
                </div>
              </div>
            </div>

            {/* Elevated Explorer Dock Form */}
            <div className="w-full bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm border border-border-default">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  applyFilters(draft);
                }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-space-sm items-center"
              >
                {/* Role */}
                <div className="lg:col-span-3 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Target Specialization
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      terminal
                    </span>
                    <input
                      type="text"
                      value={draft.role}
                      onChange={(e) => updateDraft("role", e.target.value)}
                      placeholder="All roles, or e.g. Accountant"
                      aria-label="Role"
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="lg:col-span-3 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Market &amp; Hub
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      location_on
                    </span>
                    <select
                      value={draft.location}
                      onChange={(e) => updateDraft("location", e.target.value)}
                      aria-label="Location"
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option value="">Anywhere in Ghana</option>
                      {(options?.locations || [])
                        .filter((place) => place.key !== "Ghana")
                        .map((place) => (
                          <option key={place.key} value={place.key}>
                            {place.key}
                            {place.region && place.region !== place.key ? ` — ${place.region}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Seniority */}
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Tenure Band
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      trending_up
                    </span>
                    <select
                      value={draft.seniority}
                      onChange={(e) => updateDraft("seniority", e.target.value)}
                      aria-label="Experience level"
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option value="">Any level</option>
                      {(options?.seniority || []).map((level) => (
                        <option key={level.key} value={level.key}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Industry */}
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Industry Domain
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      hub
                    </span>
                    <select
                      value={draft.industry}
                      onChange={(e) => updateDraft("industry", e.target.value)}
                      aria-label="Industry"
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option value="">All industries</option>
                      {(options?.industries || []).map((industry) => (
                        <option key={industry.key} value={industry.key}>
                          {industry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="lg:col-span-2 flex flex-col justify-end">
                  <label className="hidden lg:block font-label-caps uppercase text-transparent select-none">
                    Action
                  </label>
                  <button
                    type="submit"
                    className="w-full h-[46px] px-space-md rounded-xl bg-primary text-on-primary font-label-lg font-bold hover:bg-brand-indigo-dark flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      auto_awesome
                    </span>
                    <span>Explore Comp</span>
                  </button>
                </div>
              </form>

              {/* Popular roles with enough adverts to produce figures */}
              {popularRoles.length > 0 && (
                <div className="mt-space-md pt-space-sm border-t border-border-default flex flex-wrap items-center gap-2">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Popular Roles:
                  </span>
                  {popularRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => applyFilters({ ...draft, role })}
                      className={`px-3 py-1 rounded-full font-label-md transition-colors ${
                        filters.role === role
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-text-secondary hover:bg-brand-indigo-light hover:text-primary"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================= 4 KEY MARKET METRIC PULSE CARDS ================= */}
        <section className="w-full py-space-lg">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {loadFailed && (
              <p className="mb-space-md rounded-2xl border border-border-default bg-surface-card p-4 font-body-md text-text-secondary">
                Salary figures could not be loaded right now. Please try again shortly.
              </p>
            )}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md transition-opacity ${fade}`} aria-busy={isLoading}>
              {/* Card 1 */}
              <div className="group relative flex min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-surface-card to-surface-card p-5 shadow-[0_10px_26px_rgba(16,185,129,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(16,185,129,0.16)]">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Median Role Pay
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_8px_16px_rgba(16,185,129,0.28)]">
                    <span className="material-symbols-outlined text-[18px]">
                      payments
                    </span>
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg text-on-surface">
                      {pay ? money(pay.median) : "—"}
                    </span>
                    {pay && <span className="font-label-md text-text-muted">/mo</span>}
                  </div>
                  {pay && summary.yearOnYear != null ? (
                    <div
                      className={`flex items-center gap-1 mt-1 font-numeric-metric text-[13px] ${
                        summary.yearOnYear >= 0 ? "text-salary-emerald" : "text-error"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {summary.yearOnYear >= 0 ? "arrow_upward" : "arrow_downward"}
                      </span>
                      <span>{signed(summary.yearOnYear)} YoY</span>
                      <span className="text-text-muted font-normal text-xs ml-1">{scope}</span>
                    </div>
                  ) : (
                    <p className="font-body-sm text-text-secondary mt-1">
                      {pay
                        ? `From ${summary.advertsWithPay} adverts ${scope}`
                        : hasFigures
                          ? `${notEnough} ${scope}`
                          : "Loading…"}
                    </p>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                    style={{ width: `${pay ? clampPercent((pay.median / pay.p90) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Card 2 */}
              <div className="group relative flex min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-surface-card to-surface-card p-5 shadow-[0_10px_26px_rgba(109,40,217,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(109,40,217,0.16)]">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    90th Percentile Ceiling
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_8px_16px_rgba(89,47,174,0.28)]">
                    <span className="material-symbols-outlined text-[18px]">
                      workspace_premium
                    </span>
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg text-primary">
                      {pay ? money(pay.p90) : "—"}
                    </span>
                    {pay && <span className="font-label-md text-text-muted">/mo</span>}
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    {pay
                      ? `Middle half earn ${moneyShort(pay.p25)} – ${moneyShort(pay.p75)}`
                      : hasFigures
                        ? notEnough
                        : "Loading…"}
                  </p>
                </div>
                {/* The middle half of pay, drawn against the 90th percentile */}
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-violet-100">
                  {pay && (
                    <div
                      className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                      style={{
                        left: `${clampPercent((pay.p25 / pay.p90) * 100)}%`,
                        width: `${clampPercent(((pay.p75 - pay.p25) / pay.p90) * 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Card 3 */}
              <div className="group relative flex min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-surface-card to-surface-card p-5 shadow-[0_10px_26px_rgba(14,165,233,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(14,165,233,0.16)]">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Work Flexibility Index
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-[0_8px_16px_rgba(14,165,233,0.28)]">
                    <span className="material-symbols-outlined text-[18px]">
                      home_work
                    </span>
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg text-on-surface">
                      {summary?.flexible.share != null ? `${summary.flexible.share}%` : "—"}
                    </span>
                    <span className="font-label-md text-text-muted">Hybrid / Remote</span>
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    {summary?.flexible.share != null
                      ? `${summary.flexible.count} of ${summary.adverts} adverts offer remote or hybrid work`
                      : hasFigures
                        ? `Needs ${minSample}+ adverts`
                        : "Loading…"}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-sky-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-500"
                    style={{ width: `${summary?.flexible.share ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Card 4 */}
              <div className="group relative flex min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-surface-card to-surface-card p-5 shadow-[0_10px_26px_rgba(245,158,11,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(245,158,11,0.16)]">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Remote Pay Premium
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-[0_8px_16px_rgba(245,158,11,0.28)]">
                    <span className="material-symbols-outlined text-[18px]">
                      public
                    </span>
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-lg text-headline-lg text-secondary">
                      {flexiblePay?.premium != null ? signed(flexiblePay.premium) : "—"}
                    </span>
                    <span className="font-label-md text-text-muted">vs On-site</span>
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    {flexiblePay?.premium != null
                      ? `Remote & hybrid median ${moneyShort(flexiblePay.median)} vs ${moneyShort(flexiblePay.onsiteMedian)} on-site`
                      : hasFigures
                        ? `Needs ${minSample}+ paid adverts each for remote/hybrid and on-site`
                        : "Loading…"}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{
                      width: `${
                        pay && flexiblePay?.premium != null
                          ? clampPercent((flexiblePay.median / pay.p90) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= BENCHMARK VISUALIZER & SKILLS PREMIUM ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin w-full">
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start transition-opacity ${fade}`}>
            {/* Left: Role Benchmark Visualizer (col-span-7) */}
            <div className="lg:col-span-7 rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_36px_rgba(40,34,86,0.08)] md:p-space-lg flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-2 border-b border-border-default">
                <div>
                  <h3 className="font-headline-md font-bold text-on-surface">
                    Compensation Percentiles by Role
                  </h3>
                  <p className="font-body-sm text-text-muted">
                    {hasFigures
                      ? `Based on ${insights.dataPoints.toLocaleString("en-GB")} job adverts with published pay ${scope}, last 12 months`
                      : "Based on job adverts with published pay"}
                  </p>
                </div>
                <button
                  onClick={() => setShowSubmitModal(true)}
                  type="button"
                  className="px-space-md py-2 rounded-xl bg-brand-indigo-light text-primary font-label-md font-bold hover:bg-brand-indigo-subtle transition-colors flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Submit Data</span>
                </button>
              </div>

              <div className="flex flex-col gap-space-md">
                {!insights && isLoading &&
                  [0, 1, 2].map((row) => (
                    <div key={row} className="h-[88px] animate-pulse rounded-2xl bg-surface-container" />
                  ))}
                {hasFigures && roles.length === 0 && (
                  <p className="font-body-md text-text-muted text-center py-8">
                    No role has {minSample}+ adverts with pay {scope} yet.
                  </p>
                )}
                {roles.map((r) => (
                  <div key={r.role} className="group rounded-2xl border border-border-default bg-surface-container-low p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-card hover:shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 font-label-md">
                      <span className="font-bold text-on-surface">
                        {r.role}
                        <span className="ml-2 font-normal text-text-muted">
                          {r.adverts} adverts
                        </span>
                      </span>
                      <span className="font-numeric-metric text-salary-emerald font-bold shrink-0">
                        {moneyShort(r.median)} Median
                      </span>
                    </div>

                    {/* Visual Bar */}
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                        style={{ width: `${clampPercent((r.median / roleScale) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted font-body-sm">
                      <span>25%: {moneyShort(r.p25)}</span>
                      <span>75%: {moneyShort(r.p75)}</span>
                      <span>Top 10%: {moneyShort(r.p90)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Skill Premium Compensation Matrix (col-span-5) */}
            <div className="lg:col-span-5 rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_36px_rgba(40,34,86,0.08)] md:p-space-lg flex flex-col gap-space-md">
              <div className="pb-2 border-b border-border-default">
                <h3 className="font-headline-md font-bold text-on-surface">
                  High-Demand Skill Premiums
                </h3>
                <p className="font-body-sm text-text-muted">
                  Median pay of adverts asking for a skill, compared with all adverts
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {!insights && isLoading &&
                  [0, 1, 2].map((row) => (
                    <div key={row} className="h-[66px] animate-pulse rounded-2xl bg-surface-container" />
                  ))}
                {hasFigures && skills.length === 0 && (
                  <p className="font-body-md text-text-muted text-center py-4">
                    No skill appears in {minSample}+ adverts with pay {scope} yet.
                  </p>
                )}
                {skills.map((s) => (
                  <div
                    key={s.skill}
                    className="group flex items-center justify-between rounded-2xl border border-border-default bg-surface-container-low p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-salary-emerald/30 hover:bg-salary-surface hover:shadow-sm"
                  >
                    <div>
                      <h4 className="font-label-md font-bold text-on-surface capitalize">
                        {s.skill}
                      </h4>
                      <p className="font-body-sm text-text-muted text-[12px]">
                        Asked for in {s.adverts} adverts · median {moneyShort(s.median)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span
                        className={`font-numeric-metric font-bold text-[15px] ${
                          s.premium > 0 ? "text-salary-emerald" : "text-text-secondary"
                        }`}
                      >
                        {signed(s.premium)}
                      </span>
                      <span className="text-[10px] font-label-caps uppercase text-text-muted">
                        Pay Uplift
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= SUBMIT ANONYMOUS SALARY MODAL ================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-card rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-border-default relative">
            <button
              onClick={() => setShowSubmitModal(false)}
              type="button"
              className="absolute top-4 right-4 text-text-muted hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-indigo-light text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">
                  security
                </span>
              </div>
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Anonymous Salary Disclosure
                </h3>
                <p className="font-body-sm text-text-secondary">
                  Stored without your name or account. Submissions join these figures once verified.
                </p>
              </div>
            </div>

            <form onSubmit={handleContributeSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps uppercase text-text-muted">
                  Job Role Title
                </label>
                <input
                  type="text"
                  required
                  value={subRole}
                  onChange={(e) => setSubRole(e.target.value)}
                  placeholder="e.g. Registered Nurse or Operations Manager"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps uppercase text-text-muted">
                  Monthly Base Pay (GH₵)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={subComp}
                  onChange={(e) => setSubComp(e.target.value)}
                  placeholder="e.g. 6500"
                  className="p-2.5 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Years of Experience
                  </label>
                  <select
                    value={subExp}
                    onChange={(e) => setSubExp(e.target.value)}
                    className="p-2.5 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none"
                  >
                    <option value="0-2">0 - 2 Years</option>
                    <option value="3-5">3 - 5 Years</option>
                    <option value="6-8">6 - 8 Years</option>
                    <option value="8+">8+ Years</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Primary City / Hub
                  </label>
                  <input
                    type="text"
                    value={subLoc}
                    onChange={(e) => setSubLoc(e.target.value)}
                    placeholder="e.g. Accra, Kumasi, or Tamale"
                    className="p-2.5 rounded-xl bg-surface-container-low border border-border-default font-body-sm text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2.5 rounded-xl font-label-md text-text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-md py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold hover:bg-brand-indigo-dark shadow-xs"
                >
                  Submit Anonymously
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default SalariesInsights;
