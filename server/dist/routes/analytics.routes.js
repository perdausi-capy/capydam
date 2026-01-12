"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Only Admins can see system analytics
router.get('/', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, analytics_controller_1.getSystemAnalytics);
exports.default = router;
