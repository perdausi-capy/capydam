"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getUserById = exports.updateProfile = exports.createUser = exports.updateUserRole = exports.rejectUser = exports.approveUser = exports.getAllUsers = void 0;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../utils/supabase");
const fs_extra_1 = __importDefault(require("fs-extra"));
// ✅ 1. Get All Users
const getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const role = req.query.role || 'all';
        const skip = (page - 1) * limit;
        const whereClause = {
            AND: [
                search ? {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ],
                } : {},
                role !== 'all' ? { role: role } : {},
            ],
        };
        const [total, users] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.count({ where: whereClause }),
            prisma_1.prisma.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true, // ✅ ADDED THIS LINE
                    avatar: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
        ]);
        res.json({
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("Get Users Error:", error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};
exports.getAllUsers = getAllUsers;
// 2. Approve User Request
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
// 3. Reject User Request
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
// 4. Update Role (Safe Version)
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        // Safety: Ensure only valid roles are passed
        const validRoles = ['admin', 'editor', 'viewer'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ message: 'Invalid role provided' });
            return;
        }
        await prisma_1.prisma.user.update({
            where: { id },
            data: { role },
        });
        res.json({ message: 'User role updated' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating role' });
    }
};
exports.updateUserRole = updateUserRole;
// 5. Create User (Admin Action)
const createUser = async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                status: 'ACTIVE',
            },
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating user' });
    }
};
exports.createUser = createUser;
// 6. Update Profile (Preserved & Safe)
const updateProfile = async (req, res) => {
    const multerReq = req;
    const user = req.user;
    const userId = user?.id;
    const { name } = req.body;
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated or ID missing' });
        return;
    }
    try {
        let avatarPath = undefined;
        if (multerReq.file) {
            const { path: tempPath, mimetype } = multerReq.file;
            avatarPath = await (0, supabase_1.uploadToSupabase)(tempPath, `avatars/${userId}-${Date.now()}`, mimetype);
            await fs_extra_1.default.remove(tempPath).catch(() => { });
        }
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                name: name,
                ...(avatarPath && { avatar: avatarPath }),
            },
        });
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
    }
    catch (error) {
        console.error("Profile Update Error:", error);
        if (multerReq.file?.path) {
            await fs_extra_1.default.remove(multerReq.file.path).catch(() => { });
        }
        res.status(500).json({ message: 'Failed to update profile' });
    }
};
exports.updateProfile = updateProfile;
// 7. Get Single User Details
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { assets: true, collections: true }
                },
                assets: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, originalName: true, mimeType: true, thumbnailPath: true, createdAt: true }
                }
            }
        });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const { password, ...userData } = user;
        res.json(userData);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching user details' });
    }
};
exports.getUserById = getUserById;
// 8. Delete User (Transaction Safe)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.id;
        if (id === currentUserId) {
            res.status(400).json({ message: 'You cannot delete your own admin account.' });
            return;
        }
        const userAssets = await prisma_1.prisma.asset.findMany({
            where: { userId: id },
            select: { id: true }
        });
        const assetIds = userAssets.map(a => a.id);
        await prisma_1.prisma.$transaction([
            // Remove asset links in collections
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: { assetId: { in: assetIds } }
            }),
            // Remove collections owned by user
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: { collection: { userId: id } }
            }),
            prisma_1.prisma.collection.deleteMany({
                where: { userId: id }
            }),
            // Remove assets owned by user
            prisma_1.prisma.asset.deleteMany({
                where: { userId: id }
            }),
            // Finally, delete user
            prisma_1.prisma.user.delete({
                where: { id }
            })
        ]);
        res.json({ message: 'User and all associated data deleted successfully' });
    }
    catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ message: 'Error deleting user. Ensure all dependencies are cleared.' });
    }
};
exports.deleteUser = deleteUser;
