import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, ShieldCheck, XCircle } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

/**
 * Tells an employer where their company stands with review.
 *
 * Without it, a pending company discovers the rule only by filling in a whole
 * job posting and being refused at the end. An approved company sees nothing —
 * there is no news, and a permanent green banner is just noise.
 */

const ReviewStatusBanner = () => {
  const { isAuthenticated, user } = useAuth();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "employer") return undefined;

    let cancelled = false;
    const timer = setTimeout(() => {
      axiosInstance
        .get(API_PATHS.COMPANIES.GET_MY_PROFILE)
        .then((res) => {
          if (!cancelled) setCompany(res.data);
        })
        .catch(() => {
          // No banner is better than a wrong one if the lookup fails.
          if (!cancelled) setCompany(null);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, user?.role]);

  const state = company?.approvalState;
  if (!state || state === "approved") return null;

  if (state === "setup_incomplete") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <Clock className="h-5 w-5 shrink-0 text-slate-500 dark:text-gray-400" />
        <p className="flex-1 text-sm font-bold text-slate-700 dark:text-gray-200">
          Finish your company setup to submit for review. You can post jobs once approved.
        </p>
        <Link
          to="/company-setup"
          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 dark:bg-gray-200 dark:text-gray-900"
        >
          Complete setup
        </Link>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
            Your company was not approved, so you cannot post jobs yet.
          </p>
          {company.approvalNote && (
            <p className="mt-0.5 text-sm text-rose-700 dark:text-rose-300/90">{company.approvalNote}</p>
          )}
        </div>
        <Link
          to="/company-setup"
          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
        >
          Update &amp; resubmit
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-sm font-bold text-amber-800 dark:text-amber-300">
        Your company is awaiting review. We check your registration details before you can post jobs — your profile
        stays visible in the meantime.
      </p>
    </div>
  );
};

export default ReviewStatusBanner;
