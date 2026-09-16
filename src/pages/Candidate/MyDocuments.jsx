import { useState, useRef, useEffect, useMemo } from "react";
import {
  FileText, Upload, Eye, Download, Trash2, Loader2,
  Inbox, Info, ChevronDown, Calendar, Clock, CheckCircle2,
  XCircle, AlertCircle, AlertTriangle, Briefcase, Building2,
  MapPin, ExternalLink, Search, ArrowRight, Shield, Check,
  X, HelpCircle, FileCheck, Layers, Sparkles, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  RefreshCw, Plus, Share2, Copy
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import moment from "moment";
import CandidateHeader from "../../components/layout/CandidateHeader";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

// Document Categories
const CATEGORIES = [
  "Resume",
  "Cover Letter",
  "Certificate",
  "BECE Certificate",
  "WASSCE / High School Certificate",
  "Degree / Diploma Certificate",
  "ID Document",
  "Other",
];

// Visual styling for document categories
const CATEGORY_STYLES = {
  Resume: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  "Cover Letter": "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
  Certificate: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  "BECE Certificate": "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
  "WASSCE / High School Certificate": "bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/30",
  "Degree / Diploma Certificate": "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30",
  "ID Document": "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30",
  Other: "bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30",
};

// Application Status Configurations
const STATUS_CONFIGS = {
  Applied: {
    label: "Applied",
    icon: Clock,
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
    dot: "bg-slate-400",
  },
  "Under Review": {
    label: "Under Review",
    icon: Loader2,
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
    dot: "bg-blue-500",
    spin: true,
  },
  Interviewing: {
    label: "Interviewing",
    icon: Calendar,
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  Offered: {
    label: "Offered",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  Rejected: {
    label: "Rejected",
    icon: XCircle,
    badge: "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
    dot: "bg-red-500",
  },
};

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Color palettes for company initials
const COMPANY_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-purple-500 to-indigo-600",
];

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "CO";

export const MyDocuments = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const uploadSectionRef = useRef(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState("all");

  // Application filter tab
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Document filter
  const [docCategoryFilter, setDocCategoryFilter] = useState("All");

  // Data states
  const [documents, setDocuments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Resume");
  const [customDocTitle, setCustomDocTitle] = useState("");

  // Modal states
  const [selectedInterviewApp, setSelectedInterviewApp] = useState(null);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [appToWithdraw, setAppToWithdraw] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Pagination for Applications
  const [appPage, setAppPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch initial data
  useEffect(() => {
    fetchPageData();
  }, []);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const [docsRes, appsRes] = await Promise.allSettled([
        axiosInstance.get(API_PATHS.DOCUMENTS.GET_DOCUMENTS),
        axiosInstance.get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS),
      ]);

      if (docsRes.status === "fulfilled") {
        setDocuments(docsRes.value.data?.documents || []);
      }
      if (appsRes.status === "fulfilled") {
        setApplications(Array.isArray(appsRes.value.data) ? appsRes.value.data : []);
      }
    } catch (err) {
      console.error("Error loading candidate documents & applications:", err);
      toast.error("Failed to load your applications and documents.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [docsRes, appsRes] = await Promise.allSettled([
        axiosInstance.get(API_PATHS.DOCUMENTS.GET_DOCUMENTS),
        axiosInstance.get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS),
      ]);

      if (docsRes.status === "fulfilled") {
        setDocuments(docsRes.value.data?.documents || []);
      }
      if (appsRes.status === "fulfilled") {
        setApplications(Array.isArray(appsRes.value.data) ? appsRes.value.data : []);
      }
      toast.success("Updated!");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Upload handler
  const handleUpload = async (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only PDF, DOC, DOCX, JPEG, or PNG files are allowed.");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File size must be under 10 MB.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${uploadCategory}…`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", customDocTitle.trim() || file.name);

      // Map backend-supported categories
      let backendCategory = uploadCategory;
      if (
        uploadCategory === "BECE Certificate" ||
        uploadCategory === "WASSCE / High School Certificate" ||
        uploadCategory === "Degree / Diploma Certificate"
      ) {
        backendCategory = "Certificate";
      }
      formData.append("category", backendCategory);

      const res = await axiosInstance.post(API_PATHS.DOCUMENTS.UPLOAD_DOCUMENT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedDocs = res.data?.documents || [];
      setDocuments(updatedDocs);
      updateUser({
        documents: updatedDocs,
        resume: res.data?.resume ?? user?.resume,
      });

      toast.dismiss(toastId);
      toast.success(`${uploadCategory} uploaded successfully!`);
      setCustomDocTitle("");
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error("Document upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete Document
  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    const toastId = toast.loading("Deleting document…");

    try {
      const res = await axiosInstance.delete(API_PATHS.DOCUMENTS.DELETE_DOCUMENT(docToDelete._id));
      const updatedDocs = res.data?.documents || [];
      setDocuments(updatedDocs);
      updateUser({
        documents: updatedDocs,
        resume: res.data?.resume ?? "",
      });
      toast.dismiss(toastId);
      toast.success("Document deleted.");
      setDocToDelete(null);
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error("Failed to delete document.");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Withdraw Application
  const handleConfirmWithdraw = async () => {
    if (!appToWithdraw) return;
    setIsWithdrawing(true);
    const toastId = toast.loading("Withdrawing application…");

    try {
      await axiosInstance.delete(API_PATHS.APPLICATIONS.WITHDRAW_APPLICATION(appToWithdraw._id));
      setApplications((prev) => prev.filter((a) => a._id !== appToWithdraw._id));
      toast.dismiss(toastId);
      toast.success("Application withdrawn successfully.");
      setAppToWithdraw(null);
    } catch (err) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error("Failed to withdraw application.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Scroll to upload
  const scrollToUpload = (categoryToSelect = null) => {
    if (categoryToSelect) {
      setUploadCategory(categoryToSelect);
    }
    if (uploadSectionRef.current) {
      uploadSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Missing documents calculation
  const missingDocumentInfo = useMemo(() => {
    const hasResume = documents.some((d) => d.category === "Resume") || !!user?.resume;
    const hasCertificate = documents.some((d) => d.category === "Certificate");
    const hasIdDoc = documents.some((d) => d.category === "ID Document");

    // Applications in Interviewing or Under Review
    const actionableApps = applications.filter(
      (app) => app.status === "Interviewing" || app.status === "Under Review"
    );

    // Missing categories recommendation
    const missingPills = [];
    if (!hasCertificate) missingPills.push("BECE / WASSCE Certificate", "Degree / Diploma Certificate");
    if (!hasIdDoc) missingPills.push("National ID / Passport");
    if (!hasResume) missingPills.push("Resume / CV");

    // Number of applications requiring documents
    const count = actionableApps.length > 0 && missingPills.length > 0 ? actionableApps.length : (missingPills.length > 0 ? 1 : 0);

    return {
      actionableApps,
      missingPills,
      count,
      hasPendingAction: count > 0 && missingPills.length > 0,
    };
  }, [documents, user, applications]);

  // Upcoming Interviews list
  const upcomingInterviews = useMemo(() => {
    return applications
      .filter((app) => app.status === "Interviewing" && app.interview?.date)
      .sort((a, b) => new Date(a.interview.date) - new Date(b.interview.date));
  }, [applications]);

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    let list = [...applications];

    // Status filter tab
    if (appStatusFilter === "reviewing") {
      list = list.filter((a) => a.status === "Under Review");
    } else if (appStatusFilter === "interview") {
      list = list.filter((a) => a.status === "Interviewing");
    } else if (appStatusFilter === "hired") {
      list = list.filter((a) => a.status === "Offered");
    } else if (appStatusFilter === "unsuccessful") {
      list = list.filter((a) => a.status === "Rejected");
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => {
        const title = a.job?.title?.toLowerCase() || "";
        const comp =
          (a.job?.company?.companyName || a.job?.company?.name || "").toLowerCase();
        return title.includes(q) || comp.includes(q);
      });
    }

    return list;
  }, [applications, appStatusFilter, searchQuery]);

  // Application counts by status
  const appCounts = useMemo(() => {
    return {
      all: applications.length,
      reviewing: applications.filter((a) => a.status === "Under Review").length,
      interview: applications.filter((a) => a.status === "Interviewing").length,
      hired: applications.filter((a) => a.status === "Offered").length,
      unsuccessful: applications.filter((a) => a.status === "Rejected").length,
    };
  }, [applications]);

  // Paginated applications
  const totalAppPages = Math.ceil(filteredApplications.length / itemsPerPage) || 1;
  const paginatedApplications = useMemo(() => {
    const start = (appPage - 1) * itemsPerPage;
    return filteredApplications.slice(start, start + itemsPerPage);
  }, [filteredApplications, appPage, itemsPerPage]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    if (docCategoryFilter === "All") return documents;
    return documents.filter((d) => d.category === docCategoryFilter);
  }, [documents, docCategoryFilter]);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-gray-950 flex flex-col font-sans text-slate-800 dark:text-gray-300 antialiased selection:bg-indigo-500 selection:text-white">
      <CandidateHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">

        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                  Applications & Documents
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Manage your candidate credentials, track application statuses, and fulfill document requests.
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-xs disabled:opacity-60"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={() => scrollToUpload()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white  hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-100"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Document
            </button>
          </div>
        </div>

        {/* TOP METRICS ROW: 2 LEFT STACKED / GRID STAT CARDS + 1 RIGHT INTERVIEW CARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: 2 Stat Cards */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            
            {/* Stat Card 1: Total Jobs Applied */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  Total Jobs Applied
                </h3>
                <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Briefcase className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                  {isLoading ? "—" : applications.length}
                </span>
              </div>
            </div>

            {/* Stat Card 2: Applications to Submit Documents On */}
            <div className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    Applications to Submit Documents On
                  </h3>
                  <div
                    className="relative cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    title="Applications in interview or review stages that require document verification"
                  >
                    <Info className="h-4 w-4" />
                  </div>
                </div>
                <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                  {isLoading ? "—" : missingDocumentInfo.count}
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Upcoming Interviews Spotlight Card */}
          <div className="lg:col-span-7 rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  Upcoming Interviews
                </h3>
                <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>

              {isLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-gray-400 dark:text-gray-500 animate-spin" />
                </div>
              ) : upcomingInterviews.length > 0 ? (
                <div className="space-y-3">
                  {upcomingInterviews.slice(0, 2).map((app) => {
                    const company = app.job?.company;
                    const companyName = company?.companyName || company?.name || "Company";
                    return (
                      <div
                        key={app._id}
                        onClick={() => {
                          setSelectedInterviewApp(app);
                          setIsInterviewModalOpen(true);
                        }}
                        className="group flex items-start justify-between gap-3 p-3.5 rounded-xl bg-gray-50/70 dark:bg-gray-800/50 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-500/30 cursor-pointer transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 h-8 w-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                              {app.job?.title}{" "}
                              <span className="font-semibold text-gray-500 dark:text-gray-400">
                                @ {companyName} {app.job?.location ? `– ${app.job.location}` : ""}
                              </span>
                            </p>
                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                              {moment(app.interview.date).format("ddd, D MMM YYYY")}{" "}
                              {app.interview.time ? `at ${app.interview.time}` : ""}{" "}
                              <span className="text-gray-400 dark:text-gray-500 font-normal">· (1st Interview)</span>
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0 flex items-center gap-1 mt-1">
                          Details <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-7 text-center">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    No scheduled interviews at this time
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    When employers schedule an interview, it will appear here.
                  </p>
                </div>
              )}
            </div>

            {upcomingInterviews.length > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 border-t border-gray-50 dark:border-gray-800 pt-2">
                Click any interview to access instructions, joining link, or copy location.
              </p>
            )}
          </div>

        </div>

        {/* ACTION REQUIRED: SUBMIT MISSING DOCUMENTS BANNER */}
        {missingDocumentInfo.hasPendingAction && (
          <div className="rounded-2xl border border-rose-200/90 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-500/5 p-5 sm:p-6 shadow-xs animate-in fade-in duration-200">
            <div className="flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  !
                </div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                  Action Required: Submit Missing Documents
                </h3>
              </div>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                You have interview-stage applications that require additional documents. Please upload the missing documents to your profile to proceed.
              </p>

              {/* Application Row & Missing Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">

                <div className="space-y-2">
                  {missingDocumentInfo.actionableApps.map((app) => {
                    const company = app.job?.company;
                    const companyName = company?.companyName || company?.name || "Arch Holdings Limited";
                    return (
                      <div key={app._id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                          <Briefcase className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                          {app.job?.title}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">@ {companyName}</span>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-rose-700 dark:text-rose-400">Missing:</span>
                    {missingDocumentInfo.missingPills.map((pill) => (
                      <button
                        key={pill}
                        onClick={() => {
                          if (pill.includes("Certificate")) scrollToUpload("Certificate");
                          else if (pill.includes("ID")) scrollToUpload("ID Document");
                          else scrollToUpload("Resume");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-500/30 bg-white dark:bg-gray-900 hover:bg-rose-100/70 dark:hover:bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 transition shadow-2xs"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload CTA Button */}
                <button
                  onClick={() => scrollToUpload()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-3 text-xs font-bold text-white transition-all shadow-sm hover:scale-[1.01] active:scale-100 shrink-0 uppercase tracking-wide"
                >
                  <ArrowRight className="h-4 w-4" />
                  Upload Documents to Profile
                </button>

              </div>

            </div>
          </div>
        )}

        {/* MAIN SECTION TABS */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <Layers className="h-4 w-4" />
            All Activity
          </button>

          <button
            onClick={() => setActiveTab("applications")}
            className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "applications"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Applications History ({applications.length})
          </button>

          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3.5 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <FileText className="h-4 w-4" />
            Document Vault ({documents.length})
          </button>
        </div>

      
        {/* SECTION 1: APPLICATIONS HISTORY TABLE & TRACKER */}
        {(activeTab === "all" || activeTab === "applications") && (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">

            {/* Table Header & Filter Bar */}
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                    Applications History
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Track the lifecycle, interview dates, and status of your submissions.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative sm:w-72">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setAppPage(1);
                    }}
                    placeholder="Search by role or company…"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-4 py-2 text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "all", label: "All", count: appCounts.all },
                  { id: "reviewing", label: "Reviewing", count: appCounts.reviewing },
                  { id: "interview", label: "Interview", count: appCounts.interview },
                  { id: "hired", label: "Hired", count: appCounts.hired },
                  { id: "unsuccessful", label: "Unsuccessful", count: appCounts.unsuccessful },
                ].map((tab) => {
                  const isSelected = appStatusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setAppStatusFilter(tab.id);
                        setAppPage(1);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 ${
                        isSelected
                          ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-100 dark:border-gray-700"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                          isSelected ? "bg-white/20 text-white" : "bg-gray-200/80 dark:bg-gray-600/60 text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Applications Content: Desktop Table & Mobile Cards */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">Loading your applications…</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-3">
                  <Inbox className="h-8 w-8 text-indigo-400 dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">No applications found</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
                  {searchQuery || appStatusFilter !== "all"
                    ? "Try adjusting your search query or status filter."
                    : "You haven't submitted any job applications yet. Browse open roles to get started."}
                </p>
                <button
                  onClick={() => navigate("/find-jobs")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  Find Jobs
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <th className="py-3.5 px-6">Company Name</th>
                        <th className="py-3.5 px-6">Role</th>
                        <th className="py-3.5 px-6">Date Applied</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6">Interview Response</th>
                        <th className="py-3.5 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                      {paginatedApplications.map((app, index) => {
                        const company = app.job?.company;
                        const companyName = company?.companyName || company?.name || "Company";
                        const companyLogo = company?.companyLogo;
                        const statusCfg = STATUS_CONFIGS[app.status] || STATUS_CONFIGS.Applied;
                        const StatusIcon = statusCfg.icon;
                        const gradient = COMPANY_GRADIENTS[index % COMPANY_GRADIENTS.length];
                        const initials = getInitials(companyName);

                        return (
                          <tr
                            key={app._id}
                            className="hover:bg-slate-50/60 dark:hover:bg-gray-800/50 transition-colors group"
                          >
                            {/* Company Name */}
                            <td className="py-4 px-6 font-semibold text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-3">
                                {companyLogo ? (
                                  <img
                                    src={companyLogo}
                                    alt={companyName}
                                    className="h-9 w-9 rounded-xl object-contain border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5"
                                  />
                                ) : (
                                  <div
                                    className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shadow-xs`}
                                  >
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                                    {companyName}
                                  </p>
                                  {app.job?.location && (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[180px] flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {app.job.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="py-4 px-6">
                              <div className="min-w-0">
                                <Link
                                  to={`/job/${app.job?._id}`}
                                  className="font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline truncate block max-w-[200px]"
                                >
                                  {app.job?.title || "Role Title"}
                                </Link>
                                <span className="inline-block mt-0.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                                  {app.job?.type || "Full-Time"}
                                </span>
                              </div>
                            </td>

                            {/* Date Applied */}
                            <td className="py-4 px-6 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                              {moment(app.createdAt).format("DD-MM-YYYY")}
                              <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                                {moment(app.createdAt).fromNow()}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-6 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusCfg.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                                <StatusIcon className={`h-3 w-3 ${statusCfg.spin ? "animate-spin" : ""}`} />
                                {statusCfg.label}
                              </span>
                            </td>

                            {/* Interview Response */}
                            <td className="py-4 px-6 whitespace-nowrap">
                              {app.status === "Interviewing" && app.interview?.date ? (
                                <button
                                  onClick={() => {
                                    setSelectedInterviewApp(app);
                                    setIsInterviewModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition shadow-2xs"
                                >
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  Confirmed ({moment(app.interview.date).format("D MMM")})
                                </button>
                              ) : app.status === "Interviewing" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md">
                                  <Clock className="h-3 w-3" />
                                  Schedule Pending
                                </span>
                              ) : app.status === "Offered" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  <Sparkles className="h-3 w-3" />
                                  Offer Extended
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-6 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                {app.status === "Interviewing" && app.interview && (
                                  <button
                                    onClick={() => {
                                      setSelectedInterviewApp(app);
                                      setIsInterviewModalOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
                                  >
                                    View Interview
                                  </button>
                                )}

                                <button
                                  onClick={() => setAppToWithdraw(app)}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition shadow-2xs"
                                  title="Withdraw this application"
                                >
                                  WITHDRAW
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedApplications.map((app, index) => {
                    const company = app.job?.company;
                    const companyName = company?.companyName || company?.name || "Company";
                    const statusCfg = STATUS_CONFIGS[app.status] || STATUS_CONFIGS.Applied;
                    const gradient = COMPANY_GRADIENTS[index % COMPANY_GRADIENTS.length];
                    const initials = getInitials(companyName);

                    return (
                      <div key={app._id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{companyName}</p>
                              <Link
                                to={`/job/${app.job?._id}`}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                              >
                                {app.job?.title}
                              </Link>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${statusCfg.badge}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Applied: {moment(app.createdAt).format("DD-MM-YYYY")}</span>
                          <span>{app.job?.location || "Location"}</span>
                        </div>

                        {app.status === "Interviewing" && app.interview?.date && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between">
                            <div className="text-xs">
                              <p className="font-bold text-emerald-800 dark:text-emerald-400">Interview Confirmed</p>
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400/80">
                                {moment(app.interview.date).format("ddd, D MMM")} @ {app.interview.time}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedInterviewApp(app);
                                setIsInterviewModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white"
                            >
                              Details
                            </button>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-50 dark:border-gray-800">
                          <button
                            onClick={() => setAppToWithdraw(app)}
                            className="px-3 py-1 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            Withdraw
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:px-6 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 bg-slate-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <span>Items per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setAppPage(1);
                      }}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                    <span className="ml-2 font-medium">
                      Showing {Math.min((appPage - 1) * itemsPerPage + 1, filteredApplications.length)} -{" "}
                      {Math.min(appPage * itemsPerPage, filteredApplications.length)} of {filteredApplications.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setAppPage(1)}
                      disabled={appPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                      title="First Page"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setAppPage((p) => Math.max(1, p - 1))}
                      disabled={appPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                      title="Previous Page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 font-bold text-gray-700 dark:text-gray-300">
                      Page {appPage} of {totalAppPages}
                    </span>
                    <button
                      onClick={() => setAppPage((p) => Math.min(totalAppPages, p + 1))}
                      disabled={appPage === totalAppPages}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                      title="Next Page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setAppPage(totalAppPages)}
                      disabled={appPage === totalAppPages}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                      title="Last Page"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      
        {/* SECTION 2: DOCUMENT VAULT & UPLOAD */}
        {(activeTab === "all" || activeTab === "documents") && (
          <div ref={uploadSectionRef} className="space-y-6">
            
            {/* Upload Card */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Upload Candidate Document</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Upload certificates, resumes, and identification to fulfill employer verification requests.
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Shield className="h-3 w-3" /> Secure Vault
                </span>
              </div>

              {/* Upload Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-4">

                {/* Category Selector */}
                <div className="sm:col-span-4 relative">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Document Category
                  </label>
                  <div className="relative">
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 pr-10 text-xs font-semibold text-gray-800 dark:text-gray-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                {/* Document Title / Label */}
                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Document Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDocTitle}
                    onChange={(e) => setCustomDocTitle(e.target.value)}
                    placeholder={`e.g. ${uploadCategory} - 2026`}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-xs font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                </div>

                {/* Upload Button Action */}
                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:scale-100"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {isUploading ? "Uploading…" : "Choose File"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                </div>

              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleUpload(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10 scale-[1.01]"
                    : "border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                  Click to browse or drag and drop your file here
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Supported formats: PDF, DOC, DOCX, JPEG, PNG · Maximum file size: 10 MB
                </p>
              </div>
            </div>

            {/* Uploaded Documents List */}
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Your Document Vault</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded and saved to your candidate profile
                    </p>
                  </div>
                </div>

                {/* Category Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {["All", "Resume", "Cover Letter", "Certificate", "ID Document", "Other"].map((cat) => {
                    const active = docCategoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setDocCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg font-bold transition text-xs shrink-0 ${
                          active
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <Inbox className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No documents in this category</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Upload your certificates, ID, or resume using the form above.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[...filteredDocuments]
                    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
                    .map((doc) => {
                      const isResume = doc.category === "Resume" || doc.url === user?.resume;
                      return (
                        <div
                          key={doc._id}
                          className="flex items-center justify-between gap-3.5 rounded-xl border border-gray-100 bg-slate-50/40 hover:bg-slate-50 hover:border-indigo-100 p-4 transition shadow-2xs group"
                        >
                          <div className="h-11 w-11 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-500 group-hover:text-indigo-600 shrink-0 shadow-2xs">
                            <FileText className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]" title={doc.name}>
                                {doc.name}
                              </p>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  CATEGORY_STYLES[doc.category] || CATEGORY_STYLES.Other
                                }`}
                              >
                                {doc.category}
                              </span>
                              {isResume && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-800">
                                  <Check className="h-2.5 w-2.5" /> Primary Resume
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {formatSize(doc.size)} · Uploaded {moment(doc.uploadedAt).fromNow()}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 flex items-center justify-center transition shadow-2xs"
                              title="Preview Document"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={doc.url}
                              download
                              className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 flex items-center justify-center transition shadow-2xs"
                              title="Download File"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => setDocToDelete(doc)}
                              className="h-8 w-8 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition shadow-2xs"
                              title="Delete Document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    
      {/* MODAL 1: INTERVIEW SCHEDULE DETAILS */}
      {isInterviewModalOpen && selectedInterviewApp?.interview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-gray-100 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsInterviewModalOpen(false);
                setSelectedInterviewApp(null);
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Upcoming Interview Details</h3>
                <p className="text-xs text-gray-400">
                  Role: <span className="font-semibold text-indigo-600">{selectedInterviewApp.job?.title}</span>
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center gap-3">
                <Building2 className="h-5 w-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Employer / Company</p>
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {selectedInterviewApp.job?.company?.companyName ||
                      selectedInterviewApp.job?.company?.name ||
                      "Arch Holdings Limited"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Date</p>
                  <p className="mt-1 text-xs font-bold text-gray-800">
                    {moment(selectedInterviewApp.interview.date).format("dddd, D MMMM YYYY")}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Time</p>
                  <p className="mt-1 text-xs font-bold text-gray-800">
                    {selectedInterviewApp.interview.time}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Location / Meeting Link
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-800 truncate">
                    {selectedInterviewApp.interview.location}
                  </p>
                  {selectedInterviewApp.interview.location?.startsWith("http") ? (
                    <a
                      href={selectedInterviewApp.interview.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs shrink-0"
                    >
                      Join Meeting
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedInterviewApp.interview.location);
                        toast.success("Location copied to clipboard!");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline shrink-0"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  )}
                </div>
              </div>

              {selectedInterviewApp.interview.notes && (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                    Employer Instructions / Notes
                  </p>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selectedInterviewApp.interview.notes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsInterviewModalOpen(false);
                    setSelectedInterviewApp(null);
                  }}
                  className="rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2 text-xs font-bold text-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WITHDRAW APPLICATION CONFIRMATION */}
      {appToWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-100 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900">
              Withdraw Application?
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Are you sure you want to withdraw your application for{" "}
              <span className="font-bold text-gray-800">{appToWithdraw.job?.title}</span>? This will remove your submission from the employer's review list.
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => setAppToWithdraw(null)}
                disabled={isWithdrawing}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWithdraw}
                disabled={isWithdrawing}
                className="px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition disabled:opacity-60"
              >
                {isWithdrawing ? "Withdrawing…" : "Yes, Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* MODAL 3: DELETE DOCUMENT CONFIRMATION */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-100 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="h-6 w-6" />
            </div>

            <h3 className="text-base font-bold text-gray-900">
              Delete Document?
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-gray-800">"{docToDelete.name}"</span> from your candidate profile?
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteDoc}
                disabled={isDeletingDoc}
                className="px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition disabled:opacity-60"
              >
                {isDeletingDoc ? "Deleting…" : "Delete Document"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MyDocuments;
