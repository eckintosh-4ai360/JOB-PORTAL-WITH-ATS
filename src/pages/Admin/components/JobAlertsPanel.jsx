import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail, MailX, Send } from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { StatTile } from "./AdminUI";

/**
 * Job update subscriptions, from the platform side.
 *
 * The digests normally go out on a schedule (backend/scripts/sendJobAlerts.js).
 * This is the manual handle on the same code, which matters for two things: a
 * first send before any schedule is wired up, and a dry run to see who would
 * be written to before anyone actually is.
 */
const JobAlertsPanel = () => {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.JOB_ALERTS.STATS);
      setStats(res.data?.stats || null);
    } catch {
      // A missing panel is better than a red toast on a page about something
      // else. The dispatch buttons still report their own failures.
      setStats(null);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const run = async (options, label) => {
    setBusy(label);
    try {
      const res = await axiosInstance.post(API_PATHS.JOB_ALERTS.DISPATCH, options);
      toast.success(res.data?.message || "Done.");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send the digests.");
    } finally {
      setBusy("");
    }
  };

  if (!stats) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-text-primary">Job update subscribers</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Candidates who asked to be emailed newly posted roles.
            {stats.lastSentAt
              ? ` Last digest went out ${moment(stats.lastSentAt).fromNow()}.`
              : " No digest has gone out yet."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => run({ dryRun: true, force: true }, "dry")}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-bold text-text-secondary shadow-sm transition-all hover:border-primary/25 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/80 dark:bg-[#111b2d] dark:text-slate-200"
          >
            <Mail className="h-4 w-4" />
            {busy === "dry" ? "Checking…" : "Preview who would get one"}
          </button>
          <button
            type="button"
            onClick={() => run({}, "send")}
            disabled={Boolean(busy) || stats.active === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {busy === "send" ? "Sending…" : "Send what is due"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Subscribed" value={stats.active} tone={stats.active ? "success" : "default"} hint="candidates" icon={BellRing} />
        <StatTile label="Weekly" value={stats.weekly} icon={Mail} />
        <StatTile label="Daily" value={stats.daily} tone="info" icon={Mail} />
        <StatTile label="Opted out" value={stats.unsubscribed} tone={stats.unsubscribed ? "warn" : "default"} icon={MailX} />
      </div>
    </section>
  );
};

export default JobAlertsPanel;
