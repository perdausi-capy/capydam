import express from 'express';
import { handleWebhook } from '../controllers/clickup.controller';

const router = express.Router();

router.post('/webhook', handleWebhook);

export default router;
