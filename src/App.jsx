import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { Toaster } from "react-hot-toast";

// New Redesigned Public & Core Pages matching SCREENS
import FindJobs from "./pages/FindJobs/FindJobs";
import BrowseCompanies from "./pages/Companies/BrowseCompanies";
import SalariesInsights from "./pages/Salaries/SalariesInsights";
import ResumeAnalyzer from "./pages/ResumeAnalyzer/ResumeAnalyzer";
import SavedJobs from "./pages/Candidate/SavedJobs";
import JobDetails from "./pages/Candidate/JobDetails";
import JobPostingForm from "./pages/Employer/JobPostingForm";

// Auth Pages
import SignUp from "./pages/Auth/SignUp";
import Login from "./pages/Auth/Login";
import SSOCallback from "./pages/Auth/SSOCallback";

// Protected Candidate & Employer Pages
import UserProfile from "./pages/Candidate/UserProfile";
import MyDocuments from "./pages/Candidate/MyDocuments";
import EmployerDashboard from "./pages/Employer/EmployerDashboard";
import ApplicationViewer from "./pages/Employer/AppplicationViewer";
import ManageJobs from "./pages/Employer/ManageJobs";
import EmployerProfilePage from "./pages/Employer/EmployerProfilePage";
import EmployerSetup from "./pages/Employer/EmployerSetup";
import EmailTemplates from "./pages/Admin/EmailTemplates";
import ModerationQueue from "./pages/Admin/ModerationQueue";
import AdminOverview from "./pages/Admin/Overview";
import AdminCompanies from "./pages/Admin/Companies";
import AdminAccounts from "./pages/Admin/Accounts";
import AdminJobs from "./pages/Admin/JobsOversight";
import ProtectedRoute from "./routes/ProtectedRoute";
import EmployerOnboardingRoute from "./routes/EmployerOnboardingRoute";
import LandingPage from "./pages/LandingPage/LandingPage";

export const App = () => {
  return (
    <div>
      <Router>
        <Routes>
          {/* Public Core Job Search & Discovery Pages */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/find-jobs" element={<FindJobs />} />
          <Route path="/browse-companies" element={<BrowseCompanies />} />
          <Route path="/salaries-insights" element={<SalariesInsights />} />
          <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
          <Route path="/job/:jobId" element={<JobDetails />} />

          {/* Auth Routes */}
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sso-callback" element={<SSOCallback />} />

          {/* Candidate-only routes — login required */}
          <Route element={<ProtectedRoute requiredRole="jobseeker" />}>
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/saved-jobs" element={<SavedJobs />} />
            <Route path="/applications" element={<MyDocuments />} />
            {/* Keep old bookmarks and shared links working while directing the
                candidate to the single applications-and-documents hub. */}
            <Route path="/documents" element={<Navigate to="/applications" replace />} />
            <Route path="/my-applications" element={<Navigate to="/applications" replace />} />
          </Route>

          {/* Employer-only routes — login required */}
          <Route element={<ProtectedRoute requiredRole="employer" />}>
            {/* The setup route is intentionally exempt from the completion gate. */}
            <Route path="/company-setup" element={<EmployerSetup />} />

            <Route element={<EmployerOnboardingRoute />}>
              <Route path="/employer-dashboard" element={<EmployerDashboard />} />
              <Route path="/post-job" element={<JobPostingForm />} />
              {/* Editing reuses the full posting form so employers get every field. */}
              <Route path="/edit-job/:jobId" element={<JobPostingForm />} />
              <Route path="/manage-jobs" element={<ManageJobs />} />
              <Route path="/email-templates" element={<EmailTemplates />} />
              <Route path="/applicants" element={<ApplicationViewer />} />
              <Route path="/company-profile" element={<EmployerProfilePage />} />
            </Route>
          </Route>

          {/* Platform control — every screen here is admin-gated on the server too */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin-overview" element={<AdminOverview />} />
            <Route path="/admin-companies" element={<AdminCompanies />} />
            <Route path="/admin-accounts" element={<AdminAccounts />} />
            <Route path="/admin-jobs" element={<AdminJobs />} />
            <Route path="/admin-email-templates" element={<EmailTemplates />} />
            <Route path="/admin-moderation" element={<ModerationQueue />} />
            <Route path="/admin/moderation" element={<ModerationQueue />} />
            <Route path="/admin/email-templates" element={<EmailTemplates />} />
            <Route path="/admin/companies" element={<AdminCompanies />} />
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin" element={<Navigate to="/admin-overview" replace />} />
          </Route>

          {/* Catch all routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "",
          style: {
            fontSize: "13px",
            borderRadius: "12px",
            background: "#0b1c30",
            color: "#ffffff",
          },
        }}
      />
    </div>
  );
};

export default App;
