const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI environment variable is missing or undefined.");
        }
        await mongoose.connect(process.env.MONGO_URI, {});
        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.error("Error Connecting to MongoDB:", error.message || error);
    }
}

module.exports = connectDB;