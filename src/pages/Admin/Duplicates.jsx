import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy, Loader2, RefreshCw, ScanSearch, FileText, Files, Mail, AtSign, Phone, User, Briefcase, AlertTriangle,
  Check, X, ExternalLink, Users,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { StatTile, FilterTabs, EmptyRow } from "./components/AdminUI";

/**
 * Duplicate accounts.
 *
 * Jobseeker accounts that look like one person — the same CV file, near-
 * identical wording, a shared phone number or email inbox. Each group shows
 * its evidence in plain words, and an admin records whether it is the same
 * person. Nothing is done to the accounts automatically: a shared phone can be
 * a family, and a copied CV can be a template.
 */

const EVIDENCE_ICON = {
  same_file: FileText,
  same_text: Copy,
  similar_text: Files,
  same_inbox: Mail,
  shared_email: AtSign,
  shared_phone: Phone,
  same_name: User,
  similar_name: User,
  same_job: Briefcase,
  names_differ: AlertTriangle,
  shared_contact_note: AlertTriangle,
};

const STRENGTH_STYLE = {
  strong: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30",
  supporting: "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:ring-slate-500/30",
  against: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30",
};

const initials = (name = "") => name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const Evidence = ({ item }) => {
  const Icon = EVIDENCE_ICON[item.code] || AlertTriangle;
  return (
    <li className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${STRENGTH_STYLE[item.strength] || STRENGTH_STYLE.supporting}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">{item.label}</span>
        {item.detail && <span className="opacity-80"> — {item.detail}</span>}
      </span>
    </li>
  );
};

const MemberCard = ({ member }) => (
  <div className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/40">
    {member.avatar ? (
      <img src={member.avatar} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
    ) : (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
        {initials(member.name)}
      </span>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{member.name}</p>
      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
      <p className="mt-1 text-[11px] text-gray-400">
        Joined {moment(member.joinedAt).format("D MMM YYYY")} · {member.applicationCount} application
        {member.applicationCount === 1 ? "" : "s"} · {member.cvCount} CV{member.cvCount === 1 ? "" : "s"} read
        {member.trustState && member.trustState !== "clear" ? ` · ${member.trustState}` : ""}
      </p>
      <Link
        to={`/admin-accounts?search=${encodeURIComponent(member.email)}`}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline dark:text-violet-400"
      >
        <ExternalLink className="h-3 w-3" />
        Open account
      </Link>
    </div>
  </div>
);

const ClusterCard = ({ cluster, onDecide, isDeciding }) => {
  const [note, setNote] = useState("");
  const byKey = new Map(cluster.members.map((member) => [member.key, member]));
  const multiple = cluster.pairs.length > 1;

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${
            cluster.confidence === "high"
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          }`}
        >
          {cluster.confidence === "high" ? "Very likely the same person" : "Possibly the same person"}
        </span>
        <span className="text-xs text-gray-400">
          {cluster.members.length} accounts · evidence score {cluster.score}
        </span>
        {cluster.decision && (
          <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {cluster.decision === "same" ? "Confirmed: same person" : "Dismissed: different people"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        {cluster.members.map((member) => (
          <MemberCard key={member.key} member={member} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {cluster.pairs.map((pair) => (
          <div key={`${pair.a}-${pair.b}`}>
            {multiple && (
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {byKey.get(pair.a)?.name} ↔ {byKey.get(pair.b)?.name}
              </p>
            )}
            <ul className="space-y-1.5">
              {pair.evidence.map((item, index) => (
                <Evidence key={`${item.code}-${index}`} item={item} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:items-center">
        <input
          type="text"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — what you checked"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isDeciding || cluster.decision === "distinct"}
            onClick={() => onDecide(cluster, "distinct", note)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <X className="h-4 w-4" />
            Different people
          </button>
          <button
            type="button"
            disabled={isDeciding || cluster.decision === "same"}
            onClick={() => onDecide(cluster, "same", note)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Same person
          </button>
        </div>
      </div>
    </article>
  );
};

const Duplicates = () => {
  const [view, setView] = useState("open");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scanning, setScanning] = useState(null);
  const [decidingId, setDecidingId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.ADMIN.DUPLICATES, { params: { view } });
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not check for duplicate accounts.");
    } finally {
      setIsLoading(false);
    }
  }, [view]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /** Read every CV not yet fingerprinted, a batch at a time. */
  const scan = async () => {
    let processed = 0;
    setScanning({ processed: 0, pending: data?.pendingCvs ?? null });
    try {
      for (let round = 0; round < 40; round += 1) {
        const res = await axiosInstance.post(API_PATHS.ADMIN.DUPLICATES_SCAN);
        processed += res.data.processed;
        setScanning({ processed, pending: res.data.pending });
        if (res.data.pending === 0 || res.data.processed === 0) break;
      }
      toast.success(processed ? `Read ${processed} CV${processed === 1 ? "" : "s"}` : "Every CV has been read");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not scan CVs.");
    } finally {
      setScanning(null);
    }
  };

  const decide = async (cluster, decision, note) => {
    setDecidingId(cluster.id);
    try {
      const res = await axiosInstance.post(API_PATHS.ADMIN.DUPLICATES_REVIEW, {
        keys: cluster.members.map((member) => member.key),
        decision,
        note,
      });
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save the decision.");
    } finally {
      setDecidingId(null);
    }
  };

  const counts = data?.counts || { open: 0, confirmed: 0, dismissed: 0 };

  return (
    <DashboardLayout activeMenu="admin-duplicates">
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              Duplicate accounts
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Jobseeker accounts that look like the same person. A shared name alone never flags anyone.
            </p>
          </div>
          <div className="flex gap-2 self-start">
            <button
              type="button"
              onClick={scan}
              disabled={Boolean(scanning)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {scanning
                ? `Reading CVs… ${scanning.processed}${scanning.pending !== null ? ` · ${scanning.pending} left` : ""}`
                : "Read new CVs"}
            </button>
            <button
              type="button"
              onClick={load}
              disabled={isLoading}
              aria-label="Refresh"
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="To review" value={counts.open} tone={counts.open ? "warn" : "default"} icon={Copy} />
          <StatTile label="Confirmed same person" value={counts.confirmed} icon={Check} />
          <StatTile label="Accounts checked" value={data?.accountsChecked ?? "—"} icon={Users} />
          <StatTile
            label="CVs not read yet"
            value={data?.pendingCvs ?? "—"}
            tone={data?.pendingCvs ? "info" : "default"}
            hint={data?.pendingCvs ? "Read them to check file matches" : "Every CV has been read"}
            icon={FileText}
          />
        </div>

        <FilterTabs
          options={[
            { id: "open", label: "To review", count: counts.open },
            { id: "confirmed", label: "Same person", count: counts.confirmed },
            { id: "dismissed", label: "Different people", count: counts.dismissed },
          ]}
          value={view}
          onChange={setView}
        />

        {isLoading && !data ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : !data?.clusters?.length ? (
          <EmptyRow
            icon={Copy}
            title={view === "open" ? "No duplicate accounts found" : "Nothing here"}
            description={
              view === "open"
                ? data?.pendingCvs
                  ? `${data.pendingCvs} CV${data.pendingCvs === 1 ? " has" : "s have"} not been read yet — read them to check for identical files.`
                  : "Accounts are compared by CV, phone number and email inbox."
                : "Groups you decide on appear here."
            }
          />
        ) : (
          <div className="space-y-4">
            {data.clusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} onDecide={decide} isDeciding={decidingId === cluster.id} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Duplicates;
