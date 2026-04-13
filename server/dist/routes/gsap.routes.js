"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/gsap.routes.ts
const express_1 = __importDefault(require("express"));
const gsapController_1 = require("../controllers/gsapController");
const router = express_1.default.Router();
// ✅ ADD THIS LINE HERE
// This fixes the "400 Bad Request" by allowing the server to read the { id } you send
router.use(express_1.default.json());
// This handles GET, POST, PUT, and DELETE requests
router.all('/', gsapController_1.getGsapAssets);
exports.default = router;
