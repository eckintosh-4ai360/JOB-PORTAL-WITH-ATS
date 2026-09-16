const fs = require("fs");
const path = require("path");
const User = require("../models/User");

// @desc Update User profile
exports.updateProfile = async (req, res) => {
    try {
        const {name, avatar, resume, companyName, companyDescription, companyLogo} = req.body;
        const user = await User.findById(req.user._id);
        if(!user) res.status(404).json({message: "User not found"});
        
        user.name = name || user.name;
        user.avatar  = avatar || user.avatar;  
        user.resume = resume || user.resume;  

        if(user.role === "jobseeker"){
            user.resume = resume || user.resume;
        }
        //! if emplyer, allow updating company info
        if(user.role === "employer"){
            user.companyName = companyName || user.companyName;
            user.companyDescription = companyDescription || user.companyDescription;
            user.companyLogo = companyLogo || user.companyLogo;
        }
        await user.save();
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            resume: user.resume || '',
            companyName: user.companyName,
            companyDescription: user.companyDescription,
            companyLogo: user.companyLogo,}
        );
        
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

        const user = await User.findById(req.user._id);
        if(!user) res.status(404).json({message: "User not found"});

        if(user.role == "jobseeker"){
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
        user.resume = '';
        await user.save();

        res.json({message: "Resume deleted successfully"});
       
    } catch (error) {
        console.error(error);
        res.status(500).json({message: error.message});
    }
}

// @desc Get user public profile
exports.getPublicProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if(!user) res.status(404).json({message: "User not found"});
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: error.message});
    }
}

