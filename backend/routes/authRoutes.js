const express = require("express");
const {register, login, getMe, clerkAuth} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");

const router = express.Router();

// Placeholder test route
router.post("/register", register);
router.post("/login", login);
router.post("/clerk", clerkAuth);      // Google OAuth via Clerk
router.get("/me", protect, getMe);

router.post("/upload-image", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        let imageUrl;
        try {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder: "job-portal/avatars",
                resource_type: "image",
                format: "webp",
                transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
            });
            imageUrl = result.secure_url;
        } catch (cloudinaryError) {
            console.warn("Cloudinary upload failed, falling back to local disk storage:", cloudinaryError.message || cloudinaryError);
            const filename = await uploadToLocalDisk(req.file.buffer, req.file.originalname);
            imageUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
        }

        res.status(200).json({ imageUrl });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Image upload failed", error: error.message });
    }
}); 

module.exports = router;
