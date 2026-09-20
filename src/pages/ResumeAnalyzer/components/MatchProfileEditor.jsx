import { useState } from "react";

/**
 * Editor for the inputs the candidate controls.
 *
 * Location, pay expectation, and mobility are 25% of the match score between
 * them, and the AI cannot read them off a CV. Leaving them unset costs the
 * candidate real points, so the panel says so explicitly.
 */
const MatchProfileEditor = ({ profile, onSave, isSaving }) => {
  const [form, setForm] = useState({
    location: "",
    expectedSalaryMin: "",
    expectedSalaryMax: "",
    willingToRelocate: false,
    openToRemote: true,
  });
  const [dirty, setDirty] = useState(false);
  const [syncedFrom, setSyncedFrom] = useState(null);

  /**
   * Re-seed the form when a saved profile arrives or is replaced.
   *
   * Adjusted during render rather than in an effect: React re-renders
   * immediately with the new state without committing the stale form to the
   * DOM, so the user never sees a frame of the old values.
   */
  const profileSignature = profile
    ? JSON.stringify([
        profile.location,
        profile.expectedSalaryMin,
        profile.expectedSalaryMax,
        profile.willingToRelocate,
        profile.openToRemote,
      ])
    : null;

  if (profile && profileSignature !== syncedFrom) {
    setSyncedFrom(profileSignature);
    setForm({
      location: profile.location || "",
      expectedSalaryMin: profile.expectedSalaryMin ?? "",
      expectedSalaryMax: profile.expectedSalaryMax ?? "",
      willingToRelocate: Boolean(profile.willingToRelocate),
      openToRemote: profile.openToRemote !== false,
    });
    setDirty(false);
  }

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const min = Number(form.expectedSalaryMin);
  const max = Number(form.expectedSalaryMax);
  const rangeInvalid = Boolean(form.expectedSalaryMin && form.expectedSalaryMax && min > max);

  const missingCount =
    (form.location ? 0 : 1) + (form.expectedSalaryMin || form.expectedSalaryMax ? 0 : 1);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (rangeInvalid) return;
    onSave({
      location: form.location,
      expectedSalaryMin: form.expectedSalaryMin === "" ? null : min,
      expectedSalaryMax: form.expectedSalaryMax === "" ? null : max,
      willingToRelocate: form.willingToRelocate,
      openToRemote: form.openToRemote,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]"
    >
      <div>
        <h3 className="font-headline-sm font-bold text-text-primary">Your match criteria</h3>
        <p className="font-body-sm text-text-muted">
          Location and pay are 25% of every match score, and they cannot be read from a CV.
        </p>
      </div>

      {missingCount > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-space-sm font-body-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="material-symbols-outlined text-[17px] shrink-0" aria-hidden="true">
            info
          </span>
          <span>
            {missingCount === 2
              ? "Your location and salary expectation are unset, so both are scored neutrally rather than in your favour."
              : form.location
                ? "Your salary expectation is unset, so pay alignment is scored neutrally."
                : "Your location is unset, so location fit is scored neutrally."}
          </span>
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-label-md font-bold text-text-secondary">Where you are based</span>
        <input
          type="text"
          value={form.location}
          onChange={(event) => update("location", event.target.value)}
          placeholder="e.g. Accra, Ghana"
          className="rounded-xl border border-border-default bg-surface-container-low px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary"
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-label-md font-bold text-text-secondary">
          Monthly salary expectation (GH₵)
        </legend>
        <div className="flex items-center gap-space-sm">
          <input
            type="number"
            min="0"
            step="100"
            value={form.expectedSalaryMin}
            onChange={(event) => update("expectedSalaryMin", event.target.value)}
            placeholder="Minimum"
            aria-label="Minimum monthly salary expectation in cedis"
            className="w-full rounded-xl border border-border-default bg-surface-container-low px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary"
          />
          <span className="font-body-sm text-text-muted">to</span>
          <input
            type="number"
            min="0"
            step="100"
            value={form.expectedSalaryMax}
            onChange={(event) => update("expectedSalaryMax", event.target.value)}
            placeholder="Maximum"
            aria-label="Maximum monthly salary expectation in cedis"
            className="w-full rounded-xl border border-border-default bg-surface-container-low px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary"
          />
        </div>
        {rangeInvalid && (
          <span className="font-body-sm text-error">
            Your minimum cannot be higher than your maximum.
          </span>
        )}
      </fieldset>

      <div className="flex flex-col gap-space-sm">
        {[
          {
            key: "openToRemote",
            label: "Open to remote roles",
            hint: "Remote postings score full marks on location",
          },
          {
            key: "willingToRelocate",
            label: "Willing to relocate",
            hint: "Keeps roles in other cities in contention",
          },
        ].map((option) => (
          <label
            key={option.key}
            className="flex cursor-pointer items-start gap-space-sm rounded-xl border border-border-default bg-surface-container-low p-space-sm"
          >
            <input
              type="checkbox"
              checked={form[option.key]}
              onChange={(event) => update(option.key, event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="min-w-0">
              <span className="block font-body-md font-semibold text-text-primary">
                {option.label}
              </span>
              <span className="block font-body-sm text-text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={isSaving || rangeInvalid || !dirty}
        className="self-start rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : dirty ? "Save and rescore matches" : "Saved"}
      </button>
    </form>
  );
};

export default MatchProfileEditor;
