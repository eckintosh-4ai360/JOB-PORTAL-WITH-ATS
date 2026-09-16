const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true,},
    // Optional — null for OAuth (Google/Clerk) users who never set a password
    password: {type: String, default: null},
    role: {type: String, enum: ["jobseeker", "employer", "admin"],  required: true},
    avatar: String,
    resume: String,

    documents: [{
        name: String,
        url: String,
        category: {type: String, enum: ["Resume", "Cover Letter", "Certificate", "ID Document", "Other"], default: "Other"},
        fileType: String,
        size: Number,
        publicId: String,      // Cloudinary public_id, for clean deletion
        resourceType: String,  // "image" | "raw" — needed by cloudinary.uploader.destroy
        uploadedAt: {type: Date, default: Date.now},
    }],

    // Clerk's unique user ID — set for Google/OAuth sign-ins
    clerkId: {type: String, default: null, index: true},

    //for employer
    companyName: String,
    companyDescription: String,
    companyLogo: String,
}, {timestamps: true});

// Encrypt password before saving
userSchema.pre("save", async function () {
    if (!this.password || !this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});


// Match password — returns false for OAuth-only accounts
userSchema.methods.matchPassword = function(enteredPassword){
    if (!this.password) return Promise.resolve(false);
    return bcrypt.compare(enteredPassword, this.password);
}; 

module.exports = mongoose.model("User", userSchema);
