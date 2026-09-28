import { useState } from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import { useJobAlerts } from "../../hooks/useJobAlerts";
import { DEPARTMENT_OPTIONS } from "../../utils/jobOptions";

/** "Accra, Kumasi" → ["Accra", "Kumasi"]. Empty means anywhere. */
const splitLocations = (value) => String(value || "")
  .split(",")
  .map((part) => part.trim())
  .filter(Boolean);

const FREQUENCIES = [
  { value: "weekly", label: "Weekly", hint: "One round-up a week" },
  { value: "daily", label: "Daily", hint: "As soon as the next day" },
];

/**
 * Where a candidate manages the job updates they agreed to receive.
 *
 * Both halves of the promise made at sign-up live here: how often we write,
 * and what about. Leaving is a single switch — nobody should have to hunt
 * through an old email for an unsubscribe link to stop these.
 *
 * No category selected means every category, which is the default and the
 * point: the new roles from every company hiring on the platform.
 *
 * The form holds no copy of the saved settings. `draft` is null until
 * something is edited, and the fields render the server's values until then,
 * so a save or a reload shows the truth without anything to synchronise.
 */
const JobAlertsCard = () => {
  const { isLoading, subscription, isSubscribed, isSaving, save } = useJobAlerts();
  const [draft, setDraft] = useState(null);

  const saved = {
    frequency: subscription?.frequency || "weekly",
    categories: subscription?.categories || [],
    locations: (subscription?.locations || []).join(", "),
  };
  const form = draft || saved;
  const dirty = draft !== null;

  const edit = (changes) => setDraft((current) => ({ ...(current || saved), ...changes }));

  const toggleCategory = (category) => edit({
    categories: form.categories.includes(category)
      ? form.categories.filter((item) => item !== category)
      : [...form.categories, category],
  });

  const persist = async (changes, successFallback) => {
    try {
      const data = await save(changes);
      setDraft(null);
      toast.success(data?.message || successFallback);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save your job update settings.");
    }
  };

  const toggleSubscription = () => persist(
    isSubscribed
      ? { subscribed: false }
      : { subscribed: true, ...form, locations: splitLocations(form.locations) },
    isSubscribed ? "Job updates are off." : "Job updates are on."
  );

  const savePreferences = () => persist(
    { subscribed: true, ...form, locations: splitLocations(form.locations) },
    "Your job update settings are saved."
  );

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            isSubscribed
              ? "bg-amber-50 dark:bg-amber-500/10"
              : "bg-slate-50 dark:bg-gray-800"
          }`}>
            {isSubscribed
              ? <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              : <BellOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Job Updates by Email</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {isLoading
                ? "Checking your settings…"
                : isSubscribed
                  ? `On — ${saved.frequency === "daily" ? "daily" : "weekly"}${
                      subscription?.lastSentAt ? `, last sent ${moment(subscription.lastSentAt).fromNow()}` : ""
                    }`
                  : "Off — you are not getting emails about new roles"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSubscription}
          disabled={isLoading || isSaving}
          aria-pressed={isSubscribed}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            isSubscribed ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          <span className="sr-only">{isSubscribed ? "Turn job updates off" : "Turn job updates on"}</span>
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
              isSubscribed ? "left-5.5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {isLoading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : !isSubscribed ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 p-4 text-sm text-gray-500 dark:text-gray-400">
          Switch this on and we will email you the roles newly posted on the platform — from every company hiring
          here, not only the ones you have already looked at. We only write when there is something new.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {/* How often */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">How often</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FREQUENCIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => edit({ frequency: option.value })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.frequency === option.value
                      ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10 ring-1 ring-indigo-400"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Which fields */}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Which fields</p>
              {form.categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => edit({ categories: [] })}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  Send me everything
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {form.categories.length === 0
                ? "Nothing selected — you get every new role, in every field."
                : `${form.categories.length} selected.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEPARTMENT_OPTIONS.map((option) => {
                const active = form.categories.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleCategory(option)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Where */}
          <div>
            <label htmlFor="alert-locations" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Where
            </label>
            <input
              id="alert-locations"
              type="text"
              value={form.locations}
              onChange={(event) => edit({ locations: event.target.value })}
              placeholder="Accra, Kumasi — or leave empty for anywhere"
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Separate cities with commas. Remote roles always come through, wherever you are.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-50 dark:border-gray-800 pt-4">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Every email has a one-click unsubscribe.
            </p>
            <button
              type="button"
              onClick={savePreferences}
              disabled={isSaving || !dirty}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isSaving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobAlertsCard;
