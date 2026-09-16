import { Briefcase, MapPin, Calendar, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import moment from "moment";

const JobRow = ({ job }) => {
  const isActive = job.isActive !== false && !job.isClosed;

  return (
    <div className="group flex items-center gap-4 rounded-xl p-3 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-gray-800">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 ring-1 ring-blue-100 dark:ring-blue-500/30">
        <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
          {job.title}
        </p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {moment(job.createdAt).format("MMM D, YYYY")}
          </span>
          {job.applicantCount != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {job.applicantCount} applied
            </span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          isActive
            ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
            : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700"
        }`}
      >
        {isActive ? "Active" : "Closed"}
      </span>
    </div>
  );
};

const JobDashboardCard = ({ jobs = [] }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent Job Posts</h3>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Your latest job postings</p>
        </div>
        <button
          onClick={() => navigate("/employer/jobs")}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
            <Briefcase className="h-7 w-7 text-blue-400 dark:text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No jobs posted yet</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Post your first job to start receiving applications</p>
          <button
            onClick={() => navigate("/employer/post-job")}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Post a Job
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {jobs.map((job) => (
            <JobRow key={job._id || job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};

export default JobDashboardCard;
