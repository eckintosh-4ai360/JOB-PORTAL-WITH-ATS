import { Clock, Briefcase, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import moment from "moment";

//Status config 
const STATUS_CONFIG = {
  applied: {
    label: "Applied",
    icon: Clock,
    classes: "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
    spin: false,
  },
  "under review": {
    label: "Under Review",
    icon: Loader2,
    classes: "bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
    spin: true,
  },
  interviewing: {
    label: "Interviewing",
    icon: Clock,
    classes: "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    spin: false,
  },
  offered: {
    label: "Offered",
    icon: CheckCircle2,
    classes: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    spin: false,
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    classes: "bg-red-50 text-red-500 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
    spin: false,
  },
  pending: {
    label: "Pending",
    icon: Clock,
    classes: "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
    spin: false,
  },
};

// Colour palette for avatar background (index-based) 
const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
];

const ApplicantDashboardCard = ({ applicant, position, time, status = "pending", index = 0 }) => {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? STATUS_CONFIG.pending;
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
        <StatusIcon className={`h-3 w-3 ${cfg.spin ? "animate-spin" : ""}`} />
        {cfg.label}
      </span>
    </div>
  );
};

export default ApplicantDashboardCard;
