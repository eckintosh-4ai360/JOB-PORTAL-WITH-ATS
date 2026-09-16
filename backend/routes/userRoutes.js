const express = require("express");
const {
    updateProfile,
    deleteResume,
    getPublicProfile,
} = require("../controllers/userController");
const {
    getDocuments,
    uploadDocument,
    deleteDocument,
} = require("../controllers/documentController");
const { protect } = require("../middlewares/authMiddleware");

const upload = require("../middlewares/uploadMiddleware");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");

const router = express.Router();

// protected routes
router.put("/profile", protect, updateProfile);
router.delete("/resume", protect, deleteResume);

// documents (CV, certificates, etc.)
router.get("/documents", protect, getDocuments);
router.post("/documents", protect, upload.single("file"), uploadDocument);
router.delete("/documents/:docId", protect, deleteDocument);
router.post("/upload-resume", protect, upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        let resumeUrl;
        try {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder: "job-portal/resumes",
                resource_type: "raw",
            });
            resumeUrl = result.secure_url;
        } catch (cloudinaryError) {
            console.warn("Cloudinary upload failed, falling back to local disk storage:", cloudinaryError.message || cloudinaryError);
            const filename = await uploadToLocalDisk(req.file.buffer, req.file.originalname);
            resumeUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
        }

        res.status(200).json({ resumeUrl });
    } catch (error) {
        console.error("Resume upload error:", error);
        res.status(500).json({ message: "Resume upload failed", error: error.message });
    }
});

// public route
router.get("/public/:id", getPublicProfile);

module.exports = router;