"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_controller_1 = require("../controllers/user.controller");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Apply Auth Middleware to all routes
router.use(auth_middleware_1.verifyJWT);
// Configure Multer
const upload = (0, multer_1.default)({
    dest: path_1.default.join(__dirname, '../../uploads/temp'),
    limits: { fileSize: 10 * 1024 * 1024 },
});
// --- ROUTES ---
// 1. Get All Users
router.get('/', user_controller_1.getAllUsers);
// 2. Approve User 
// ✅ FIX: Changed PATCH to POST to match frontend 'client.post'
router.post('/:id/approve', user_controller_1.approveUser);
// 3. Reject User
router.delete('/:id/reject', user_controller_1.rejectUser);
// 4. Update Role 
// ✅ FIX: Changed PATCH to PUT to match frontend 'client.put'
router.put('/:id/role', user_controller_1.updateUserRole);
// 5. Create New User
router.post('/', user_controller_1.createUser);
// 6. Update Profile
// Note: This must come BEFORE /:id so "profile" isn't treated as an ID
router.patch('/profile', upload.single('avatar'), user_controller_1.updateProfile);
// 7. Get Specific User
router.get('/:id', user_controller_1.getUserById);
// 8. Delete User
router.delete('/:id', user_controller_1.deleteUser);
exports.default = router;
