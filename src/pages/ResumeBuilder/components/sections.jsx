import { useState } from "react";
import toast from "react-hot-toast";
import { LANGUAGE_LEVELS, blankEntry, formatRange, hasPdfFallback } from "../../../utils/resumeBuilder";
import {
  AddButton,
  AssistButton,
  Field,
  IconButton,
  MonthYearField,
  SelectInput,
  Suggestion,
  TextArea,
  TextInput,
} from "./fields";

/**
 * The editor for each part of the CV. Each takes its slice of the content and
 * an onChange that receives the whole new slice.
 */

const LIMITS = { experience: 15, bullets: 10, education: 10, skills: 40, certifications: 15, projects: 10, languages: 10, references: 4 };

/** Add, change, remove and reorder rows of a list section. */
const listOps = (items, onChange) => ({
  update: (index, patch) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item))),
  remove: (index) => onChange(items.filter((_, i) => i !== index)),
  move: (index, step) => {
    const target = index + step;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  },
  add: (entry) => onChange([...items, entry]),
});

/** Up, down and remove for one row. */
const RowControls = ({ index, count, onMove, onRemove, label }) => (
  <div className="flex shrink-0 items-center">
    <IconButton icon="arrow_upward" label={`Move ${label} up`} onClick={() => onMove(index, -1)} disabled={index === 0} />
    <IconButton icon="arrow_downward" label={`Move ${label} down`} onClick={() => onMove(index, 1)} disabled={index === count - 1} />
    <IconButton icon="delete" label={`Remove ${label}`} tone="danger" onClick={() => onRemove(index)} />
  </div>
);

const useAssist = (run) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const request = async (...args) => {
    setBusy(true);
    try {
      setResult(await run(...args));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return { busy, result, request, clear: () => setResult(null) };
};

const aiTitle = (aiEnabled) => (aiEnabled ? undefined : "AI writing help is not configured on this server");

// --- Personal details ---------------------------------------------------------

export const PersonalEditor = ({ personal, onChange }) => {
  const set = (key) => (value) => onChange({ ...personal, [key]: value });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextInput
        id="cv-name"
        label="Full name"
        hint={hasPdfFallback(personal.fullName) ? "PDF fonts do not include Ɔ, Ɛ or Ŋ, so your CV prints them as O, E and N." : undefined}
        value={personal.fullName}
        onChange={set("fullName")}
        autoComplete="name"
        maxLength={120}
        className="sm:col-span-2"
      />
      <TextInput
        id="cv-headline"
        label="Headline"
        hint="The job you do or want, e.g. “Registered Nurse” or “Accounts Officer”."
        value={personal.headline}
        onChange={set("headline")}
        maxLength={200}
        className="sm:col-span-2"
      />
      <TextInput id="cv-email" label="Email" type="email" value={personal.email} onChange={set("email")} autoComplete="email" maxLength={120} />
      <TextInput id="cv-phone" label="Phone" type="tel" value={personal.phone} onChange={set("phone")} autoComplete="tel" placeholder="+233 24 123 4567" maxLength={40} />
      <TextInput
        id="cv-location"
        label="Location"
        hint="Town and region is enough — no house address."
        value={personal.location}
        onChange={set("location")}
        placeholder="e.g. Kumasi, Ashanti"
        maxLength={120}
        className="sm:col-span-2"
      />
      <TextInput id="cv-linkedin" label="LinkedIn" value={personal.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/your-name" maxLength={200} />
      <TextInput id="cv-website" label="Website or portfolio" value={personal.website} onChange={set("website")} placeholder="Optional" maxLength={200} />
      <p className="flex items-start gap-1.5 rounded-xl bg-surface-container-low p-2.5 text-[11px] leading-4 text-text-secondary sm:col-span-2">
        <span className="material-symbols-outlined text-[15px] text-primary" aria-hidden="true">
          info
        </span>
        Leave out your photo, date of birth, marital status and religion. Employers should not screen on them, and many
        applicant tracking systems strip them anyway.
      </p>
    </div>
  );
};

// --- Summary ----------------------------------------------------------------------

export const SummaryEditor = ({ value, onChange, onAssist, aiEnabled }) => {
  const ai = useAssist(onAssist);
  return (
    <>
      <TextArea
        id="cv-summary"
        label="Summary"
        hint="3–4 sentences: who you are, your strongest proof, and what you want next."
        value={value}
        onChange={onChange}
        minRows={4}
        counter={{ ideal: 450, max: 750 }}
        maxLength={1200}
        placeholder="e.g. Registered nurse with 5 years on busy medical wards at Korle Bu…"
      />
      <div className="flex justify-end">
        <AssistButton
          label={value?.trim() ? "Rewrite with AI" : "Write it with AI"}
          onClick={() => ai.request()}
          busy={ai.busy}
          disabled={!aiEnabled}
          title={aiTitle(aiEnabled)}
        />
      </div>
      {ai.result?.summary && (
        <Suggestion
          title="Suggested summary"
          tips={ai.result.tips}
          onAccept={() => {
            onChange(ai.result.summary);
            ai.clear();
          }}
          onDismiss={ai.clear}
        >
          {ai.result.summary}
        </Suggestion>
      )}
    </>
  );
};

// --- Work experience ------------------------------------------------------------

const BulletList = ({ entryId, bullets, onChange }) => {
  const focusBullet = (index) =>
    requestAnimationFrame(() => document.querySelector(`[data-bullet="${entryId}-${index}"]`)?.focus());

  const change = (index, value) => onChange(bullets.map((line, i) => (i === index ? value : line)));

  const insertAfter = (index) => {
    if (bullets.length >= LIMITS.bullets) return;
    onChange([...bullets.slice(0, index + 1), "", ...bullets.slice(index + 1)]);
    focusBullet(index + 1);
  };

  const remove = (index) => {
    onChange(bullets.filter((_, i) => i !== index));
    if (index > 0) focusBullet(index - 1);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {bullets.map((line, index) => (
        <div key={index} className="flex items-start gap-1">
          <span className="mt-2 w-3 shrink-0 text-center text-text-muted" aria-hidden="true">
            •
          </span>
          <TextArea
            value={line}
            minRows={1}
            onChange={(value) => change(index, value)}
            maxLength={400}
            placeholder={index === 0 ? "e.g. Reduced patient waiting time by 30% by redesigning the triage rota" : "Another achievement"}
            data-bullet={`${entryId}-${index}`}
            aria-label={`Bullet ${index + 1}`}
            className="flex-1"
            onKeyDown={(event) => {
              // Enter starts the next bullet, the way a list works in a word processor.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                insertAfter(index);
              }
              if (event.key === "Backspace" && !line && bullets.length > 1) {
                event.preventDefault();
                remove(index);
              }
            }}
          />
          <IconButton icon="close" label={`Remove bullet ${index + 1}`} tone="danger" onClick={() => remove(index)} className="mt-0.5" />
        </div>
      ))}
      {bullets.length < LIMITS.bullets && (
        <button
          type="button"
          onClick={() => insertAfter(bullets.length - 1)}
          className="ml-4 flex w-fit items-center gap-1 rounded-lg px-2 py-1 font-label-md font-bold text-primary hover:bg-brand-indigo-light"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            add
          </span>
          Add bullet
        </button>
      )}
    </div>
  );
};

const ExperienceEntry = ({ entry, index, count, ops, onAssist, aiEnabled, open, onToggle }) => {
  const [notes, setNotes] = useState("");
  const [askingNotes, setAskingNotes] = useState(false);
  const ai = useAssist(onAssist);
  const hasBullets = entry.bullets.some((line) => line.trim());
  const heading = [entry.title, entry.employer].filter(Boolean).join(" · ") || "New role";

  const improve = () => {
    if (!hasBullets && !askingNotes) {
      setAskingNotes(true);
      return;
    }
    ai.request(index, notes);
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-container-lowest">
      <div className="flex items-center gap-2 py-1.5 pl-3 pr-1">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="material-symbols-outlined text-[18px] text-text-muted" aria-hidden="true">
            {open ? "expand_more" : "chevron_right"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-text-primary">{heading}</span>
            <span className="block text-[11px] text-text-muted">
              {formatRange(entry.start, entry.end, entry.current) || "No dates yet"}
            </span>
          </span>
        </button>
        <RowControls index={index} count={count} onMove={ops.move} onRemove={ops.remove} label="role" />
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border-default p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput id={`${entry.id}-title`} label="Job title" value={entry.title} onChange={(value) => ops.update(index, { title: value })} maxLength={120} />
            <TextInput id={`${entry.id}-employer`} label="Employer" value={entry.employer} onChange={(value) => ops.update(index, { employer: value })} maxLength={120} />
            <TextInput
              id={`${entry.id}-location`}
              label="Location"
              value={entry.location}
              onChange={(value) => ops.update(index, { location: value })}
              placeholder="e.g. Takoradi"
              maxLength={120}
              className="sm:col-span-2"
            />
            <MonthYearField id={`${entry.id}-start`} label="Started" value={entry.start} onChange={(value) => ops.update(index, { start: value })} />
            <div className="flex flex-col gap-1.5">
              <MonthYearField
                id={`${entry.id}-end`}
                label="Finished"
                value={entry.current ? "" : entry.end}
                disabled={entry.current}
                onChange={(value) => ops.update(index, { end: value })}
              />
              <label className="flex items-center gap-2 text-[12px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={entry.current}
                  onChange={(event) => ops.update(index, { current: event.target.checked, end: "" })}
                  className="h-4 w-4 accent-primary"
                />
                I work here now
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-label-md font-bold text-text-secondary">What you achieved</span>
              <AssistButton
                label={hasBullets ? "Improve with AI" : "Write with AI"}
                onClick={improve}
                busy={ai.busy}
                disabled={!aiEnabled}
                title={aiTitle(aiEnabled)}
              />
            </div>
            <BulletList entryId={entry.id} bullets={entry.bullets.length ? entry.bullets : [""]} onChange={(bullets) => ops.update(index, { bullets })} />
            <p className="text-[11px] leading-4 text-text-muted">
              Start each with a verb — Led, Reduced, Trained, Handled — and add a number where you can: people, cedis,
              percentages, time saved. Press Enter for the next bullet.
            </p>

            {askingNotes && !hasBullets && !ai.result && (
              <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-brand-indigo-light/60 p-3">
                <TextArea
                  id={`${entry.id}-notes`}
                  label="What did you do in this role?"
                  hint="Rough notes are fine — duties, who you served, anything you improved."
                  value={notes}
                  onChange={setNotes}
                  minRows={3}
                  maxLength={1500}
                />
                <div className="flex gap-2">
                  <AssistButton label="Write bullets" onClick={() => ai.request(index, notes)} busy={ai.busy} />
                  <button
                    type="button"
                    onClick={() => setAskingNotes(false)}
                    className="rounded-lg px-3 py-1.5 font-label-md font-bold text-text-secondary hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {ai.result?.bullets && (
              <Suggestion
                title="Suggested bullets"
                tips={ai.result.tips}
                acceptLabel={hasBullets ? "Replace my bullets" : "Use these bullets"}
                onAccept={() => {
                  ops.update(index, { bullets: ai.result.bullets });
                  ai.clear();
                  setAskingNotes(false);
                  setNotes("");
                }}
                onDismiss={ai.clear}
              >
                <ul className="flex flex-col gap-1">
                  {ai.result.bullets.map((line) => (
                    <li key={line} className="flex gap-1.5">
                      <span aria-hidden="true">•</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </Suggestion>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ExperienceEditor = ({ items, onChange, onAssist, aiEnabled }) => {
  const ops = listOps(items, onChange);
  const [openId, setOpenId] = useState(items[0]?.id || null);

  return (
    <>
      {items.length === 0 && (
        <p className="text-[12px] leading-5 text-text-muted">
          Add your jobs, most recent first. National service, internships, volunteering and running your own business
          all count.
        </p>
      )}
      {items.map((entry, index) => (
        <ExperienceEntry
          key={entry.id}
          entry={entry}
          index={index}
          count={items.length}
          ops={ops}
          onAssist={onAssist}
          aiEnabled={aiEnabled}
          open={openId === entry.id}
          onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
        />
      ))}
      <AddButton
        label="Add a role"
        disabled={items.length >= LIMITS.experience}
        onClick={() => {
          const entry = blankEntry.experience();
          ops.add(entry);
          setOpenId(entry.id);
        }}
      />
    </>
  );
};

// --- Education ----------------------------------------------------------------------

export const EducationEditor = ({ items, onChange }) => {
  const ops = listOps(items, onChange);
  return (
    <>
      {items.map((entry, index) => (
        <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-container-lowest p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-bold text-text-primary">{entry.qualification || entry.institution || "New qualification"}</span>
            <RowControls index={index} count={items.length} onMove={ops.move} onRemove={ops.remove} label="qualification" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              id={`${entry.id}-qualification`}
              label="Qualification"
              value={entry.qualification}
              onChange={(value) => ops.update(index, { qualification: value })}
              placeholder="e.g. BSc Nursing, HND Accountancy, WASSCE"
              maxLength={200}
              className="sm:col-span-2"
            />
            <TextInput id={`${entry.id}-institution`} label="School or institution" value={entry.institution} onChange={(value) => ops.update(index, { institution: value })} maxLength={200} />
            <TextInput id={`${entry.id}-location`} label="Location" value={entry.location} onChange={(value) => ops.update(index, { location: value })} maxLength={120} />
            <MonthYearField id={`${entry.id}-start`} label="Started" value={entry.start} onChange={(value) => ops.update(index, { start: value })} />
            <MonthYearField id={`${entry.id}-end`} label="Finished (or expected)" value={entry.end} onChange={(value) => ops.update(index, { end: value })} />
            <TextArea
              id={`${entry.id}-details`}
              label="Details"
              hint="Optional: class of degree, relevant courses, your project or thesis."
              value={entry.details}
              onChange={(value) => ops.update(index, { details: value })}
              minRows={2}
              maxLength={600}
              className="sm:col-span-2"
            />
          </div>
        </div>
      ))}
      <AddButton label="Add a qualification" disabled={items.length >= LIMITS.education} onClick={() => ops.add(blankEntry.education())} />
    </>
  );
};

// --- Skills ---------------------------------------------------------------------------

export const SkillsEditor = ({ skills, onChange, onAssist, aiEnabled }) => {
  const [draft, setDraft] = useState("");
  const ai = useAssist(onAssist);

  const add = (values) => {
    const known = new Set(skills.map((skill) => skill.toLowerCase()));
    const next = [...skills];
    for (const raw of values) {
      const skill = raw.trim().slice(0, 60);
      if (!skill || known.has(skill.toLowerCase()) || next.length >= LIMITS.skills) continue;
      known.add(skill.toLowerCase());
      next.push(skill);
    }
    onChange(next);
  };

  const commit = () => {
    if (!draft.trim()) return;
    add(draft.split(/[,;\n]/));
    setDraft("");
  };

  const suggested = (ai.result?.skills || []).filter((skill) => !skills.some((s) => s.toLowerCase() === skill.toLowerCase()));

  return (
    <>
      <Field
        label="Your skills"
        htmlFor="cv-skill-input"
        hint="8–15 works best. Use the words job adverts use — software, equipment, licences, methods."
      >
        <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-border-default bg-surface-container-low p-1.5 focus-within:border-primary">
          {skills.map((skill, index) => (
            <span key={skill} className="inline-flex items-center gap-1 rounded-lg bg-surface-card py-1 pl-2.5 pr-1 text-[12px] font-semibold text-text-primary ring-1 ring-border-default">
              {skill}
              <button
                type="button"
                onClick={() => onChange(skills.filter((_, i) => i !== index))}
                aria-label={`Remove ${skill}`}
                className="flex h-5 w-5 items-center justify-center rounded-md text-text-muted hover:bg-rose-50 hover:text-rose-600"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  close
                </span>
              </button>
            </span>
          ))}
          <input
            id="cv-skill-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commit();
              }
              if (event.key === "Backspace" && !draft && skills.length) onChange(skills.slice(0, -1));
            }}
            onBlur={commit}
            placeholder={skills.length ? "Add another…" : "Type a skill and press Enter"}
            disabled={skills.length >= LIMITS.skills}
            className="min-w-[140px] flex-1 bg-transparent px-1.5 py-1 text-[13px] text-on-surface outline-none placeholder:text-text-muted"
          />
        </div>
      </Field>
      <div className="flex justify-end">
        <AssistButton label="Suggest skills from my CV" onClick={() => ai.request()} busy={ai.busy} disabled={!aiEnabled} title={aiTitle(aiEnabled)} />
      </div>
      {ai.result && (
        <Suggestion
          title="Skills your CV shows"
          acceptLabel={suggested.length ? "Add all" : undefined}
          onAccept={
            suggested.length
              ? () => {
                  add(suggested);
                  ai.clear();
                }
              : undefined
          }
          onDismiss={ai.clear}
        >
          {suggested.length ? (
            <div className="flex flex-wrap gap-1.5">
              {suggested.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => add([skill])}
                  className="inline-flex items-center gap-1 rounded-lg bg-surface-card px-2.5 py-1 text-[12px] font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary hover:text-on-primary"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    add
                  </span>
                  {skill}
                </button>
              ))}
            </div>
          ) : (
            "No new skills to suggest — your list already covers what the CV shows."
          )}
        </Suggestion>
      )}
    </>
  );
};

// --- Certifications ------------------------------------------------------------------

const THIS_YEAR = new Date().getFullYear();
const CERT_YEARS = Array.from({ length: THIS_YEAR + 1 - 1970 + 1 }, (_, index) => String(THIS_YEAR + 1 - index));

export const CertificationsEditor = ({ items, onChange }) => {
  const ops = listOps(items, onChange);
  return (
    <>
      {items.map((entry, index) => (
        <div key={entry.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border-default bg-surface-container-lowest p-3 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end">
          <TextInput id={`${entry.id}-name`} label="Certificate or licence" value={entry.name} onChange={(value) => ops.update(index, { name: value })} placeholder="e.g. PMP, Nursing and Midwifery Council licence" maxLength={200} />
          <TextInput id={`${entry.id}-issuer`} label="Issued by" value={entry.issuer} onChange={(value) => ops.update(index, { issuer: value })} maxLength={120} />
          <SelectInput id={`${entry.id}-year`} label="Year" value={entry.year} onChange={(value) => ops.update(index, { year: value })} options={CERT_YEARS} placeholder="Year" />
          <RowControls index={index} count={items.length} onMove={ops.move} onRemove={ops.remove} label="certificate" />
        </div>
      ))}
      <AddButton label="Add a certificate" disabled={items.length >= LIMITS.certifications} onClick={() => ops.add(blankEntry.certifications())} />
    </>
  );
};

// --- Projects --------------------------------------------------------------------------

export const ProjectsEditor = ({ items, onChange }) => {
  const ops = listOps(items, onChange);
  return (
    <>
      {items.length === 0 && (
        <p className="text-[12px] leading-5 text-text-muted">
          Useful when your best work is not a job: a final-year project, a community initiative, a business you ran, or work
          you can link to.
        </p>
      )}
      {items.map((entry, index) => (
        <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-container-lowest p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-bold text-text-primary">{entry.name || "New project"}</span>
            <RowControls index={index} count={items.length} onMove={ops.move} onRemove={ops.remove} label="project" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput id={`${entry.id}-name`} label="Project name" value={entry.name} onChange={(value) => ops.update(index, { name: value })} maxLength={120} />
            <TextInput id={`${entry.id}-link`} label="Link" value={entry.link} onChange={(value) => ops.update(index, { link: value })} placeholder="Optional" maxLength={200} />
            <TextArea
              id={`${entry.id}-description`}
              label="What it was and what came of it"
              value={entry.description}
              onChange={(value) => ops.update(index, { description: value })}
              minRows={2}
              maxLength={700}
              className="sm:col-span-2"
            />
          </div>
        </div>
      ))}
      <AddButton label="Add a project" disabled={items.length >= LIMITS.projects} onClick={() => ops.add(blankEntry.projects())} />
    </>
  );
};

// --- Languages -------------------------------------------------------------------------

export const LanguagesEditor = ({ items, onChange }) => {
  const ops = listOps(items, onChange);
  return (
    <>
      {items.map((entry, index) => (
        <div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <TextInput id={`${entry.id}-name`} label={index === 0 ? "Language" : undefined} aria-label="Language" value={entry.name} onChange={(value) => ops.update(index, { name: value })} placeholder="e.g. Twi, Ewe, French" maxLength={60} />
          <SelectInput id={`${entry.id}-level`} label={index === 0 ? "Level" : undefined} value={entry.level} onChange={(value) => ops.update(index, { level: value })} options={LANGUAGE_LEVELS} placeholder="Level" />
          <IconButton icon="delete" label="Remove language" tone="danger" onClick={() => ops.remove(index)} className="mb-1" />
        </div>
      ))}
      <AddButton label="Add a language" disabled={items.length >= LIMITS.languages} onClick={() => ops.add(blankEntry.languages())} />
    </>
  );
};

// --- References ------------------------------------------------------------------------

const REFERENCE_MODES = [
  { id: "on_request", label: "Available on request", hint: "The usual choice — you share referees once an employer is interested." },
  { id: "list", label: "List my referees", hint: "Only list people who have agreed to be contacted." },
  { id: "hide", label: "Leave this section out", hint: "" },
];

export const ReferencesEditor = ({ references, onChange }) => {
  const items = references.items || [];
  const ops = listOps(items, (next) => onChange({ ...references, items: next }));

  return (
    <>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="References">
        {REFERENCE_MODES.map((mode) => (
          <label
            key={mode.id}
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
              references.mode === mode.id ? "border-primary bg-brand-indigo-light/60" : "border-border-default hover:bg-surface-container-low"
            }`}
          >
            <input
              type="radio"
              name="reference-mode"
              checked={references.mode === mode.id}
              onChange={() => onChange({ ...references, mode: mode.id, items: mode.id === "list" && !items.length ? [blankEntry.references()] : items })}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block text-[13px] font-semibold text-text-primary">{mode.label}</span>
              {mode.hint && <span className="block text-[11px] leading-4 text-text-muted">{mode.hint}</span>}
            </span>
          </label>
        ))}
      </div>

      {references.mode === "list" && (
        <>
          {items.map((entry, index) => (
            <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-container-lowest p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-bold text-text-primary">{entry.name || `Referee ${index + 1}`}</span>
                <RowControls index={index} count={items.length} onMove={ops.move} onRemove={ops.remove} label="referee" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextInput id={`${entry.id}-name`} label="Name" value={entry.name} onChange={(value) => ops.update(index, { name: value })} maxLength={120} />
                <TextInput id={`${entry.id}-position`} label="Position" value={entry.position} onChange={(value) => ops.update(index, { position: value })} maxLength={120} />
                <TextInput id={`${entry.id}-organisation`} label="Organisation" value={entry.organisation} onChange={(value) => ops.update(index, { organisation: value })} maxLength={120} className="sm:col-span-2" />
                <TextInput id={`${entry.id}-email`} label="Email" type="email" value={entry.email} onChange={(value) => ops.update(index, { email: value })} maxLength={120} />
                <TextInput id={`${entry.id}-phone`} label="Phone" type="tel" value={entry.phone} onChange={(value) => ops.update(index, { phone: value })} maxLength={40} />
              </div>
            </div>
          ))}
          <AddButton label="Add a referee" disabled={items.length >= LIMITS.references} onClick={() => ops.add(blankEntry.references())} />
        </>
      )}
    </>
  );
};
