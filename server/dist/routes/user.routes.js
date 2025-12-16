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
router.use(auth_middleware_1.verifyJWT);
// Configure Multer (Same as your asset upload)
const upload = (0, multer_1.default)({
    dest: path_1.default.join(__dirname, '../../uploads/temp'),
    limits: { fileSize: 10 * 1024 * 1024 }, // 5MB limit for avatars
});
// All these routes require a valid Token
// ideally, you'd also have a 'checkRole("admin")' middleware here
router.get('/', auth_middleware_1.verifyJWT, user_controller_1.getAllUsers);
router.patch('/:id/approve', auth_middleware_1.verifyJWT, user_controller_1.approveUser);
router.delete('/:id/reject', auth_middleware_1.verifyJWT, user_controller_1.rejectUser);
router.patch('/:id/role', auth_middleware_1.verifyJWT, user_controller_1.updateUserRole);
// POST /api/users (Create new member)
router.post('/', auth_middleware_1.verifyJWT, user_controller_1.createUser);
router.patch('/profile', upload.single('avatar'), user_controller_1.updateProfile);
router.get('/:id', user_controller_1.getUserById);
router.delete('/:id', user_controller_1.deleteUser);
exports.default = router;
