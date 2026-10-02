import express from 'express';
import { handleDriveUpload } from '../controllers/webhook.controller';

const router = express.Router();

// Matches POST /api/webhooks/drive-upload
router.post('/drive-upload', handleDriveUpload);

export default router;
