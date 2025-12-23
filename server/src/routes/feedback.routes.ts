import { Router } from 'express';
import { 
  submitFeedback, 
  getAllFeedback, 
  updateFeedbackStatus, 
  deleteFeedback,
  getMyFeedback, 
  replyToFeedback,
  deleteOwnFeedback

} from '../controllers/feedback.controller';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });


router.post('/', verifyJWT, upload.single('attachment'), submitFeedback);
// User Routes
router.post('/', verifyJWT, submitFeedback);
router.get('/my', verifyJWT, getMyFeedback);

router.delete('/my/:id', verifyJWT, deleteOwnFeedback);

// Admin Routes
router.get('/', verifyJWT, requireAdmin, getAllFeedback);
router.patch('/:id', verifyJWT, requireAdmin, updateFeedbackStatus);
router.delete('/:id', verifyJWT, requireAdmin, deleteFeedback);
router.post('/:id/reply', verifyJWT, requireAdmin, replyToFeedback);

export default router;