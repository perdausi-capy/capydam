"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const passport_1 = __importDefault(require("../config/passport"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.get('/me', auth_middleware_1.verifyJWT, auth_controller_1.getMe);
// ✅ NEW: SSO Routes
router.get('/google', passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
    session: false // We use JWT, not session cookies
}));
router.get('/google/callback', passport_1.default.authenticate('google', { session: false, failureRedirect: '/login?error=failed' }), auth_controller_1.googleCallback);
exports.default = router;
