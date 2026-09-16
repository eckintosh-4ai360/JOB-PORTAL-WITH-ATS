require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

const [, , email, password, ...nameParts] = process.argv;
const name = nameParts.join(" ") || "Platform Admin";

if (!email || !password) {
    console.error("Usage: npm run create-admin -- <email> <password> [name]");
    process.exit(1);
}

const createAdmin = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not configured");
        }

        await mongoose.connect(process.env.MONGO_URI);
        let user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            user = new User({
                name,
                email: email.toLowerCase().trim(),
                password,
                role: "admin",
            });
        } else {
            user.role = "admin";
            user.name = name;
            user.password = password;
        }

        await user.save();
        console.log(`Admin access enabled for ${user.email}`);
    } catch (error) {
        console.error("Could not create admin:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

createAdmin();
