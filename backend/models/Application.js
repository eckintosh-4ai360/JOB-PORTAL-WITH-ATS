const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
    {
        job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },

        // Registered user — optional (null for guest applications)
        applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

        // Guest applicant fields — used when applicant is null
        guestName: { type: String, default: "" },
        guestEmail: { type: String, default: "" },
        guestPhone: { type: String, default: "" },

        resume: { type: String, required: true }, // stored file path or URL
        coverLetter: { type: String },             // typed text
        coverLetterFile: { type: String },          // uploaded document URL
        status: {
            type: String,
            enum: ["Applied", "Under Review", "Interviewing", "Offered", "Rejected"],
            default: "Applied",
        },
        interview: {
            date: { type: Date },
            time: { type: String },
            location: { type: String },
            notes: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

// Custom validation: either a registered applicant OR guest name + email must be present
applicationSchema.pre("validate", function () {
    if (!this.applicant && (!this.guestName || !this.guestEmail)) {
        throw new Error("Either a registered applicant or guest name and email are required.");
    }
});

// Virtual to quickly check if an application is from a guest
applicationSchema.virtual("isGuest").get(function () {
    return !this.applicant;
});

// Ensure virtuals show up in JSON
applicationSchema.set("toJSON", { virtuals: true });
applicationSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Application", applicationSchema);
