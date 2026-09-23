import { Copy, FileText, Files, Mail, AtSign, Phone, User, Briefcase, AlertTriangle } from "lucide-react";

/**
 * The icon for each kind of duplicate evidence the API reports
 * (services/duplicateDetectionService). Shared by every page that shows it.
 */
export const EVIDENCE_ICONS = {
  same_file: FileText,
  same_text: Copy,
  similar_text: Files,
  same_inbox: Mail,
  shared_email: AtSign,
  shared_phone: Phone,
  same_name: User,
  similar_name: User,
  same_job: Briefcase,
  names_differ: AlertTriangle,
  shared_contact_note: AlertTriangle,
};

/** For a kind of evidence added to the API before an icon was chosen for it. */
export const FALLBACK_EVIDENCE_ICON = AlertTriangle;

/**
 * One line per kind of evidence across a group's pairs, so a group of five —
 * ten pairs — reads as a few lines instead of forty. `pairCount` says how many
 * pairs it holds for; the detail is kept only when it describes a single pair,
 * since "Kwame and Ama" would mislead as a summary of several.
 */
export const summarizeEvidence = (pairs) => {
  const byCode = new Map();
  for (const pair of pairs) {
    for (const item of pair.evidence) {
      const entry = byCode.get(item.code);
      if (entry) entry.pairCount += 1;
      else byCode.set(item.code, { ...item, pairCount: 1 });
    }
  }
  return [...byCode.values()].map((entry) => ({
    ...entry,
    detail: entry.pairCount === 1 || pairs.length === 1 ? entry.detail : "",
    scope: pairs.length > 1 ? `${entry.pairCount} of ${pairs.length} pairs` : "",
  }));
};
