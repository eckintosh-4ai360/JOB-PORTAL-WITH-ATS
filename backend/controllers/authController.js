const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { createClerkClient, verifyToken } = require("@clerk/backend");
const { sendAccountCreatedEmail } = require("../utils/emailService");

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

//Generate Token
const genarateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: "30d"});
};

// @desc Register a new user
exports.register = async (req, res) => {
    try{
        const {name, email, password, avatar, role} = req.body;
        if (!role || !["jobseeker", "employer"].includes(role)) {
            return res.status(400).json({message: "A valid user role is required"});
        }
        const userExist = await User.findOne({email});
        if(userExist) return res.status(400).json({message: "User already exists"});
        const user = await User.create({name, email, password, avatar, role});

        sendAccountCreatedEmail({
            to: user.email,
            name: user.name,
            role: user.role,
        });

        res.status(201).json({
            token: genarateToken(user._id),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                companyName: user.companyName || '',
                companyDescription: user.companyDescription || '',
                companyLogo: user.companyLogo || '',
                resume: user.resume || '',
            }
        });

    } catch (error){
        console.error(error);
        res.status(500).json({message: error.message});
    }
}
// @desc login
exports.login = async (req, res) => {
    try{
        const {email, password} = req.body;
        const user = await User.findOne({email});
        if(!user || !await user.matchPassword(password)){
            return res.status(401).json({message: "Invalid credentials"});
        }
        res.json({
            token: genarateToken(user._id),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                companyName: user.companyName || '',
                companyDescription: user.companyDescription || '',
                companyLogo: user.companyLogo || '',
                resume: user.resume || '',
            }
        });
    } catch (error){
        console.error(error);
        res.status(500).json({message: error.message});
    }
}
// @desc get logged in user
exports.getMe = async (req, res) => {
    try{
        if (!req.user) {
            return res.status(401).json({message: "Not authorized"});
        }

        res.status(200).json({user: req.user});
    } catch (error){
        console.error(error);
        res.status(500).json({message: error.message});
    }
}

// @desc   Sign in / register via Clerk (Google OAuth)
// @route  POST /api/auth/clerk
// @body   { clerkToken: string, role: "jobseeker" | "employer" }
// @access Public
exports.clerkAuth = async (req, res) => {
    try {
        const { clerkToken, role } = req.body;

        if (!clerkToken) {
            return res.status(400).json({ message: "Clerk token is required" });
        }

        // Verify the session token with Clerk and get the user
        let clerkUser;
        try {
            // verifyToken decodes & verifies the Clerk session JWT and returns the payload
            // The "sub" claim is the Clerk user ID (user_xxxx)
            const payload = await verifyToken(clerkToken, {
                secretKey: process.env.CLERK_SECRET_KEY,
            });
            clerkUser = await clerkClient.users.getUser(payload.sub);
        } catch (err) {
            console.error("Clerk token verification failed:", err.message);
            return res.status(401).json({ message: "Invalid or expired Clerk token" });
        }

        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        const name  = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "User";
        const avatar = clerkUser.imageUrl || "";

        if (!email) {
            return res.status(400).json({ message: "No email found on Clerk account" });
        }

        // Find existing user by clerkId or email, or create a new one
        let user = await User.findOne({ $or: [{ clerkId: clerkUser.id }, { email }] });
        let isNewUser = false;

        if (user) {
            // Update clerkId if missing (e.g. email-account user now signs in with Google)
            if (!user.clerkId) {
                user.clerkId = clerkUser.id;
                await user.save();
            }
        } else {
            // New user — role is required on first sign-in
            if (!role || !["jobseeker", "employer"].includes(role)) {
                return res.status(400).json({ 
                    message: "Role is required for first-time sign-in. Please specify 'jobseeker' or 'employer'.",
                    requiresRole: true,
                });
            }
            user = await User.create({
                clerkId: clerkUser.id,
                name,
                email,
                avatar,
                role,
                password: null,
            });
            isNewUser = true;
        }

        if (isNewUser) {
            sendAccountCreatedEmail({
                to: user.email,
                name: user.name,
                role: user.role,
            });
        }

        res.json({
            token: genarateToken(user._id),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                companyName: user.companyName || '',
                companyDescription: user.companyDescription || '',
                companyLogo: user.companyLogo || '',
                resume: user.resume || '',
            }
        });

    } catch (error) {
        console.error("Clerk auth error:", error);
        res.status(500).json({ message: error.message });
    }
};
