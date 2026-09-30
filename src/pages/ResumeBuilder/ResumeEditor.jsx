import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import moment from "moment";

import Navbar from "../../components/layout/Navbar";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import {
  ACCENTS,
  SECTIONS,
  TEMPLATES,
  downloadResumePdf,
  hasSection,
  printable,
} from "../../utils/resumeBuilder";
import ResumePreview from "./components/ResumePreview";
import AtsCheckDrawer from "./components/AtsCheckDrawer";
import SaveToDocumentsDialog from "./components/SaveToDocumentsDialog";
import { SectionCard } from "./components/fields";
import {
  CertificationsEditor,
  EducationEditor,
  ExperienceEditor,
  LanguagesEditor,
  PersonalEditor,
  ProjectsEditor,
  ReferencesEditor,
  SkillsEditor,
  SummaryEditor,
} from "./components/sections";

/**
 * Save as the candidate types. One request at a time: edits made while a save
 * is in flight are merged and sent after it, so the server never receives an
 * older version after a newer one.
 */
const useAutosave = (id, onSaved) => {
  const [status, setStatus] = useState("saved");
  const pending = useRef(null);
  const inFlight = useRef(null);
  const timer = useRef(null);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  /** Send whatever is waiting. Resolves false when it could not be saved. */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;

    // Edits typed while a save was in flight go out straight after it.
    while (pending.current) {
      const payload = pending.current;
      pending.current = null;
      setStatus("saving");

      let ok = true;
      inFlight.current = axiosInstance
        .put(API_PATHS.RESUME_BUILDER.UPDATE(id), payload)
        .then((res) => onSavedRef.current?.(res.data?.resume))
        .catch(() => {
          ok = false;
          // Keep it for the next attempt, under anything typed since.
          pending.current = { ...payload, ...(pending.current || {}) };
        })
        .finally(() => {
          inFlight.current = null;
        });
      await inFlight.current;

      if (!ok) {
        setStatus("error");
        return false;
      }
    }

    setStatus(inFlight.current ? "saving" : "saved");
    return true;
  }, [id]);

  const queue = useCallback(
    (patch, delay = 800) => {
      pending.current = { ...(pending.current || {}), ...patch };
      setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush]
  );

  useEffect(() => {
    const warn = (event) => {
      if (pending.current || inFlight.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      // Leaving the page inside the app: send the last edits on their way.
      flush();
    };
  }, [flush]);

  return { status, queue, flush };
};

const SaveStatus = ({ status, savedAt, onRetry }) => {
  if (status === "error") {
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
          cloud_off
        </span>
        Not saved — retry
      </button>
    );
  }
  const label = status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : savedAt ? `Saved ${moment(savedAt).fromNow()}` : "Saved";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-muted" aria-live="polite">
      <span className={`material-symbols-outlined text-[15px] ${status === "saving" ? "animate-pulse" : ""}`} aria-hidden="true">
        {status === "saved" ? "cloud_done" : "cloud_upload"}
      </span>
      {label}
    </span>
  );
};

const sectionSubtitle = (key, content, lists) => {
  switch (key) {
    case "summary": {
      const words = (content.summary || "").split(/\s+/).filter(Boolean).length;
      return words ? `${words} words` : "A short introduction at the top";
    }
    case "experience":
      return lists.experience.length ? `${lists.experience.length} role${lists.experience.length === 1 ? "" : "s"}` : "Your jobs, most recent first";
    case "education":
      return lists.education.length ? `${lists.education.length} qualification${lists.education.length === 1 ? "" : "s"}` : "Degrees, diplomas, WASSCE";
    case "skills":
      return lists.skills.length ? `${lists.skills.length} skills` : "What you can do, in the words adverts use";
    case "certifications":
      return lists.certifications.length ? `${lists.certifications.length} listed` : "Optional — licences and certificates";
    case "projects":
      return lists.projects.length ? `${lists.projects.length} listed` : "Optional";
    case "languages":
      return lists.languages.length ? lists.languages.map((l) => l.name).join(", ") : "Optional";
    case "references":
      return { on_request: "Available on request", list: `${lists.references.items.length} referee(s)`, hide: "Left out" }[lists.references.mode];
    default:
      return "";
  }
};

const ResumeEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [resume, setResume] = useState(null);
  const [content, setContent] = useState(null);
  const contentRef = useRef(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [openSection, setOpenSection] = useState("personal");
  const [mobileView, setMobileView] = useState("edit");
  const [arranging, setArranging] = useState(false);
  const [stats, setStats] = useState({ pages: 1, words: 0 });

  const [downloading, setDownloading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  const [atsOpen, setAtsOpen] = useState(false);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState(null);
  const [atsError, setAtsError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const { status, queue, flush } = useAutosave(id, (saved) => {
    if (saved) setResume((current) => (current ? { ...current, updatedAt: saved.updatedAt } : current));
  });

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get(API_PATHS.RESUME_BUILDER.GET(id))
      .then((res) => {
        if (cancelled) return;
        const { content: loaded, ...meta } = res.data.resume;
        contentRef.current = loaded;
        setContent(loaded);
        setResume(meta);
        setAiEnabled(Boolean(res.data.aiEnabled));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.response?.data?.message || "Could not load this CV.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // --- Editing ----------------------------------------------------------------

  const updateContent = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(contentRef.current) : updater;
      contentRef.current = next;
      setContent(next);
      queue({ content: next });
    },
    [queue]
  );

  const setSlice = (key) => (value) => updateContent((current) => ({ ...current, [key]: value }));

  const updateMeta = (patch, delay) => {
    setResume((current) => ({ ...current, ...patch }));
    queue(patch, delay);
  };

  const moveSection = (index, step) =>
    updateContent((current) => {
      const order = [...current.sections];
      const target = index + step;
      if (target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, sections: order };
    });

  const assist = useCallback(async (kind, extra = {}) => {
    try {
      const current = contentRef.current;
      const res = await axiosInstance.post(
        API_PATHS.RESUME_BUILDER.ASSIST,
        { kind, content: current, targetRole: current.personal?.headline, ...extra },
        { timeout: 90000 }
      );
      return res.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Writing help is unavailable right now. Try again shortly.", { cause: error });
    }
  }, []);

  // --- Actions ------------------------------------------------------------------

  const notSaved = "Your latest changes have not saved yet. Check your connection, then try again.";

  const download = async () => {
    setDownloading(true);
    try {
      if (!(await flush())) throw new Error(notSaved);
      const name = await downloadResumePdf(id);
      toast.success(`Downloaded ${name}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  const runCheck = async () => {
    setAtsOpen(true);
    setAtsLoading(true);
    setAtsError("");
    try {
      if (!(await flush())) throw new Error(notSaved);
      const res = await axiosInstance.post(API_PATHS.RESUME_BUILDER.CHECK(id));
      setAtsResult(res.data);
    } catch (error) {
      setAtsResult(null);
      setAtsError(error.response?.data?.message || error.message || "Could not check this CV.");
    } finally {
      setAtsLoading(false);
    }
  };

  const fullReview = async () => {
    if (!atsResult?.text) return;
    setReviewing(true);
    const toastId = toast.loading("Running the full AI review…");
    try {
      await axiosInstance.post(
        API_PATHS.AI.ANALYZE_RESUME,
        { resumeText: atsResult.text, fileName: resume.title, targetRole: content.personal?.headline || "" },
        { timeout: 120000 }
      );
      toast.success("Your review is ready", { id: toastId });
      navigate("/resume-analyzer");
    } catch (error) {
      toast.error(error.response?.data?.message || "The AI review could not run. Try again shortly.", { id: toastId });
    } finally {
      setReviewing(false);
    }
  };

  const saveDocument = async ({ makePrimary }) => {
    setSavingDoc(true);
    try {
      if (!(await flush())) throw new Error(notSaved);
      const res = await axiosInstance.post(API_PATHS.RESUME_BUILDER.SAVE_DOCUMENT(id), { makePrimary });
      // The editor's own copy of the content stays as it is.
      const meta = { ...res.data.resume };
      delete meta.content;
      setResume((current) => ({ ...current, ...meta }));
      if (res.data.primaryResume !== undefined && res.data.primaryResume !== user?.resume) {
        updateUser({ resume: res.data.primaryResume });
      }
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Could not save this CV to your documents.");
      return false;
    } finally {
      setSavingDoc(false);
    }
  };

  // --- Render -------------------------------------------------------------------

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col bg-surface pt-24 text-on-surface">
        <Navbar />
        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 px-4 text-center">
          <span className="material-symbols-outlined text-[44px] text-text-muted" aria-hidden="true">
            description
          </span>
          <h1 className="font-headline-md font-bold text-text-primary">{loadError}</h1>
          <Link to="/resume-builder" className="rounded-xl bg-primary px-4 py-2.5 font-label-md font-bold text-on-primary">
            Back to your CVs
          </Link>
        </div>
      </div>
    );
  }

  if (!resume || !content) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface">
        <Navbar />
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const lists = printable(content);
  const { pages, words } = stats;
  const toggle = (key) => setOpenSection((current) => (current === key ? null : key));

  const editors = {
    summary: <SummaryEditor value={content.summary} onChange={setSlice("summary")} onAssist={() => assist("summary")} aiEnabled={aiEnabled} />,
    experience: (
      <ExperienceEditor
        items={content.experience}
        onChange={setSlice("experience")}
        onAssist={(index, notes) => assist("bullets", { index, notes })}
        aiEnabled={aiEnabled}
      />
    ),
    education: <EducationEditor items={content.education} onChange={setSlice("education")} />,
    skills: <SkillsEditor skills={content.skills} onChange={setSlice("skills")} onAssist={() => assist("skills")} aiEnabled={aiEnabled} />,
    certifications: <CertificationsEditor items={content.certifications} onChange={setSlice("certifications")} />,
    projects: <ProjectsEditor items={content.projects} onChange={setSlice("projects")} />,
    languages: <LanguagesEditor items={content.languages} onChange={setSlice("languages")} />,
    references: <ReferencesEditor references={content.references} onChange={setSlice("references")} />,
  };

  const doneBadge = (done) =>
    done ? (
      <span className="material-symbols-outlined text-[18px] text-emerald-600" aria-label="Has content">
        check_circle
      </span>
    ) : null;

  const personal = content.personal || {};

  return (
    <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
      <Navbar />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-margin-mobile pb-space-xl md:px-margin">
        {/* ============ TOOLBAR ============ */}
        <div className="flex flex-col gap-3 border-b border-border-default py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/resume-builder"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-container hover:text-primary"
              title="All your CVs"
              aria-label="Back to all your CVs"
            >
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                arrow_back
              </span>
            </Link>
            <div className="min-w-0 flex-1">
              <input
                value={resume.title}
                onChange={(event) => updateMeta({ title: event.target.value.slice(0, 80) })}
                onBlur={() => !resume.title.trim() && updateMeta({ title: "My CV" }, 0)}
                aria-label="CV name"
                className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 font-headline-md font-bold text-text-primary outline-none hover:border-border-default focus:border-primary focus:bg-surface-card"
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5">
                <SaveStatus status={status} savedAt={resume.updatedAt} onRetry={flush} />
                {resume.document && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      folder_open
                    </span>
                    {resume.isPrimary ? "Your primary CV" : "In your documents"}
                    {resume.savedAt && moment(resume.updatedAt).isAfter(moment(resume.savedAt).add(5, "seconds")) && (
                      <span className="text-amber-700 dark:text-amber-300">· changed since saved</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runCheck}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-card px-3.5 py-2 font-label-md font-bold text-text-primary transition-colors hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                fact_check
              </span>
              ATS check
            </button>
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-card px-3.5 py-2 font-label-md font-bold text-text-primary transition-colors hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {resume.document ? "sync" : "drive_folder_upload"}
              </span>
              {resume.document ? "Update saved copy" : "Save to documents"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3d197f] to-[#6b35c6] px-4 py-2 font-label-md font-bold text-white shadow-[0_5px_12px_rgba(72,35,154,0.28)] transition-all hover:brightness-110 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${downloading ? "animate-spin" : ""}`} aria-hidden="true">
                {downloading ? "progress_activity" : "download"}
              </span>
              Download PDF
            </button>
          </div>
        </div>

        {/* Small screens edit and preview one at a time. */}
        <div className="mt-4 flex w-full items-center gap-1 rounded-xl bg-surface-container p-1 lg:hidden">
          {[
            { id: "edit", label: "Edit", icon: "edit" },
            { id: "preview", label: "Preview", icon: "visibility" },
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setMobileView(view.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-label-md font-bold transition-colors ${
                mobileView === view.id ? "bg-surface-card text-primary shadow-xs" : "text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                {view.icon}
              </span>
              {view.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
          {/* ============ EDITOR ============ */}
          <div className={`flex flex-col gap-3 lg:col-span-6 xl:col-span-5 ${mobileView === "preview" ? "hidden lg:flex" : ""}`}>
            <SectionCard
              id="section-personal"
              icon="badge"
              title="Personal details"
              subtitle={[personal.fullName, personal.email, personal.phone].filter(Boolean).join(" · ") || "Name and how to reach you"}
              open={openSection === "personal"}
              onToggle={() => toggle("personal")}
              badge={doneBadge(personal.fullName && personal.email && personal.phone)}
            >
              <PersonalEditor personal={personal} onChange={setSlice("personal")} />
            </SectionCard>

            {content.sections.map((key) => (
              <SectionCard
                key={key}
                id={`section-${key}`}
                icon={SECTIONS[key].icon}
                title={SECTIONS[key].label}
                subtitle={sectionSubtitle(key, content, lists)}
                open={openSection === key}
                onToggle={() => toggle(key)}
                badge={doneBadge(key !== "references" && hasSection(content, key, lists))}
              >
                {editors[key]}
              </SectionCard>
            ))}
          </div>

          {/* ============ PREVIEW ============ */}
          <div className={`lg:sticky lg:top-24 lg:col-span-6 xl:col-span-7 ${mobileView === "edit" ? "hidden lg:block" : ""}`}>
            <div className="flex flex-col gap-3 rounded-3xl border border-border-default bg-surface-card p-4 shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-xl bg-surface-container p-1" role="radiogroup" aria-label="Template">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      role="radio"
                      aria-checked={resume.template === template.id}
                      title={template.description}
                      onClick={() => updateMeta({ template: template.id }, 0)}
                      className={`rounded-lg px-3 py-1.5 font-label-md font-bold transition-colors ${
                        resume.template === template.id ? "bg-surface-card text-primary shadow-xs" : "text-text-secondary hover:text-on-surface"
                      }`}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Accent colour">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      type="button"
                      role="radio"
                      aria-checked={resume.accent === accent.id}
                      aria-label={accent.label}
                      title={accent.label}
                      onClick={() => updateMeta({ accent: accent.id }, 0)}
                      className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-surface-card transition-transform hover:scale-110 ${
                        resume.accent === accent.id ? "ring-2 ring-text-primary" : ""
                      }`}
                      style={{ background: accent.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-text-muted">
                <span>
                  {pages === 1 ? "Fits on 1 page" : `About ${pages} pages`} · {words} words
                  {words < 300 && words > 0 ? " — add more; 400–800 is typical" : ""}
                  {pages > 2 ? " — aim for two pages at most" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setArranging((value) => !value)}
                  aria-expanded={arranging}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-primary hover:bg-brand-indigo-light"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    swap_vert
                  </span>
                  Arrange sections
                </button>
              </div>

              {arranging && (
                <ol className="flex flex-col gap-1 rounded-2xl border border-border-default bg-surface-container-low p-2">
                  {content.sections.map((key, index) => (
                    <li key={key} className="flex items-center gap-2 rounded-xl bg-surface-card px-2.5 py-1.5">
                      <span className="material-symbols-outlined text-[18px] text-text-muted" aria-hidden="true">
                        {SECTIONS[key].icon}
                      </span>
                      <span className={`flex-1 text-[12px] font-semibold ${hasSection(content, key, lists) ? "text-text-primary" : "text-text-muted"}`}>
                        {SECTIONS[key].label}
                        {!hasSection(content, key, lists) && <span className="font-normal"> — empty, not printed</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveSection(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${SECTIONS[key].label} up`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface-container hover:text-primary disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                          arrow_upward
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(index, 1)}
                        disabled={index === content.sections.length - 1}
                        aria-label={`Move ${SECTIONS[key].label} down`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-surface-container hover:text-primary disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
                          arrow_downward
                        </span>
                      </button>
                    </li>
                  ))}
                  <li className="px-2 pt-1 text-[11px] leading-4 text-text-muted">
                    Recent graduates often put Education first; everyone else leads with Work Experience.
                  </li>
                </ol>
              )}

              <div className="max-h-none overflow-y-auto rounded-xl bg-surface-container-low p-3 sm:p-5 lg:max-h-[calc(100vh-15rem)]">
                {/* Remounted when the mobile tab changes, so it measures itself
                    once it is actually on screen. */}
                <ResumePreview key={mobileView} content={content} template={resume.template} accent={resume.accent} onStats={setStats} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <AtsCheckDrawer
        open={atsOpen}
        onClose={() => setAtsOpen(false)}
        loading={atsLoading}
        result={atsResult}
        error={atsError}
        onRetry={runCheck}
        onFullReview={fullReview}
        reviewing={reviewing}
        aiEnabled={aiEnabled}
      />

      <SaveToDocumentsDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={saveDocument}
        saving={savingDoc}
        resume={resume}
        hasPrimary={Boolean(user?.resume)}
      />
    </div>
  );
};

export default ResumeEditor;
