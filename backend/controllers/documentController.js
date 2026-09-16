const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");

// @desc Get all documents for the logged-in user
exports.getDocuments = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ documents: user.documents || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc Upload a new document (resume, certificate, etc.)
exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const { name, category } = req.body;
        const validCategories = ["Resume", "Cover Letter", "Certificate", "ID Document", "Other"];
        const docCategory = validCategories.includes(category) ? category : "Other";
        const resourceType = req.file.mimetype.startsWith("image/") ? "image" : "raw";

        let url, publicId;
        try {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder: "job-portal/documents",
                resource_type: resourceType,
            });
            url = result.secure_url;
            publicId = result.public_id;
        } catch (cloudinaryError) {
            console.warn("Cloudinary upload failed, falling back to local disk storage:", cloudinaryError.message || cloudinaryError);
            const filename = await uploadToLocalDisk(req.file.buffer, req.file.originalname);
            url = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
            publicId = null;
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const newDocument = {
            name: name || req.file.originalname,
            url,
            category: docCategory,
            fileType: req.file.mimetype,
            size: req.file.size,
            publicId,
            resourceType,
            uploadedAt: new Date(),
        };

        user.documents.push(newDocument);

        // Keep the profile resume field (used for 1-click apply) in sync
        if (docCategory === "Resume") {
            user.resume = url;
        }

        await user.save();

        res.status(201).json({ documents: user.documents, resume: user.resume || "" });
    } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({ message: "Document upload failed", error: error.message });
    }
};

// @desc Delete a document
exports.deleteDocument = async (req, res) => {
    try {
        const { docId } = req.params;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const document = user.documents.id(docId);
        if (!document) return res.status(404).json({ message: "Document not found" });

        // Delete the underlying file
        if (document.publicId) {
            try {
                await cloudinary.uploader.destroy(document.publicId, {
                    resource_type: document.resourceType || "raw",
                });
            } catch (cloudinaryError) {
                console.warn("Cloudinary delete failed:", cloudinaryError.message || cloudinaryError);
            }
        } else if (document.url) {
            const fileName = document.url.split("/").pop();
            const filePath = path.join(__dirname, "..", "uploads", fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        const wasProfileResume = user.resume && document.url === user.resume;
        document.deleteOne();

        if (wasProfileResume) {
            const remainingResumes = user.documents
                .filter((d) => d.category === "Resume")
                .sort((a, b) => b.uploadedAt - a.uploadedAt);
            user.resume = remainingResumes[0]?.url || "";
        }

        await user.save();

        res.json({ documents: user.documents, resume: user.resume || "" });
    } catch (error) {
        console.error("Document delete error:", error);
        res.status(500).json({ message: error.message });
    }
};
