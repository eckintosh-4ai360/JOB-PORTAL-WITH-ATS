const mongoose = require("mongoose")

const jobSchema = new mongoose.Schema({
    title: {type: String, required: true},
    description: {type: String, required: true},
    requirements: {type: String, required: true},
    location: {type: String},
    latitude: {type: Number},
    longitude: {type: Number},
    category: {type: String},
    customCategory: {type: String},
    type: {
        type: String, 
        enum: ["Remote",  "Part-Time", "Full-Time", "Internship", "Contract", "Other" ],
        required: true,
    },
    customJobType: {type: String},
    deadline: {type: Date},
    //employer
    company: {type: mongoose.Schema.Types.ObjectId, ref:"User", required: true}, 

    salaryMin: {type: Number},
    salaryMax: {type: Number},
    isClosed: {type: Boolean, default: false},

    jobType: {type: String, enum: ["full-time", "part-time", "contract", "temporary"]},
    companyLogo: String,
    }, 
    
    {
        timestamps: true,
    }

);

module.exports = mongoose.model("Job", jobSchema);