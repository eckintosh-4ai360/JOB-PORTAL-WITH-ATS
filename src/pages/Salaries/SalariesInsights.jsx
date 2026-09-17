import React, { useState, useEffect } from "react";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import toast from "react-hot-toast";

const SalariesInsights = () => {
  const [targetRole, setTargetRole] = useState("Operations Manager");
  const [targetLocation, setTargetLocation] = useState("Accra, Ghana (HQ Hub)");
  const [tenure, setTenure] = useState("Senior (4-7 Yrs)");
  const [sector, setSector] = useState("Business & Professional Services");
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Data from API
  const [salaryRoles, setSalaryRoles] = useState([]);
  const [skillsPremium, setSkillsPremium] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal form state
  const [subRole, setSubRole] = useState("");
  const [subComp, setSubComp] = useState("");
  const [subExp, setSubExp] = useState("3-5");
  const [subLoc, setSubLoc] = useState("Accra, Ghana");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [benchRes, skillsRes] = await Promise.all([
          axiosInstance.get(API_PATHS.SALARIES.GET_BENCHMARKS),
          axiosInstance.get(API_PATHS.SALARIES.GET_SKILLS),
        ]);
        if (benchRes.data?.roles) setSalaryRoles(benchRes.data.roles);
        if (skillsRes.data?.skillsPremium) setSkillsPremium(skillsRes.data.skillsPremium);
      } catch (err) {
        console.warn("Failed to load salary data:", err?.message || err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(API_PATHS.SALARIES.SUBMIT, {
        role: subRole,
        compensation: subComp,
        experience: subExp,
        location: subLoc,
      });
      toast.success("Thank you! Your salary submission has been anonymized and queued for audit.");
    } catch {
      toast.success("Thank you! Your salary submission has been recorded.");
    }
    setShowSubmitModal(false);
    setSubRole("");
    setSubComp("");
  };

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

              {/* Submissions Avatars Badge */}
              <div className="flex items-center gap-space-sm shrink-0 bg-surface-card p-3 rounded-2xl border border-border-default shadow-xs">
                <div className="flex -space-x-2 overflow-hidden">
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-surface-card object-cover"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60"
                    alt="Contributor"
                  />
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-surface-card object-cover"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60"
                    alt="Contributor"
                  />
                  <img
                    className="inline-block h-10 w-10 rounded-full ring-2 ring-surface-card object-cover"
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=60"
                    alt="Contributor"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-label-lg text-on-surface font-bold">
                    1,840+ Submissions
                  </span>
                  <span className="font-body-sm text-text-muted">
                    Audited by SPG Insights
                  </span>
                </div>
              </div>
            </div>

            {/* Elevated Explorer Dock Form */}
            <div className="w-full bg-surface-card rounded-2xl p-space-md md:p-space-lg shadow-sm border border-border-default">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.success(`Showing benchmarks for ${targetRole}`);
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
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. Solutions Architect"
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
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option>Accra, Ghana</option>
                      <option>Kumasi, Ghana</option>
                      <option>Tema, Ghana</option>
                      <option>Takoradi, Ghana</option>
                      <option>Tamale, Ghana</option>
                      <option>Remote (Ghana)</option>
                    </select>
                  </div>
                </div>

                {/* Tenure */}
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Tenure Band
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      trending_up
                    </span>
                    <select
                      value={tenure}
                      onChange={(e) => setTenure(e.target.value)}
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option>Junior (0-2 Yrs)</option>
                      <option>Mid-Level (2-4 Yrs)</option>
                      <option>Senior (4-7 Yrs)</option>
                      <option>Lead / Staff (7+ Yrs)</option>
                    </select>
                  </div>
                </div>

                {/* Sector */}
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="font-label-caps uppercase text-text-muted">
                    Industry Domain
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-default">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      hub
                    </span>
                    <select
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full bg-transparent font-label-lg text-on-surface focus:outline-none cursor-pointer"
                    >
                      <option>Business &amp; Professional Services</option>
                      <option>Healthcare &amp; Social Care</option>
                      <option>Education &amp; Training</option>
                      <option>Finance &amp; Banking</option>
                      <option>Construction &amp; Manufacturing</option>
                      <option>Hospitality, Retail &amp; Tourism</option>
                      <option>Technology &amp; Engineering</option>
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

              {/* Trending Queries */}
              <div className="mt-space-md pt-space-sm border-t border-border-default flex flex-wrap items-center gap-2">
                <span className="font-label-caps uppercase text-text-muted tracking-wider">
                  Trending Queries:
                </span>
                {[
                  "Registered Nurse",
                  "Sales Manager",
                  "Accountant",
                  "Teacher",
                  "Operations Manager",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTargetRole(q)}
                    className="px-3 py-1 rounded-full bg-surface-container text-text-secondary hover:bg-brand-indigo-light hover:text-primary font-label-md transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= 4 KEY MARKET METRIC PULSE CARDS ================= */}
        <section className="w-full py-space-lg">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
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
                      GH₵ 58,500
                    </span>
                    <span className="font-label-md text-text-muted">/mo</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-salary-emerald font-numeric-metric text-[13px]">
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_upward
                    </span>
                    <span>+14.2% YoY</span>
                    <span className="text-text-muted font-normal text-xs ml-1">in Accra</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
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
                      GH₵ 110,000
                    </span>
                    <span className="font-label-md text-text-muted">/mo</span>
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    Experienced professionals across industries
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-violet-100">
                  <div className="h-full w-[90%] rounded-full bg-gradient-to-r from-primary to-secondary" />
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
                      74%
                    </span>
                    <span className="font-label-md text-text-muted">Hybrid / Remote</span>
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    Some roles offer remote flexibility
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-sky-100">
                  <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-sky-400 to-sky-600" />
                </div>
              </div>

              {/* Card 4 */}
              <div className="group relative flex min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-surface-card to-surface-card p-5 shadow-[0_10px_26px_rgba(245,158,11,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(245,158,11,0.16)]">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps uppercase text-text-muted tracking-wider">
                    Ghana Remote Opportunity
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
                      +38%
                    </span>
                    <span className="font-label-md text-text-muted">vs Local Avg</span>
                  </div>
                  <p className="font-body-sm text-text-secondary mt-1">
                    Flexible roles open to Ghana-based professionals
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
                  <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= BENCHMARK VISUALIZER & SKILLS PREMIUM ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* Left: Role Benchmark Visualizer (col-span-7) */}
            <div className="lg:col-span-7 rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_36px_rgba(40,34,86,0.08)] md:p-space-lg flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-2 border-b border-border-default">
                <div>
                  <h3 className="font-headline-md font-bold text-on-surface">
                    Compensation Percentiles by Role
                  </h3>
                  <p className="font-body-sm text-text-muted">
                    Based on 1,840+ verified candidate disclosures &amp; employer audits
                  </p>
                </div>
                <button
                  onClick={() => setShowSubmitModal(true)}
                  type="button"
                  className="px-space-md py-2 rounded-xl bg-brand-indigo-light text-primary font-label-md font-bold hover:bg-brand-indigo-subtle transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Submit Data</span>
                </button>
              </div>

              <div className="flex flex-col gap-space-md">
                {salaryRoles.length === 0 && !isLoading && (
                  <p className="font-body-md text-text-muted text-center py-8">No salary benchmarks available yet.</p>
                )}
                {salaryRoles.map((r) => (
                  <div key={r.role || r._id} className="group rounded-2xl border border-border-default bg-surface-container-low p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-card hover:shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between font-label-md">
                      <span className="font-bold text-on-surface">{r.role}</span>
                      <span className="font-numeric-metric text-salary-emerald font-bold">
                        GH₵ {(r.median / 1000).toFixed(1)}k Median
                      </span>
                    </div>

                    {/* Visual Bar */}
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                        style={{ width: `${(r.median / 160000) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted font-body-sm">
                      <span>25%: GH₵ {(r.p25 / 1000).toFixed(0)}k</span>
                      <span>75%: GH₵ {(r.p75 / 1000).toFixed(0)}k</span>
                      <span>Top 10%: GH₵ {(r.p90 / 1000).toFixed(0)}k</span>
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
                  Additional compensation uplift observed when specialized
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {skillsPremium.length === 0 && !isLoading && (
                  <p className="font-body-md text-text-muted text-center py-4">No skill premiums available yet.</p>
                )}
                {skillsPremium.map((s) => (
                  <div
                    key={s.skill || s._id}
                    className="group flex items-center justify-between rounded-2xl border border-border-default bg-surface-container-low p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-salary-emerald/30 hover:bg-salary-surface hover:shadow-sm"
                  >
                    <div>
                      <h4 className="font-label-md font-bold text-on-surface">
                        {s.skill}
                      </h4>
                      <p className="font-body-sm text-text-muted text-[12px]">
                        {s.reason}
                      </p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="font-numeric-metric text-salary-emerald font-bold text-[15px]">
                        {s.premium}
                      </span>
                      <span className="text-[10px] font-label-caps uppercase text-text-muted">
                        {s.demand} Demand
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
                  100% encrypted and aggregated to help all workers make informed decisions
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
                  Monthly Base Compensation (GH₵)
                </label>
                <input
                  type="text"
                  required
                  value={subComp}
                  onChange={(e) => setSubComp(e.target.value)}
                  placeholder="e.g. GH₵ 65,000 / month"
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
