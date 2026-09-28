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

/**
 * Experience level. The values are the keys the backend stores on a posting and
 * the Find Jobs rail filters on, so a level an employer picks here is the exact
 * value a candidate's filter matches. Empty means "read it from the advert" —
 * the wording-based guess that was the only source before employers could say.
 */
export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "", label: "Detect from the advert" },
  { value: "intern", label: "Intern / Trainee" },
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
  { value: "executive", label: "Executive" },
];

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
