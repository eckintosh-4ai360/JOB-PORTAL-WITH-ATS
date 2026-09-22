import { useCallback, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";
import { useAuth } from "../context/AuthContext";

/**
 * The ids of jobs this account has already applied to.
 *
 * The API refuses a second application, but it can only say so after the form
 * has been filled in and the CV uploaded. Knowing up front lets the page say
 * "Applied" instead of taking someone through a submission that cannot succeed.
 *
 * Guests get an empty set — their applications are matched by email, which the
 * browser has no way to look up, so their buttons stay as they were.
 */
export const useAppliedJobs = () => {
  const { isAuthenticated } = useAuth();
  const [appliedJobIds, setAppliedJobIds] = useState(() => new Set());

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    axiosInstance
      .get(API_PATHS.APPLICATIONS.GET_MY_APPLICATIONS)
      .then((res) => {
        if (cancelled) return;
        const ids = (res.data || [])
          .map((application) => application.job?.id || application.job?._id || application.jobId)
          .filter(Boolean);
        setAppliedJobIds(new Set(ids));
      })
      .catch(() => {
        // Unknown is the safe default: the button stays live and the API still
        // refuses a duplicate. Never block applying because this lookup failed.
        if (!cancelled) setAppliedJobIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Gated on the session rather than cleared on sign-out, so logging out needs
  // no state write — ids left over from the previous session never answer true.
  const hasApplied = useCallback(
    (jobId) => isAuthenticated && Boolean(jobId) && appliedJobIds.has(jobId),
    [isAuthenticated, appliedJobIds]
  );

  /** Mark one applied straight after a successful submit, without refetching. */
  const markApplied = useCallback((jobId) => {
    if (!jobId) return;
    setAppliedJobIds((current) => new Set(current).add(jobId));
  }, []);

  return { hasApplied, markApplied };
};
