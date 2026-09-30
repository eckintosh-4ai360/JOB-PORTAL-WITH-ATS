import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock, Inbox, Loader2, RefreshCw, Settings2,
  UserCheck, Users, UserX, X,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import {
  AdminPageHeader, EmptyRow, FilterTabs, Pagination,
  SearchBox, StatePill, StatTile,
} from "./components/AdminUI";

const ROLE_TABS = [
  { id: "", label: "Everyone" },
  { id: "employer", label: "Employers" },
  { id: "jobseeker", label: "Jobseekers" },
  { id: "admin", label: "Admins" },
];

const ACCESS_TABS = [
  { id: "", label: "Any access" },
  { id: "active", label: "Active" },
  { id: "ending", label: "Not renewing" },
  { id: "inactive", label: "Inactive" },
];

const TRUST_TONE = { suspended: "rejected", flagged: "pending", clear: "approved" };

const draftFrom = (account) => ({
  isActive: account.isActive !== false,
  subscriptionEndsAt: account.subscriptionEndsAt
    ? moment(account.subscriptionEndsAt).format("YYYY-MM-DD")
    : "",
  subscriptionRenews: account.subscriptionRenews !== false,
  reason: account.deactivationReason || "",
});

const Accounts = () => {
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [accessStatus, setAccessStatus] = useState("");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [accessDraft, setAccessDraft] = useState(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accountsRes, overviewRes] = await Promise.all([
        axiosInstance.get(API_PATHS.ADMIN.GET_ACCOUNTS, {
          params: {
            role: role || undefined,
            status: accessStatus || undefined,
            search: search || undefined,
            page,
          },
        }),
        axiosInstance.get(API_PATHS.ADMIN.OVERVIEW).catch(() => null),
      ]);
      setAccounts(accountsRes.data.accounts || []);
      setTotal(accountsRes.data.total || 0);
      setPages(accountsRes.data.pages || 1);
      if (overviewRes) setOverview(overviewRes.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load accounts.");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessStatus, page, role, search]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const openAccessManager = (account) => {
    setSelected(account);
    setAccessDraft(draftFrom(account));
  };

  const saveAccess = async () => {
    if (!selected || !accessDraft) return;
    setIsSavingAccess(true);
    try {
      const subscriptionEndsAt = accessDraft.subscriptionEndsAt
        ? new Date(`${accessDraft.subscriptionEndsAt}T23:59:59.999Z`).toISOString()
        : null;
      const response = await axiosInstance.patch(
        API_PATHS.ADMIN.UPDATE_ACCOUNT_ACCESS(selected.id),
        {
          isActive: accessDraft.isActive,
          subscriptionEndsAt,
          subscriptionRenews: accessDraft.subscriptionRenews,
          reason: accessDraft.reason.trim(),
        }
      );
      toast.success(response.data.message);
      setSelected(response.data.account);
      setAccessDraft(draftFrom(response.data.account));
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update account access.");
    } finally {
      setIsSavingAccess(false);
    }
  };

  return (
    <DashboardLayout activeMenu="admin-accounts">
      <div className="mx-auto max-w-7xl space-y-7 pb-12">
        <AdminPageHeader
          icon={Users}
          title="Accounts"
          description="Manage platform access and subscription expiry. Trust suspensions remain in Trust & Safety."
          actions={(
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-bold text-text-secondary shadow-sm transition-all hover:border-primary/25 hover:bg-surface-container-low hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        />

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Employers" value={overview.people?.employers ?? 0} icon={Users} />
            <StatTile label="Jobseekers" value={overview.people?.jobseekers ?? 0} tone="info" icon={Users} />
            <StatTile label="Not renewing" value={overview.people?.nonRenewing ?? 0} hint="scheduled to end" tone="warn" icon={CalendarClock} />
            <StatTile label="Inactive" value={overview.people?.inactive ?? 0} hint="access blocked" tone="danger" icon={UserX} />
            <StatTile label="Matching" value={total} hint="current filters" icon={Users} />
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterTabs
              options={ROLE_TABS}
              value={role}
              onChange={(next) => {
                setRole(next);
                setPage(1);
              }}
            />
            <FilterTabs
              options={ACCESS_TABS}
              value={accessStatus}
              onChange={(next) => {
                setAccessStatus(next);
                setPage(1);
              }}
            />
          </div>
          <SearchBox
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Name, email, company"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyRow icon={Inbox} title="No accounts here" description="Nothing matches this filter." />
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-4 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
              >
                {account.avatar ? (
                  <img src={account.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-extrabold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    {(account.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">{account.name}</span>
                    <StatePill tone="info" label={account.role} />
                    <StatePill
                      tone={account.isActive === false ? "rejected" : "approved"}
                      label={account.isActive === false ? "inactive" : "active"}
                    />
                    {account.isActive !== false && account.subscriptionRenews === false && (
                      <StatePill tone="pending" label="not renewing" />
                    )}
                    {account.trustState !== "clear" && (
                      <StatePill tone={TRUST_TONE[account.trustState]} label={account.trustState} />
                    )}
                    {account.company && <StatePill state={account.company.approvalState} />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                    {account.email}{account.companyName ? ` · ${account.companyName}` : ""}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {account.subscriptionEndsAt
                      ? `Subscription ${account.subscriptionRenews === false ? "ends" : "renews"} ${moment(account.subscriptionEndsAt).format("D MMM YYYY")}`
                      : "No subscription end date"}
                    {account.deactivationReason ? ` · ${account.deactivationReason}` : ""}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 md:block">
                  {account.role === "employer" ? (
                    <p className="font-bold text-gray-600 dark:text-gray-300">
                      {account._count?.postedJobs ?? 0} posting{(account._count?.postedJobs ?? 0) === 1 ? "" : "s"}
                    </p>
                  ) : account.role === "jobseeker" ? (
                    <p className="font-bold text-gray-600 dark:text-gray-300">
                      {account._count?.applications ?? 0} application{(account._count?.applications ?? 0) === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <p className="mt-0.5">joined {moment(account.createdAt).format("D MMM YYYY")}</p>
                </div>

                <button
                  type="button"
                  onClick={() => openAccessManager(account)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:border-primary/30 hover:bg-brand-indigo-light hover:text-primary"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Manage</span>
                </button>
              </div>
            ))}

            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </div>

      {selected && accessDraft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-300">Account access</p>
                <h2 className="mt-1 text-lg font-extrabold text-gray-900 dark:text-gray-100">{selected.name}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{selected.email}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close account manager" className="rounded-lg p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {selected.role === "admin" ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                  Administrator accounts cannot be deactivated from this screen.
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="account-access-state" className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">Platform access</label>
                    <select
                      id="account-access-state"
                      value={accessDraft.isActive ? "active" : "inactive"}
                      onChange={(event) => setAccessDraft((current) => ({ ...current, isActive: event.target.value === "active" }))}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="active">Active — can sign in</option>
                      <option value="inactive">Inactive — access blocked</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="subscription-end" className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">Subscription end date</label>
                    <input
                      id="subscription-end"
                      type="date"
                      value={accessDraft.subscriptionEndsAt}
                      onChange={(event) => setAccessDraft((current) => ({ ...current, subscriptionEndsAt: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Leave empty when access has no scheduled end.</p>
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                    <input
                      type="checkbox"
                      checked={accessDraft.subscriptionRenews}
                      onChange={(event) => setAccessDraft((current) => ({ ...current, subscriptionRenews: event.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-violet-600"
                    />
                    <span>
                      <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">Subscription renews</span>
                      <span className="mt-0.5 block text-xs leading-5 text-gray-400 dark:text-gray-500">
                        Turn this off when the customer will not renew. At the end date the database account becomes inactive automatically.
                      </span>
                    </span>
                  </label>

                  <div>
                    <label htmlFor="deactivation-reason" className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deactivation note</label>
                    <textarea
                      id="deactivation-reason"
                      rows={3}
                      value={accessDraft.reason}
                      onChange={(event) => setAccessDraft((current) => ({ ...current, reason: event.target.value }))}
                      placeholder="Reason shown to administrators"
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${accessDraft.isActive ? "text-emerald-600" : "text-rose-600"}`}>
                {accessDraft.isActive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                {accessDraft.isActive ? "Access enabled" : "Access blocked"}
              </span>
              {selected.role !== "admin" && (
                <button
                  type="button"
                  onClick={saveAccess}
                  disabled={isSavingAccess}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {isSavingAccess && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save access
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Accounts;
