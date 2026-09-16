import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users, Briefcase, Search, FileText, Mail, Phone,
  MapPin, Calendar, Clock, ChevronRight, ArrowLeft,
  CheckCircle2, XCircle, Loader2, Eye, Download,
  RefreshCw, SlidersHorizontal, X, Star, TrendingUp,
  ExternalLink, ChevronDown, AlertCircle, Inbox,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";

//   Status Config  
const STATUS_CONFIG = {
  Applied: {
    label: "Applied",
    icon: Clock,
    bg: "bg-slate-100 dark:bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    ring: "ring-slate-200 dark:ring-slate-500/30",
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  },
  "Under Review": {
    label: "Under Review",
    icon: Loader2,
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-200 dark:ring-blue-500/30",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
    spin: true,
  },
  Interviewing: {
    label: "Interviewing",
    icon: Calendar,
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-500/30",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  Offered: {
    label: "Offered",
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  Rejected: {
    label: "Rejected",
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-500 dark:text-red-400",
    ring: "ring-red-200 dark:ring-red-500/30",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-500 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
  },
};

const STATUS_OPTIONS = ["Applied", "Under Review", "Interviewing", "Offered", "Rejected"];

//   Avatar Gradients  
const AVATAR_GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-blue-400 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
  "from-purple-400 to-indigo-500",
];

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

//  Status Badge 
const StatusBadge = ({ status, size = "sm" }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Applied"];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${cfg.badge} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <Icon className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} ${cfg.spin ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
};

//   Inline Loader  
const InlineLoader = ({ message = "Loading…" }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <div className="relative h-14 w-14">
      <div className="animate-spin rounded-full h-14 w-14 border-4 border-indigo-100 dark:border-indigo-500/20 border-t-indigo-600 dark:border-t-indigo-400" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{message}</p>
  </div>
);

//   Empty State
const EmptyState = ({ title, description, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center px-4">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
      <Icon className="h-8 w-8 text-indigo-400 dark:text-indigo-400" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
    <p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500 max-w-xs">{description}</p>
  </div>
);

//   Applicant List Item  
const ApplicantListItem = ({ app, index, isSelected, onClick }) => {
  const name = app.applicantName || app.applicant?.name || "Unknown Applicant";
  const initials = getInitials(name);
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG["Applied"];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 flex items-center gap-3.5 transition-all duration-200 border-b border-gray-50 dark:border-gray-800 last:border-none hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 group ${
        isSelected ? "bg-indigo-50 dark:bg-indigo-500/10 border-l-2 border-l-indigo-500" : "border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar */}
      <div
        className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white shadow-sm`}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${isSelected ? "text-indigo-700 dark:text-indigo-400" : "text-gray-900 dark:text-gray-100"} group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors`}>
          {name}
          {app.isGuest && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">Guest</span>
          )}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{moment(app.createdAt).fromNow()}</span>
        </div>
      </div>

      {/* Status dot + chevron */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
        <ChevronRight className={`h-3.5 w-3.5 text-gray-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5 ${isSelected ? "text-indigo-400" : ""}`} />
      </div>
    </button>
  );
};

//   Info Row
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-none">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
      <Icon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
    </div>
    <div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200 break-all">{value || "—"}</p>
    </div>
  </div>
);

//   Main Component   
const ApplicationViewer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get("jobId");

  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = useState(false);
  const [interviewDetails, setInterviewDetails] = useState({ date: "", time: "", location: "", notes: "" });

  //   Fetch Applications   
  const fetchApplications = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(API_PATHS.APPLICATIONS.GET_APPLICANT(jobId));
      const data = Array.isArray(res.data) ? res.data : [];
      setApplications(data);
      if (data.length > 0 && !selectedApp) {
        setSelectedApp(data[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load applications.");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  //   Filter Logic   
  const filtered = applications.filter((app) => {
    const name = (app.applicantName || app.applicant?.name || "").toLowerCase();
    const email = (app.applicantEmail || app.applicant?.email || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || name.includes(q) || email.includes(q);
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  //   Summary counts   
  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  //   Update Status   
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedApp || newStatus === selectedApp.status) return;
    setIsUpdatingStatus(true);
    const id = toast.loading("Updating status…");
    try {
      await axiosInstance.patch(API_PATHS.APPLICATIONS.UPDATE_STATUS(selectedApp._id), {
        status: newStatus,
      });
      toast.dismiss(id);
      toast.success(`Status updated to "${newStatus}"`);
      const updated = applications.map((a) =>
        a._id === selectedApp._id ? { ...a, status: newStatus } : a
      );
      setApplications(updated);
      setSelectedApp((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      toast.dismiss(id);
      toast.error(err.response?.data?.message || "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };
  
  //   Schedule/Update Interview  
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!interviewDetails.date || !interviewDetails.time || !interviewDetails.location) {
      toast.error("Date, Time, and Location/Link are required.");
      return;
    }

    setIsUpdatingStatus(true);
    const id = toast.loading("Saving interview schedule…");
    try {
      const res = await axiosInstance.patch(API_PATHS.APPLICATIONS.UPDATE_STATUS(selectedApp._id), {
        status: "Interviewing",
        interview: interviewDetails,
      });
      toast.dismiss(id);
      toast.success("Interview scheduled successfully!");
      
      const updatedApp = res.data.application || {
        ...selectedApp,
        status: "Interviewing",
        interview: {
          date: new Date(interviewDetails.date),
          time: interviewDetails.time,
          location: interviewDetails.location,
          notes: interviewDetails.notes,
        }
      };
      
      const updated = applications.map((a) =>
        a._id === selectedApp._id ? { ...a, status: "Interviewing", interview: updatedApp.interview } : a
      );
      setApplications(updated);
      setSelectedApp(updatedApp);
      setIsSchedulingModalOpen(false);
    } catch (err) {
      toast.dismiss(id);
      toast.error(err.response?.data?.message || "Failed to schedule interview.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  //   Job Info (from first application)  
  const jobInfo = applications[0]?.job;
  const selectedIndex = filtered.findIndex((a) => a._id === selectedApp?._id);
  const selectedGradient = AVATAR_GRADIENTS[selectedIndex % AVATAR_GRADIENTS.length];
  const selectedInitials = getInitials(selectedApp?.applicantName || selectedApp?.applicant?.name);

  if (!jobId) {
    return (
      <DashboardLayout activeMenu="manage-jobs">
        <EmptyState
          icon={AlertCircle}
          title="No Job Selected"
          description="Please navigate here from the Manage Jobs page by clicking on an applicant count."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeMenu="manage-jobs">
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-0 max-w-7xl mx-auto">

        {/*    Top Bar   */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={() => navigate("/manage-jobs")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group shrink-0"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Jobs
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {jobInfo ? (
                <>
                  Applicants for{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">{jobInfo.title}</span>
                </>
              ) : (
                "Application Viewer"
              )}
            </h1>
            {jobInfo && (
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{jobInfo.location}</span>
                <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{jobInfo.type}</span>
              </div>
            )}
          </div>

          {/* Stat Pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 shadow-sm">
              <Users className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{applications.length}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Total</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3.5 py-2 shadow-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{counts["Offered"] || 0}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Offered</span>
            </div>
            <button
              onClick={fetchApplications}
              title="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-gray-400 dark:text-gray-500 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/*    Status Filter Pills   */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {["All", ...STATUS_OPTIONS].map((s) => {
            const count = s === "All" ? applications.length : (counts[s] || 0);
            const isActive = statusFilter === s;
            const cfg = s !== "All" ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                {cfg && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : cfg.dot}`} />
                )}
                {s}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/*    Main Split Layout   */}
        {isLoading ? (
          <div className="flex-1 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <InlineLoader message="Loading applications…" />
          </div>
        ) : applications.length === 0 ? (
          <div className="flex-1 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <EmptyState
              icon={Inbox}
              title="No Applications Yet"
              description="No candidates have applied for this position yet. Share the job to attract talent."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex min-h-0">

            {/*    Left Panel: Applicant List    */}
            <div className="w-[300px] xl:w-[340px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
              {/* Search bar */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search applicants…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 pl-9 pr-8 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Count label */}
              <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                  {filtered.length} applicant{filtered.length !== 1 ? "s" : ""}
                  {statusFilter !== "All" && ` · ${statusFilter}`}
                </p>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                    <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No matches found</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search or filter.</p>
                  </div>
                ) : (
                  filtered.map((app, i) => (
                    <ApplicantListItem
                      key={app._id}
                      app={app}
                      index={i}
                      isSelected={selectedApp?._id === app._id}
                      onClick={() => setSelectedApp(app)}
                    />
                  ))
                )}
              </div>
            </div>

            {/*  Right Panel: Detail View  */}
            {selectedApp ? (
              <div className="flex-1 overflow-y-auto min-w-0">
                {/* Detail Header */}
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-7 py-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div
                      className={`h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br ${selectedGradient} flex items-center justify-center text-lg font-bold text-white shadow-md`}
                    >
                      {selectedInitials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                        {selectedApp.applicantName || selectedApp.applicant?.name || "Unknown Applicant"}
                        {selectedApp.isGuest && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30">Guest Applicant</span>
                        )}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Mail className="h-3 w-3" />
                          {selectedApp.applicantEmail || selectedApp.applicant?.email || "—"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <Calendar className="h-3 w-3" />
                          Applied {moment(selectedApp.createdAt).fromNow()}
                        </span>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="shrink-0">
                      <StatusBadge status={selectedApp.status} size="md" />
                    </div>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="px-7 py-6 space-y-6">

                  {/*  Change Status ─ */}
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <SlidersHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Update Application Status</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STATUS_OPTIONS.map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const Icon = cfg.icon;
                        const isActive = selectedApp.status === s;
                        return (
                          <button
                            key={s}
                            disabled={isUpdatingStatus}
                            onClick={() => {
                              if (s === "Interviewing") {
                                if (selectedApp.isGuest) {
                                  toast.error("Interviews can only be scheduled for candidates with registered accounts.");
                                  return;
                                }
                                setInterviewDetails({
                                  date: selectedApp.interview?.date ? moment(selectedApp.interview.date).format("YYYY-MM-DD") : "",
                                  time: selectedApp.interview?.time || "",
                                  location: selectedApp.interview?.location || "",
                                  notes: selectedApp.interview?.notes || "",
                                });
                                setIsSchedulingModalOpen(true);
                              } else {
                                handleUpdateStatus(s);
                              }
                            }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 text-xs font-bold transition-all duration-200 ${
                              isActive
                                ? `${cfg.bg} ${cfg.text} ${cfg.ring} border-current shadow-sm`
                                : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300 hover:text-gray-600 hover:bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                            } ${isUpdatingStatus ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <Icon className={`h-4.5 w-4.5 ${isActive && cfg.spin ? "animate-spin" : ""}`} />
                            {s}
                            {isActive && (
                              <span className="text-[10px] font-normal opacity-70">Current</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/*  Scheduled Interview Details ─ */}
                  {selectedApp.status === "Interviewing" && selectedApp.interview && (
                    <div className="rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5 p-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 hidden md:block">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                          Interview Scheduled
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Scheduled Interview Details</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Date</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {moment(selectedApp.interview.date).format("dddd, MMMM D, YYYY")}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Time</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {selectedApp.interview.time
                              ? (() => {
                                  const [h, m] = selectedApp.interview.time.split(":").map(Number);
                                  const ampm = h >= 12 ? "PM" : "AM";
                                  const hour = h % 12 || 12;
                                  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
                                })()
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-amber-100/50 dark:border-amber-500/20 shadow-xs">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Location / Link</p>
                          <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{selectedApp.interview.location}</span>
                            {selectedApp.interview.location?.startsWith("http") && (
                              <a
                                href={selectedApp.interview.location}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 shrink-0"
                                title="Open Link"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {selectedApp.interview.notes && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-amber-100/50 dark:border-amber-500/20 shadow-xs mb-4">
                          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">Instructions / Notes</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {selectedApp.interview.notes}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setInterviewDetails({
                            date: moment(selectedApp.interview.date).format("YYYY-MM-DD"),
                            time: selectedApp.interview.time,
                            location: selectedApp.interview.location,
                            notes: selectedApp.interview.notes || "",
                          });
                          setIsSchedulingModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-900 hover:bg-amber-50 dark:hover:bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 transition"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Edit Interview Details
                      </button>
                    </div>
                  )}

                  {/*  Two-col Grid  */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Applicant Info */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Applicant Details</h3>
                      </div>
                      <div>
                        <InfoRow icon={Mail} label="Email Address" value={selectedApp.applicantEmail || selectedApp.applicant?.email} />
                        {selectedApp.isGuest && selectedApp.applicantPhone && (
                          <InfoRow icon={Phone} label="Phone Number" value={selectedApp.applicantPhone} />
                        )}
                        <InfoRow icon={Calendar} label="Applied On" value={moment(selectedApp.createdAt).format("MMM D, YYYY · h:mm A")} />
                        <InfoRow icon={Clock} label="Last Updated" value={moment(selectedApp.updatedAt).fromNow()} />
                        <InfoRow icon={Briefcase} label="Applied For" value={selectedApp.job?.title} />
                        {selectedApp.job?.location && (
                          <InfoRow icon={MapPin} label="Job Location" value={selectedApp.job.location} />
                        )}
                      </div>
                    </div>

                    {/* Resume Card */}
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Resume / CV</h3>
                      </div>

                      {selectedApp.resume ? (
                        <>
                          {/* Preview card */}
                          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5 p-6 text-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Resume Attached</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 break-all max-w-[200px] mx-auto truncate">
                                {selectedApp.resume.split("/").pop()}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-center">
                              <a
                                href={selectedApp.resume}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </a>
                              <a
                                href={selectedApp.resume}
                                download
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 text-center">
                          <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No resume uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/*  Cover Letter  */}
                  {(selectedApp.coverLetter || selectedApp.coverLetterFile) && (
                    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-4 w-4 text-amber-400 dark:text-amber-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Cover Letter</h3>
                      </div>

                      {/* Typed cover letter text */}
                      {selectedApp.coverLetter && (
                        <div className="rounded-xl bg-slate-50 dark:bg-gray-800/60 p-4 border border-slate-100 dark:border-gray-700">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {selectedApp.coverLetter}
                          </p>
                        </div>
                      )}

                      {/* Uploaded cover letter document */}
                      {selectedApp.coverLetterFile && (
                        <div className={`flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5 p-4 ${selectedApp.coverLetter ? "mt-3" : ""}`}>
                          <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Cover Letter Document</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate break-all mt-0.5">
                              {selectedApp.coverLetterFile.split("/").pop()}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <a
                              href={selectedApp.coverLetterFile}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </a>
                            <a
                              href={selectedApp.coverLetterFile}
                              download
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/*  Timeline  */}
                  <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Application Timeline</h3>
                    </div>
                    <div className="relative pl-5">
                      {/* Vertical line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-indigo-100 dark:bg-indigo-500/20" />

                      {/* Timeline events */}
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-gray-900 shadow-sm mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Application Submitted</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{moment(selectedApp.createdAt).format("MMM D, YYYY · h:mm A")}</p>
                          </div>
                        </div>

                        {selectedApp.status !== "Applied" && (
                          <div className="flex items-start gap-3">
                            <span className={`relative z-10 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900 shadow-sm mt-0.5 ${STATUS_CONFIG[selectedApp.status]?.dot || "bg-gray-400"}`} />
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                Status Changed to{" "}
                                <span className={STATUS_CONFIG[selectedApp.status]?.text}>
                                  {selectedApp.status}
                                </span>
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{moment(selectedApp.updatedAt).format("MMM D, YYYY · h:mm A")}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={Users}
                  title="Select an Applicant"
                  description="Click on any applicant from the list to view their full application details."
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/*  Scheduling Modal  */}
      {isSchedulingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-100 dark:border-gray-800 shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsSchedulingModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Schedule Interview</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Specify details for candidate: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedApp?.applicantName || selectedApp?.applicant?.name}</span></p>
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interview Date</label>
                  <input
                    type="date"
                    required
                    value={interviewDetails.date}
                    onChange={(e) => setInterviewDetails((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition scheme-light dark:scheme-dark"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Interview Time</label>
                  <input
                    type="time"
                    required
                    value={interviewDetails.time}
                    onChange={(e) => setInterviewDetails((prev) => ({ ...prev, time: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition cursor-pointer scheme-light dark:scheme-dark"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Location / Meet Link</label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet URL, Zoom link, or Office Location Address"
                  required
                  value={interviewDetails.location}
                  onChange={(e) => setInterviewDetails((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes & Instructions (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Provide meeting password, preparation guide, or notes for the candidate..."
                  value={interviewDetails.notes}
                  onChange={(e) => setInterviewDetails((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-805 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsSchedulingModalOpen(false)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-100 transition disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Saving..." : "Confirm & Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ApplicationViewer;