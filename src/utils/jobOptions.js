/**
 * Choices shared by the job posting form and the job template editor, so a
 * template always holds values the posting form can show.
 */

export const DEPARTMENT_OPTIONS = [
  "Business & Professional Services",
  "Technology & Engineering",
  "Healthcare & Social Care",
  "Education & Training",
  "Sales, Marketing & Customer Service",
  "Finance, Legal & Administration",
  "Construction, Manufacturing & Trades",
  "Hospitality, Retail & Tourism",
  "Transport, Logistics & Supply Chain",
  "Government, Nonprofit & Community",
  "Creative & Media",
  "Other",
];

export const JOB_TYPE_OPTIONS = ["Full-Time", "Part-Time", "Contract", "Internship", "Temporary"];

export const WORK_MODEL_OPTIONS = ["Hybrid", "On-site", "Remote"];

/** "GH₵ 4,000 – 6,000", or "" when no pay is set. */
export const formatSalaryRange = (min, max) => {
  const format = (value) => Number(value).toLocaleString("en-GB");
  const hasMin = Number(min) > 0;
  const hasMax = Number(max) > 0;
  if (hasMin && hasMax) return `GH₵ ${format(min)} – ${format(max)}`;
  if (hasMin) return `From GH₵ ${format(min)}`;
  if (hasMax) return `Up to GH₵ ${format(max)}`;
  return "";
};
