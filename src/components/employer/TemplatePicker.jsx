import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutTemplate, Loader2, Search, X, ChevronRight } from "lucide-react";
import moment from "moment";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

/**
 * Choose one of the employer's job templates to start a posting from.
 * Render it only while it is open.
 */
const TemplatePicker = ({ onClose, onPick, currentId = null }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.JOB_TEMPLATES.LIST)
      .then((res) => {
        if (!cancelled) setTemplates(res.data?.templates || []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = templates.filter(
    (template) =>
      !q ||
      template.name.toLowerCase().includes(q) ||
      template.title.toLowerCase().includes(q) ||
      (template.category || "").toLowerCase().includes(q)
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
          <div>
            <h3 id="template-picker-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              <LayoutTemplate className="h-5 w-5 text-indigo-500" />
              Start from a template
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choosing one fills in the posting below. You can change anything before you publish.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {templates.length > 5 && (
          <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates…"
                autoFocus
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        <div className="min-h-[160px] flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your templates…
            </div>
          ) : failed ? (
            <p className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">Could not load your templates.</p>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No templates yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Save this posting as a template when you're done, or create one on the{" "}
                <Link to="/job-templates" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                  Job Templates
                </Link>{" "}
                page.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No template matches “{query}”.</p>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => onPick(template)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                      template.id === currentId
                        ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                        : "border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-gray-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{template.name}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {[template.title, template.type, template.workModel].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                        {template.timesUsed
                          ? `Used ${template.timesUsed} time${template.timesUsed === 1 ? "" : "s"} · last ${moment(template.lastUsedAt).fromNow()}`
                          : `Not used yet · saved ${moment(template.createdAt).fromNow()}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatePicker;
