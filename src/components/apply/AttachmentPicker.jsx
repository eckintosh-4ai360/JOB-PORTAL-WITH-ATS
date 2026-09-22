import { emptyAttachment } from "../../hooks/useSavedAttachments";

/**
 * Attach a file to an application — either one already on the applicant's
 * profile or a fresh upload.
 *
 * Someone who has uploaded a CV once should not be asked for it again on every
 * job, so saved files are offered first and the newest is pre-selected. With
 * nothing saved (a guest, or a first application) this renders as the plain
 * file input it always was.
 */
const AttachmentPicker = ({
  label,
  options = [],
  value,
  onChange,
  accept = ".pdf,.docx,.doc",
  required = false,
  uploadHint = "PDF, DOC or DOCX",
}) => {
  const current = value || emptyAttachment;
  const hasSaved = options.length > 0;

  const choose = (option) =>
    onChange({ source: "saved", file: null, url: option.url, name: option.name });

  const chooseUpload = () => onChange(emptyAttachment);

  return (
    <div className="flex flex-col gap-2">
      <label className="font-label-caps uppercase text-text-muted">
        {label} {required && "*"}
      </label>

      {hasSaved && (
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const isActive = current.source === "saved" && current.url === option.url;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={isActive}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-brand-indigo-light"
                    : "border-border-default bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] shrink-0 ${
                    isActive ? "text-primary" : "text-text-muted"
                  }`}
                >
                  {isActive ? "check_circle" : "description"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label-md font-semibold text-on-surface">
                    {option.name}
                  </span>
                  {option.hint && (
                    <span className="block font-body-sm text-text-secondary">{option.hint}</span>
                  )}
                </span>
                {isActive && (
                  <span className="shrink-0 font-label-sm font-bold text-primary">Using this</span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={chooseUpload}
            aria-pressed={current.source === "upload"}
            className={`flex items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors ${
              current.source === "upload"
                ? "border-primary bg-brand-indigo-light"
                : "border-border-default bg-surface-container-low hover:bg-surface-container"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] shrink-0 ${
                current.source === "upload" ? "text-primary" : "text-text-muted"
              }`}
            >
              upload_file
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-label-md font-semibold text-on-surface">
                Upload a different file
              </span>
              <span className="block font-body-sm text-text-secondary">{uploadHint}</span>
            </span>
          </button>
        </div>
      )}

      {(!hasSaved || current.source === "upload") && (
        <input
          type="file"
          accept={accept}
          // Required only when there is nothing saved to fall back on —
          // otherwise the browser would block a perfectly valid application
          // that reuses a stored file.
          required={required && !hasSaved}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange({ source: "upload", file, url: "", name: file?.name || "" });
          }}
          className="font-body-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-indigo-light file:text-primary hover:file:bg-brand-indigo-subtle cursor-pointer"
        />
      )}
    </div>
  );
};

export default AttachmentPicker;
