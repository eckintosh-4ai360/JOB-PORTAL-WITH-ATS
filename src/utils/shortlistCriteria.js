/**
 * Assisted shortlisting criteria as the Shortlisting screen edits them, and
 * the shape the API checks (services/shortlistService.validateCriteria).
 *
 * Each criterion can be switched off without losing its value, so an
 * employer can try "without the assessment" and back again.
 */

export const DEFAULT_CRITERIA = {
  useFit: true,
  minFit: 70,
  useRecommendation: false,
  recommendations: ["shortlist", "interview"],
  coreSkills: false,
  meetsExperience: false,
  useAssessment: false,
  minAssessment: 60,
  // { [questionId]: { equals } | { min, max } | { anyOf } }
  screening: {},
  // How many of the suggestions to tick for adding.
  topN: 10,
};

export const RECOMMENDATION_OPTIONS = [
  { id: "shortlist", label: "Shortlist" },
  { id: "interview", label: "Interview" },
  { id: "hold", label: "Hold" },
];

/** Screening question types that have an answer to check against. */
export const CHECKABLE_TYPES = ["yes_no", "number", "salary", "choice"];

const isSet = (value) => value !== "" && value !== null && value !== undefined;

const screeningRules = (screening = {}) =>
  Object.entries(screening)
    .map(([questionId, rule]) => {
      if (rule?.equals === true || rule?.equals === false) return { questionId, equals: rule.equals };
      if (isSet(rule?.min) || isSet(rule?.max)) {
        return { questionId, min: isSet(rule.min) ? Number(rule.min) : null, max: isSet(rule.max) ? Number(rule.max) : null };
      }
      if (Array.isArray(rule?.anyOf) && rule.anyOf.length) return { questionId, anyOf: rule.anyOf };
      return null;
    })
    .filter(Boolean);

/** The criteria the API checks, from what the screen holds. */
export const toApiCriteria = (criteria) => {
  const api = {};
  if (criteria.useFit && isSet(criteria.minFit)) api.minFit = Number(criteria.minFit);
  if (criteria.useRecommendation && criteria.recommendations.length) api.recommendations = criteria.recommendations;
  if (criteria.coreSkills) api.coreSkills = true;
  if (criteria.meetsExperience) api.meetsExperience = true;
  if (criteria.useAssessment && isSet(criteria.minAssessment)) api.minAssessment = Number(criteria.minAssessment);
  const screening = screeningRules(criteria.screening);
  if (screening.length) api.screening = screening;
  return api;
};

export const countCriteria = (criteria) => {
  const api = toApiCriteria(criteria);
  return Object.keys(api).length - (api.screening ? 1 : 0) + (api.screening?.length || 0);
};

const storageKey = (jobId) => `shortlist-criteria:${jobId}`;

/** The criteria last used for a job on this browser, or the defaults. */
export const loadCriteria = (jobId) => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(jobId)) || "null");
    return saved && typeof saved === "object" ? { ...DEFAULT_CRITERIA, ...saved } : { ...DEFAULT_CRITERIA };
  } catch {
    return { ...DEFAULT_CRITERIA };
  }
};

export const saveCriteria = (jobId, criteria) => {
  try {
    window.localStorage.setItem(storageKey(jobId), JSON.stringify(criteria));
  } catch {
    // A convenience only; the screen works without it.
  }
};
