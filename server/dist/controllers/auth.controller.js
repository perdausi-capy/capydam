"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.googleCallback = exports.rejectUser = exports.approveUser = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'; // ✅ Defaults to local if missing
const register = async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        // 1. Check if user exists
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        // 2. Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // 3. Create user
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'viewer',
                status: 'PENDING', // Recommended: Default new registrations to PENDING
            },
        });
        res.status(201).json({
            message: 'User created successfully',
            user: { id: user.id, email: user.email, role: user.role },
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        // --- CHECK STATUS ---
        if (user.status === 'PENDING') {
            res.status(403).json({ message: 'Account pending approval by Admin.' });
            return;
        }
        // --- 🛡️ SSO SAFETY CHECK ---
        // If user registered via SSO, they won't have a password. 
        // This prevents bcrypt from crashing on null.
        if (!user.password) {
            res.status(400).json({ message: 'Please login with Google/SSO.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};
exports.login = login;
// PATCH /api/auth/users/:id/approve
const approveUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        await prisma_1.prisma.user.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                role: role || 'viewer'
            },
        });
        res.json({ message: 'User approved and active' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error approving user' });
    }
};
exports.approveUser = approveUser;
// DELETE /api/auth/users/:id/reject
const rejectUser = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.user.delete({ where: { id } });
        res.json({ message: 'User request rejected and removed' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error rejecting user' });
    }
};
exports.rejectUser = rejectUser;
// ✅ SSO Callback Handler (Updated for Prod)
const googleCallback = (req, res) => {
    const user = req.user;
    if (!user) {
        // Redirect to the Dynamic Client URL
        return res.redirect(`${CLIENT_URL}/login?error=Unauthorized`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    // ✅ Redirect to Dynamic Client URL
    res.redirect(`${CLIENT_URL}/login?token=${token}`);
};
exports.googleCallback = googleCallback;
const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ message: 'User not found' });
        // Handle user with no password (SSO) safely
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMe = getMe;
