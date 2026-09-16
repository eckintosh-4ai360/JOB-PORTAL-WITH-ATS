const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memoryStorage instead of multer-storage-cloudinary
const storage = multer.memoryStorage();

// File filter — allow images, PDFs, and Word documents
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = [
        "image/jpeg", "image/jpg", "image/png",
        "application/pdf",
        "application/msword",                                                    // .doc
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
    ];
    if (allowedFileTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, PDF, DOC, and DOCX are allowed."), false);
    }
};

const upload = multer({ storage, fileFilter });

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer – the file buffer from multer memoryStorage
 * @param {object} options – Cloudinary upload options 
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        stream.end(buffer);
    });
};

const fs = require("fs");
const path = require("path");

const uploadToLocalDisk = async (buffer, originalname) => {
    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(originalname);
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    return filename;
};

module.exports = upload;
module.exports.uploadToCloudinary = uploadToCloudinary;
module.exports.uploadToLocalDisk = uploadToLocalDisk;
