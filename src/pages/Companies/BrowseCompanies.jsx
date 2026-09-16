import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { MOCK_COMPANIES, MOCK_JOBS } from "../../utils/mockData";

const BrowseCompanies = () => {
  const [search, setSearch] = useState("");
  const [selectedHq, setSelectedHq] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [activeCompanyModal, setActiveCompanyModal] = useState(null);

  const filteredCompanies = useMemo(() => {
    return MOCK_COMPANIES.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.stack.some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
        c.description.toLowerCase().includes(search.toLowerCase());

      const matchHq = !selectedHq || c.hq.toLowerCase().includes(selectedHq.toLowerCase());
      const matchStage = !selectedStage || c.stage.toLowerCase().includes(selectedStage.toLowerCase());
      const matchIndustry =
        !selectedIndustry || c.industry.toLowerCase().includes(selectedIndustry.toLowerCase());

      return matchSearch && matchHq && matchStage && matchIndustry;
    });
  }, [search, selectedHq, selectedStage, selectedIndustry]);

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= HERO SECTION ================= */}
        <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pt-space-lg pb-space-xl border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-space-xs font-label-md text-text-muted mb-space-sm">
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-primary font-bold">Browse Companies</span>
            </nav>

            {/* Headline Block with Live Metric Counters */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg mb-space-lg">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-brand-indigo-light text-primary font-label-caps uppercase tracking-wider mb-space-sm">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Verified Tech Ecosystem 2025
                </div>
                <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                  Discover Top Tech Companies &amp; Startups in Africa
                </h1>
                <p className="font-body-lg text-body-lg text-text-secondary mt-2">
                  Explore workplace cultures, verified employee benefits, engineering stacks, and active job vacancies across Ghana, Nigeria, Kenya, and global remote hubs.
                </p>
              </div>

              {/* Metric Stat Cards Group */}
              <div className="flex items-center gap-space-md shrink-0 flex-wrap">
                <div className="px-space-md py-space-sm rounded-2xl bg-surface-card border border-border-default shadow-xs flex flex-col">
                  <span className="font-numeric-metric text-[26px] text-primary">
                    340+
                  </span>
                  <span className="font-label-md text-text-muted">Verified Firms</span>
                </div>
                <div className="px-space-md py-space-sm rounded-2xl bg-salary-surface border border-salary-emerald/20 shadow-xs flex flex-col">
                  <span className="font-numeric-metric text-[26px] text-salary-emerald">
                    1,280+
                  </span>
                  <span className="font-label-md text-salary-emerald font-semibold">
                    Open Positions
                  </span>
                </div>
                <div className="px-space-md py-space-sm rounded-2xl bg-surface-card border border-border-default shadow-xs flex flex-col">
                  <span className="font-numeric-metric text-[26px] text-secondary">
                    GH₵ 42k
                  </span>
                  <span className="font-label-md text-text-muted">Median Salary</span>
                </div>
              </div>
            </div>

            {/* High-Precision Search & Filter Dock */}
            <div className="p-space-md md:p-space-lg rounded-2xl bg-surface-card border border-border-default shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">
                {/* Search Input */}
                <div className="md:col-span-5 flex items-center bg-surface-container-low rounded-xl px-space-md py-3 gap-space-sm shadow-inner focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="material-symbols-outlined text-text-muted text-[22px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by company name or tech stack (e.g. Go, Paystack)..."
                    className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none"
                  />
                </div>

                {/* HQ Location Dropdown */}
                <div className="md:col-span-3 flex items-center bg-surface-container-low rounded-xl px-space-md py-3 gap-space-xs shadow-inner">
                  <span className="material-symbols-outlined text-text-muted text-[20px]">
                    location_on
                  </span>
                  <select
                    value={selectedHq}
                    onChange={(e) => setSelectedHq(e.target.value)}
                    className="w-full bg-transparent font-body-md text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="">All Locations</option>
                    <option value="Accra">Accra, Ghana</option>
                    <option value="Lagos">Lagos, Nigeria</option>
                    <option value="Nairobi">Nairobi, Kenya</option>
                    <option value="Remote">Pan-African Remote</option>
                  </select>
                </div>

                {/* Stage Dropdown */}
                <div className="md:col-span-2 flex items-center bg-surface-container-low rounded-xl px-space-md py-3 gap-space-xs shadow-inner">
                  <span className="material-symbols-outlined text-text-muted text-[20px]">
                    trending_up
                  </span>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full bg-transparent font-body-md text-on-surface focus:outline-none cursor-pointer"
                  >
                    <option value="">All Stages</option>
                    <option value="Series A">Series A / B</option>
                    <option value="Series C">Series C / D</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Acquired">Acquired</option>
                  </select>
                </div>

                {/* Reset Action */}
                <div className="md:col-span-2 flex items-center justify-end">
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedHq("");
                      setSelectedStage("");
                      setSelectedIndustry("");
                    }}
                    type="button"
                    className="w-full py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-text-secondary font-label-md font-semibold transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= COMPANIES GRID ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin mt-space-lg w-full">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline-sm font-bold text-on-surface">
              Verified Organizations ({filteredCompanies.length})
            </span>
            <span className="font-body-sm text-text-muted">
              Audited by SPG Talent Intelligence
            </span>
          </div>          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
            {filteredCompanies.map((company) => (
              <article
                key={company.id}
                className="bg-surface-card rounded-2xl border border-border-default hover:border-primary/40 shadow-sm hover:shadow-lg transition-all duration-200 p-space-lg flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Decorative Subtle Corner Accent matching code (6).html */}
                <div className="absolute top-0 right-0 w-28 h-28 bg-brand-indigo-light/40 rounded-bl-full pointer-events-none -z-0 group-hover:scale-110 transition-transform" />

                <div className="relative z-10">
                  {/* Top Header: Logo, Company Name, Verified & Stage Badges */}
                  <div className="flex items-start justify-between gap-space-sm mb-space-sm">
                    <div className="flex items-start gap-space-md">
                      <div className="w-14 h-14 rounded-2xl bg-surface-container p-1 shadow-sm border border-border-default overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                            {company.name}
                          </h3>
                          <span
                            className="material-symbols-outlined text-verified-badge text-[18px]"
                            title="Audited & Verified Employer"
                          >
                            verified
                          </span>
                        </div>
                        <p className="font-body-sm text-text-muted mt-0.5 truncate">
                          {company.industry}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-surface-container font-label-caps text-text-secondary font-bold shrink-0">
                      {company.stage}
                    </span>
                  </div>

                  {/* Company Description */}
                  <p className="font-body-md text-text-secondary line-clamp-2 leading-relaxed mt-2 mb-space-md">
                    {company.description}
                  </p>

                  {/* Metadata Row: Location, Employees & Culture */}
                  <div className="flex items-center gap-space-md text-text-muted font-body-sm py-1 border-t border-border-default/60">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">
                        location_on
                      </span>
                      {company.hq}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">
                        groups
                      </span>
                      {company.employees}
                    </span>
                  </div>

                  {/* Tech Stack Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-space-sm mb-space-md">
                    {company.stack.slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-text-secondary text-[11px]"
                      >
                        {tech}
                      </span>
                    ))}
                    {company.stack.length > 4 && (
                      <span className="px-2 py-0.5 rounded-lg bg-brand-indigo-light text-primary font-label-md text-[11px] font-bold">
                        +{company.stack.length - 4} More
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row Action & Open Roles */}
                <div className="relative z-10 pt-space-md border-t border-border-default flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-label-md text-salary-emerald font-bold bg-salary-surface px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-salary-emerald animate-pulse" />
                      {company.openRoles} Open Roles
                    </span>
                    <div className="flex items-center gap-1 text-on-surface font-body-sm">
                      <span className="material-symbols-outlined text-amber-500 text-[18px]">
                        star
                      </span>
                      <span className="font-bold text-xs">{company.rating}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveCompanyModal(company)}
                    type="button"
                    className="inline-flex items-center gap-1 font-label-lg text-primary hover:text-brand-indigo-dark font-semibold transition-colors"
                  >
                    <span>View Jobs</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ================= COMPANY PROFILE MODAL ================= */}
      {activeCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-card rounded-2xl max-w-2xl w-full p-space-lg shadow-2xl border border-border-default relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setActiveCompanyModal(null)}
              type="button"
              className="absolute top-4 right-4 text-text-muted hover:text-on-surface p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="flex items-start gap-4 mb-4">
              <img
                src={activeCompanyModal.logo}
                alt={activeCompanyModal.name}
                className="w-16 h-16 rounded-2xl object-cover border border-border-default"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-headline-md font-bold text-on-surface">
                    {activeCompanyModal.name}
                  </h2>
                  <span className="material-symbols-outlined text-verified-badge text-[20px]">
                    verified
                  </span>
                </div>
                <p className="font-body-sm text-text-muted">
                  {activeCompanyModal.hq} • {activeCompanyModal.stage} • {activeCompanyModal.employees} team members
                </p>
              </div>
            </div>

            <p className="font-body-md text-text-secondary leading-relaxed mb-4">
              {activeCompanyModal.description}
            </p>

            <div className="mb-4">
              <h4 className="font-label-caps uppercase text-text-muted mb-2">
                Engineering Stack &amp; Tools
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {activeCompanyModal.stack.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-on-surface"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-label-caps uppercase text-text-muted mb-2">
                Verified Benefits &amp; Culture Perks
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {activeCompanyModal.perks.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low font-body-sm text-text-secondary"
                  >
                    <span className="material-symbols-outlined text-salary-emerald text-[18px]">
                      check_circle
                    </span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border-default flex items-center justify-between">
              <span className="font-body-sm text-text-muted">
                {activeCompanyModal.openRoles} active positions matching tech candidates
              </span>
              <Link
                to="/find-jobs"
                onClick={() => setActiveCompanyModal(null)}
                className="px-space-md py-2 bg-primary-container text-on-primary font-label-md font-bold rounded-xl hover:bg-brand-indigo-dark transition-all"
              >
                Browse Open Roles
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default BrowseCompanies;
