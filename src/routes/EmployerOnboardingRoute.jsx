import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const EmployerOnboardingRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const needsCompanySetup =
    user?.role === "employer" && user?.employerOnboardingComplete === false;

  if (needsCompanySetup) {
    return (
      <Navigate
        to="/company-setup"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
};

export default EmployerOnboardingRoute;
