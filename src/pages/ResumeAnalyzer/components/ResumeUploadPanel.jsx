import { useRef, useState } from "react";

/**
 * Resume input panel.
 *
 * Four ways in, because the friction of getting a CV into the tool is what
 * actually stops people using it: upload a file, use the resume already on the
 * profile, pick a saved document, or paste text (the escape hatch when a file
 * will not parse).
 */
const ResumeUploadPanel = ({
  onAnalyze,
  isAnalyzing,
  isAuthenticated,
  savedResumeUrl,
  documents = [],
  targetRole,
  onTargetRoleChange,
  activeFileName,
}) => {
  const [mode, setMode] = useState("upload");
  const [pastedText, setPastedText] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const resumeDocuments = documents.filter(
    (doc) => doc.category === "Resume" || /\.(pdf|docx?|txt)$/i.test(doc.name || "")
  );

  const submitFile = (file) => {
    if (!file) return;
    onAnalyze({ file });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    submitFile(event.dataTransfer.files?.[0]);
  };

  const tabs = [
    { id: "upload", label: "Upload file", icon: "upload_file" },
    { id: "paste", label: "Paste text", icon: "content_paste" },
    ...(isAuthenticated && savedResumeUrl
      ? [{ id: "saved", label: "My resume", icon: "folder_shared" }]
      : []),
    ...(isAuthenticated && resumeDocuments.length > 0
      ? [{ id: "document", label: "My documents", icon: "description" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-space-md rounded-3xl border border-border-default bg-surface-card p-space-md shadow-[0_16px_34px_rgba(40,34,86,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div>
          <h2 className="font-headline-sm font-bold text-text-primary">Analyse your resume</h2>
          <p className="font-body-sm text-text-muted">
            PDF, DOCX, or plain text. We read the text, not the design.
          </p>
        </div>
        {activeFileName && (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-surface-container px-2.5 py-1 font-label-md text-text-secondary">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              description
            </span>
            <span className="truncate">{activeFileName}</span>
          </span>
        )}
      </div>

      {/* Source tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-container p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            disabled={isAnalyzing}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-label-md font-bold transition-colors disabled:opacity-60 ${
              mode === tab.id
                ? "bg-surface-card text-primary shadow-xs"
                : "text-text-secondary hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Target role sharpens missing-skill and keyword analysis. */}
      <label className="flex flex-col gap-1">
        <span className="font-label-md font-bold text-text-secondary">
          Role you are targeting{" "}
          <span className="font-normal text-text-muted">(optional, but improves the analysis)</span>
        </span>
        <input
          type="text"
          value={targetRole}
          onChange={(event) => onTargetRoleChange(event.target.value)}
          placeholder="e.g. Retail Sales Supervisor, Frontend Developer, Staff Nurse"
          disabled={isAnalyzing}
          className="rounded-xl border border-border-default bg-surface-container-low px-3 py-2.5 font-body-md text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-60"
        />
      </label>

      {mode === "upload" && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-space-lg text-center transition-colors ${
            dragActive
              ? "border-primary bg-brand-indigo-light"
              : "border-border-default bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[36px] text-primary" aria-hidden="true">
            cloud_upload
          </span>
          <p className="font-body-md font-semibold text-text-primary">
            Drop your CV here, or choose a file
          </p>
          <p className="font-body-sm text-text-muted">PDF, DOC, DOCX or TXT · up to 12MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(event) => submitFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="mt-1 rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:opacity-60"
          >
            {isAnalyzing ? "Analysing…" : "Choose file"}
          </button>
        </div>
      )}

      {mode === "paste" && (
        <div className="flex flex-col gap-space-sm">
          <textarea
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={9}
            placeholder="Paste the full text of your resume here…"
            disabled={isAnalyzing}
            className="resize-y rounded-xl border border-border-default bg-surface-container-low p-3 font-body-sm text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-space-sm">
            <span className="font-body-sm text-text-muted">
              {pastedText.trim() ? `${pastedText.trim().split(/\s+/).length} words` : "At least 40 words"}
            </span>
            <button
              type="button"
              onClick={() => onAnalyze({ resumeText: pastedText })}
              disabled={isAnalyzing || pastedText.trim().split(/\s+/).length < 40}
              className="rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? "Analysing…" : "Analyse text"}
            </button>
          </div>
        </div>
      )}

      {mode === "saved" && (
        <div className="flex flex-col gap-space-sm rounded-2xl border border-border-default bg-surface-container-low p-space-md">
          <p className="font-body-md text-text-secondary">
            Analyse the resume already attached to your profile.
          </p>
          <button
            type="button"
            onClick={() => onAnalyze({ useSavedResume: true })}
            disabled={isAnalyzing}
            className="self-start rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:opacity-60"
          >
            {isAnalyzing ? "Analysing…" : "Analyse my saved resume"}
          </button>
        </div>
      )}

      {mode === "document" && (
        <div className="flex flex-col gap-space-sm rounded-2xl border border-border-default bg-surface-container-low p-space-md">
          <select
            value={selectedDocId}
            onChange={(event) => setSelectedDocId(event.target.value)}
            disabled={isAnalyzing}
            className="rounded-xl border border-border-default bg-surface-card px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary disabled:opacity-60"
          >
            <option value="">Choose a document…</option>
            {resumeDocuments.map((doc) => (
              <option key={doc._id || doc.id} value={doc._id || doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAnalyze({ documentId: selectedDocId })}
            disabled={isAnalyzing || !selectedDocId}
            className="self-start rounded-xl bg-primary px-space-md py-2.5 font-label-md font-bold text-on-primary transition-colors hover:bg-brand-indigo-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? "Analysing…" : "Analyse document"}
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <p className="flex items-start gap-1.5 rounded-xl bg-brand-indigo-light p-space-sm font-body-sm text-primary">
          <span className="material-symbols-outlined text-[17px] shrink-0" aria-hidden="true">
            info
          </span>
          <span>
            You can analyse a resume without an account — nothing is saved. Sign in to store your
            results, track your score over time, and see matched jobs.
          </span>
        </p>
      )}
    </div>
  );
};

export default ResumeUploadPanel;
