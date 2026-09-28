import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useJobAlerts } from "../../hooks/useJobAlerts";

/**
 * The one-time ask: may we email you the new roles?
 *
 * Shown to a signed-in candidate who has never answered — which is how
 * someone who signed up before this existed, or signed in with Google from the
 * login page, gets the choice the sign-up form now offers. Either answer is
 * recorded, so this appears once per account and then never again.
 */
const JobAlertsPrompt = () => {
  const { user, isAuthenticated } = useAuth();
  const { isLoading, decided, isSaving, save, decline } = useJobAlerts();
  const [dismissed, setDismissed] = useState(false);

  const isCandidate = user?.role === "jobseeker";
  if (!isAuthenticated || !isCandidate || isLoading || decided || dismissed) return null;

  const agree = async () => {
    try {
      const data = await save({ subscribed: true, frequency: "weekly" });
      toast.success(data?.message || "You'll hear from us when new roles are posted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not switch job updates on.");
    }
  };

  const refuse = async () => {
    // Hidden straight away — waiting on the request would make "No thanks"
    // feel like it did nothing.
    setDismissed(true);
    try {
      await decline();
    } catch {
      // Silent: the answer is "no", and failing to record it is not something
      // to interrupt them about. They will simply be asked again next visit.
    }
  };

  return (
    <div className="flex flex-col justify-between gap-space-sm rounded-2xl border border-primary/20 bg-brand-indigo-light p-space-md sm:flex-row sm:items-center">
      <div className="flex items-start gap-space-sm">
        <span className="material-symbols-outlined shrink-0 text-[22px] text-primary">notifications_active</span>
        <div className="min-w-0">
          <p className="font-body-md font-bold text-primary">
            Want the new roles emailed to you?
          </p>
          <p className="font-body-sm text-text-secondary">
            A weekly round-up of everything newly posted, from every company hiring here. One click to stop it.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={refuse}
          className="rounded-xl px-space-sm py-2.5 font-label-md font-bold text-text-muted transition-colors hover:text-text-primary"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={agree}
          disabled={isSaving}
          className="rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Yes, keep me posted"}
        </button>
      </div>
    </div>
  );
};

export default JobAlertsPrompt;
