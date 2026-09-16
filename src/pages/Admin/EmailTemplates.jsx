import { useEffect, useMemo, useState } from "react";
import { Check, Code2, Mail, Save, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

const PREVIEW_VALUES = {
  name: "Jordan Smith",
  role: "jobseeker",
  applicantName: "Jordan Smith",
  jobTitle: "Senior Product Designer",
  status: "Under Review",
  interviewDate: "Monday, 14 September 2026",
  interviewTime: "10:00 AM",
  interviewLocation: "Google Meet",
  interviewNotes: "Please bring a portfolio of your recent work.",
};

const replacePreviewVariables = (value = "") => value.replace(
  /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
  (_, key) => PREVIEW_VALUES[key] ?? `[${key}]`
);

const previewDocument = (html) => `
  <!doctype html>
  <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
    <body style="margin:0;padding:16px;background:#f1f5f9;">
      ${replacePreviewVariables(html)}
    </body>
  </html>
`;

const EmailTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey),
    [templates, selectedKey]
  );

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await axiosInstance.get(API_PATHS.EMAIL_TEMPLATES.GET_ALL);
        const loadedTemplates = response.data.templates || [];
        setTemplates(loadedTemplates);
        setDrafts(Object.fromEntries(loadedTemplates.map((template) => [template.key, {
          subject: template.subject,
          html: template.html,
        }])));
        setSelectedKey(loadedTemplates[0]?.key || "");
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load email templates");
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const draft = drafts[selectedKey] || {
    subject: selectedTemplate?.subject || "",
    html: selectedTemplate?.html || "",
  };

  const updateDraft = (updates) => {
    setDrafts((current) => ({
      ...current,
      [selectedKey]: { ...draft, ...updates },
    }));
  };

  const selectTemplate = (key) => {
    if (key === selectedKey) return;
    setSelectedKey(key);
  };

  const handleSave = async () => {
    if (!draft.subject.trim() || !draft.html.trim()) {
      toast.error("Subject and message HTML are required");
      return;
    }

    setSaving(true);
    try {
      const response = await axiosInstance.put(
        API_PATHS.EMAIL_TEMPLATES.UPDATE(selectedKey),
        draft
      );
      const savedTemplate = response.data.template;
      setTemplates((current) => current.map((template) => (
        template.key === savedTemplate.key ? savedTemplate : template
      )));
      setDrafts((current) => ({ ...current, [savedTemplate.key]: {
        subject: savedTemplate.subject,
        html: savedTemplate.html,
      }}));
      toast.success("Email template saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save email template");
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable) => {
    updateDraft({ html: `${draft.html}\n{{${variable}}}` });
  };

  return (
    <DashboardLayout activeMenu={user?.role === "admin" ? "admin-email-templates" : "email-templates"}>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Platform settings</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Email templates</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Edit the messages automatically sent to candidates and employers across the platform.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Employer &amp; admin access
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-gray-100 bg-white text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            Loading templates…
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-900 dark:text-white">
                <Mail className="h-4 w-4 text-primary" />
                Automated messages
              </div>
              <div className="space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => selectTemplate(template.key)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${selectedKey === template.key
                      ? "bg-secondary text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    <p className="text-sm font-semibold">{template.name}</p>
                    <p className={`mt-1 text-xs leading-5 ${selectedKey === template.key ? "text-white/60" : "text-gray-400"}`}>
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            {selectedTemplate && (
              <section className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
                <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTemplate.name}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedTemplate.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Check className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving…" : "Save template"}
                  </button>
                </div>

                <div className="mt-6 grid gap-6 2xl:grid-cols-2">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">Subject line</span>
                      <input
                        type="text"
                        value={draft.subject}
                        onChange={(event) => updateDraft({ subject: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label htmlFor="email-html" className="text-sm font-semibold text-gray-700 dark:text-gray-200">Message HTML</label>
                        <Code2 className="h-4 w-4 text-gray-400" />
                      </div>
                      <textarea
                        id="email-html"
                        value={draft.html}
                        onChange={(event) => updateDraft({ html: event.target.value })}
                        spellCheck="false"
                        className="min-h-[430px] w-full resize-y rounded-xl border border-gray-200 bg-gray-950 px-4 py-4 font-mono text-xs leading-6 text-gray-100 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-gray-700"
                      />
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Available variables</p>
                      <p className="mt-1 text-xs text-gray-400">Click one to add it to the end of the message.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(selectedTemplate.variables || []).map((variable) => (
                          <button
                            key={variable}
                            type="button"
                            onClick={() => insertVariable(variable)}
                            className="rounded-lg bg-gray-100 px-2.5 py-1.5 font-mono text-xs text-gray-600 transition hover:bg-primary/10 hover:text-primary dark:bg-gray-800 dark:text-gray-300"
                          >
                            {`{{${variable}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Live preview</span>
                      <span className="text-xs text-gray-400">Sample data</span>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-100 dark:border-gray-700 dark:bg-gray-800">
                      <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Subject</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{replacePreviewVariables(draft.subject)}</p>
                      </div>
                      <iframe
                        title="Email preview"
                        srcDoc={previewDocument(draft.html)}
                        sandbox=""
                        className="h-[550px] w-full border-0 bg-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EmailTemplates;
