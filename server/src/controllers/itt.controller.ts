import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// ==========================================
// WORKSTATIONS
// ==========================================

export const getWorkstations = async (req: Request, res: Response) => {
  try {
    const workstations = await prisma.workstation.findMany({
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        monitors: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(workstations);
  } catch (error) {
    console.error('Error fetching workstations:', error);
    res.status(500).json({ error: 'Failed to fetch workstations' });
  }
};

export const createWorkstation = async (req: Request, res: Response) => {
  try {
    const { unitId, mobo, cpu, ram, gpu, psu, storage, monitors, status, assignedToId, notes } = req.body;

    // Check if unitId already exists
    const existing = await prisma.workstation.findUnique({ where: { unitId } });
    if (existing) {
      return res.status(400).json({ error: 'Workstation Unit ID already exists' });
    }

    const workstation = await prisma.workstation.create({
      data: {
        unitId, mobo, cpu, ram, gpu, psu, storage, status, notes,
        assignedToId: assignedToId || null,
        monitors: {
          create: (monitors || []).map((m: any) => ({
            model: m.model,
            specs: m.specs
          }))
        }
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        monitors: true
      },
    });
    res.status(201).json(workstation);
  } catch (error) {
    console.error('Error creating workstation:', error);
    res.status(500).json({ error: 'Failed to create workstation' });
  }
};

export const updateWorkstation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { unitId, mobo, cpu, ram, gpu, psu, storage, monitors, status, assignedToId, notes } = req.body;

    const workstation = await prisma.workstation.update({
      where: { id },
      data: {
        unitId, mobo, cpu, ram, gpu, psu, storage, status, notes,
        assignedToId: assignedToId || null,
        monitors: {
          deleteMany: {},
          create: (monitors || []).map((m: any) => ({
            model: m.model,
            specs: m.specs
          }))
        }
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        monitors: true
      },
    });
    res.json(workstation);
  } catch (error) {
    console.error('Error updating workstation:', error);
    res.status(500).json({ error: 'Failed to update workstation' });
  }
};

export const deleteWorkstation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.workstation.delete({ where: { id } });
    res.json({ message: 'Workstation deleted successfully' });
  } catch (error) {
    console.error('Error deleting workstation:', error);
    res.status(500).json({ error: 'Failed to delete workstation' });
  }
};

// ==========================================
// MAINTENANCE LEDGERS
// ==========================================

export const getLedgers = async (req: Request, res: Response) => {
  try {
    const ledgers = await prisma.maintenanceLedger.findMany({
      include: {
        workstation: { select: { id: true, unitId: true } },
        assignedTech: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ledgers);
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({ error: 'Failed to fetch ledgers' });
  }
};

export const createLedger = async (req: Request, res: Response) => {
  try {
    const { workstationId, issue, actionTaken, status, assignedTechId } = req.body;

    // Ensure workstation exists
    const ws = await prisma.workstation.findUnique({ where: { id: workstationId } });
    if (!ws) {
      return res.status(404).json({ error: 'Workstation not found' });
    }

    const ledger = await prisma.maintenanceLedger.create({
      data: {
        workstationId,
        issue,
        actionTaken,
        status: status || 'open',
        assignedTechId: assignedTechId || (req as AuthRequest).user?.id || null
      },
      include: {
        workstation: { select: { id: true, unitId: true } },
        assignedTech: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    res.status(201).json(ledger);
  } catch (error) {
    console.error('Error creating ledger:', error);
    res.status(500).json({ error: 'Failed to create ledger' });
  }
};

export const updateLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { workstationId, issue, actionTaken, status, assignedTechId } = req.body;

    const ledger = await prisma.maintenanceLedger.update({
      where: { id },
      data: {
        workstationId,
        issue,
        actionTaken,
        status,
        // ✅ FIX: If undefined, do nothing. If empty string, set to null. Otherwise, use the ID.
        assignedTechId: assignedTechId === undefined ? undefined : (assignedTechId || null)
      },
      include: {
        workstation: { select: { id: true, unitId: true } },
        assignedTech: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    res.json(ledger);
  } catch (error) {
    console.error('Error updating ledger:', error);
    res.status(500).json({ error: 'Failed to update ledger' });
  }
};

export const deleteLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.maintenanceLedger.delete({ where: { id } });
    res.json({ message: 'Ledger deleted successfully' });
  } catch (error) {
    console.error('Error deleting ledger:', error);
    res.status(500).json({ error: 'Failed to delete ledger' });
  }
};

// ==========================================
// DAILY REPORTS
// ==========================================

export const getReports = async (req: Request, res: Response) => {
  try {
    const reports = await prisma.dailyReport.findMany({
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

export const createReport = async (req: Request, res: Response) => {
  try {
    const { date, hours, reactiveTickets, proactiveMaintenance, researchNotes, nextSteps } = req.body;

    const authorId = (req as AuthRequest).user?.id;
    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = await prisma.dailyReport.create({
      data: {
        date: date ? new Date(date) : new Date(),
        hours: parseFloat(hours) || 8.0,
        reactiveTickets: reactiveTickets || [],
        proactiveMaintenance: proactiveMaintenance || [],
        researchNotes,
        nextSteps,
        authorId
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
};

export const updateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, hours, reactiveTickets, proactiveMaintenance, researchNotes, nextSteps } = req.body;

    const report = await prisma.dailyReport.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        hours: hours ? parseFloat(hours) : undefined,
        reactiveTickets,
        proactiveMaintenance,
        researchNotes,
        nextSteps,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    res.json(report);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
};

export const deleteReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dailyReport.delete({ where: { id } });
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
};

// ==========================================
// ITT SUPPORT TICKETS
// ==========================================

export const getIttTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.feedback.findMany({
      where: { type: 'itt_support' },
      include: {
        user: { select: { name: true, email: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching ITT tickets:", error);
    res.status(500).json({ error: "Failed to fetch ITT tickets" });
  }
};

// Get ITT support tickets by assigned user (for workstation detail view)
export const getIttTicketsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tickets = await prisma.feedback.findMany({
      where: { type: 'itt_support', userId },
      include: {
        user: { select: { name: true, email: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching ITT tickets by user:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

// Reply to an ITT support ticket
export const replyToIttTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Reply message is required" });

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        adminReply: message,
        repliedAt: new Date(),
      }
    });
    res.json(updated);
  } catch (error) {
    console.error("Error replying to ITT ticket:", error);
    res.status(500).json({ error: "Failed to reply to ticket" });
  }
};

export const updateIttTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updated = await prisma.feedback.update({
      where: { id },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating ITT ticket status:", error);
    res.status(500).json({ error: "Failed to update ticket status" });
  }
};

// ==========================================
// HARDWARE INVENTORY
// ==========================================

// Get all inventory items (optionally filtered by type)
export const getInventory = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    const whereClause = type ? { type: String(type) } : {};

    const inventory = await prisma.ittInventory.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

// Add a new hardware component
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const { itemName, serialNumber, type, purchaseDate, status, notes } = req.body;

    // Check for duplicate serial number
    const existing = await prisma.ittInventory.findUnique({ 
        where: { serialNumber } 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Serial Number already exists in inventory' });
    }

    const item = await prisma.ittInventory.create({
      data: {
        itemName,
        serialNumber,
        type,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        status: status || 'Active',
        notes: notes || null
      },
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: 'Failed to add item to inventory' });
  }
};

// Update an existing hardware component
export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { itemName, serialNumber, type, purchaseDate, status, notes } = req.body;

    const item = await prisma.ittInventory.update({
      where: { id },
      data: {
        itemName,
        serialNumber,
        type,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        status,
        notes
      },
    });
    
    res.json(item);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
};

// Delete a hardware component
export const deleteInventoryItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.ittInventory.delete({ where: { id } });
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
};
