import { useState } from "react";
import { LayoutTemplate, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Name and save a job template, either from the posting form's current
 * fields (`payload`) or from one of the employer's jobs (`fromJobId`).
 * Render it only while it is open. It is its own form, so render it outside
 * any other form.
 */
const SaveTemplateDialog = ({ defaultName = "", payload = null, fromJobId = null, onClose, onSaved }) => {
  const [name, setName] = useState(defaultName.slice(0, 80));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the template a name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = fromJobId ? { fromJobId, name: trimmed } : { ...payload, name: trimmed };
      const res = await axiosInstance.post(API_PATHS.JOB_TEMPLATES.CREATE, body);
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
        aria-labelledby="save-template-title"
        className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <LayoutTemplate className="h-5 w-5" />
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

        <h3 id="save-template-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
          Save as a job template
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Keeps the title, description, requirements, skills, pay range, location and screening questions for your
          next posting. The deadline is not saved.
        </p>

        <label htmlFor="template-name" className="mt-5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Template name
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          placeholder="e.g. Registered Nurse — Accra"
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {error && <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SaveTemplateDialog;
