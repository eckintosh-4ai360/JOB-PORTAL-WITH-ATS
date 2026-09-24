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
import { COMPANY_STAGES, isCompanyStage } from "../../utils/companyStages";
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
  { id: "pending", label: "Submitted" },
  { id: "in_review", label: "Under review" },
  { id: "approved", label: "Verified" },
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
  const [stageDraft, setStageDraft] = useState("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

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
    setStageDraft(isCompanyStage(company.stage) ? company.stage : "");
    setIsLoadingDetail(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.GET_COMPANY(company.id));
      setSelected(res.data.company);
      setStageDraft(isCompanyStage(res.data.company?.stage) ? res.data.company.stage : "");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load that company.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const startReview = async () => {
    if (!selected) return;

    setIsDeciding(true);
    try {
      const res = await axiosInstance.post(API_PATHS.ADMIN.START_COMPANY_REVIEW(selected.id));
      toast.success(res.data.message);
      setSelected(res.data.company);
      loadCompanies();
      loadOverview();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start the review.");
      if (err.response?.data?.company) setSelected(err.response.data.company);
    } finally {
      setIsDeciding(false);
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

  const saveCompanyStage = async () => {
    if (!selected) return;
    if (!isCompanyStage(stageDraft)) {
      toast.error("Choose a valid company stage before saving.");
      return;
    }

    setIsUpdatingStage(true);
    try {
      const res = await axiosInstance.patch(API_PATHS.ADMIN.UPDATE_COMPANY_STAGE(selected.id), {
        stage: stageDraft,
      });
      toast.success(res.data.message);
      setSelected(res.data.company);
      setStageDraft(res.data.company.stage);
      loadCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the company stage.");
    } finally {
      setIsUpdatingStage(false);
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatTile
              label="Submitted"
              value={overview.companies?.pending ?? 0}
              tone={overview.companies?.pending ? "warn" : "default"}
              hint="waiting to be picked up"
              icon={FileText}
            />
            <StatTile
              label="Under review"
              value={overview.companies?.in_review ?? 0}
              tone="info"
              hint="cannot post yet"
              icon={ShieldCheck}
            />
            <StatTile
              label="Verified"
              value={overview.companies?.approved ?? 0}
              tone="success"
              icon={Check}
            />
            <StatTile
              label="Rejected"
              value={overview.companies?.rejected ?? 0}
              tone={overview.companies?.rejected ? "danger" : "default"}
              icon={X}
            />
            <StatTile
              label="Unverified"
              value={overview.companies?.awaitingSetup ?? 0}
              hint="never submitted"
              icon={Inbox}
            />
            <StatTile
              label="Companies"
              value={overview.companies?.total ?? 0}
              hint="total on platform"
              icon={Building2}
            />
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
            description="Nothing matches this filter. New companies land in Submitted the moment an employer submits their setup."
          />
        ) : (
          <div className="space-y-4">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => openCompany(company)}
                className="group relative flex w-full overflow-hidden rounded-3xl border border-border-default bg-surface-card p-space-md text-left shadow-[0_10px_24px_rgba(40,34,86,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_rgba(89,47,174,0.12)] md:p-space-lg"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${
                    company.approvalState === "approved"
                      ? "bg-emerald-500"
                      : company.approvalState === "rejected"
                        ? "bg-rose-500"
                        : company.approvalState === "in_review"
                          ? "bg-sky-500"
                          : "bg-amber-500"
                  }`}
                />
                {company.logo ? (
                  <img
                    src={company.logo}
                    alt=""
                    className="ml-1 h-12 w-12 shrink-0 rounded-2xl border border-primary/10 bg-surface-card object-cover p-1 shadow-sm"
                  />
                ) : (
                  <span className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-indigo-light text-primary shadow-sm">
                    <Building2 className="h-5 w-5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-space-xs">
                    <span className="truncate font-label-lg font-bold text-text-primary">
                      {company.name}
                    </span>
                    <StatePill state={company.approvalState} />
                    {company.verified && (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-verified-badge" aria-label="Verified" />
                    )}
                  </div>
                  <p className="mt-1 truncate font-body-sm text-text-muted">
                    {company.user?.email} · {company.registrationNumber || "no registration number"} ·{" "}
                    {company._count?.jobs ?? 0} job{(company._count?.jobs ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="hidden shrink-0 items-center gap-space-sm sm:flex">
                  <div className="text-right">
                  {company.registrationDocUrl ? (
                    <span className="inline-flex items-center gap-1 font-label-md font-bold text-emerald-600 dark:text-emerald-400">
                      <FileText className="h-3.5 w-3.5" />
                      Certificate
                    </span>
                  ) : (
                    <span className="font-label-md font-bold text-amber-600 dark:text-amber-400">No certificate</span>
                  )}
                  <p className="mt-0.5 font-body-sm text-text-muted">
                    {moment(company.submittedForReviewAt || company.createdAt).fromNow()}
                  </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-text-muted transition-colors group-hover:bg-brand-indigo-light group-hover:text-primary">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}

            {incompleteSetups.length > 0 && (
              <div className="rounded-3xl border border-dashed border-border-default bg-surface-container-low p-space-md shadow-xs dark:bg-gray-900/40">
                <p className="font-label-caps font-bold uppercase tracking-wider text-text-muted">
                  Signed up but never submitted
                </p>
                <div className="mt-space-sm space-y-space-xs">
                  {incompleteSetups.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-space-sm rounded-2xl border border-border-default bg-surface-card p-space-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container text-text-muted">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-label-md font-bold text-text-primary">{entry.name}</p>
                        <p className="truncate font-body-sm text-text-muted">{entry.user?.email}</p>
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
                    <DetailRow label="Company stage" value={selected.stage || "Not set"} />
                    <DetailRow label="Headquarters" value={selected.hq} />
                    <DetailRow label="Employees" value={selected.employees} />
                    <DetailRow
                      label="Website"
                      value={selected.website}
                    />
                    <DetailRow label="Trust state" value={selected.trustState} />
                  </div>

                  <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Company stage review
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-gray-300">
                      Confirm the employer&apos;s selected maturity stage or correct it. This controls the public job-search filter.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={stageDraft}
                        onChange={(event) => setStageDraft(event.target.value)}
                        disabled={isUpdatingStage || isLoadingDetail}
                        className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-60 dark:border-violet-500/30 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select company stage</option>
                        {COMPANY_STAGES.map((stage) => (
                          <option key={stage.value} value={stage.value}>{stage.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={saveCompanyStage}
                        disabled={isUpdatingStage || isLoadingDetail || stageDraft === selected.stage}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUpdatingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save stage
                      </button>
                    </div>
                  </section>

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

            {selected.approvalState === "pending" ? (
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Starting the review emails the employer that their company is being checked.
                </p>
                <button
                  type="button"
                  disabled={isDeciding || isLoadingDetail}
                  onClick={startReview}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Start review
                </button>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Companies;
