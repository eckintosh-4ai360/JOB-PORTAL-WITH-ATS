import { useState, useRef, useEffect } from "react";
import {
  Building2, Mail, User2, FileText, Edit3, Save,
  X, Camera, Globe, MapPin, Phone, Upload, Check,
  Loader2, Briefcase, Star, Shield, ChevronRight,
  Image as ImageIcon, Link2, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

//  Avatar Initials  
const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

//  Stat Card    
const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
};

//  Info Row (view mode)
const InfoRow = ({ icon: Icon, label, value, placeholder = "Not set" }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-none">
    <div className="mt-0.5 h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-gray-800">
      <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-sm font-medium break-all ${value ? "text-gray-800 dark:text-gray-200" : "text-gray-300 dark:text-gray-600 italic"}`}>
        {value || placeholder}
      </p>
    </div>
  </div>
);

//  Input Field
const FormField = ({ label, required, icon: Icon, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
      {label}
      {required && <span className="ml-0.5 text-red-500 dark:text-red-400">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      {children}
    </div>
    {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
  </div>
);

const inputCls = (hasIcon, error) =>
  `w-full rounded-xl border ${error ? "border-red-300 dark:border-red-500/40 focus:ring-red-400/20 focus:border-red-400" : "border-gray-200 dark:border-gray-700 focus:border-indigo-400 focus:ring-indigo-400/20"} bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 focus:ring-2 py-3 ${hasIcon ? "pl-10 pr-4" : "px-4"}`;

//  Main Component 
const EmployerProfilePage = () => {
  const { user, updateUser } = useAuth();
  const avatarInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    companyDescription: "",
    companyLogo: "",
    avatar: "",
  });
  const [errors, setErrors] = useState({});

  // Sync from auth user
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        companyName: user.companyName || "",
        companyDescription: user.companyDescription || "",
        companyLogo: user.companyLogo || "",
        avatar: user.avatar || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Your name is required.";
    if (!form.companyName.trim()) errs.companyName = "Company name is required.";
    return errs;
  };

  //  Image Upload Handler 
  const handleImageUpload = async (file, field) => {
    if (!file) return;
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    const setter = field === "avatar" ? setIsUploadingAvatar : setIsUploadingLogo;
    setter(true);
    const id = toast.loading(`Uploading ${field === "avatar" ? "profile photo" : "company logo"}…`);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await axiosInstance.post(API_PATHS.IMAGE.UPLOAD_IMAGE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res.data?.imageUrl || res.data?.url || res.data;
      if (!url) throw new Error("No URL returned");

      setForm((prev) => ({ ...prev, [field]: url }));
      toast.dismiss(id);
      toast.success("Image uploaded!");
    } catch (err) {
      toast.dismiss(id);
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setter(false);
    }
  };

  //  Save Profile 
  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSaving(true);
    const id = toast.loading("Saving profile…");
    try {
      const res = await axiosInstance.put(API_PATHS.AUTH.UPDATE_PROFILE, {
        name: form.name,
        avatar: form.avatar,
        companyName: form.companyName,
        companyDescription: form.companyDescription,
        companyLogo: form.companyLogo,
      });

      updateUser(res.data);
      toast.dismiss(id);
      toast.success("Profile saved successfully!");
      setIsEditing(false);
      setErrors({});
    } catch (err) {
      toast.dismiss(id);
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
    // Reset form to current user data
    if (user) {
      setForm({
        name: user.name || "",
        companyName: user.companyName || "",
        companyDescription: user.companyDescription || "",
        companyLogo: user.companyLogo || "",
        avatar: user.avatar || "",
      });
    }
  };

  const initials = getInitials(user?.name);

  return (
    <DashboardLayout activeMenu="company-profile">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">

        {/*  Page Header  */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Company Profile</h1>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Manage your personal info and company details
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60"
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

        {/*  Hero Profile Banner  */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary via-secondary to-indigo-900 px-8 py-8 shadow-xl">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0 group">
              {form.avatar || user?.avatar ? (
                <img
                  src={form.avatar || user?.avatar}
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
                    onChange={(e) => handleImageUpload(e.target.files?.[0], "avatar")}
                  />
                  <div className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-indigo-500 border-2 border-secondary flex items-center justify-center">
                    <Camera className="h-3 w-3 text-white" />
                  </div>
                </>
              )}
            </div>

            {/* Name & Company */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white">
                {user?.name || "Your Name"}
              </h2>
              <p className="mt-1 text-indigo-300 font-medium">
                {user?.companyName || "Your Company"}
              </p>
              <p className="mt-1 text-white/50 text-sm">{user?.email}</p>

              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
                  <Shield className="h-3 w-3" />
                  Verified Employer
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
                  <Briefcase className="h-3 w-3" />
                  Hiring
                </span>
              </div>
            </div>

            {/* Company Logo area */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Company Logo</p>
              <div className="relative group">
                {form.companyLogo || user?.companyLogo ? (
                  <img
                    src={form.companyLogo || user?.companyLogo}
                    alt="Company Logo"
                    className="h-16 w-16 rounded-xl object-cover bg-white ring-2 ring-white/20 shadow-md"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-white/10 border-2 border-dashed border-white/30 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white/40" />
                  </div>
                )}

                {isEditing && (
                  <>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], "companyLogo")}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/*  Content Grid  */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Left: Personal + Company Info  */}
          <div className="lg:col-span-3 space-y-5">

            {/* Personal Info Card */}
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
                      className={`${inputCls(true, false)} cursor-not-allowed bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500`}
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Email cannot be changed here.
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

            {/* Company Info Card */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Company Information</h3>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <FormField label="Company Name" required icon={Building2} error={errors.companyName}>
                    <input
                      type="text"
                      name="companyName"
                      value={form.companyName}
                      onChange={handleChange}
                      placeholder="Your company name"
                      className={inputCls(true, errors.companyName)}
                    />
                  </FormField>

                  <FormField label="About the Company" icon={FileText} error={errors.companyDescription}>
                    <textarea
                      name="companyDescription"
                      value={form.companyDescription}
                      onChange={handleChange}
                      rows={5}
                      placeholder="Describe your company — mission, values, culture, products…"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 px-4 py-3 resize-y"
                    />
                  </FormField>
                </div>
              ) : (
                <div>
                  <InfoRow icon={Building2} label="Company Name" value={user?.companyName} />
                  <InfoRow icon={Briefcase} label="Role" value="Employer" />

                  {/* About section */}
                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">About Company</p>
                    </div>
                    {user?.companyDescription ? (
                      <div className="rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-800 p-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {user.companyDescription}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 p-6 text-center">
                        <FileText className="h-7 w-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 dark:text-gray-500">No company description added yet.</p>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                          + Add description
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Company Logo upload card (Edit mode only — extra option) */}
            {isEditing && (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Profile & Logo Images</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Profile photo */}
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 p-5 text-center gap-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-400 transition-colors group"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                    ) : form.avatar ? (
                      <img src={form.avatar} alt="Avatar" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <Camera className="h-8 w-8 text-indigo-400 group-hover:text-indigo-500 transition-colors" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Profile Photo</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Click to upload · Max 5 MB</p>
                    </div>
                    {form.avatar && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                  </div>

                  {/* Company logo */}
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-100 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 p-5 text-center gap-2 cursor-pointer hover:border-blue-300 dark:hover:border-blue-400 transition-colors group"
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                    ) : form.companyLogo ? (
                      <img src={form.companyLogo} alt="Logo" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <Building2 className="h-8 w-8 text-blue-400 group-hover:text-blue-500 transition-colors" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Company Logo</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Click to upload · Max 5 MB</p>
                    </div>
                    {form.companyLogo && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar  */}
          <div className="lg:col-span-2 space-y-5">

            {/* Profile Completeness */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Profile Completeness</h3>
              </div>

              {(() => {
                const fields = [
                  { label: "Full Name", done: !!user?.name },
                  { label: "Email", done: !!user?.email },
                  { label: "Company Name", done: !!user?.companyName },
                  { label: "Company Description", done: !!user?.companyDescription },
                  { label: "Profile Photo", done: !!user?.avatar },
                  { label: "Company Logo", done: !!user?.companyLogo },
                ];
                const completed = fields.filter((f) => f.done).length;
                const pct = Math.round((completed / fields.length) * 100);

                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pct}%</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct === 100 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                        {pct === 100 ? "Complete!" : "Incomplete"}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="space-y-2">
                      {fields.map((f) => (
                        <div key={f.label} className="flex items-center gap-2.5">
                          <div className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center ${f.done ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                            {f.done ? (
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <X className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                            )}
                          </div>
                          <span className={`text-xs font-medium ${f.done ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
                            {f.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Account Info */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Account Details</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Role</span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 capitalize bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                    {user?.role || "Employer"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Account Status</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Email Verified</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                    <Check className="h-3 w-3" />
                    Verified
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployerProfilePage;