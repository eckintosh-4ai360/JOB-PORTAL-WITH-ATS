import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, Loader2, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import { REPORT_FORMATS, downloadReport } from "../../utils/reportDownload";

const FORMAT_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, csv: FileDown };

/**
 * "Export" with a choice of PDF, Excel or CSV, for any report the API builds
 * (services/reportService). `params` are the report's filters.
 */
const ExportMenu = ({ type, params = {}, label = "Export", disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const run = async (format) => {
    setOpen(false);
    setBusy(format);
    try {
      const filename = await downloadReport(type, format, params);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || Boolean(busy)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Preparing…" : label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-gray-100 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {REPORT_FORMATS.map((format) => {
            const Icon = FORMAT_ICONS[format.id] || FileDown;
            return (
              <button
                key={format.id}
                type="button"
                role="menuitem"
                onClick={() => run(format.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                {format.label}
                <span className="ml-auto text-xs text-gray-400">.{format.id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
