import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutTemplate, Plus, Search, Pencil, Copy, Trash2, Loader2, AlertCircle,
  MapPin, Briefcase, ListChecks, ArrowRight, X,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import JobTemplateEditor from "../../components/employer/JobTemplateEditor";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { formatSalaryRange } from "../../utils/jobOptions";

/**
 * Job templates: reusable job descriptions. A template fills in a new posting
 * in one click; the employer still checks it and sets the deadline before
 * publishing.
 */

const usageLine = (template) =>
  template.timesUsed
    ? `Used for ${template.timesUsed} posting${template.timesUsed === 1 ? "" : "s"} · last ${moment(template.lastUsedAt).fromNow()}`
    : `Not used yet · updated ${moment(template.updatedAt).fromNow()}`;

const Chip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
    {Icon && <Icon className="h-3 w-3" />}
    {children}
  </span>
);

const TemplateCard = ({ template, onUse, onEdit, onDuplicate, onDelete }) => {
  const salary = formatSalaryRange(template.salaryMin, template.salaryMax);
  const questionCount = Array.isArray(template.screeningQuestions) ? template.screeningQuestions.length : 0;
  const tags = template.tags || [];

  return (
    <article className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-indigo-100 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-gray-900 dark:text-gray-100" title={template.name}>
            {template.name}
          </h3>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400" title={template.title}>{template.title}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onEdit}
            title="Edit template"
            aria-label={`Edit ${template.name}`}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate"
            aria-label={`Duplicate ${template.name}`}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete template"
            aria-label={`Delete ${template.name}`}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.type && <Chip icon={Briefcase}>{template.type}</Chip>}
        {template.workModel && <Chip>{template.workModel}</Chip>}
        {template.location && <Chip icon={MapPin}>{template.location}</Chip>}
        {questionCount > 0 && (
          <Chip icon={ListChecks}>
            {questionCount} screening question{questionCount === 1 ? "" : "s"}
          </Chip>
        )}
      </div>

      {salary && <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{salary} / month</p>}

      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{template.description}</p>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              {tag}
            </span>
          ))}
          {tags.length > 6 && <span className="px-1 text-[11px] text-gray-400">+{tags.length - 6} more</span>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-50 pt-4 dark:border-gray-800">
        <span className="text-xs text-gray-400 dark:text-gray-500">{usageLine(template)}</span>
        <button
          type="button"
          onClick={onUse}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Use template
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
};

const JobTemplates = () => {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");

  // { template } while the editor is open; template is null for a new one
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTemplates = useCallback(() => {
    axiosInstance
      .get(API_PATHS.JOB_TEMPLATES.LIST)
      .then((res) => {
        setTemplates(res.data?.templates || []);
        setLimit(res.data?.limit || 100);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadTemplates, 0);
    return () => clearTimeout(timer);
  }, [loadTemplates]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(API_PATHS.JOB_TEMPLATES.DELETE(deleting.id));
      setTemplates((current) => current.filter((template) => template.id !== deleting.id));
      toast.success(`Deleted "${deleting.name}"`);
      setDeleting(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete the template.");
    } finally {
      setIsDeleting(false);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = templates.filter(
    (template) =>
      !q ||
      template.name.toLowerCase().includes(q) ||
      template.title.toLowerCase().includes(q) ||
      (template.category || "").toLowerCase().includes(q) ||
      (template.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
  const atLimit = templates.length >= limit;

  return (
    <DashboardLayout activeMenu="job-templates">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Job Templates</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Reusable job descriptions. Start a new posting from one, check it, set a deadline and publish.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ template: null })}
            disabled={atLimit}
            title={atLimit ? `You can keep up to ${limit} templates` : undefined}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-all hover:scale-105 hover:bg-opacity-95 active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            <Plus className="h-4 w-4" />
            New template
          </button>
        </div>

        {templates.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-900">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, title, department or skill…"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              {shown.length} of {templates.length} template{templates.length === 1 ? "" : "s"}
              {atLimit && ` · at the limit of ${limit}`}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-24 dark:border-gray-800 dark:bg-gray-900">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-gray-400">Loading your templates…</p>
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-white py-20 text-center dark:border-rose-500/20 dark:bg-gray-900">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Could not load your templates</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                loadTemplates();
              }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
              <LayoutTemplate className="h-8 w-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No job templates yet</h3>
            <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Save the adverts you post again and again — the description, requirements, skills, pay and screening
              questions — and start the next one in a click. You can also save any job from Manage Jobs, or use
              “Save as template” while posting.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setEditing({ template: null })}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Create a template
              </button>
              <button
                type="button"
                onClick={() => navigate("/manage-jobs")}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Save one of my jobs
              </button>
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No template matches “{query}”</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => navigate(`/post-job?template=${template.id}`)}
                onEdit={() => setEditing({ template })}
                onDuplicate={() => {
                  if (atLimit) {
                    toast.error(`You can keep up to ${limit} templates. Delete one first.`);
                    return;
                  }
                  const copy = { ...template, name: `${template.name} (copy)`.slice(0, 80) };
                  delete copy.id;
                  delete copy._id;
                  setEditing({ template: copy });
                }}
                onDelete={() => setDeleting(template)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <JobTemplateEditor
          template={editing.template}
          onClose={() => setEditing(null)}
          onSaved={() => loadTemplates()}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-template-title"
            className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 id="delete-template-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Delete “{deleting.name}”?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Jobs you already posted from it stay exactly as they are. The template itself cannot be recovered.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={isDeleting}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default JobTemplates;
