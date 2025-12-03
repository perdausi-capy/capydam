import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getAllUsers, 
  approveUser, 
  rejectUser, 
  updateUserRole 
} from '../controllers/user.controller';

const router = Router();

// All these routes require a valid Token
// ideally, you'd also have a 'checkRole("admin")' middleware here

router.get('/', verifyJWT, getAllUsers);
router.patch('/:id/approve', verifyJWT, approveUser);
router.delete('/:id/reject', verifyJWT, rejectUser);
router.patch('/:id/role', verifyJWT, updateUserRole);

export default router;