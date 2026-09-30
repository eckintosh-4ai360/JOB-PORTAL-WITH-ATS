import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import moment from "moment";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { TEMPLATES, downloadResumePdf } from "../../utils/resumeBuilder";
import ResumePreview from "./components/ResumePreview";

/**
 * The candidate's CVs, and where a new one is started. A CV can begin from
 * what the platform already knows — the latest resume analysis and the
 * matching profile — so nobody retypes a CV they have already uploaded.
 */

const templateLabel = (id) => TEMPLATES.find((template) => template.id === id)?.label || "Modern";

const ResumeCard = ({ resume, onDuplicate, onDelete, busy }) => {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadResumePdf(resume.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border-default bg-surface-card shadow-[0_12px_28px_rgba(40,34,86,0.07)] transition-shadow hover:shadow-[0_18px_40px_rgba(40,34,86,0.13)]">
      <Link
        to={`/resume-builder/${resume.id}`}
        className="relative block h-64 overflow-hidden bg-surface-container-low px-8 pt-6"
        aria-label={`Edit ${resume.title}`}
      >
        <div className="pointer-events-none" aria-hidden="true">
          <ResumePreview content={resume.content} template={resume.template} accent={resume.accent} showPageBreaks={false} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-card to-transparent" />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <Link to={`/resume-builder/${resume.id}`} className="block truncate font-headline-sm font-bold text-text-primary hover:text-primary">
            {resume.title}
          </Link>
          <p className="text-[11px] text-text-muted">
            {templateLabel(resume.template)} · edited {moment(resume.updatedAt).fromNow()}
          </p>
          {resume.document && (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                resume.isPrimary
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-surface-container text-text-secondary"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                {resume.isPrimary ? "star" : "folder_open"}
              </span>
              {resume.isPrimary ? "Primary CV" : "In your documents"}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1.5">
          <Link
            to={`/resume-builder/${resume.id}`}
            className="flex-1 rounded-xl bg-primary px-3 py-2 text-center font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            title="Download PDF"
            aria-label={`Download ${resume.title} as PDF`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-default text-text-secondary hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[19px] ${downloading ? "animate-spin" : ""}`} aria-hidden="true">
              {downloading ? "progress_activity" : "download"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(resume)}
            disabled={busy}
            title="Make a copy — for a version tailored to one job"
            aria-label={`Copy ${resume.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-default text-text-secondary hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
              content_copy
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(resume)}
            disabled={busy}
            title="Delete"
            aria-label={`Delete ${resume.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-default text-text-secondary hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
              delete
            </span>
          </button>
        </div>
      </div>
    </article>
  );
};

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [meta, setMeta] = useState({ limit: 20, latestAnalysis: null, aiEnabled: false });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    axiosInstance
      .get(API_PATHS.RESUME_BUILDER.LIST)
      .then((res) => {
        setResumes(res.data.resumes || []);
        setMeta({ limit: res.data.limit, latestAnalysis: res.data.latestAnalysis, aiEnabled: res.data.aiEnabled });
      })
      .catch((error) => toast.error(error.response?.data?.message || "Could not load your CVs"))
      .finally(() => setLoading(false));
  }, []);

  const create = async (source) => {
    setCreating(source);
    try {
      const res = await axiosInstance.post(API_PATHS.RESUME_BUILDER.CREATE, { source });
      navigate(`/resume-builder/${res.data.resume.id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not start a new CV");
      setCreating("");
    }
  };

  const duplicate = async (resume) => {
    setBusyId(resume.id);
    try {
      const res = await axiosInstance.post(API_PATHS.RESUME_BUILDER.DUPLICATE(resume.id));
      setResumes((current) => [res.data.resume, ...current]);
      toast.success("Copy made — rename it for the job you are tailoring it to");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not copy this CV");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (resume) => {
    const note = resume.document ? "\n\nThe PDF saved in your documents will stay there." : "";
    if (!window.confirm(`Delete “${resume.title}”? This cannot be undone.${note}`)) return;
    setBusyId(resume.id);
    try {
      await axiosInstance.delete(API_PATHS.RESUME_BUILDER.DELETE(resume.id));
      setResumes((current) => current.filter((item) => item.id !== resume.id));
      toast.success("CV deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete this CV");
    } finally {
      setBusyId("");
    }
  };

  const atLimit = resumes.length >= meta.limit;
  const analysis = meta.latestAnalysis;

  return (
    <div className="flex min-h-screen flex-col bg-surface pt-20 text-on-surface">
      <Navbar />

      <main className="w-full flex-1 pb-space-xl">
        {/* ================= HERO ================= */}
        <section className="w-full border-b border-border-default bg-surface py-space-lg">
          <div className="mx-auto max-w-[1280px] px-margin-mobile md:px-margin">
            <nav className="mb-space-sm flex items-center gap-space-xs font-label-md text-text-muted">
              <Link to="/" className="transition-colors hover:text-primary">
                Home
              </Link>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                chevron_right
              </span>
              <span className="font-bold text-primary">CV Builder</span>
            </nav>

            <h1 className="font-headline-xl text-headline-xl tracking-tight text-text-primary">
              Build a CV{" "}
              <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                employers can read
              </span>
            </h1>
            <p className="mt-space-sm max-w-3xl font-body-lg text-body-lg leading-relaxed text-text-secondary">
              Fill in your details once and get a clean, professional PDF. Every template is laid out the way applicant
              tracking systems parse — and you can check yours against the same ATS rules our Resume Analyzer uses.
            </p>

            <div className="grid grid-cols-1 gap-space-md pt-space-md sm:grid-cols-3">
              {[
                { icon: "description", tone: "text-primary bg-brand-indigo-light", metric: "3 templates", label: "All single-column, ATS-safe" },
                { icon: "auto_awesome", tone: "text-[#7c3aed] bg-[#f3e8ff] dark:bg-[#7c3aed]/15", metric: "AI writing help", label: "Summary, bullets and skills" },
                { icon: "fact_check", tone: "text-salary-emerald bg-salary-surface", metric: "ATS check", label: "Run on the PDF itself" },
              ].map((stat) => (
                <div key={stat.metric} className="flex items-center gap-space-sm rounded-2xl border border-border-default bg-surface-card p-3 shadow-xs">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                    <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                      {stat.icon}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-numeric-metric text-text-primary">{stat.metric}</span>
                    <span className="text-[11px] text-text-muted">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-margin-mobile pt-space-lg md:px-margin">
          {/* ================= START ================= */}
          <div className="rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)] md:p-space-lg">
            <h2 className="font-headline-md font-bold text-text-primary">Start a new CV</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              {atLimit
                ? `You have ${meta.limit} CVs, the most you can keep. Delete one you no longer use to start another.`
                : "Pick a starting point. You can change everything, and switch templates at any time."}
            </p>

            <div className="mt-space-md grid grid-cols-1 gap-space-md md:grid-cols-2">
              <button
                type="button"
                onClick={() => create("profile")}
                disabled={Boolean(creating) || atLimit}
                className="group flex items-start gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-brand-indigo-light/80 to-surface-card p-4 text-left transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <span className={`material-symbols-outlined text-[22px] ${creating === "profile" ? "animate-spin" : ""}`} aria-hidden="true">
                    {creating === "profile" ? "progress_activity" : "bolt"}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-headline-sm font-bold text-text-primary">
                    {analysis ? "Start from my analysed CV" : "Start from my profile"}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-text-secondary">
                    {analysis
                      ? `Fills in your roles, education and skills from ${analysis.fileName || "your CV"}, analysed ${moment(analysis.createdAt).fromNow()}. Check each section — the analysis keeps the key points of each role, not every line.`
                      : "Fills in your name, email and anything on your matching profile."}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => create("blank")}
                disabled={Boolean(creating) || atLimit}
                className="group flex items-start gap-3 rounded-2xl border-2 border-border-default p-4 text-left transition-all hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container text-text-secondary group-hover:text-primary">
                  <span className={`material-symbols-outlined text-[22px] ${creating === "blank" ? "animate-spin" : ""}`} aria-hidden="true">
                    {creating === "blank" ? "progress_activity" : "note_add"}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-headline-sm font-bold text-text-primary">Start from scratch</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-text-secondary">
                    A blank CV with just your name and email filled in.
                  </span>
                </span>
              </button>
            </div>

            {!analysis && !loading && (
              <p className="mt-space-md flex items-start gap-1.5 text-[12px] leading-5 text-text-muted">
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                  lightbulb
                </span>
                <span>
                  Already have a CV file?{" "}
                  <Link to="/resume-analyzer" className="font-bold text-primary hover:underline">
                    Analyse it first
                  </Link>{" "}
                  and your roles, education and skills will be filled in here for you.
                </span>
              </p>
            )}
          </div>

          {/* ================= YOUR CVs ================= */}
          <div className="mt-space-xl flex items-baseline justify-between gap-3">
            <h2 className="font-headline-md font-bold text-text-primary">Your CVs</h2>
            {resumes.length > 0 && (
              <span className="text-[12px] text-text-muted">
                {resumes.length} of {meta.limit}
              </span>
            )}
          </div>

          {loading ? (
            <div className="mt-space-md grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-[380px] animate-pulse rounded-3xl bg-surface-container" />
              ))}
            </div>
          ) : resumes.length === 0 ? (
            <div className="mt-space-md rounded-3xl border border-dashed border-border-default bg-surface-card p-space-xl text-center">
              <span className="material-symbols-outlined text-[44px] text-text-muted" aria-hidden="true">
                article
              </span>
              <h3 className="mt-2 font-headline-sm font-bold text-text-primary">No CVs yet</h3>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-text-muted">
                Start one above. You can keep several — say, one tailored to each kind of role you apply for.
              </p>
            </div>
          ) : (
            <div className="mt-space-md grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
              {resumes.map((resume) => (
                <ResumeCard key={resume.id} resume={resume} onDuplicate={duplicate} onDelete={remove} busy={busyId === resume.id} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ResumeBuilder;
