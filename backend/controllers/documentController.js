const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const prisma = require("../config/prisma");
const { toClient } = require("../utils/prismaHelper");
const { uploadToCloudinary, uploadToLocalDisk } = require("../middlewares/uploadMiddleware");

// @desc Get all documents for the logged-in user
exports.getDocuments = async (req, res) => {
    try {
        const documents = await prisma.document.findMany({
            where: { userId: req.user._id },
            orderBy: { uploadedAt: "desc" },
        });

        res.json({ documents: toClient(documents) });
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

        await prisma.document.create({
            data: {
                userId: req.user._id,
                name: name || req.file.originalname,
                url,
                category: docCategory,
                fileType: req.file.mimetype,
                size: req.file.size,
                publicId,
                resourceType,
                uploadedAt: new Date(),
            },
        });

        // The first CV on the account becomes the primary one. A later upload
        // does not take that place — an applicant who keeps several CVs picks
        // which one is primary, and silently reassigning it would change what
        // their next application attaches without them asking.
        if (docCategory === "Resume") {
            const account = await prisma.user.findUnique({
                where: { id: req.user._id },
                select: { resume: true },
            });

            if (!account?.resume) {
                await prisma.user.update({
                    where: { id: req.user._id },
                    data: { resume: url },
                });
            }
        }

        const documents = await prisma.document.findMany({
            where: { userId: req.user._id },
            orderBy: { uploadedAt: "desc" },
        });

        const user = await prisma.user.findUnique({
            where: { id: req.user._id },
            select: { resume: true },
        });

        res.status(201).json({ documents: toClient(documents), resume: user?.resume || "" });
    } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({ message: "Document upload failed", error: error.message });
    }
};

/**
 * @desc  Choose which uploaded resume is the primary one
 * @route PUT /api/user/documents/:docId/primary
 *
 * The primary resume is the single CV on the account — it is what an
 * application attaches by default and what the resume analyser reads. An
 * applicant may keep several CVs on file, so which one holds that place has to
 * be their choice rather than whichever they happened to upload last.
 */
exports.setPrimaryResume = async (req, res) => {
    try {
        const { docId } = req.params;

        const document = await prisma.document.findUnique({
            where: { id: docId },
        });

        if (!document || document.userId !== req.user._id) {
            return res.status(404).json({ message: "Document not found" });
        }

        if (document.category !== "Resume") {
            return res.status(400).json({ message: "Only a resume can be your primary CV" });
        }

        await prisma.user.update({
            where: { id: req.user._id },
            data: { resume: document.url },
        });

        const documents = await prisma.document.findMany({
            where: { userId: req.user._id },
            orderBy: { uploadedAt: "desc" },
        });

        res.json({ documents: toClient(documents), resume: document.url });
    } catch (error) {
        console.error("Set primary resume error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc Delete a document
exports.deleteDocument = async (req, res) => {
    try {
        const { docId } = req.params;

        const document = await prisma.document.findUnique({
            where: { id: docId },
        });

        if (!document || document.userId !== req.user._id) {
            return res.status(404).json({ message: "Document not found" });
        }

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
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkErr) {
                    console.warn("Local file unlink failed:", unlinkErr.message);
                }
            }
        }

        await prisma.document.delete({
            where: { id: docId },
        });

        const user = await prisma.user.findUnique({
            where: { id: req.user._id },
            select: { resume: true },
        });

        let updatedResume = user?.resume || "";
        const wasProfileResume = user?.resume && document.url === user.resume;

        if (wasProfileResume) {
            const remainingResumes = await prisma.document.findMany({
                where: { userId: req.user._id, category: "Resume" },
                orderBy: { uploadedAt: "desc" },
            });
            updatedResume = remainingResumes[0]?.url || "";
            await prisma.user.update({
                where: { id: req.user._id },
                data: { resume: updatedResume },
            });
        }

        const documents = await prisma.document.findMany({
            where: { userId: req.user._id },
            orderBy: { uploadedAt: "desc" },
        });

        res.json({ documents: toClient(documents), resume: updatedResume });
    } catch (error) {
        console.error("Document delete error:", error);
        res.status(500).json({ message: error.message });
    }
};
