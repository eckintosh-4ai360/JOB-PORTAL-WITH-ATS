import axiosInstance from "./axiosInstance";
import { API_PATHS } from "./apiPath";

/**
 * Shared pieces of the CV builder. The CV's shape is defined on the API in
 * backend/utils/resumeContent.js, and the PDF layout in
 * backend/services/resumePdfService.js — the preview mirrors both.
 */

export const TEMPLATES = [
  { id: "modern", label: "Modern", description: "Coloured name and headings, clean sans-serif" },
  { id: "classic", label: "Classic", description: "Centred serif header, traditional and formal" },
  { id: "compact", label: "Compact", description: "Tighter spacing to fit more on a page" },
];

export const ACCENTS = [
  { id: "indigo", label: "Indigo", hex: "#3730A3" },
  { id: "teal", label: "Teal", hex: "#0F766E" },
  { id: "navy", label: "Navy", hex: "#1E3A8A" },
  { id: "burgundy", label: "Burgundy", hex: "#9F1239" },
  { id: "forest", label: "Forest", hex: "#166534" },
  { id: "slate", label: "Slate", hex: "#334155" },
];

export const accentHex = (id) => (ACCENTS.find((accent) => accent.id === id) || ACCENTS[0]).hex;

export const SECTIONS = {
  summary: { label: "Professional summary", heading: "Professional Summary", icon: "notes" },
  experience: { label: "Work experience", heading: "Work Experience", icon: "work" },
  education: { label: "Education", heading: "Education", icon: "school" },
  skills: { label: "Skills", heading: "Skills", icon: "psychology" },
  certifications: { label: "Certifications", heading: "Certifications", icon: "verified" },
  projects: { label: "Projects", heading: "Projects", icon: "rocket_launch" },
  languages: { label: "Languages", heading: "Languages", icon: "translate" },
  references: { label: "References", heading: "References", icon: "contacts" },
};

export const LANGUAGE_LEVELS = ["Native", "Fluent", "Professional", "Conversational", "Basic"];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const newId = () => Math.random().toString(36).slice(2, 12);

/** Blank rows for each list section, as "Add" creates them. */
export const blankEntry = {
  experience: () => ({ id: newId(), title: "", employer: "", location: "", start: "", end: "", current: false, bullets: [""] }),
  education: () => ({ id: newId(), qualification: "", institution: "", location: "", start: "", end: "", details: "" }),
  certifications: () => ({ id: newId(), name: "", issuer: "", year: "" }),
  projects: () => ({ id: newId(), name: "", link: "", description: "" }),
  languages: () => ({ id: newId(), name: "", level: "" }),
  references: () => ({ id: newId(), name: "", position: "", organisation: "", email: "", phone: "" }),
};

export const formatDate = (value) => {
  const [year, month] = String(value || "").split("-");
  if (!year) return "";
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
};

export const formatRange = (start, end, current = false) => {
  const from = formatDate(start);
  const to = current ? "Present" : formatDate(end);
  if (from && to) return `${from} – ${to}`;
  return from ? (current ? `${from} – Present` : from) : to;
};

/** Same rule as the PDF: keep whatever makes the text read as a link. */
export const displayUrl = (value) => {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!url) return "";
  const bare = url.replace(/^https?:\/\//i, "");
  if (/^(?:www\.)?(?:linkedin|github)\.com\//i.test(bare)) return bare.replace(/^www\./i, "");
  if (/^www\./i.test(bare)) return bare;
  return /^https?:\/\//i.test(url) ? url : `https://${bare}`;
};

// The PDF's standard fonts lack a few letters used in Ghanaian names and the
// cedi sign, so it prints these instead (see resumePdfService.js).
const PDF_FALLBACK = { "Ɛ": "E", "ɛ": "e", "Ɔ": "O", "ɔ": "o", "Ŋ": "N", "ŋ": "n" };
const PDF_FALLBACK_RE = /[ƐɛƆɔŊŋ]/g;

export const hasPdfFallback = (value) => /[ƐɛƆɔŊŋ₵]/.test(String(value || ""));

/** A string as the PDF will print it. */
export const asPrinted = (value) =>
  String(value ?? "").replace(/GH₵/g, "GHS").replace(/₵/g, "GHS").replace(PDF_FALLBACK_RE, (ch) => PDF_FALLBACK[ch]);

/** Every string in the CV as the PDF will print it. */
export const printedContent = (value) => {
  if (typeof value === "string") return asPrinted(value);
  if (Array.isArray(value)) return value.map(printedContent);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, printedContent(item)]));
  }
  return value;
};

/** Entries the PDF would print — the same filter the API applies. */
export const printable = (content) => ({
  experience: (content.experience || [])
    .filter((e) => e.title || e.employer || e.bullets?.some((b) => b.trim()))
    .map((e) => ({ ...e, bullets: (e.bullets || []).map((b) => b.trim()).filter(Boolean) })),
  education: (content.education || []).filter((e) => e.qualification || e.institution),
  skills: (content.skills || []).filter(Boolean),
  certifications: (content.certifications || []).filter((e) => e.name),
  projects: (content.projects || []).filter((e) => e.name),
  languages: (content.languages || []).filter((e) => e.name),
  references: {
    mode: content.references?.mode || "on_request",
    items: (content.references?.items || []).filter((e) => e.name),
  },
});

export const hasSection = (content, key, lists = printable(content)) => {
  if (key === "summary") return Boolean(content.summary?.trim());
  if (key === "references") return lists.references.mode !== "hide";
  return lists[key]?.length > 0;
};

const FILENAME = /filename="?([^";]+)"?/i;

/** An error response downloaded as a Blob still carries the API's message. */
const messageFrom = async (error) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || null;
    } catch {
      return null;
    }
  }
  return data?.message || null;
};

/** Download the CV's PDF under the name the API gives it. */
export const downloadResumePdf = async (id) => {
  try {
    const res = await axiosInstance.get(API_PATHS.RESUME_BUILDER.PDF(id), { responseType: "blob" });
    const filename = (res.headers["content-disposition"] || "").match(FILENAME)?.[1] || "CV.pdf";
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  } catch (error) {
    throw new Error((await messageFrom(error)) || "Could not create the PDF.", { cause: error });
  }
};
