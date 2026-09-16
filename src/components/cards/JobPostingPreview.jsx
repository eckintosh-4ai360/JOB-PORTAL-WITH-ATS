import {
  ArrowLeft, MapPin, Clock, Building2,
  Users, CheckCircle2, Calendar, ExternalLink,
} from "lucide-react";

// GHS icon (reused from form) 
const GhsIcon = () => (
  <span className="text-base font-bold text-white leading-none">GH₵</span>
);

// Badge chip 
const Badge = ({ children, color = "blue" }) => {
  const styles = {
    blue:   "bg-blue-50   text-blue-600  border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
    violet: "bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30",
    gray:   "bg-gray-50   text-gray-600  border border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30",
    green:  "bg-green-50  text-green-600 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles[color]}`}>
      {children}
    </span>
  );
};

//  Section with left accent bar
const PreviewSection = ({ title, children }) => (
  <div>
    <div className="mb-3 flex items-center gap-3">
      <div className="h-5 w-1 rounded-full bg-violet-500" />
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
    {children}
  </div>
);

// Text block 
const TextBlock = ({ text }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/50">
    <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-gray-300">
      {text || <span className="italic text-gray-300 dark:text-gray-600">Not provided</span>}
    </p>
  </div>
);

// Derived helpers
const formatSalary = (min, max) => {
  if (!min && !max) return null;
  const fmt = (n) => Number(n).toLocaleString("en-GH");
  if (min && max) return `GH₵ ${fmt(min)} – ${fmt(max)} per year`;
  if (min)        return `GH₵ ${fmt(min)}+ per year`;
  return          `Up to GH₵ ${fmt(max)} per year`;
};

// Main component 
const JobPostingPreview = ({ form, onClose }) => {
  const salaryText = formatSalary(form.salaryMin, form.salaryMax);

  // Resolve display labels for category and job type
  const categoryLabel = form.category === "other" && form.customCategory
    ? form.customCategory
    : form.category;
  const jobTypeLabel = form.jobType === "Other" && form.customJobType
    ? form.customJobType
    : form.jobType;

  return (
    /* Full-screen slide-over */
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:bg-gray-900">

        {/*Header bar  */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Job Preview</h2>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Edit
          </button>
        </div>

        {/*Body  */}
        <div className="space-y-7 px-6 py-6">

          {/* Job title + location  */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {form.title || <span className="text-gray-300 dark:text-gray-600">Job Title</span>}
              </h1>
              {form.location && (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                    {form.location}
                  </span>
                  <a
                    href={
                      form.latitude && form.longitude
                        ? `https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline bg-indigo-50 px-2 py-0.5 rounded-full dark:text-indigo-400 dark:bg-indigo-500/10"
                  >
                    Google Locator <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
            {/* Company logo  */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 shadow-sm dark:border-gray-800 dark:bg-gray-800">
              <Building2 className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            </div>
          </div>

          {/* Badges  */}
          <div className="flex flex-wrap gap-2">
            {categoryLabel && (
              <Badge color="blue">{categoryLabel}</Badge>
            )}
            {jobTypeLabel && (
              <Badge color="violet">{jobTypeLabel}</Badge>
            )}
            <Badge color="gray">
              <Clock className="h-3 w-3" />
              Posted today
            </Badge>
            {form.deadline && (
              <Badge color="green">
                <Calendar className="h-3 w-3" />
                Deadline: {new Date(form.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Badge>
            )}
          </div>

          {/* Salary banner  */}
          {salaryText ? (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
              {/* Decorative blob */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                    <GhsIcon />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-emerald-100">Compensation</p>
                    <p className="text-lg font-bold text-white">{salaryText}</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white">
                  <Users className="h-3.5 w-3.5" />
                  Competitive
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">GH₵</span>
              </div>
              <p className="text-sm text-gray-400 italic dark:text-gray-500">Salary not specified</p>
            </div>
          )}

          {/* About this role  */}
          <PreviewSection title="About This Role">
            <TextBlock text={form.description} />
          </PreviewSection>

          {/* Requirements  */}
          <PreviewSection title="What We're Looking For">
            <TextBlock text={form.requirements} />
            {form.requirements && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Include required skills, experience level, education, and any preferred qualifications
              </p>
            )}
          </PreviewSection>

          {/* Divider note  */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>This is a preview only.</strong> Go back to edit before publishing your job.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default JobPostingPreview;
