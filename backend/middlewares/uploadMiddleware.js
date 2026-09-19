const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memoryStorage instead of multer-storage-cloudinary
const storage = multer.memoryStorage();

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024); // 12MB

const ALLOWED_MIMETYPES = new Set([
    "image/jpeg", "image/jpg", "image/png",
    "application/pdf",
    "application/msword",                                                     // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "text/plain",                                                             // .txt
]);

const ALLOWED_EXTENSIONS = new Set([
    ".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx", ".txt",
]);

// Browsers are unreliable about document mimetypes. A perfectly good .docx
// commonly arrives as application/octet-stream or application/zip (it is a zip
// underneath), and .doc as anything from application/x-msword to an empty
// string — which is how a genuine resume ends up rejected. These types carry no
// real information, so for them the file extension is the better signal.
const UNINFORMATIVE_MIMETYPES = new Set([
    "",
    "application/octet-stream",
    "binary/octet-stream",
    "application/download",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-msword",
    "application/x-pdf",
]);

/**
 * Accept a file when its mimetype is allowed, or when the mimetype tells us
 * nothing and the extension is one we accept.
 *
 * A mimetype that is both specific and disallowed (say video/mp4) is always
 * rejected, whatever the file is called.
 *
 * Rejections are tagged so the global error handler can report them as a 400
 * with a readable message. Untagged, they surface as a generic 500 — which
 * tells someone who picked the wrong file that the site is broken.
 */
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mimetype = (file.mimetype || "").toLowerCase().trim();

    const mimeAllowed = ALLOWED_MIMETYPES.has(mimetype);
    const extAllowed = ALLOWED_EXTENSIONS.has(ext);
    const mimeUninformative = UNINFORMATIVE_MIMETYPES.has(mimetype);

    if (mimeAllowed || (extAllowed && mimeUninformative)) {
        return cb(null, true);
    }

    const error = new Error(
        "Unsupported file type. Upload a PDF, DOC, DOCX, TXT, JPG, or PNG file."
    );
    error.code = "INVALID_FILE_TYPE";
    error.status = 400;
    cb(error, false);
};

const upload = multer({
    storage,
    fileFilter,
    // memoryStorage buffers the whole file in RAM, so an unbounded upload is a
    // denial-of-service vector rather than merely a slow request.
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 4 },
});

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
