import { useCallback, useEffect, useState } from "react";
import { Inbox, Loader2, RefreshCw, Users } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { StatTile, StatePill, FilterTabs, SearchBox, EmptyRow, Pagination } from "./components/AdminUI";

/**
 * Every account on the platform, in one list.
 *
 * Read-only on purpose: enforcement against a person lives in Trust & Safety,
 * where the evidence that justifies it is on the same page. This screen answers
 * "who is on the platform, and what state are they in".
 */

const ROLE_TABS = [
  { id: "", label: "Everyone" },
  { id: "employer", label: "Employers" },
  { id: "jobseeker", label: "Jobseekers" },
  { id: "admin", label: "Admins" },
];

const TRUST_TONE = { suspended: "rejected", flagged: "pending", clear: "approved" };

const Accounts = () => {
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accountsRes, overviewRes] = await Promise.all([
        axiosInstance.get(API_PATHS.ADMIN.GET_ACCOUNTS, {
          params: { role: role || undefined, search: search || undefined, page },
        }),
        axiosInstance.get(API_PATHS.ADMIN.OVERVIEW).catch(() => null),
      ]);
      setAccounts(accountsRes.data.accounts || []);
      setTotal(accountsRes.data.total || 0);
      setPages(accountsRes.data.pages || 1);
      if (overviewRes) setOverview(overviewRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load accounts.");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [role, search, page]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <DashboardLayout activeMenu="admin-accounts">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Accounts
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Everyone signed up to the platform. Suspend or reinstate from Trust &amp; Safety, where the evidence is.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Employers" value={overview.people?.employers ?? 0} />
            <StatTile label="Jobseekers" value={overview.people?.jobseekers ?? 0} />
            <StatTile label="Applications" value={overview.applications ?? 0} hint="all time" />
            <StatTile label="Accounts" value={total} hint="matching this filter" />
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterTabs
            options={ROLE_TABS}
            value={role}
            onChange={(next) => {
              setRole(next);
              setPage(1);
            }}
          />
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
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
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
                    <span className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                      {account.name}
                    </span>
                    <StatePill tone="info" label={account.role} />
                    {account.trustState !== "clear" && (
                      <StatePill tone={TRUST_TONE[account.trustState]} label={account.trustState} />
                    )}
                    {account.company && <StatePill state={account.company.approvalState} />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                    {account.email}
                    {account.companyName ? ` · ${account.companyName}` : ""}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 sm:block">
                  {account.role === "employer" ? (
                    <p className="font-bold text-gray-600 dark:text-gray-300">
                      {account._count?.postedJobs ?? 0} posting{(account._count?.postedJobs ?? 0) === 1 ? "" : "s"}
                    </p>
                  ) : account.role === "jobseeker" ? (
                    <p className="font-bold text-gray-600 dark:text-gray-300">
                      {account._count?.applications ?? 0} application
                      {(account._count?.applications ?? 0) === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <p className="mt-0.5">joined {moment(account.createdAt).format("D MMM YYYY")}</p>
                </div>
              </div>
            ))}

            <Pagination page={page} pages={pages} onPage={setPage} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Accounts;
