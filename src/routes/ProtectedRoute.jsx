import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ requiredRole, redirectTo = "/login" }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // While the auth context is resolving from localStorage, render nothing to avoid a flash-redirect on page refresh.
  if (loading) return null;

  // Not logged in → redirect to login, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Logged in but wrong role → send back to their own dashboard
  if (requiredRole && user?.role !== requiredRole) {
    const fallback =
      user?.role === "admin"
        ? "/admin-overview"
        : user?.role === "employer"
          ? user?.employerOnboardingComplete === false
            ? "/company-setup"
            : "/employer-dashboard"
          : "/find-jobs";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
