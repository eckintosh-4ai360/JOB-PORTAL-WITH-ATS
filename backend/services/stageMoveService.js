const prisma = require("../config/prisma");
const {
    sendApplicationStatusUpdatedEmail,
    sendUnderReviewEmail,
    sendInterviewScheduledEmail,
    sendOfferEmail,
    sendRejectionEmail,
    sendShortlistedEmail,
    sendHiredEmail,
} = require("../utils/emailService");
const {
    normalizeStatus,
    findStage,
    canTransition,
    toCandidateStatus,
} = require("../utils/hiringPipeline");

/**
 * Moving an application to another stage of the employer's pipeline, and
 * telling the candidate when what they can see changes. One place for it, so a
 * move made from the applicant view and one made in bulk from the shortlist
 * follow the same rules and send the same emails.
 *
 * The pipeline only runs forwards (utils/hiringPipeline.canTransition). A
 * candidate is emailed as they move through it, so walking a stage backwards
 * would contradict something they have already been told.
 */

// What a move reads back: enough to email the candidate and answer the client.
const MOVE_INCLUDE = {
    job: { select: { id: true, title: true, location: true, type: true, isClosed: true } },
    applicant: { select: { id: true, name: true, email: true, avatar: true, resume: true } },
};

/**
 * Tell the candidate about a move — only when what they can see changes.
 * Screening to Longlisted says nothing; Longlisted to Shortlisted does. An
 * interview stage always sends its details, since a second interview is news
 * even though the phase is the same.
 */
const notifyCandidate = ({ application, stages, previousStatus, stage, interview }) => {
    const to = application.applicant?.email || application.guestEmail;
    if (!to) return;

    const payload = {
        to,
        applicantName: application.applicant?.name || application.guestName || "Applicant",
        jobTitle: application.job.title,
    };

    if (stage.type === "rejected") return sendRejectionEmail(payload);
    if (stage.type === "interview") return sendInterviewScheduledEmail({ ...payload, interview });
    if (stage.type === "offer") return sendOfferEmail(payload);
    if (stage.type === "hired") return sendHiredEmail(payload);

    const before = toCandidateStatus(stages, previousStatus);
    const after = toCandidateStatus(stages, stage.id);
    if (before.phase === after.phase) return;

    if (after.phase === "under_review") return sendUnderReviewEmail(payload);
    if (after.phase === "shortlisted") return sendShortlistedEmail(payload);
    return sendApplicationStatusUpdatedEmail({ ...payload, status: after.label });
};

/**
 * Move one application to `stage`. The caller has already checked that the
 * employer owns it. Returns `{ application }` — the updated row, with its job
 * and applicant — or `{ error: { status, message, currentStatus? } }`.
 *
 * @param {object} options
 * @param {object} options.application Row with `job.title` and `applicant`
 * @param {object[]} options.stages     The employer's stages
 * @param {object} options.stage        The stage to move to (from findStage)
 * @param {object} [options.interview]  { date, time, location, notes } for an interview stage
 */
const moveApplication = async ({ application, stages, stage, interview }) => {
    const current = normalizeStatus(application.status);
    const currentStage = findStage(stages, current);

    // Re-sending an interview stage the application is already in is a
    // reschedule, not a move — the one same-stage update worth accepting.
    const isReschedule = stage.id === current && stage.type === "interview";

    if (!isReschedule && !canTransition(stages, current, stage.id)) {
        const settled = currentStage?.type === "rejected" || currentStage?.type === "hired";
        return {
            error: {
                status: 409,
                message: settled
                    ? `This application is settled as "${currentStage.name}" and can no longer be moved.`
                    : `An application cannot move from "${currentStage?.name || current}" back to "${stage.name}".`,
                currentStatus: current,
            },
        };
    }

    const updateData = { status: stage.id };

    if (stage.type === "interview") {
        if (!application.applicantId) {
            return { error: { status: 400, message: "Interviews can only be scheduled for candidates with registered accounts." } };
        }
        if (!interview || !interview.date || !interview.time || !interview.location) {
            return { error: { status: 400, message: "Interview date, time, and location/link are required when scheduling an interview." } };
        }
        updateData.interviewDate = new Date(interview.date);
        updateData.interviewTime = interview.time;
        updateData.interviewLocation = interview.location;
        updateData.interviewNotes = interview.notes || "";
    }

    // Conditional on the stage it was read in, so two recruiters moving the
    // same applicant at once cannot both succeed and both email them.
    const { count } = await prisma.application.updateMany({
        where: { id: application.id, status: application.status },
        data: updateData,
    });
    if (count === 0) {
        return {
            error: {
                status: 409,
                message: "Someone else moved this application a moment ago. Refresh to see where it is now.",
            },
        };
    }

    const updated = await prisma.application.findUnique({
        where: { id: application.id },
        include: MOVE_INCLUDE,
    });

    notifyCandidate({
        application: updated,
        stages,
        previousStatus: current,
        stage,
        interview: {
            date: updateData.interviewDate,
            time: updateData.interviewTime,
            location: updateData.interviewLocation,
            notes: updateData.interviewNotes,
        },
    });

    return { application: updated };
};

module.exports = {
    MOVE_INCLUDE,
    notifyCandidate,
    moveApplication,
};
