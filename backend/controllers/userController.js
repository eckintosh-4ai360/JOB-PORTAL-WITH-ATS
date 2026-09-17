const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");

// @desc Update User profile
exports.updateProfile = async (req, res) => {
    try {
        const {name, avatar, resume, companyName, companyDescription, companyLogo} = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user._id } });
        if(!user) return res.status(404).json({message: "User not found"});
        
        const updateData = {};
        if (name) updateData.name = name;
        if (avatar) updateData.avatar = avatar;
        if (resume) updateData.resume = resume;

        if(user.role === "jobseeker"){
            if (resume) updateData.resume = resume;
        }
        //! if emplyer, allow updating company info
        if(user.role === "employer"){
            if (companyName) updateData.companyName = companyName;
            if (companyDescription) updateData.companyDescription = companyDescription;
            if (companyLogo) updateData.companyLogo = companyLogo;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user._id },
            data: updateData,
        });

        res.json(toClient({
            _id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            role: updatedUser.role,
            resume: updatedUser.resume || '',
            companyName: updatedUser.companyName,
            companyDescription: updatedUser.companyDescription,
            companyLogo: updatedUser.companyLogo,
            employerOnboardingComplete: updatedUser.employerOnboardingComplete !== false,
            employerOnboardingCompletedAt: updatedUser.employerOnboardingCompletedAt || null,
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).json({message: error.message});
    }
}

//@desc Delete Resume file for candidate only 
exports.deleteResume = async (req, res) => {
    try {
        const {resumeUrl} = req.body; //expect resume url to be the URL of teh resume 

        //! extract file name fromm the url
        const fileName = resumeUrl?.split("/")?.pop();

        const user = await prisma.user.findUnique({ where: { id: req.user._id } });
        if(!user) return res.status(404).json({message: "User not found"});

        if(user.role !== "jobseeker"){
            return res.status(403).json({message: "only candidate can delete resume"});
        }

        //construct full path to the resume file
        const filePath = path.join(__dirname, "..", "uploads", fileName);

        //Check if file exists then delete
        if(!fs.existsSync(filePath)){
            return res.status(404).json({message: "File not found"});
        }

        //Delete file
        fs.unlinkSync(filePath);

        //Update user model
        await prisma.user.update({
            where: { id: req.user._id },
            data: { resume: '' }
        });

        res.json({message: "Resume deleted successfully"});
       
    } catch (error) {
        console.error(error);
        res.status(500).json({message: error.message});
    }
}

// @desc Get user public profile
exports.getPublicProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, name: true, email: true, role: true,
                avatar: true, resume: true, clerkId: true,
                companyName: true, companyDescription: true, companyLogo: true,
                createdAt: true, updatedAt: true,
            }
        });
        if(!user) return res.status(404).json({message: "User not found"});
        res.json(toClient(user));
    } catch (error) {
        console.error(error);
        res.status(500).json({message: error.message});
    }
}
