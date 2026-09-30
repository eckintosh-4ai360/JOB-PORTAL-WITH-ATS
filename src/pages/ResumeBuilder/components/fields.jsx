import { useLayoutEffect, useRef } from "react";
import { MONTHS } from "../../../utils/resumeBuilder";

/**
 * Form controls for the CV editor. Text is set a size up from the rest of the
 * app's forms: this is where someone writes several hundred words.
 */

const inputClass =
  "w-full rounded-xl border border-border-default bg-surface-container-low px-3 py-2 text-[13px] leading-5 text-on-surface outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:bg-surface-card disabled:opacity-60";

export const Field = ({ label, hint, htmlFor, className = "", children }) => (
  <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
    {label && (
      <label htmlFor={htmlFor} className="font-label-md font-bold text-text-secondary">
        {label}
      </label>
    )}
    {children}
    {hint && <p className="text-[11px] leading-4 text-text-muted">{hint}</p>}
  </div>
);

export const TextInput = ({ id, label, hint, value, onChange, className = "", ...rest }) => (
  <Field label={label} hint={hint} htmlFor={id} className={className}>
    <input
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
      {...rest}
    />
  </Field>
);

/** Grows with its text, so a long bullet never hides behind a scrollbar. */
export const TextArea = ({ id, label, hint, value, onChange, minRows = 2, counter, className = "", ...rest }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight + 2}px`;
  }, [value]);

  const length = String(value || "").length;

  return (
    <Field
      label={label}
      hint={
        counter ? (
          <span className="flex justify-between gap-2">
            <span>{hint}</span>
            <span className={length > counter.max ? "font-bold text-amber-600" : ""}>
              {length}/{counter.ideal}
            </span>
          </span>
        ) : (
          hint
        )
      }
      htmlFor={id}
      className={className}
    >
      <textarea
        id={id}
        ref={ref}
        rows={minRows}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-none overflow-hidden`}
        {...rest}
      />
    </Field>
  );
};

export const SelectInput = ({ id, label, value, onChange, options, placeholder, className = "" }) => (
  <Field label={label} htmlFor={id} className={className}>
    <select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
    </select>
  </Field>
);

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 6 - 1960 + 1 }, (_, index) => String(THIS_YEAR + 6 - index));

/**
 * Month (optional) and year, stored as "YYYY" or "YYYY-MM". Two selects
 * rather than <input type="month">, which several desktop browsers still
 * render as a plain text box.
 */
export const MonthYearField = ({ id, label, value, onChange, disabled = false, allowMonth = true }) => {
  const [year = "", month = ""] = String(value || "").split("-");

  const change = (nextYear, nextMonth) => {
    if (!nextYear) return onChange("");
    onChange(nextMonth ? `${nextYear}-${nextMonth}` : nextYear);
  };

  return (
    <Field label={label} htmlFor={`${id}-year`}>
      <div className="flex gap-1.5">
        {allowMonth && (
          <select
            aria-label={`${label} month`}
            value={month}
            disabled={disabled || !year}
            onChange={(event) => change(year, event.target.value)}
            className={`${inputClass} min-w-0 flex-1 px-2`}
          >
            <option value="">Month</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          id={`${id}-year`}
          aria-label={`${label} year`}
          value={year}
          disabled={disabled}
          onChange={(event) => change(event.target.value, month)}
          className={`${inputClass} min-w-0 flex-1 px-2`}
        >
          <option value="">Year</option>
          {YEARS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
};

export const IconButton = ({ icon, label, onClick, disabled = false, tone = "default", className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
      tone === "danger"
        ? "text-text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
        : "text-text-muted hover:bg-surface-container hover:text-primary"
    } ${className}`}
  >
    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
      {icon}
    </span>
  </button>
);

export const AddButton = ({ label, onClick, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 py-2.5 font-label-md font-bold text-primary transition-colors hover:bg-brand-indigo-light disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
      add
    </span>
    {label}
  </button>
);

/** A small "AI" action. Disabled with a reason when AI is not configured. */
export const AssistButton = ({ label, onClick, busy = false, disabled = false, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy || disabled}
    title={title}
    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className={`material-symbols-outlined text-[15px] ${busy ? "animate-spin" : ""}`} aria-hidden="true">
      {busy ? "progress_activity" : "auto_awesome"}
    </span>
    {busy ? "Writing…" : label}
  </button>
);

/**
 * A suggestion from the AI writer, shown beside the candidate's own text until
 * they take it or throw it away. Nothing is replaced without that click.
 */
export const Suggestion = ({ title = "Suggested", children, tips = [], onAccept, acceptLabel = "Use this", onDismiss }) => (
  <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-brand-indigo-light/70 p-3 dark:bg-brand-indigo-light/40">
    <div className="flex items-center gap-1.5 font-label-caps uppercase text-primary">
      <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
        auto_awesome
      </span>
      {title}
    </div>
    <div className="text-[13px] leading-5 text-text-primary">{children}</div>
    {tips.length > 0 && (
      <ul className="flex flex-col gap-1 border-t border-primary/15 pt-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-1.5 text-[11px] leading-4 text-text-secondary">
            <span className="material-symbols-outlined text-[14px] text-amber-600" aria-hidden="true">
              lightbulb
            </span>
            {tip}
          </li>
        ))}
      </ul>
    )}
    <p className="text-[11px] leading-4 text-text-muted">
      Check it says only what is true — you are the one sending it.
    </p>
    <div className="flex flex-wrap gap-2">
      {onAccept && (
        <button
          type="button"
          onClick={onAccept}
          className="rounded-lg bg-primary px-3 py-1.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark"
        >
          {acceptLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg px-3 py-1.5 font-label-md font-bold text-text-secondary transition-colors hover:bg-surface-container"
      >
        Discard
      </button>
    </div>
  </div>
);

/** One collapsible block of the editor. */
export const SectionCard = ({ id, icon, title, subtitle, open, onToggle, badge, children }) => (
  <section id={id} className="scroll-mt-24 rounded-2xl border border-border-default bg-surface-card shadow-[0_8px_24px_rgba(40,34,86,0.06)]">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-light text-primary">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-headline-sm font-bold text-text-primary">{title}</span>
        {subtitle && <span className="block truncate text-[11px] leading-4 text-text-muted">{subtitle}</span>}
      </span>
      {badge}
      <span className="material-symbols-outlined text-[20px] text-text-muted" aria-hidden="true">
        {open ? "expand_less" : "expand_more"}
      </span>
    </button>
    {open && <div className="flex flex-col gap-3 border-t border-border-default px-4 pb-4 pt-3">{children}</div>}
  </section>
);
