"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = void 0;
const uploadFile = (req, res) => {
    try {
        console.log("📂 [Upload Controller] Request received.");
        if (!req.file) {
            console.error("❌ [Upload Controller] No file found in request.");
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // ✅ FIX: Return a relative path. 
        // The frontend will treat this as relative to the current domain (https://dam.capy-dev.com)
        // Nginx will catch the /uploads/ request and serve the file securely.
        const fileUrl = `/uploads/${req.file.filename}`;
        console.log("✅ [Upload Controller] Success!");
        console.log(`   - Filename: ${req.file.originalname}`);
        console.log(`   - Saved as: ${req.file.filename}`);
        console.log(`   - Size: ${(req.file.size / 1024).toFixed(2)} KB`);
        console.log(`   - Returning Relative Path: ${fileUrl}`);
        res.status(200).json({
            url: fileUrl,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    }
    catch (error) {
        console.error("🔥 [Upload Controller] Exception:", error);
        res.status(500).json({ error: 'Upload failed' });
    }
};
exports.uploadFile = uploadFile;
