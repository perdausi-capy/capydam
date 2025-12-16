"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getUserById = exports.updateProfile = exports.createUser = exports.updateUserRole = exports.rejectUser = exports.approveUser = exports.getAllUsers = void 0;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../utils/supabase"); // ✅ Ensure this file exists
const fs_extra_1 = __importDefault(require("fs-extra"));
// 1. Get All Users (Admin Dashboard)
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
                avatar: true // ✅ Make sure you ran 'npx prisma db push' so this column exists
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    }
    catch (error) {
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
// 4. Update Role (For existing active users)
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
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
// ✅ 6. Update Profile (Name & Avatar)
const updateProfile = async (req, res) => {
    const multerReq = req;
    // 🔍 DEBUG: Log to see what we are receiving
    // console.log("User in Controller:", (req as any).user);
    // 🛡️ SAFETY CHECK: Force cast to 'any' to ensure we capture the user attached by middleware
    const user = req.user;
    const userId = user?.id;
    const { name } = req.body;
    // 🛑 STOP if no user found (Prevents the Prisma Crash)
    if (!userId) {
        res.status(401).json({ message: 'User not authenticated or ID missing' });
        return;
    }
    try {
        let avatarPath = undefined;
        // Handle Avatar Upload
        if (multerReq.file) {
            const { path: tempPath, mimetype } = multerReq.file;
            // Upload to 'avatars' folder
            avatarPath = await (0, supabase_1.uploadToSupabase)(tempPath, `avatars/${userId}-${Date.now()}`, mimetype);
            // Cleanup local temp file
            await fs_extra_1.default.remove(tempPath).catch(() => { });
        }
        // Update Database
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: userId }, // ✅ userId is now guaranteed to exist here
            data: {
                name: name,
                ...(avatarPath && { avatar: avatarPath }),
            },
        });
        // Exclude password from response
        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
    }
    catch (error) {
        console.error("Profile Update Error:", error);
        // Cleanup if file exists but DB failed
        if (multerReq.file?.path) {
            await fs_extra_1.default.remove(multerReq.file.path).catch(() => { });
        }
        res.status(500).json({ message: 'Failed to update profile' });
    }
};
exports.updateProfile = updateProfile;
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
        // Remove password
        const { password, ...userData } = user;
        res.json(userData);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching user details' });
    }
};
exports.getUserById = getUserById;
// 8. Delete Active User
// ... other imports
// 8. Delete Active User (Robust Fix)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user?.id;
        if (id === currentUserId) {
            res.status(400).json({ message: 'You cannot delete your own admin account.' });
            return;
        }
        // 1. Find all assets uploaded by this user (to get their IDs)
        const userAssets = await prisma_1.prisma.asset.findMany({
            where: { userId: id },
            select: { id: true }
        });
        const assetIds = userAssets.map(a => a.id);
        // 2. Perform Clean-up Transaction
        await prisma_1.prisma.$transaction([
            // A. Remove ALL links to the user's assets from ANY collection
            // (This fixes the "Foreign Key Constraint" error on Assets)
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: {
                    assetId: { in: assetIds }
                }
            }),
            // B. Clear the user's OWN collections (remove assets inside them)
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: {
                    collection: { userId: id }
                }
            }),
            // C. Delete the User's Collections
            prisma_1.prisma.collection.deleteMany({
                where: { userId: id }
            }),
            // D. Delete the User's Assets
            prisma_1.prisma.asset.deleteMany({
                where: { userId: id }
            }),
            // E. Finally, Delete the User
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
