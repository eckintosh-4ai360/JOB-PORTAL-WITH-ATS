const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

// Middleware to protect route 
const protect = async (req, res, next) => {
    try{
        let token = req.headers.authorization

        if(token && token.startsWith("Bearer")){
            token = token.split(" ")[1];          //Exttract the token

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true, name: true, email: true, role: true,
                    avatar: true, resume: true, clerkId: true,
                    companyName: true, companyDescription: true, companyLogo: true,
                    employerOnboardingComplete: true, employerOnboardingCompletedAt: true,
                    createdAt: true, updatedAt: true,
                }
            });
            if (!user) {
                return res.status(401).json({message: "Not authorized, user not found"});
            }
            // Add _id alias for backward compatibility
            req.user = { ...user, _id: user.id };
            next();
        } else {
            return res.status(401).json({message: "Not authorized, no token"});
        }
    } catch (error){
        return res.status(401).json({message: "Not authorized, invalid token"});
    }
};
/**
 * Optional auth middleware — attaches req.user when a valid token is present,
 * but allows the request to proceed without authentication (for guest flows).
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        if (token && token.startsWith("Bearer")) {
            token = token.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true, name: true, email: true, role: true,
                    avatar: true, resume: true, clerkId: true,
                    companyName: true, companyDescription: true, companyLogo: true,
                    employerOnboardingComplete: true, employerOnboardingCompletedAt: true,
                    createdAt: true, updatedAt: true,
                }
            });
            if (user) {
                req.user = { ...user, _id: user.id };
            }
        }
        // If no token or invalid token, req.user stays undefined
    } catch (error) {
        // Token was present but invalid — silently continue as guest
        req.user = null;
    }
    next();
};

const emailTemplateAccess = (req, res, next) => {
    if (!['admin', 'employer'].includes(req.user?.role)) {
        return res.status(403).json({ message: "Employer access required" });
    }
    next();
};

/**
 * Admin-only guard. Moderation decisions carry enforcement power over real
 * accounts, so the queue is never exposed to employers.
 */
const adminOnly = (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Administrator access required" });
    }
    next();
};

module.exports = { protect, optionalAuth, emailTemplateAccess, adminOnly };
