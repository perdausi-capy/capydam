"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'secret'; // Make sure this matches your .env default
const verifyJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
    if (!token) {
        // Explicitly return to satisfy void return type
        res.status(401).json({ message: 'Access denied. No token provided.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Attach decoded user to the request object
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ message: 'Invalid token' });
        return;
    }
};
exports.verifyJWT = verifyJWT;
