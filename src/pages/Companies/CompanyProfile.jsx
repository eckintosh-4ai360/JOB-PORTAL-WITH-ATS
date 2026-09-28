import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/** Employers write the about text by hand, so keep the paragraphs they typed. */
const paragraphs = (text) =>
  String(text || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

const salaryText = (job) => {
  const { salaryMin, salaryMax } = job;
  if (!salaryMin && !salaryMax) return "Not disclosed";

  const short = (value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`);
  if (salaryMin && salaryMax) return `GH₵ ${short(salaryMin)} – ${short(salaryMax)}`;
  return `GH₵ ${short(salaryMin || salaryMax)}`;
};

const postedAgo = (createdAt) => {
  if (!createdAt) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const joinedOn = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

/** A website is stored with its scheme; the host is the part a candidate reads. */
const websiteLabel = (raw) => {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
};

const DetailRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-space-md py-2.5 border-b border-border-default/60 last:border-none">
    <span className="font-body-sm text-text-muted shrink-0">{label}</span>
    <span className="font-body-sm font-semibold text-text-primary text-right break-words">
      {children}
    </span>
  </div>
);

/**
 * One employer's public profile — everything they filled in at setup, plus the
 * roles they currently have live. Reached from a job posting and from the
 * employer directory, so a candidate can read about the company before
 * applying instead of being sent back to the directory listing.
 */
const CompanyProfile = () => {
  const { companyId } = useParams();

  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCompany = async () => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get(API_PATHS.COMPANIES.GET_BY_ID(companyId));
        if (!cancelled) setCompany(res.data || null);
      } catch (err) {
        // An employer who never completed a company profile has no Company
        // record to look up — the directory lists them under `emp_<userId>`,
        // so try there before calling the profile missing.
        if (err?.response?.status === 404 && !String(companyId).startsWith("emp_")) {
          try {
            const fallback = await axiosInstance.get(
              API_PATHS.COMPANIES.GET_BY_ID(`emp_${companyId}`)
            );
            if (!cancelled) setCompany(fallback.data || null);
            return;
          } catch {
            // Fall through to the not-found state.
          }
        }
        console.warn("Could not load company:", err?.message || err);
        if (!cancelled) setCompany(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (companyId) fetchCompany();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (isLoading) {
    return (
      <div className="bg-surface min-h-screen flex flex-col pt-20">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-body-md text-text-muted">Loading company profile...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-surface min-h-screen flex flex-col pt-20">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-text-muted mb-4">
            <span className="material-symbols-outlined text-[36px]">domain_disabled</span>
          </div>
          <h2 className="font-headline-md font-bold text-text-primary mb-2">Company Not Found</h2>
          <p className="font-body-md text-text-secondary max-w-md mb-6">
            This employer profile may have been removed, or the link is out of date.
          </p>
          <Link
            to="/browse-companies"
            className="px-6 py-3 rounded-xl bg-primary text-white font-label-md font-bold hover:bg-brand-indigo-dark transition-colors"
          >
            Browse Employers
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const name = company.name || company.companyName || "Hiring Company";
  const logo = company.logo || company.companyLogo || "";
  // The banner is the employer's cover, and otherwise the profile photo they
  // uploaded — a separate image from the company logo, which already sits in
  // the badge below. Without either, the brand panel stands in.
  const banner = company.cover || company.avatar || "";
  const about = paragraphs(company.description);
  const stack = Array.isArray(company.stack) ? company.stack : [];
  const perks = Array.isArray(company.perks) ? company.perks : [];
  const jobs = Array.isArray(company.jobs) ? company.jobs : [];
  const openRoles = Number(company.openRoles) || jobs.length;
  const joined = joinedOn(company.createdAt);
  const allRolesUrl = `/find-jobs?company=${encodeURIComponent(
    company.userId || ""
  )}&companyName=${encodeURIComponent(name)}`;

  return (
    <div className="bg-surface min-h-screen text-on-surface flex flex-col pt-20">
      <Navbar />

      <main className="flex-1 w-full pb-space-xl">
        {/* ================= PROFILE HEADER ================= */}
        <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pt-space-lg pb-space-lg border-b border-border-default">
          <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-space-xs font-label-md text-text-muted mb-space-sm">
              <Link to="/find-jobs" className="hover:text-primary transition-colors">
                Home
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <Link to="/browse-companies" className="hover:text-primary transition-colors">
                Browse Companies
              </Link>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-primary font-bold truncate max-w-[220px]">{name}</span>
            </nav>

            {/* Cover banner, or a plain brand panel for an employer with no image at all */}
            <div className="relative h-32 md:h-44 w-full rounded-t-2xl overflow-hidden border border-b-0 border-border-default bg-gradient-to-br from-brand-indigo-light via-surface-container to-surface-container-low">
              {banner && (
                <>
                  <img
                    src={banner}
                    alt={`${name} banner`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Keeps the logo badge and the card edge readable over a busy photo. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
                </>
              )}
            </div>

            <div className="rounded-b-2xl border border-t-0 border-border-default bg-surface-card px-space-md md:px-space-lg pb-space-md shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-space-md">
                <div className="flex items-end gap-space-md min-w-0">
                  <div className="w-24 h-24 -mt-10 rounded-2xl bg-surface-card p-1.5 shadow-md border border-border-default overflow-hidden shrink-0 flex items-center justify-center">
                    {logo ? (
                      <img src={logo} alt={name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-[40px]">
                        business
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 pb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h1 className="font-headline-lg font-bold text-on-surface tracking-tight">
                        {name}
                      </h1>
                      {company.verified && (
                        <span
                          className="material-symbols-outlined text-verified-badge text-[22px]"
                          title="Verified employer"
                        >
                          verified
                        </span>
                      )}
                    </div>
                    <p className="font-body-md text-text-secondary mt-0.5">
                      {company.industry}
                      {company.stage && company.stage !== "Not specified" && ` • ${company.stage}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-space-sm flex-wrap shrink-0">
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">language</span>
                      Visit website
                    </a>
                  )}
                  <Link
                    to={allRolesUrl}
                    className="inline-flex items-center gap-1.5 px-space-md py-2.5 rounded-xl bg-primary text-white font-label-md font-bold hover:bg-brand-indigo-dark transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">work</span>
                    Browse open roles
                  </Link>
                </div>
              </div>

              {/* Headline figures for this employer */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm mt-space-md pt-space-md border-t border-border-default">
                <div className="flex flex-col">
                  <span className="font-numeric-metric text-[22px] text-salary-emerald">
                    {openRoles}
                  </span>
                  <span className="font-label-md text-text-muted">
                    Open {openRoles === 1 ? "Role" : "Roles"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-numeric-metric text-[22px] text-on-surface">
                    {company.employees}
                  </span>
                  <span className="font-label-md text-text-muted">Employees</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-lg font-bold text-on-surface truncate">
                    {company.hq}
                  </span>
                  <span className="font-label-md text-text-muted">Headquarters</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-lg font-bold text-on-surface truncate">
                    {joined || "—"}
                  </span>
                  <span className="font-label-md text-text-muted">On SPG since</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PROFILE BODY ================= */}
        <section className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin mt-space-lg w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
            {/* ---- Left column: what the employer wrote about themselves ---- */}
            <div className="lg:col-span-2 flex flex-col gap-space-lg">
              <article className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-space-md md:p-space-lg">
                <h2 className="font-headline-sm font-bold text-on-surface mb-space-sm">
                  About {name}
                </h2>
                {about.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {about.map((block, index) => (
                      <p
                        key={index}
                        className="font-body-md text-text-secondary leading-relaxed whitespace-pre-line"
                      >
                        {block}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-body-md text-text-muted italic">
                    This employer has not written a company description yet.
                  </p>
                )}
              </article>

              {stack.length > 0 && (
                <article className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-space-md md:p-space-lg">
                  <h2 className="font-headline-sm font-bold text-on-surface mb-space-sm">
                    Areas of Expertise &amp; Tools
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {stack.map((item) => (
                      <span
                        key={item}
                        className="px-3 py-1.5 rounded-lg bg-surface-container font-label-md text-text-secondary"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              )}

              {perks.length > 0 && (
                <article className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-space-md md:p-space-lg">
                  <h2 className="font-headline-sm font-bold text-on-surface mb-space-sm">
                    Benefits &amp; Workplace Highlights
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perks.map((perk) => (
                      <div
                        key={perk}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-container-low font-body-sm text-text-secondary"
                      >
                        <span className="material-symbols-outlined text-salary-emerald text-[18px]">
                          check_circle
                        </span>
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-space-md md:p-space-lg">
                <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                  <h2 className="font-headline-sm font-bold text-on-surface">
                    Open Roles ({jobs.length})
                  </h2>
                  {jobs.length > 0 && (
                    <Link
                      to={allRolesUrl}
                      className="inline-flex items-center gap-1 font-label-md text-primary hover:text-brand-indigo-dark font-semibold transition-colors"
                    >
                      See all
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                  )}
                </div>

                {jobs.length === 0 ? (
                  <p className="font-body-md text-text-muted">
                    {name} has no live vacancies right now. Check back later, or explore other
                    employers.
                  </p>
                ) : (
                  <div className="flex flex-col gap-space-sm">
                    {jobs.map((job) => {
                      const posted = postedAgo(job.createdAt);
                      return (
                        <Link
                          key={job._id || job.id}
                          to={`/job/${job._id || job.id}`}
                          className="group flex items-start justify-between gap-space-md rounded-xl border border-border-default bg-surface-container-low p-space-sm md:p-space-md hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                          <div className="min-w-0">
                            <h3 className="font-label-lg font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                              {job.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-body-sm text-text-muted">
                              {job.location && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">
                                    location_on
                                  </span>
                                  {job.location}
                                </span>
                              )}
                              {job.type && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">
                                    schedule
                                  </span>
                                  {job.type}
                                </span>
                              )}
                              {job.workModel && <span>{job.workModel}</span>}
                              {posted && <span>{posted}</span>}
                            </div>
                          </div>
                          <span className="shrink-0 font-label-md font-bold text-salary-emerald text-right">
                            {salaryText(job)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>

            {/* ---- Right column: the organisation details set at setup ---- */}
            <aside className="flex flex-col gap-space-lg">
              <div className="bg-surface-card rounded-2xl border border-border-default shadow-sm p-space-md md:p-space-lg lg:sticky lg:top-24">
                <h2 className="font-headline-sm font-bold text-on-surface mb-space-sm">
                  Company Details
                </h2>

                <div className="flex flex-col">
                  <DetailRow label="Industry">{company.industry}</DetailRow>
                  {company.organizationType && (
                    <DetailRow label="Organisation type">{company.organizationType}</DetailRow>
                  )}
                  <DetailRow label="Company stage">{company.stage}</DetailRow>
                  <DetailRow label="Headquarters">{company.hq}</DetailRow>
                  <DetailRow label="Organization size">{company.employees}</DetailRow>
                  {company.website && (
                    <DetailRow label="Website">
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {websiteLabel(company.website)}
                      </a>
                    </DetailRow>
                  )}
                  {Number(company.rating) > 0 && (
                    <DetailRow label="Candidate rating">
                      {Number(company.rating).toFixed(1)} / 5
                    </DetailRow>
                  )}
                  <DetailRow label="Verification status">
                    {company.verified ? (
                      <span className="text-salary-emerald inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        Verified employer
                      </span>
                    ) : (
                      <span className="text-text-muted">Not yet verified</span>
                    )}
                  </DetailRow>
                  {joined && <DetailRow label="On SPG since">{joined}</DetailRow>}
                </div>

                <Link
                  to={allRolesUrl}
                  className="mt-space-md w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-semibold text-center transition-colors block"
                >
                  View all roles from this employer
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CompanyProfile;
