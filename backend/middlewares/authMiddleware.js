const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect route 
const protect = async (req, res, next) => {
    try{
        let token = req.headers.authorization

        if(token && token.startsWith("Bearer")){
            token = token.split(" ")[1];          //Exttract the token

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
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
            req.user = await User.findById(decoded.id).select("-password");
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

module.exports = { protect, optionalAuth, emailTemplateAccess };
