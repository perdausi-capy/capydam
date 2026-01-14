// src/routes/gsap.routes.ts
import express from 'express';
import { getGsapAssets } from '../controllers/gsapController'; 

const router = express.Router();

// ✅ ADD THIS LINE HERE

// This fixes the "400 Bad Request" by allowing the server to read the { id } you send
router.use(express.json());

// This handles GET, POST, PUT, and DELETE requests
router.all('/', getGsapAssets);

export default router;