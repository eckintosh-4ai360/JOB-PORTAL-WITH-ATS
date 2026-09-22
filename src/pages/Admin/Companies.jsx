import { useCallback, useEffect, useState } from "react";
import {
  Building2, Check, ExternalLink, FileText, Inbox, Loader2, RefreshCw, ShieldCheck, X,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { resolveFileUrl, downloadFileUrl } from "../../utils/fileUrl";
import {
  StatTile, StatePill, FilterTabs, SearchBox, EmptyRow, DetailRow, Pagination,
} from "./components/AdminUI";

/**
 * Company review.
 *
 * Every business on the platform is listed here, and nobody publishes a job
 * until someone on this screen has looked at their registration details and
 * approved them. The decision also grants the public verified badge, so what a
 * reviewer does here is what candidates end up trusting.
 */

const STATE_TABS = [
  { id: "pending", label: "Awaiting review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "", label: "All" },
];

const Companies = () => {
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [incompleteSetups, setIncompleteSetups] = useState([]);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [state, setState] = useState("pending");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [note, setNote] = useState("");
  const [isDeciding, setIsDeciding] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.OVERVIEW);
      setOverview(res.data);
    } catch {
      // The tiles are context, not the job — a failure here must not stop review.
      setOverview(null);
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.GET_COMPANIES, {
        params: { state: state || undefined, search: search || undefined, page },
      });
      setCompanies(res.data.companies || []);
      setIncompleteSetups(res.data.incompleteSetups || []);
      setPages(res.data.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load companies.");
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  }, [state, search, page]);

  useEffect(() => {
    // Kicked off a tick later so the fetch never writes state inside the
    // effect's synchronous path — the same shape as the debounced list load.
    const timer = setTimeout(loadOverview, 0);
    return () => clearTimeout(timer);
  }, [loadOverview]);

  useEffect(() => {
    const timer = setTimeout(loadCompanies, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadCompanies, search]);

  const openCompany = async (company) => {
    setSelected(company);
    setNote("");
    setIsLoadingDetail(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.GET_COMPANY(company.id));
      setSelected(res.data.company);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load that company.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const decide = async (decision) => {
    if (!selected) return;
    if (decision === "rejected" && !note.trim()) {
      toast.error("Give a reason so the employer knows what to fix.");
      return;
    }

    setIsDeciding(true);
    try {
      const res = await axiosInstance.post(API_PATHS.ADMIN.DECIDE_COMPANY(selected.id), {
        decision,
        note: note.trim(),
      });
      toast.success(res.data.message);
      setSelected(null);
      setNote("");
      loadCompanies();
      loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save that decision.");
    } finally {
      setIsDeciding(false);
    }
  };

  const changeState = (next) => {
    setState(next);
    setPage(1);
  };

  return (
    <DashboardLayout activeMenu="admin-companies">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <Building2 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Companies
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Every business on the platform. A company cannot post a job until it is approved here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadCompanies();
              loadOverview();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile
              label="Awaiting review"
              value={overview.companies?.pending ?? 0}
              tone={overview.companies?.pending ? "warn" : "default"}
              hint="cannot post yet"
            />
            <StatTile label="Approved" value={overview.companies?.approved ?? 0} />
            <StatTile
              label="Rejected"
              value={overview.companies?.rejected ?? 0}
              tone={overview.companies?.rejected ? "danger" : "default"}
            />
            <StatTile label="Setup unfinished" value={overview.companies?.awaitingSetup ?? 0} hint="never submitted" />
            <StatTile label="Companies" value={overview.companies?.total ?? 0} hint="total on platform" />
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs options={STATE_TABS} value={state} onChange={changeState} />
          <SearchBox
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Name, registration number, email"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : companies.length === 0 && incompleteSetups.length === 0 ? (
          <EmptyRow
            icon={Inbox}
            title="No companies here"
            description="Nothing matches this filter. New companies land in Awaiting review the moment an employer submits their setup."
          />
        ) : (
          <div className="space-y-3">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => openCompany(company)}
                className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/5"
              >
                {company.logo ? (
                  <img src={company.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500 dark:bg-violet-500/10">
                    <Building2 className="h-5 w-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                      {company.name}
                    </span>
                    <StatePill state={company.approvalState} />
                    {company.verified && (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Verified" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                    {company.user?.email} · {company.registrationNumber || "no registration number"} ·{" "}
                    {company._count?.jobs ?? 0} job{(company._count?.jobs ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                  {company.registrationDocUrl ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <FileText className="h-3.5 w-3.5" />
                      Certificate
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">No certificate</span>
                  )}
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {moment(company.submittedForReviewAt || company.createdAt).fromNow()}
                  </p>
                </div>
              </button>
            ))}

            {incompleteSetups.length > 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Signed up but never submitted
                </p>
                <div className="mt-2 space-y-2">
                  {incompleteSetups.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-400 dark:bg-gray-800">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-700 dark:text-gray-200">{entry.name}</p>
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">{entry.user?.email}</p>
                      </div>
                      <StatePill state="setup_incomplete" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Review panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold text-gray-900 dark:text-gray-100">{selected.name}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <StatePill state={selected.approvalState} />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {selected.user?.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close review panel"
                className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isLoadingDetail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                </div>
              ) : (
                <>
                  {/* The certificate is the thing this whole screen exists for. */}
                  <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Business registration certificate
                    </p>
                    {selected.registrationDocUrl ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-500" />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">
                          {selected.registrationDocName || "Certificate"}
                        </span>
                        <a
                          href={resolveFileUrl(selected.registrationDocUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </a>
                        <a
                          href={downloadFileUrl(selected.registrationDocUrl)}
                          className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 dark:border-violet-500/30 dark:text-violet-300"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                        No certificate was uploaded. Ask for one before approving.
                      </p>
                    )}
                  </section>

                  <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <DetailRow label="Registered legal name" value={selected.legalName} />
                    <DetailRow label="Organisation type" value={selected.organizationType} />
                    <DetailRow label="Registration number / TIN" value={selected.registrationNumber} mono />
                    <DetailRow label="Industry" value={selected.industry} />
                    <DetailRow label="Headquarters" value={selected.hq} />
                    <DetailRow label="Employees" value={selected.employees} />
                    <DetailRow
                      label="Website"
                      value={selected.website}
                    />
                    <DetailRow label="Trust state" value={selected.trustState} />
                  </div>

                  <h3 className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Hiring contact
                  </h3>
                  <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <DetailRow label="Name" value={selected.contactName} />
                    <DetailRow label="Title" value={selected.contactTitle} />
                    <DetailRow label="Email" value={selected.contactEmail} />
                    <DetailRow label="Phone" value={selected.contactPhone} />
                  </div>

                  <h3 className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Declarations
                  </h3>
                  <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <DetailRow
                      label="Authority confirmed"
                      value={selected.authorityConfirmedAt ? moment(selected.authorityConfirmedAt).format("D MMM YYYY") : ""}
                    />
                    <DetailRow
                      label="Terms accepted"
                      value={selected.termsAcceptedAt ? moment(selected.termsAcceptedAt).format("D MMM YYYY") : ""}
                    />
                    <DetailRow
                      label="Fair hiring policy"
                      value={selected.hiringPolicyAcceptedAt ? moment(selected.hiringPolicyAcceptedAt).format("D MMM YYYY") : ""}
                    />
                    <DetailRow
                      label="Submitted for review"
                      value={selected.submittedForReviewAt ? moment(selected.submittedForReviewAt).format("D MMM YYYY, HH:mm") : ""}
                    />
                  </div>

                  {selected.approvalNote && (
                    <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                      <span className="font-bold">Last decision note:</span> {selected.approvalNote}
                    </p>
                  )}

                  {selected.jobs?.length > 0 && (
                    <>
                      <h3 className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Postings ({selected._count?.jobs ?? selected.jobs.length})
                      </h3>
                      <div className="mt-1 space-y-1">
                        {selected.jobs.map((job) => (
                          <div key={job.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-gray-700 dark:text-gray-300">{job.title}</span>
                            <span className="shrink-0 text-xs text-gray-400">
                              {job.isClosed ? "closed" : job.moderationState}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Note to the employer {selected.approvalState !== "approved" && "(required to reject)"}
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you check, or what needs fixing?"
                className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeciding}
                  onClick={() => decide("rejected")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-gray-900 dark:text-rose-300"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  disabled={isDeciding}
                  onClick={() => decide("approved")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve &amp; verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Companies;
