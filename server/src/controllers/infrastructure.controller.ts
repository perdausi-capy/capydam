import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ All security checks are handled by requireAdmin middleware. 
// These functions only execute if the user is a guaranteed Admin.

export const getNodes = async (req: Request, res: Response) => {
    try {
        const nodes = await prisma.infrastructureNode.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(nodes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching infrastructure' });
    }
};

export const createNode = async (req: Request, res: Response) => {
    try {
        const node = await prisma.infrastructureNode.create({ data: req.body });
        res.json(node);
    } catch (error) {
        res.status(500).json({ message: 'Error creating infrastructure node' });
    }
};

export const updateNode = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const node = await prisma.infrastructureNode.update({ where: { id }, data: req.body });
        res.json(node);
    } catch (error) {
        res.status(500).json({ message: 'Error updating infrastructure node' });
    }
};

export const deleteNode = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.infrastructureNode.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting infrastructure node' });
    }
};

// ✅ NEW: Handle Real File Uploads
export const uploadKeyFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const file = req.file; // Caught by multer

        if (!file) {
             res.status(400).json({ message: 'No file uploaded' });
             return;
        }

        // Convert file buffer to string for secure DB storage
        const fileContent = file.buffer.toString('utf-8');
        const fileName = file.originalname;

        const node = await prisma.infrastructureNode.update({
            where: { id },
            data: { 
                sshKey: fileContent, 
                sshKeyFileName: fileName // Remember the exact name!
            }
        });

        res.json(node);
    } catch (error) {
        res.status(500).json({ message: 'Error securing file to vault' });
    }
};

// ✅ NEW: Delete the File
export const deleteKeyFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const node = await prisma.infrastructureNode.update({
            where: { id },
            data: { sshKey: null, sshKeyFileName: null }
        });
        res.json(node);
    } catch (error) {
        res.status(500).json({ message: 'Error deleting file' });
    }
};