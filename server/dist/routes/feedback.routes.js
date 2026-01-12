"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feedback_controller_1 = require("../controllers/feedback.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.post('/', auth_middleware_1.verifyJWT, upload.single('attachment'), feedback_controller_1.submitFeedback);
// User Routes
router.post('/', auth_middleware_1.verifyJWT, feedback_controller_1.submitFeedback);
router.get('/my', auth_middleware_1.verifyJWT, feedback_controller_1.getMyFeedback);
router.delete('/my/:id', auth_middleware_1.verifyJWT, feedback_controller_1.deleteOwnFeedback);
// Admin Routes
router.get('/', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, feedback_controller_1.getAllFeedback);
router.patch('/:id', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, feedback_controller_1.updateFeedbackStatus);
router.delete('/:id', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, feedback_controller_1.deleteFeedback);
router.post('/:id/reply', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, feedback_controller_1.replyToFeedback);
exports.default = router;
