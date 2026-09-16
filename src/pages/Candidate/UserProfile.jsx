import { useState, useRef, useEffect } from "react";
import {
  User2, Mail, FileText, Edit3, Save, X, Camera,
  Shield, Check, Loader2, Briefcase, Star,
  Bookmark, Clock, ArrowRight, ExternalLink,
  ChevronRight, AlertCircle, Inbox, Plus, Calendar,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import CandidateHeader from "../../components/layout/CandidateHeader";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import moment from "moment";

//   Status Config for Candidate Applications   
const STATUS_CONFIG = {
  Applied: {
    label: "Applied",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  },
  "Under Review": {
    label: "Under Review",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  },
  Interviewing: {
    label: "Interviewing",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  Offered: {
    label: "Offered",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-250 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  Rejected: {
    label: "Rejected",
    badge: "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
  },
};

//   Info Row   
const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-none">
    <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-gray-800">
      <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-sm font-medium break-all ${value ? "text-gray-800 dark:text-gray-100" : "text-gray-300 dark:text-gray-600 italic"}`}>
        {value || "Not set"}
      </p>
    </div>
  </div>
);

//   Form Field Helper
const FormField = ({ label, required, icon: Icon, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      {children}
    </div>
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const inputCls = (hasIcon, error) =>
  `w-full rounded-xl border ${
    error ? "border-red-300 focus:ring-red-400/20 focus:border-red-400" : "border-gray-200 dark:border-gray-700 focus:border-indigo-400 focus:ring-indigo-400/20"
  } bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 focus:ring-2 py-3 ${
    hasIcon ? "pl-10 pr-4" : "px-4"
  }`;

//   Main Component   
const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Profile data stats
  const [myApplications, setMyApplications] = useState([]);
  const [savedJobsCount, setSavedJobsCount] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [selectedInterviewApp, setSelectedInterviewApp] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    avatar: "",
  });
  const [errors, setErrors] = useState({});

  // Sync state with auth context
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        avatar: user.avatar || "",
      });
      fetchStats();
    }
  }, [user]);

  // Fetch Applications and Saved Jobs Counts
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const [appRes, savedRes] = await Promise.allSettled([
        axiosInstance.get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS),
        axiosInstance.get(API_PATHS.JOBS.GET_SAVED_JOBS),
      ]);

      if (appRes.status === "fulfilled") {
        setMyApplications(Array.isArray(appRes.value.data) ? appRes.value.data : []);
      }
      if (savedRes.status === "fulfilled") {
        const savedData = Array.isArray(savedRes.value.data) ? savedRes.value.data : [];
        setSavedJobsCount(savedData.length);
      }
    } catch (err) {
      console.error("Error fetching candidate profile stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  //  Upload Avatar Photo   
  const handleAvatarUpload = async (file) => {
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    setIsUploadingAvatar(true);
    const id = toast.loading("Uploading photo…");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await axiosInstance.post(API_PATHS.IMAGE.UPLOAD_IMAGE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res.data?.imageUrl || res.data?.url || res.data;
      if (!url) throw new Error("No URL returned");

      setForm((prev) => ({ ...prev, avatar: url }));
      toast.dismiss(id);
      toast.success("Profile photo uploaded!");
    } catch (err) {
      toast.dismiss(id);
      console.error(err);
      toast.error("Profile photo upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  //   Save Profile Name
  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrors({ name: "Your name is required." });
      return;
    }

    setIsSaving(true);
    const id = toast.loading("Saving changes…");
    try {
      const res = await axiosInstance.put(API_PATHS.AUTH.UPDATE_PROFILE, {
        name: form.name,
        avatar: form.avatar,
      });

      updateUser(res.data);
      toast.dismiss(id);
      toast.success("Profile saved successfully!");
      setIsEditing(false);
      setErrors({});
    } catch (err) {
      toast.dismiss(id);
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
    if (user) {
      setForm({
        name: user.name || "",
        avatar: user.avatar || "",
      });
    }
  };

  const initials = form.name ? form.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") : "?";

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-gray-950 flex flex-col">
      <CandidateHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/*  Page Header   */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Manage your personal dashboard, resume, and profile details
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-100 disabled:opacity-70 disabled:scale-100"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-100"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/*    Profile Banner    */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-750 to-indigo-900 px-8 py-8 shadow-xl">
          {/* Decorative shapes */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-36 w-36 rounded-full bg-white/5 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            
            {/* Avatar block */}
            <div className="relative shrink-0 group">
              {form.avatar ? (
                <img
                  src={form.avatar}
                  alt="Profile"
                  className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg"
                />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/20 shadow-lg">
                  {initials}
                </div>
              )}

              {isEditing && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                  />
                  <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-indigo-500 border-2 border-indigo-600 flex items-center justify-center">
                    <Camera className="h-3 w-3 text-white" />
                  </div>
                </>
              )}
            </div>

            {/* Banner Details */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white">
                {user?.name || "Job Seeker"}
              </h2>
              <p className="mt-1 text-indigo-200 font-medium">{user?.email}</p>
              
              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm">
                  <Shield className="h-3 w-3 text-indigo-300" />
                  Verified Account
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm">
                  <Briefcase className="h-3 w-3 text-indigo-300" />
                  Job Seeker
                </span>
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="shrink-0 grid grid-cols-2 gap-3 w-full sm:w-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 text-center text-white border border-white/10 min-w-[100px]">
                <p className="text-2xl font-extrabold">{myApplications.length}</p>
                <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider mt-0.5">Applied</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 text-center text-white border border-white/10 min-w-[100px]">
                <p className="text-2xl font-extrabold">{savedJobsCount}</p>
                <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider mt-0.5">Saved</p>
              </div>
            </div>

          </div>
        </div>

        {/*    Content Grid    */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Left Panel: Forms & Uploads   */}
          <div className="lg:col-span-3 space-y-5">
            
            {/* Personal Details Card */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <User2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Personal Information</h3>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <FormField label="Full Name" required icon={User2} error={errors.name}>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      className={inputCls(true, errors.name)}
                    />
                  </FormField>

                  <FormField label="Email Address" icon={Mail}>
                    <input
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className={`${inputCls(true, false)} cursor-not-allowed bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500`}
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Email address cannot be changed.
                    </p>
                  </FormField>
                </div>
              ) : (
                <div>
                  <InfoRow icon={User2} label="Full Name" value={user?.name} />
                  <InfoRow icon={Mail} label="Email Address" value={user?.email} />
                </div>
              )}
            </div>

            {/* Documents Summary Card */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Documents</h3>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border-2 border-dashed border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-500/5 p-5 text-center sm:text-left">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {user?.resume ? "Your resume is uploaded" : "No resume uploaded yet"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {user?.resume
                      ? "Ready for 1-click applications."
                      : "Upload your resume and other documents to apply faster."}
                  </p>
                </div>

                <button
                  onClick={() => navigate("/documents")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-100 hover:bg-indigo-700 transition shrink-0"
                >
                  Manage Documents
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Applications Activity Card */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent Applications</h3>
                </div>
                <button
                  onClick={() => navigate("/find-jobs")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                >
                  Find more jobs <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {myApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No applications submitted yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Your active job applications will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {myApplications.slice(0, 4).map((app) => {
                    const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.Applied;
                    const companyName = app.job?.company?.companyName || app.job?.company?.name || "Company";
                    return (
                      <div key={app._id} className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{app.job?.title || "Position"}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
                            <span className="font-semibold text-gray-500 dark:text-gray-400">{companyName}</span>
                            <span>•</span>
                            <span>{app.job?.location || "Location"}</span>
                            <span>•</span>
                            <span>Applied {moment(app.createdAt).fromNow()}</span>
                          </div>
                          {app.status === "Interviewing" && app.interview && (
                            <button
                              onClick={() => {
                                setSelectedInterviewApp(app);
                                setIsInterviewModalOpen(true);
                              }}
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 transition"
                            >
                              <Calendar className="h-3 w-3 text-amber-500" />
                              View Interview Schedule
                            </button>
                          )}
                        </div>

                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0 ${statusCfg.badge}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Panel: Sidebars    */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Completeness bar */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Profile Completeness</h3>
              </div>

              {(() => {
                const checkList = [
                  { label: "Profile Photo", done: !!user?.avatar },
                  { label: "Full Name", done: !!user?.name },
                  { label: "Resume / CV", done: !!user?.resume },
                  { label: "Verified Email", done: !!user?.email },
                ];
                const completed = checkList.filter((c) => c.done).length;
                const pct = Math.round((completed / checkList.length) * 100);

                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pct}%</span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        pct === 100 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                      }`}>
                        {pct === 100 ? "Ready to Apply!" : "Needs work"}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full transition-all duration-750 ${
                          pct === 100 ? "bg-emerald-500" : "bg-indigo-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="space-y-2.5">
                      {checkList.map((c) => (
                        <div key={c.label} className="flex items-center gap-2.5">
                          <div className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center ${
                            c.done ? "bg-emerald-100 dark:bg-emerald-500/10" : "bg-gray-100 dark:bg-gray-800"
                          }`}>
                            {c.done ? (
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <X className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                            )}
                          </div>
                          <span className={`text-xs font-medium ${c.done ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Quick Tips */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border border-indigo-100 dark:border-indigo-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Quick Tips</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Upload a PDF resume to apply to jobs with 1-click",
                  "Keep your profile photo up to date",
                  "Track the status of your active applications in real-time",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

      </main>
      
      {/*    Candidate Interview Details Modal   */}
    {isInterviewModalOpen && selectedInterviewApp?.interview && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-100 dark:border-gray-800 shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
          <button
            onClick={() => {
              setIsInterviewModalOpen(false);
              setSelectedInterviewApp(null);
            }}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Interview Scheduled</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">For position: <span className="font-semibold text-indigo-650 dark:text-indigo-400">{selectedInterviewApp.job?.title}</span></p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50/50 dark:bg-gray-800/50 rounded-xl p-4 border border-slate-100 dark:border-gray-800 flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Employer / Company</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                  {selectedInterviewApp.job?.company?.companyName || selectedInterviewApp.job?.company?.name || "Company Name"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/50 dark:bg-gray-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-gray-800">
                <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Date</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {moment(selectedInterviewApp.interview.date).format("MMM D, YYYY")}
                </p>
              </div>
              <div className="bg-slate-50/50 dark:bg-gray-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-gray-800">
                <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Time</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {selectedInterviewApp.interview.time}
                </p>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-gray-800/50 rounded-xl p-4 border border-slate-100 dark:border-gray-800">
              <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1">Location / Joining Link</p>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <p className="text-sm font-semibold text-gray-805 dark:text-gray-100 truncate break-all">
                  {selectedInterviewApp.interview.location}
                </p>
                {selectedInterviewApp.interview.location?.startsWith("http") ? (
                  <a
                    href={selectedInterviewApp.interview.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition shrink-0"
                  >
                    Join
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedInterviewApp.interview.location);
                      toast.success("Location copied to clipboard!");
                    }}
                    className="text-xs font-semibold text-indigo-650 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline shrink-0"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>

            {selectedInterviewApp.interview.notes && (
              <div className="bg-slate-50/50 dark:bg-gray-800/50 rounded-xl p-4 border border-slate-100 dark:border-gray-800">
                <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-1.5">Employer's Instructions</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedInterviewApp.interview.notes}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-150/70 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => {
                  setIsInterviewModalOpen(false);
                  setSelectedInterviewApp(null);
                }}
                className="rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-5 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default UserProfile;