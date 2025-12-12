import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getAllUsers, 
  approveUser, 
  rejectUser, 
  updateUserRole,
  createUser,
  updateProfile,
  getUserById, 
  deleteUser   
} from '../controllers/user.controller';
import multer from 'multer';
import path from 'path';

const router = Router();
router.use(verifyJWT);

// Configure Multer (Same as your asset upload)
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 5MB limit for avatars
});

// All these routes require a valid Token
// ideally, you'd also have a 'checkRole("admin")' middleware here

router.get('/', verifyJWT, getAllUsers);
router.patch('/:id/approve', verifyJWT, approveUser);
router.delete('/:id/reject', verifyJWT, rejectUser);
router.patch('/:id/role', verifyJWT, updateUserRole);
// POST /api/users (Create new member)
router.post('/', verifyJWT, createUser);
router.patch('/profile', upload.single('avatar'), updateProfile);

router.get('/:id', getUserById);
router.delete('/:id', deleteUser);

export default router;