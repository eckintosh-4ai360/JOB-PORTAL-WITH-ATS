const { Resend } = require("resend");
const prisma = require("../config/prisma");

// Resend sends over HTTPS, unlike SMTP (port 587/465/25) which Render blocks outbound.
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const emailShell = (content) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 8px;">
        ${content}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from Job Portal. Please do not reply to this email.</p>
    </div>
`;

// These defaults seed the database the first time an admin opens the templates
// screen. Existing saved templates are never overwritten.
const DEFAULT_EMAIL_TEMPLATES = [
    {
        key: "account-created",
        name: "Account created",
        description: "Sent when a new candidate or employer account is created.",
        subject: "Welcome to Job Portal",
        variables: ["name", "role"],
        html: emailShell(`
            <h2 style="color: #2563eb;">Welcome to Job Portal!</h2>
            <p>Hi <strong>{{name}}</strong>,</p>
            <p>Your account has been created successfully.</p>
            <p>You are signed up as a <strong>{{role}}</strong>.</p>
            <p>You can now browse roles, manage your profile, and keep track of your activity on the platform.</p>
        `),
    },
    {
        key: "application-submitted",
        name: "Application received",
        description: "Sent to an applicant after they submit an application.",
        subject: "Application Received — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #2563eb;">Application Received!</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>We've successfully received your application for the position of <strong>{{jobTitle}}</strong>.</p>
            <p>The employer will review your application and get back to you. You can expect an update on your application status.</p>
        `),
    },
    {
        key: "application-status-updated",
        name: "Application status updated",
        description: "Sent when the candidate-facing status changes and there is no dedicated message. {{status}} is what the candidate sees (e.g. Interview), never the internal stage name.",
        subject: "Application Status Updated - {{jobTitle}}",
        variables: ["applicantName", "jobTitle", "status"],
        html: emailShell(`
            <h2 style="color: #2563eb;">Application Status Updated</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>Your application for <strong>{{jobTitle}}</strong> has been updated.</p>
            <p>Current status: <strong>{{status}}</strong></p>
        `),
    },
    {
        key: "application-under-review",
        name: "Application under review",
        description: "Sent when an employer starts reviewing an application.",
        subject: "Your Application Is Under Review — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #d97706;">Application Under Review</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>Great news! The employer is currently reviewing your application for <strong>{{jobTitle}}</strong>.</p>
            <p>We'll notify you as soon as there's a further update.</p>
        `),
    },
    {
        key: "application-shortlisted",
        name: "Application shortlisted",
        description: "Sent when an employer shortlists an application.",
        subject: "You've Been Shortlisted — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #2563eb;">You've Been Shortlisted</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>Good news — your application for <strong>{{jobTitle}}</strong> has been shortlisted.</p>
            <p>The employer may be in touch about next steps. We'll email you as soon as there's a further update.</p>
        `),
    },
    {
        key: "interview-scheduled",
        name: "Interview scheduled",
        description: "Sent when an employer schedules an interview.",
        subject: "Interview Scheduled — {{jobTitle}}",
        variables: ["applicantName", "jobTitle", "interviewDate", "interviewTime", "interviewLocation", "interviewNotes"],
        html: emailShell(`
            <h2 style="color: #059669;">Interview Scheduled!</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>Congratulations! You've been shortlisted for an interview for the position of <strong>{{jobTitle}}</strong>.</p>
            <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 16px; border-radius: 4px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0;"><strong>📅 Date:</strong> {{interviewDate}}</p>
                <p style="margin: 0 0 8px 0;"><strong>⏰ Time:</strong> {{interviewTime}}</p>
                <p style="margin: 0 0 8px 0;"><strong>📍 Location / Link:</strong> {{interviewLocation}}</p>
                <p style="margin: 0;"><strong>📝 Notes:</strong> {{interviewNotes}}</p>
            </div>
            <p>Please confirm your availability or reach out if you need to reschedule.</p>
        `),
    },
    {
        key: "job-offer",
        name: "Job offer",
        description: "Sent when an employer marks an application as offered.",
        subject: "You've Received a Job Offer — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #7c3aed;">Congratulations — You Got the Offer!</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>We're thrilled to inform you that you've received a <strong>job offer</strong> for the position of <strong>{{jobTitle}}</strong>!</p>
            <p>The employer will be in touch with you shortly with further details about the offer.</p>
            <p>Wishing you all the best in this exciting new chapter! 🎊</p>
        `),
    },
    {
        key: "application-hired",
        name: "Hired",
        description: "Sent when an employer marks a candidate as hired.",
        subject: "Welcome aboard — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #059669;">Congratulations — You're Hired!</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>The employer has confirmed your hire for the position of <strong>{{jobTitle}}</strong>.</p>
            <p>They will contact you directly about your start date and onboarding. Best of luck in your new role!</p>
        `),
    },
    {
        key: "application-rejected",
        name: "Application update",
        description: "Sent when an employer rejects an application.",
        subject: "Application Update — {{jobTitle}}",
        variables: ["applicantName", "jobTitle"],
        html: emailShell(`
            <h2 style="color: #dc2626;">Application Update</h2>
            <p>Hi <strong>{{applicantName}}</strong>,</p>
            <p>Thank you for your interest in the <strong>{{jobTitle}}</strong> position and for taking the time to apply.</p>
            <p>After careful consideration, the employer has decided to move forward with other candidates at this time.</p>
            <p>We encourage you to keep exploring other opportunities on our platform. Don't be discouraged — the right role is out there!</p>
        `),
    },
    {
        key: "company-submitted",
        name: "Company verification submitted",
        description: "Sent to an employer when they submit their company setup for verification.",
        subject: "We received {{companyName}}'s verification request",
        variables: ["contactName", "companyName"],
        html: emailShell(`
            <h2 style="color: #2563eb;">Verification submitted</h2>
            <p>Hi <strong>{{contactName}}</strong>,</p>
            <p>We have received the registration details for <strong>{{companyName}}</strong> and added your company to our verification queue.</p>
            <p>A reviewer will check your business registration certificate and details. We will email you when the review starts and again once a decision is made.</p>
            <p>Your company profile stays visible in the meantime, but you can post jobs only once it is verified.</p>
        `),
    },
    {
        key: "company-under-review",
        name: "Company under review",
        description: "Sent to an employer when a reviewer starts checking their company.",
        subject: "{{companyName}} is now under review",
        variables: ["contactName", "companyName"],
        html: emailShell(`
            <h2 style="color: #d97706;">Your company is under review</h2>
            <p>Hi <strong>{{contactName}}</strong>,</p>
            <p>A reviewer has started checking the registration details for <strong>{{companyName}}</strong>.</p>
            <p>You do not need to do anything right now. We will email you as soon as a decision is made.</p>
        `),
    },
    {
        key: "company-approved",
        name: "Company approved",
        description: "Sent to an employer when a reviewer approves their company.",
        subject: "{{companyName}} is approved — you can start posting",
        variables: ["contactName", "companyName", "note"],
        html: emailShell(`
            <h2 style="color: #059669;">Your company has been approved</h2>
            <p>Hi <strong>{{contactName}}</strong>,</p>
            <p>We have reviewed the registration details for <strong>{{companyName}}</strong> and approved your account.</p>
            <p>You can now publish job postings, and your company carries the verified badge on your public profile.</p>
            <p>{{note}}</p>
        `),
    },
    {
        key: "company-rejected",
        name: "Company not approved",
        description: "Sent to an employer when a reviewer rejects their company. The reviewer's reason is the body of the message.",
        subject: "We could not approve {{companyName}} yet",
        variables: ["contactName", "companyName", "reason"],
        html: emailShell(`
            <h2 style="color: #dc2626;">We could not approve your company yet</h2>
            <p>Hi <strong>{{contactName}}</strong>,</p>
            <p>We reviewed the registration details for <strong>{{companyName}}</strong> and could not approve the account as it stands.</p>
            <p style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; color: #7f1d1d;">
                <strong>What needs attention:</strong><br />{{reason}}
            </p>
            <p>Update your company setup with the corrected details and submit again — your account goes straight back into the review queue.</p>
        `),
    },
];

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const replaceVariables = (value, data, escapeValues = false) => value.replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_, key) => escapeValues ? escapeHtml(data[key]) : String(data[key] ?? "")
);

const getTemplate = async (key) => {
    const fallback = DEFAULT_EMAIL_TEMPLATES.find((template) => template.key === key);
    if (!fallback) throw new Error(`Unknown email template: ${key}`);

    try {
        const saved = await prisma.emailTemplate.findUnique({ where: { key } });
        return saved || fallback;
    } catch (error) {
        console.warn(`Could not load saved email template ${key}; using the default`, error.message);
        return fallback;
    }
};

const sendEmail = async ({ to, subject, html }) => {
    try {
        if (!resend) {
            console.warn("RESEND_API_KEY is not configured; skipping email notification");
            return;
        }

        const { error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || "Job Portal <onboarding@resend.dev>",
            to,
            subject,
            html,
        });
        if (error) throw new Error(error.message);
        console.log(`📧 Email sent to ${to}: ${subject}`);
    } catch (error) {
        console.error("Failed to send email:", error.message);
    }
};

const sendTemplatedEmail = async ({ key, to, data }) => {
    const template = await getTemplate(key);
    await sendEmail({
        to,
        subject: replaceVariables(template.subject, data),
        html: replaceVariables(template.html, data, true),
    });
};

const sendAccountCreatedEmail = async ({ to, name, role }) => sendTemplatedEmail({
    key: "account-created", to, data: { name: name || "there", role: role || "user" },
});

const sendApplicationSubmittedEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "application-submitted", to, data: { applicantName, jobTitle },
});

const sendApplicationStatusUpdatedEmail = async ({ to, applicantName, jobTitle, status }) => sendTemplatedEmail({
    key: "application-status-updated", to, data: { applicantName, jobTitle, status },
});

const sendUnderReviewEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "application-under-review", to, data: { applicantName, jobTitle },
});

const sendInterviewScheduledEmail = async ({ to, applicantName, jobTitle, interview }) => sendTemplatedEmail({
    key: "interview-scheduled",
    to,
    data: {
        applicantName,
        jobTitle,
        interviewDate: new Date(interview.date).toLocaleDateString("en-GB", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
        }),
        interviewTime: interview.time,
        interviewLocation: interview.location,
        interviewNotes: interview.notes || "",
    },
});

const sendOfferEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "job-offer", to, data: { applicantName, jobTitle },
});

const sendShortlistedEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "application-shortlisted", to, data: { applicantName, jobTitle },
});

const sendHiredEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "application-hired", to, data: { applicantName, jobTitle },
});

const sendRejectionEmail = async ({ to, applicantName, jobTitle }) => sendTemplatedEmail({
    key: "application-rejected", to, data: { applicantName, jobTitle },
});

const sendCompanySubmittedEmail = async ({ to, contactName, companyName }) => sendTemplatedEmail({
    key: "company-submitted",
    to,
    data: { contactName: contactName || "there", companyName },
});

const sendCompanyUnderReviewEmail = async ({ to, contactName, companyName }) => sendTemplatedEmail({
    key: "company-under-review",
    to,
    data: { contactName: contactName || "there", companyName },
});

const sendCompanyApprovedEmail = async ({ to, contactName, companyName, note }) => sendTemplatedEmail({
    key: "company-approved",
    to,
    data: { contactName: contactName || "there", companyName, note: note || "" },
});

// The reviewer's reason is the whole point of this message — an employer who is
// told "no" without being told what to fix cannot do anything about it.
const sendCompanyRejectedEmail = async ({ to, contactName, companyName, reason }) => sendTemplatedEmail({
    key: "company-rejected",
    to,
    data: {
        contactName: contactName || "there",
        companyName,
        reason: reason || "No reason was recorded. Please contact support.",
    },
});

module.exports = {
    DEFAULT_EMAIL_TEMPLATES,
    sendEmail,
    sendAccountCreatedEmail,
    sendApplicationSubmittedEmail,
    sendApplicationStatusUpdatedEmail,
    sendUnderReviewEmail,
    sendInterviewScheduledEmail,
    sendOfferEmail,
    sendRejectionEmail,
    sendShortlistedEmail,
    sendHiredEmail,
    sendCompanySubmittedEmail,
    sendCompanyUnderReviewEmail,
    sendCompanyApprovedEmail,
    sendCompanyRejectedEmail,
};
