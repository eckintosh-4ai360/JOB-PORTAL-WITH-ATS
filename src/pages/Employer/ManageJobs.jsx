import { useEffect, useState } from "react";
import {
  Briefcase, Plus, Search, Edit3, XCircle, Trash2,
  AlertCircle, Users, CheckCircle, ChevronDown, Loader2,
  MapPin, DollarSign, Send, Eye, X, ArrowUpDown,
  ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/dashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { InputField, SelectField, TextAreaField } from "../../components/input/InputField";
import { LocationPicker } from "../../components/input/LocationPicker";

// ─ Static option lists for editor 
const CATEGORY_OPTIONS = [
  { value: "technology",    label: "Technology & Software" },
  { value: "design",        label: "Design & Creative" },
  { value: "marketing",     label: "Marketing & Sales" },
  { value: "finance",       label: "Finance & Accounting" },
  { value: "healthcare",    label: "Healthcare & Medical" },
  { value: "education",     label: "Education & Training" },
  { value: "engineering",   label: "Engineering" },
  { value: "operations",    label: "Operations & Logistics" },
  { value: "hr",            label: "Human Resources" },
  { value: "other",         label: "Other" },
];

const JOB_TYPE_OPTIONS = [
  { value: "Full-Time",   label: "Full-Time" },
  { value: "Part-Time",   label: "Part-Time" },
  { value: "Contract",    label: "Contract" },
  { value: "Internship",  label: "Internship" },
  { value: "Remote",      label: "Remote" },
  { value: "Other",       label: "Other" },
];

// Currency badge component
const GhsIcon = () => (
  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 leading-none">GH₵</span>
);

const ManageJobs = () => {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, alphabetical

  // Edit modal state
  const [editingJob, setEditingJob] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete modal state
  const [deletingJobId, setDeletingJobId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get(API_PATHS.JOBS.GET_JOBS_EMPLOYER);
      setJobs(response.data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Handle Search & Filter
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isActive = !job.isClosed;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "closed" && !isActive);

    return matchesSearch && matchesStatus;
  });

  // Handle Sort
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
    return 0;
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy]);

  // Pagination calculations
  const totalItems = sortedJobs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedJobs = sortedJobs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Toggle Close / Reopen
  const handleToggleClose = async (jobId, currentClosedState) => {
    const loadingToast = toast.loading(currentClosedState ? "Reopening job..." : "Closing job...");
    try {
      const response = await axiosInstance.patch(API_PATHS.JOBS.TOGGLE_CLOSE(jobId));
      toast.dismiss(loadingToast);
      toast.success(response.data?.message || "Job status updated successfully");
      
      // Update local state
      setJobs(prev =>
        prev.map(job => (job._id === jobId ? { ...job, isClosed: !job.isClosed } : job))
      );
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error toggling job status:", error);
      toast.error(error.response?.data?.message || "Failed to update job status");
    }
  };

  // Trigger Delete confirmation
  const initiateDelete = (jobId) => {
    setDeletingJobId(jobId);
  };

  // Perform Delete
  const handleDeleteConfirm = async () => {
    if (!deletingJobId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(API_PATHS.JOBS.DELETE_JOB(deletingJobId));
      toast.success("Job deleted successfully");
      setJobs(prev => prev.filter(job => job._id !== deletingJobId));
      setDeletingJobId(null);
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error(error.response?.data?.message || "Failed to delete job");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Modal
  const handleEditClick = (job) => {
    setEditingJob(job);
    setEditForm({
      title: job.title || "",
      location: job.location || "",
      latitude: job.latitude || null,
      longitude: job.longitude || null,
      category: job.category || "",
      customCategory: job.customCategory || "",
      jobType: job.type || "", // DB stores as type, form uses jobType
      customJobType: job.customJobType || "",
      description: job.description || "",
      requirements: job.requirements || "",
      salaryMin: job.salaryMin || "",
      salaryMax: job.salaryMax || "",
      deadline: job.deadline ? new Date(job.deadline).toISOString().split("T")[0] : "",
    });
    setEditErrors({});
  };

  // Edit Change Handler
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    if (editErrors[name]) setEditErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Edit validation
  const validateEdit = () => {
    const errors = {};
    if (!editForm.title?.trim()) errors.title = "Job title is required.";
    if (!editForm.location?.trim()) errors.location = "Location is required.";
    if (!editForm.category) errors.category = "Please select a category.";
    if (editForm.category === "other" && !editForm.customCategory?.trim())
      errors.customCategory = "Please specify your category.";
    if (!editForm.jobType) errors.jobType = "Please select a job type.";
    if (editForm.jobType === "Other" && !editForm.customJobType?.trim())
      errors.customJobType = "Please specify the job type.";
    if (!editForm.description?.trim()) errors.description = "Job description is required.";
    if (!editForm.requirements?.trim()) errors.requirements = "Requirements are required.";
    if (editForm.salaryMin && editForm.salaryMax) {
      if (Number(editForm.salaryMin) > Number(editForm.salaryMax)) {
        errors.salaryMin = "Min salary cannot exceed max salary.";
      }
    }
    return errors;
  };

  // Submit Edit Form
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateEdit();
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        requirements: editForm.requirements,
        location: editForm.location,
        latitude: editForm.latitude || undefined,
        longitude: editForm.longitude || undefined,
        category: editForm.category,
        customCategory: editForm.category === "other" ? editForm.customCategory : undefined,
        type: editForm.jobType, // mapped correctly to schema 'type'
        customJobType: editForm.jobType === "Other" ? editForm.customJobType : undefined,
        salaryMin: Number(editForm.salaryMin) || undefined,
        salaryMax: Number(editForm.salaryMax) || undefined,
        deadline: editForm.deadline || undefined,
      };

      await axiosInstance.put(API_PATHS.JOBS.UPDATE_JOB(editingJob._id), payload);
      toast.success("Job updated successfully");
      
      // Refresh local jobs list
      setJobs(prev =>
        prev.map(job =>
          job._id === editingJob._id
            ? {
                ...job,
                ...payload,
                isClosed: job.isClosed, // maintain close status
              }
            : job
        )
      );
      setEditingJob(null);
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error(error.response?.data?.message || "Failed to update job");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout activeMenu="manage-jobs">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/*  Header Row  */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Job Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your job postings and track applications
            </p>
          </div>
          <button
            onClick={() => navigate("/post-job")}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/10 hover:bg-opacity-95 transition-all hover:scale-105 active:scale-100 shrink-0"
          >
            <Plus className="h-4.5 w-4.5" />
            Add New Job
          </button>
        </div>

        {/*  Search and Filter Controls  */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Result summary */}
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500">
          Showing {sortedJobs.length} of {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </div>

        {/*  Main content grid/table ─ */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Loading your jobs list…</p>
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-gray-800">
              <Briefcase className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No jobs found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Try adjusting your search query, status filters, or post a new job opening.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-gray-500 dark:text-gray-400">
                <thead className="bg-slate-50/75 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <tr>
                    <th scope="col" className="px-6 py-4">Job Title</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Applicants</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {paginatedJobs.map((job) => {
                    const isActive = !job.isClosed;
                    return (
                      <tr key={job._id} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{job.title}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{job.company?.name || "SPG User"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                              isActive
                                ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                                : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {isActive ? "Active" : "Closed"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => navigate(`/applicants?jobId=${job._id}`)}
                            className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                          >
                            <Users className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                            <span>{job.applicantCount ?? 0}</span>
                          </button>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Edit */}
                            <button
                              onClick={() => handleEditClick(job)}
                              className="rounded-lg p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                              title="Edit Job"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            {/* Close/Reopen */}
                            <button
                              onClick={() => handleToggleClose(job._id, job.isClosed)}
                              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition border ${
                                isActive
                                  ? "text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                  : "text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <XCircle className="h-3.5 w-3.5" />
                                  Close
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Reopen
                                </>
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => initiateDelete(job._id)}
                              className="rounded-lg p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                              title="Delete Job"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack Cards Layout */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedJobs.map((job) => {
                const isActive = !job.isClosed;
                return (
                  <div key={job._id} className="p-5 space-y-4 hover:bg-slate-50/50 dark:hover:bg-gray-800/50">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base">{job.title}</h4>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{job.company?.name || "SPG User"}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isActive
                            ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                            : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
                        }`}
                      >
                        {isActive ? "Active" : "Closed"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 dark:border-gray-800 pt-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-500">Applicants:</span>
                        <button
                          onClick={() => navigate(`/applicants?jobId=${job._id}`)}
                          className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          <Users className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                          {job.applicantCount ?? 0}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons list */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleEditClick(job)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                        Edit
                      </button>

                      <button
                        onClick={() => handleToggleClose(job._id, job.isClosed)}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                          isActive
                            ? "border-orange-100 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            : "border-emerald-100 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        }`}
                      >
                        {isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        {isActive ? "Close" : "Reopen"}
                      </button>

                      <button
                        onClick={() => initiateDelete(job._id)}
                        className="flex items-center justify-center rounded-xl border border-red-100 dark:border-red-500/30 p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/*  Pagination Footer Controls  */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 rounded-b-2xl">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{totalItems}</span> jobs
                </div>

                <div className="flex items-center gap-2">
                  {/* Items per page selector */}
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 outline-none cursor-pointer focus:border-blue-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        type="button"
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                          currentPage === page
                            ? "bg-primary text-white shadow-sm shadow-primary/10"
                            : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/*  Edit Job Modal  */}
      {editingJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Job Posting</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">Make changes to your job parameters below</p>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <InputField
                label="Job Title"
                name="title"
                required
                icon={Briefcase}
                placeholder="e.g. Lead Developer"
                value={editForm.title}
                onChange={handleEditChange}
                error={editErrors.title}
              />

              <LocationPicker
                label="Location / Business Address"
                required
                value={editForm.location}
                latitude={editForm.latitude}
                longitude={editForm.longitude}
                onChange={({ location, latitude, longitude }) => {
                  setEditForm((prev) => ({ ...prev, location, latitude, longitude }));
                  if (editErrors.location) setEditErrors((prev) => ({ ...prev, location: "" }));
                }}
                error={editErrors.location}
                placeholder="e.g. Accra, Ghana or search Google Locator"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Category"
                  name="category"
                  required
                  icon={Users}
                  placeholder="Select category"
                  options={CATEGORY_OPTIONS}
                  value={editForm.category}
                  onChange={handleEditChange}
                  error={editErrors.category}
                />
                <SelectField
                  label="Job Type"
                  name="jobType"
                  required
                  icon={Briefcase}
                  placeholder="Select type"
                  options={JOB_TYPE_OPTIONS}
                  value={editForm.jobType}
                  onChange={handleEditChange}
                  error={editErrors.jobType}
                />
              </div>

              {/* Conditional "Other" specification fields */}
              {editForm.category === "other" && (
                <InputField
                  label="Specify Category"
                  name="customCategory"
                  required
                  icon={Users}
                  placeholder="e.g., Agriculture, Logistics…"
                  value={editForm.customCategory}
                  onChange={handleEditChange}
                  error={editErrors.customCategory}
                />
              )}

              {editForm.jobType === "Other" && (
                <InputField
                  label="Specify Job Type"
                  name="customJobType"
                  required
                  icon={Briefcase}
                  placeholder="e.g., Freelance, Volunteer…"
                  value={editForm.customJobType}
                  onChange={handleEditChange}
                  error={editErrors.customJobType}
                />
              )}

              {/* Application Deadline */}
              <InputField
                label="Application Deadline"
                name="deadline"
                type="date"
                icon={Calendar}
                placeholder="Select closing date"
                value={editForm.deadline}
                onChange={handleEditChange}
                error={editErrors.deadline}
                hint="The date when this job listing stops accepting applications"
              />

              <TextAreaField
                label="Job Description"
                name="description"
                required
                placeholder="Describe role..."
                value={editForm.description}
                onChange={handleEditChange}
                error={editErrors.description}
                rows={5}
              />

              <TextAreaField
                label="Requirements"
                name="requirements"
                required
                placeholder="Requirements list..."
                value={editForm.requirements}
                onChange={handleEditChange}
                error={editErrors.requirements}
                rows={4}
              />

              <div>
                <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Salary Range</p>
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    name="salaryMin"
                    type="number"
                    icon={GhsIcon}
                    iconPadding="pl-14"
                    placeholder="Min"
                    value={editForm.salaryMin}
                    onChange={handleEditChange}
                    error={editErrors.salaryMin}
                  />
                  <InputField
                    name="salaryMax"
                    type="number"
                    icon={GhsIcon}
                    iconPadding="pl-14"
                    placeholder="Max"
                    value={editForm.salaryMax}
                    onChange={handleEditChange}
                    error={editErrors.salaryMax}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*  Delete Confirmation Dialog  */}
      {deletingJobId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Delete Job Posting</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this job posting? This action is permanent and all candidate applications for this job will be removed.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setDeletingJobId(null)}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ManageJobs;