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
  deleteUser,
  acceptSOP,
  resetSOPForAll,
  getSOPUpdateDate
} from '../controllers/user.controller';
import multer from 'multer';
import path from 'path';

const router = Router();

// Apply Auth Middleware to all routes
router.use(verifyJWT);

// Configure Multer
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

// --- ROUTES ---

// 1. Get All Users
router.get('/', getAllUsers);

// 2. Approve User 
// ✅ FIX: Changed PATCH to POST to match frontend 'client.post'
router.post('/:id/approve', approveUser);

// 3. Reject User
router.delete('/:id/reject', rejectUser);

// 4. Update Role 
// ✅ FIX: Changed PATCH to PUT to match frontend 'client.put'
router.put('/:id/role', updateUserRole);

// 5. Create New User
router.post('/', createUser);

// 6. Update Profile
// Note: This must come BEFORE /:id so "profile" isn't treated as an ID
router.patch('/profile', upload.single('avatar'), updateProfile);
router.patch('/profile/sop', acceptSOP);

// 6.5. SOP Admin Routes
router.post('/reset-sop', resetSOPForAll);
router.get('/sop-update-date', getSOPUpdateDate);

// 7. Get Specific User
router.get('/:id', getUserById);

// 8. Delete User
router.delete('/:id', deleteUser);

export default router;