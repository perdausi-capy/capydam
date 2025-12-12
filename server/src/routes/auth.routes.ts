import { Router } from 'express';
import { login, register, googleCallback, getMe } from '../controllers/auth.controller';
import passport from '../config/passport';
import { verifyJWT } from '../middleware/auth.middleware';




const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyJWT, getMe); 

// ✅ NEW: SSO Routes
router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false // We use JWT, not session cookies
}));

router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=failed' }),
    googleCallback
  );


export default router;