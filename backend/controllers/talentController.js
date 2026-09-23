const prisma = require("../config/prisma");
const { searchTalent, isVerifiedEmployer } = require("../services/talentSearchService");
const { sendTalentInviteEmail } = require("../utils/emailService");

const SCOPES = ["all", "applicants", "open"];

// @desc    Natural-language search over the employer's applicants and the
//          candidates who opted in to Talent Search
// @route   GET /api/talent/search?q=&scope=&page=
// @access  Private (Employer only)
const search = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Talent Search is available to employers." });
        }

        const scope = SCOPES.includes(req.query.scope) ? req.query.scope : "all";
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

        const result = await searchTalent({
            employerId: req.user._id,
            query: String(req.query.q || ""),
            scope,
            page,
        });

        res.status(200).json(result);
    } catch (error) {
        console.error("Talent search failed:", error);
        res.status(500).json({ message: "Talent Search is temporarily unavailable", error: error.message });
    }
};

// @desc    Invite a candidate found in Talent Search to apply for a job. The
//          candidate is emailed; the employer never sees their address.
// @route   POST /api/talent/invite
// @access  Private (Employer only, verified company)
const invite = async (req, res) => {
    try {
        if (req.user.role !== "employer") {
            return res.status(403).json({ message: "Only employers can invite candidates." });
        }

        const { candidateId, jobId } = req.body || {};
        if (!candidateId || !jobId) {
            return res.status(400).json({ message: "Choose a candidate and a job." });
        }

        if (!(await isVerifiedEmployer(req.user._id))) {
            return res.status(403).json({ message: "Your company must be verified before you can invite candidates." });
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: {
                id: true, title: true, companyId: true, isClosed: true, deletedAt: true, moderationState: true,
                companyProfile: { select: { name: true } },
            },
        });
        if (!job || job.companyId !== req.user._id) {
            return res.status(404).json({ message: "Job not found" });
        }
        if (job.isClosed || job.deletedAt || job.moderationState === "hidden") {
            return res.status(400).json({ message: "You can only invite people to a job that is open." });
        }

        const [candidate, profile, appliedHere, appliedToEmployer] = await Promise.all([
            prisma.user.findUnique({
                where: { id: candidateId },
                select: { id: true, name: true, email: true, role: true, trustState: true },
            }),
            prisma.candidateProfile.findUnique({ where: { userId: candidateId }, select: { discoverable: true } }),
            prisma.application.findFirst({ where: { jobId: job.id, applicantId: candidateId }, select: { id: true } }),
            prisma.application.findFirst({
                where: { applicantId: candidateId, job: { companyId: req.user._id } },
                select: { id: true },
            }),
        ]);

        // Only someone this employer can find may be invited: an applicant of
        // theirs, or a candidate who opted in. Anyone else is reported as not
        // found, so the endpoint cannot be used to probe who exists.
        const reachable = candidate
            && candidate.role === "jobseeker"
            && candidate.trustState !== "suspended"
            && (profile?.discoverable || appliedToEmployer);
        if (!reachable) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        if (appliedHere) {
            return res.status(409).json({ message: `${candidate.name} has already applied for this job.` });
        }

        try {
            await prisma.talentInvite.create({
                data: { employerId: req.user._id, candidateId, jobId: job.id },
            });
        } catch (error) {
            if (error?.code === "P2002") {
                return res.status(409).json({ message: `${candidate.name} has already been invited to this job.` });
            }
            throw error;
        }

        const frontend = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
        // Not awaited: the invite is recorded whether or not the mail goes out.
        sendTalentInviteEmail({
            to: candidate.email,
            candidateName: candidate.name,
            companyName: job.companyProfile?.name || req.user.companyName || req.user.name,
            jobTitle: job.title,
            jobUrl: `${frontend}/job/${job.id}`,
        });

        res.status(201).json({ message: `Invitation sent to ${candidate.name}.`, jobId: job.id, candidateId });
    } catch (error) {
        console.error("Talent invite failed:", error);
        res.status(500).json({ message: "Could not send the invitation", error: error.message });
    }
};

module.exports = { search, invite };
