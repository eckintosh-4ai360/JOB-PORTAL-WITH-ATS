import { Link } from "react-router-dom";

const Footer = () => {
  const candidateLinks = [
    ["Find a job", "/find-jobs"],
    ["Browse companies", "/browse-companies"],
    ["Salary insights", "/salaries-insights"],
    ["AI resume match", "/resume-analyzer"],
    ["Saved jobs", "/saved-jobs"],
  ];

  const employerLinks = [
    ["Post a job", "/post-job"],
    ["Employer dashboard", "/employer-dashboard"],
    ["Manage applicants", "/applicants"],
    ["Compensation intelligence", "/salaries-insights"],
    ["Hiring team sign in", "/login"],
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-[#211046] pt-space-xl text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#7235c4]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#d27cf0]/20 blur-3xl" />

      <div className="relative mx-auto max-w-[1280px] px-margin-mobile md:px-margin">
        <div className="mb-space-xl grid grid-cols-1 gap-space-lg lg:grid-cols-12 lg:items-stretch">
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.07] p-space-lg backdrop-blur-sm lg:col-span-5">
            <div>
              <Link to="/find-jobs" className="group flex w-fit items-center gap-3 focus:outline-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f4d68f] via-[#e79fbb] to-[#c471ec] text-[#39136d] shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-[25px]">work</span>
                </div>
                <div>
                  <span className="block font-headline-md text-[1.35rem] font-bold leading-none tracking-tight text-white">SPG</span>
                  <span className="mt-1 block font-label-caps uppercase tracking-[0.18em] text-[#d9bdff]">Talent network</span>
                </div>
              </Link>

              <h2 className="mt-space-lg max-w-md font-headline-lg text-[1.75rem] leading-tight text-white">
                Better work starts with the right connection.
              </h2>
              <p className="mt-space-sm max-w-md font-body-md leading-relaxed text-white/70">
                SPG connects ambitious African tech talent with verified teams building what comes next.
              </p>
            </div>

            <div className="mt-space-lg flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#80efd0]/20 bg-[#59d3ac]/10 px-3 py-1.5 font-label-caps uppercase tracking-wider text-[#a7f8dc]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#74f0bd] animate-pulse" />
                Verified roles only
              </span>
              <span className="font-body-sm text-white/50">Accra · Lagos · Nairobi · Remote</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:col-span-4">
            <div className="rounded-3xl  p-space-md">
              <span className="flex items-center gap-2 font-label-caps uppercase tracking-[0.15em] text-[#d9bdff]">
                <span className="material-symbols-outlined text-[16px]">person_search</span>
                For talent
              </span>
              <div className="mt-3 flex flex-col gap-1">
                {candidateLinks.map(([label, path]) => (
                  <Link key={path} to={path} className="group flex items-center justify-between rounded-xl px-2 py-1.5 font-body-sm text-white/70 transition hover:bg-white/10 hover:text-white">
                    {label}
                    <span className="material-symbols-outlined text-[16px] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">arrow_forward</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl  p-space-md">
              <span className="flex items-center gap-2 font-label-caps uppercase tracking-[0.15em] text-[#d9bdff]">
                <span className="material-symbols-outlined text-[16px]">business_center</span>
                For employers
              </span>
              <div className="mt-3 flex flex-col gap-1">
                {employerLinks.map(([label, path]) => (
                  <Link key={path} to={path} className="group flex items-center justify-between rounded-xl px-2 py-1.5 font-body-sm text-white/70 transition hover:bg-white/10 hover:text-white">
                    {label}
                    <span className="material-symbols-outlined text-[16px] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">arrow_forward</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-[#f0d6ff] to-[#c891ef] p-space-md text-[#32115d] shadow-[0_14px_34px_rgba(0,0,0,0.18)] lg:col-span-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 text-[#6727a9]">
              <span className="material-symbols-outlined text-[21px]">notifications_active</span>
            </div>
            <h3 className="mt-3 font-headline-sm text-[#371060]">The good roles, delivered.</h3>
            <p className="mt-1 font-body-sm leading-relaxed text-[#572987]">A concise weekly edit of verified roles and salary intelligence.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                alert("Thank you for subscribing to SPG JobPortal alerts!");
              }}
              className="mt-4"
            >
              <label className="sr-only" htmlFor="footer-email">Email address</label>
              <div className="flex rounded-xl bg-white p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-[#6d2aad]/35">
                <input id="footer-email" type="email" required placeholder="you@email.com" className="min-w-0 flex-1 bg-transparent px-2 font-body-sm text-[#32115d] placeholder:text-[#8c63aa] focus:outline-none" />
                <button type="submit" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4a197f] text-white transition hover:bg-[#35105f]" aria-label="Subscribe to job alerts">
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </form>
            <p className="mt-2 font-label-caps text-[#633193]">No noise. Unsubscribe anytime.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-space-md font-body-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SPG JobPortal. Built for meaningful work.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/find-jobs" className="transition hover:text-white">Privacy</Link>
            <Link to="/find-jobs" className="transition hover:text-white">Terms</Link>
            <Link to="/salaries-insights" className="transition hover:text-white">Trust & verification</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
