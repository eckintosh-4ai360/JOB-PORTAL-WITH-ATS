import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Loader2, RefreshCw, Check, X, Inbox, Briefcase, Info } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { EVIDENCE_ICONS, FALLBACK_EVIDENCE_ICON, summarizeEvidence } from "../../utils/duplicateEvidence";

/**
 * Duplicate applicants, across all of this employer's jobs.
 *
 * The same person applying twice — once as a guest and once with an account,
 * or under two email addresses — shows up here as one group with the reasons
 * it looks like one person. Only this employer's own applicants are compared,
 * using only what they sent. Nothing changes on an application; the employer
 * records whether it is the same person, and the applicant screen shows that.
 */

const VIEWS = [
  { id: "open", label: "To review" },
  { id: "confirmed", label: "Same person" },
  { id: "dismissed", label: "Different people" },
];

const initials = (name = "") => name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const Member = ({ member }) => (
  <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40">
    {member.avatar ? (
      <img src={member.avatar} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
    ) : (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
        {initials(member.name)}
      </span>
    )}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{member.name}</p>
        {member.isGuest && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">
            Guest
          </span>
        )}
      </div>
      {member.email && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{member.email}</p>}
      <ul className="mt-1.5 space-y-0.5">
        {member.applications.map((app) => (
          <li key={app.applicationId}>
            <Link
              to={`/applicants?jobId=${app.jobId}&application=${app.applicationId}`}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Briefcase className="h-3 w-3 shrink-0" />
              {app.jobTitle} · {app.stage} · {moment(app.appliedAt).fromNow()}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const EvidenceLines = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((item, index) => {
      const Icon = EVIDENCE_ICONS[item.code] || FALLBACK_EVIDENCE_ICON;
      return (
        <li
          key={`${item.code}-${index}`}
          className={`flex items-start gap-2 text-sm ${
            item.strength === "against" ? "text-sky-700 dark:text-sky-300" : "text-gray-700 dark:text-gray-300"
          }`}
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{item.label}</span>
            {item.detail ? ` — ${item.detail}` : ""}
            {item.scope && <span className="text-gray-400"> · {item.scope}</span>}
          </span>
        </li>
      );
    })}
  </ul>
);

const GroupCard = ({ group, onDecide, isDeciding }) => {
  const [showPairs, setShowPairs] = useState(false);
  const byKey = new Map(group.members.map((member) => [member.key, member]));
  const multiple = group.pairs.length > 1;

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            group.confidence === "high"
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          }`}
        >
          {group.confidence === "high" ? "Very likely the same person" : "Possibly the same person"}
        </span>
        <span className="text-xs text-gray-400">{group.members.length} applicants</span>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        {group.members.map((member) => (
          <Member key={member.key} member={member} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <EvidenceLines items={summarizeEvidence(group.pairs)} />
        {multiple && (
          <button
            type="button"
            onClick={() => setShowPairs((value) => !value)}
            aria-expanded={showPairs}
            className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {showPairs ? "Hide each pair" : `Show each pair (${group.pairs.length})`}
          </button>
        )}
        {multiple && showPairs && (
          <div className="space-y-3 rounded-xl bg-gray-50/60 p-3 dark:bg-gray-800/40">
            {group.pairs.map((pair) => (
              <div key={`${pair.a}-${pair.b}`}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {byKey.get(pair.a)?.name} ↔ {byKey.get(pair.b)?.name}
                </p>
                <EvidenceLines items={pair.evidence} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          type="button"
          disabled={isDeciding || group.decision === "distinct"}
          onClick={() => onDecide(group, "distinct")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <X className="h-4 w-4" />
          Different people
        </button>
        <button
          type="button"
          disabled={isDeciding || group.decision === "same"}
          onClick={() => onDecide(group, "same")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Same person
        </button>
      </div>
    </article>
  );
};

const Duplicates = () => {
  const [view, setView] = useState("open");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decidingId, setDecidingId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.APPLICATIONS.DUPLICATE_GROUPS, { params: { view } });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not check for duplicate applicants.");
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const decide = async (group, decision) => {
    setDecidingId(group.id);
    try {
      const res = await axiosInstance.post(API_PATHS.APPLICATIONS.DUPLICATES_REVIEW, {
        keys: group.members.map((member) => member.key),
        decision,
      });
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save that.");
    } finally {
      setDecidingId(null);
    }
  };

  const counts = data?.counts || { open: 0, confirmed: 0, dismissed: 0 };

  return (
    <DashboardLayout activeMenu="duplicates">
      <div className="mx-auto max-w-6xl space-y-5 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <Copy className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              Duplicate applicants
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The same person applying more than once — as a guest and with an account, or under two emails.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Check again
          </button>
        </div>

        {data?.pendingCvs > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {data.pendingCvs} CV{data.pendingCvs === 1 ? " is" : "s are"} still being read. Check again in a moment to compare
            {data.pendingCvs === 1 ? " it" : " them"} too.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                  view === option.id
                    ? "bg-white text-indigo-700 shadow-xs dark:bg-gray-900 dark:text-indigo-300"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {option.label}
                <span className="ml-1.5 text-xs opacity-60">{counts[option.id]}</span>
              </button>
            ))}
          </div>
          {data && (
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              {data.applicantsChecked} applicant{data.applicantsChecked === 1 ? "" : "s"} compared
            </p>
          )}
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : !data?.groups?.length ? (
          <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Inbox className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="font-bold text-gray-800 dark:text-gray-100">
              {view === "open" ? "No duplicate applicants found" : "Nothing here yet"}
            </p>
            <p className="mt-1 max-w-md text-sm text-gray-400 dark:text-gray-500">
              {view === "open"
                ? "Applicants are compared by their CV, phone number and email. A shared name on its own never flags anyone."
                : "Groups you decide on appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.groups.map((group) => (
              <GroupCard key={group.id} group={group} onDecide={decide} isDeciding={decidingId === group.id} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Duplicates;
