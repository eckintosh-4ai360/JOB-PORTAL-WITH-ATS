import { useState } from "react";
import { LayoutTemplate, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import ScreeningQuestionsEditor from "./ScreeningQuestionsEditor";
import { toEditorQuestions, toPayloadQuestions } from "../../utils/screeningQuestions";
import { DEPARTMENT_OPTIONS, JOB_TYPE_OPTIONS, WORK_MODEL_OPTIONS } from "../../utils/jobOptions";

/**
 * Create or edit a job template. `template` with an id edits it; without one
 * (a duplicate, or nothing) creates a new one. Render it only while open.
 */

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

const Section = ({ title, children }) => (
  <section className="space-y-4">
    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h4>
    {children}
  </section>
);

const JobTemplateEditor = ({ template = null, onClose, onSaved }) => {
  const isEditing = Boolean(template?.id);

  const [form, setForm] = useState(() => ({
    name: template?.name || "",
    title: template?.title || "",
    category: template?.category || DEPARTMENT_OPTIONS[0],
    type: template?.type || JOB_TYPE_OPTIONS[0],
    workModel: template?.workModel || WORK_MODEL_OPTIONS[0],
    location: template?.location || "",
    salaryMin: template?.salaryMin != null ? String(template.salaryMin) : "",
    salaryMax: template?.salaryMax != null ? String(template.salaryMax) : "",
    tagsInput: Array.isArray(template?.tags) ? template.tags.join(", ") : "",
    description: template?.description || "",
    requirements: template?.requirements || "",
  }));
  const [questions, setQuestions] = useState(() => toEditorQuestions(template?.screeningQuestions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
  };

  const tags = form.tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("Give the template a name.");
    if (!form.title.trim()) return setError("A template needs a job title.");
    if (!form.description.trim()) return setError("A template needs a job description.");
    const incomplete = toPayloadQuestions(questions).find(
      (question) => question.type === "choice" && question.options.length < 2
    );
    if (incomplete) return setError(`"${incomplete.prompt}" needs at least two answers to choose from.`);

    // A saved map pin only still applies while the location reads the same.
    const keepsPin = template?.latitude != null && form.location.trim() === (template?.location || "").trim();

    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      category: form.category,
      type: form.type,
      workModel: form.workModel,
      location: form.location.trim(),
      latitude: keepsPin ? template.latitude : null,
      longitude: keepsPin ? template.longitude : null,
      salaryMin: form.salaryMin === "" ? null : Number(form.salaryMin),
      salaryMax: form.salaryMax === "" ? null : Number(form.salaryMax),
      tags,
      description: form.description,
      requirements: form.requirements,
      screeningQuestions: toPayloadQuestions(questions),
    };

    setSaving(true);
    setError("");
    try {
      const res = isEditing
        ? await axiosInstance.put(API_PATHS.JOB_TEMPLATES.UPDATE(template.id), payload)
        : await axiosInstance.post(API_PATHS.JOB_TEMPLATES.CREATE, payload);
      toast.success(res.data?.message || "Template saved.");
      onSaved?.(res.data?.template);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h3 id="template-editor-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {isEditing ? "Edit template" : "New job template"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Jobs already posted from this template are not changed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <Section title="Template">
            <div>
              <label htmlFor="tpl-name" className={labelClass}>Template name *</label>
              <input
                id="tpl-name"
                type="text"
                maxLength={80}
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Registered Nurse — Accra"
                className={inputClass}
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Only you see this name.</p>
            </div>
          </Section>

          <Section title="The role">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="tpl-title" className={labelClass}>Job title *</label>
                <input
                  id="tpl-title"
                  type="text"
                  maxLength={120}
                  value={form.title}
                  onChange={set("title")}
                  placeholder="e.g. Registered Nurse"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="tpl-category" className={labelClass}>Department</label>
                <select id="tpl-category" value={form.category} onChange={set("category")} className={inputClass}>
                  {!DEPARTMENT_OPTIONS.includes(form.category) && <option value={form.category}>{form.category}</option>}
                  {DEPARTMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tpl-type" className={labelClass}>Job type</label>
                <select id="tpl-type" value={form.type} onChange={set("type")} className={inputClass}>
                  {!JOB_TYPE_OPTIONS.includes(form.type) && <option value={form.type}>{form.type}</option>}
                  {JOB_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelClass}>Work model</span>
                <div className="grid grid-cols-3 gap-2">
                  {WORK_MODEL_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, workModel: option }))}
                      aria-pressed={form.workModel === option}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                        form.workModel === option
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="tpl-location" className={labelClass}>Location</label>
                <input
                  id="tpl-location"
                  type="text"
                  maxLength={200}
                  value={form.location}
                  onChange={set("location")}
                  placeholder="e.g. Accra, Ghana"
                  className={inputClass}
                />
              </div>
            </div>
          </Section>

          <Section title="Monthly pay (GH₵)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tpl-min" className={labelClass}>From</label>
                <input id="tpl-min" type="number" min="0" value={form.salaryMin} onChange={set("salaryMin")} placeholder="Optional" className={inputClass} />
              </div>
              <div>
                <label htmlFor="tpl-max" className={labelClass}>To</label>
                <input id="tpl-max" type="number" min="0" value={form.salaryMax} onChange={set("salaryMax")} placeholder="Optional" className={inputClass} />
              </div>
            </div>
          </Section>

          <Section title="Skills, licences and certifications">
            <div>
              <input
                type="text"
                value={form.tagsInput}
                onChange={set("tagsInput")}
                placeholder="Comma separated — e.g. Patient care, BLS certification, Excel"
                className={inputClass}
                aria-label="Skills"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="Description">
            <div>
              <label htmlFor="tpl-description" className={labelClass}>Responsibilities and overview *</label>
              <textarea id="tpl-description" rows={7} value={form.description} onChange={set("description")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="tpl-requirements" className={labelClass}>Qualifications and experience</label>
              <textarea id="tpl-requirements" rows={5} value={form.requirements} onChange={set("requirements")} className={inputClass} />
            </div>
          </Section>

          <Section title="Screening questions">
            <ScreeningQuestionsEditor questions={questions} onChange={setQuestions} />
          </Section>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <p className={`text-sm font-medium ${error ? "text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-gray-500"}`}>
            {error || "The deadline is set on each posting, not the template."}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : isEditing ? "Save changes" : "Save template"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JobTemplateEditor;
