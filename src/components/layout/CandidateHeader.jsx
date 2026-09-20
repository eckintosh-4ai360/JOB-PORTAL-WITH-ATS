import Navbar from "./Navbar";

/**
 * Backwards-compatible candidate header.
 *
 * Candidate pages used to render a separate, visually unrelated navigation
 * bar. Keeping this small adapter means those pages now share the public and
 * authenticated navbar, its account menu, and the one persisted colour-mode
 * control without breaking their imports.
 */
const CandidateHeader = () => <Navbar />;

export default CandidateHeader;
