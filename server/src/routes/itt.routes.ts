import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import * as ittController from '../controllers/itt.controller';

const router = Router();

// Protect all ITT routes - require authentication and admin role
router.use(verifyJWT, requireAdmin);

// Workstations
router.get('/workstations', ittController.getWorkstations);
router.post('/workstations', ittController.createWorkstation);
router.put('/workstations/:id', ittController.updateWorkstation);
router.delete('/workstations/:id', ittController.deleteWorkstation);

// Maintenance Ledgers
router.get('/ledgers', ittController.getLedgers);
router.post('/ledgers', ittController.createLedger);
router.put('/ledgers/:id', ittController.updateLedger);
router.delete('/ledgers/:id', ittController.deleteLedger);

// Daily Reports
router.get('/reports', ittController.getReports);
router.post('/reports', ittController.createReport);
router.put('/reports/:id', ittController.updateReport);
router.delete('/reports/:id', ittController.deleteReport);

// ITT Support Tickets
router.get('/tickets', ittController.getIttTickets);
router.get('/tickets/user/:userId', ittController.getIttTicketsByUser);
router.post('/tickets/:id/reply', ittController.replyToIttTicket);
router.patch('/tickets/:id/status', ittController.updateIttTicketStatus);

// ==========================================
// Hardware Inventory Routes
// ==========================================
router.get('/inventory', ittController.getInventory);
router.post('/inventory', ittController.createInventoryItem);
router.put('/inventory/:id', ittController.updateInventoryItem);
router.delete('/inventory/:id', ittController.deleteInventoryItem);

// ==========================================
// FLOOR PLAN LAYOUT
// ==========================================
router.get('/floorplan', ittController.getFloorPlan);
router.post('/floorplan', ittController.saveFloorPlan);

export default router;
