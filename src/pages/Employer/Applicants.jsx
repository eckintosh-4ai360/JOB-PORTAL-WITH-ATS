import { useSearchParams } from "react-router-dom";
import ApplicationViewer from "./AppplicationViewer";
import AllApplicants from "./AllApplicants";

/**
 * /applicants lists everyone who applied to any of the employer's jobs;
 * /applicants?jobId= opens one job's applicants in the full review view.
 */
const Applicants = () => {
  const [searchParams] = useSearchParams();
  return searchParams.get("jobId") ? <ApplicationViewer /> : <AllApplicants />;
};

export default Applicants;
