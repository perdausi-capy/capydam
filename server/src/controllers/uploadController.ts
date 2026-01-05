import { Request, Response } from 'express';

export const uploadFile = (req: Request, res: Response) => {
  try {
    console.log("📂 [Upload Controller] Request received.");

    if (!req.file) {
      console.error("❌ [Upload Controller] No file found in request.");
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct the URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    console.log("✅ [Upload Controller] Success!");
    console.log(`   - Filename: ${req.file.originalname}`);
    console.log(`   - Saved as: ${req.file.filename}`);
    console.log(`   - Size: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`   - Returning URL: ${fileUrl}`);

    res.status(200).json({
      url: fileUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error("🔥 [Upload Controller] Exception:", error);
    res.status(500).json({ error: 'Upload failed' });
  }
};