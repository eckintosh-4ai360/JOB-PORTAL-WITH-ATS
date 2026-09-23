import { Clock, Briefcase, CheckCircle2, XCircle, Search, Star, Calendar, Hourglass } from "lucide-react";
import moment from "moment";

// The label is the employer's own stage name; the colour comes from what the
// stage means, since stage names are free text.
const TONE = {
  slate: "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  blue: "bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  violet: "bg-violet-50 text-violet-600 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30",
  amber: "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  indigo: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30",
  emerald: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  red: "bg-red-50 text-red-500 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
};

const PHASE_STYLE = {
  received: { icon: Clock, classes: TONE.slate },
  under_review: { icon: Search, classes: TONE.blue },
  shortlisted: { icon: Star, classes: TONE.violet },
  interview: { icon: Calendar, classes: TONE.amber },
  decision: { icon: Hourglass, classes: TONE.indigo },
};

const stageStyle = (phase, stageType) => {
  if (stageType === "rejected") return { icon: XCircle, classes: TONE.red };
  if (stageType === "offer" || stageType === "hired") return { icon: CheckCircle2, classes: TONE.emerald };
  return PHASE_STYLE[phase] || PHASE_STYLE.received;
};

// Colour palette for avatar background (index-based) 
const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
];

const ApplicantDashboardCard = ({ applicant, position, time, status, phase, stageType, index = 0 }) => {
  const cfg = stageStyle(phase, stageType);
  const StatusIcon = cfg.icon;

  // Derive initials from name string
  const initials = applicant
    ? applicant
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    : "?";

  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const timeLabel = time ? moment(time).fromNow() : "—";

  return (
    <div className="group flex items-center gap-3.5 rounded-xl p-3 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-gray-800">
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-sm`}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 transition-colors duration-200">
          {applicant || "Unknown Applicant"}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1 truncate max-w-[130px]">
            <Briefcase className="h-3 w-3 shrink-0" />
            {position || "—"}
          </span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {timeLabel}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <span
        className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}
      >
        <StatusIcon className="h-3 w-3" />
        {status || "Applied"}
      </span>
    </div>
  );
};

export default ApplicantDashboardCard;
