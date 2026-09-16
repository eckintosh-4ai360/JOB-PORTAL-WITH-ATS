const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    variables: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
