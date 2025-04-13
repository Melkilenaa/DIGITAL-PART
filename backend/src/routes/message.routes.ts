import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import messageController from '../controllers/message.controller';
import { upload } from '../utils/cloudinary.util';

const router = express.Router();

// Apply auth middleware to all message routes
router.use(authMiddleware);

// Message endpoints
router.post('/', messageController.sendMessage);
router.get('/conversations', messageController.getConversations);
router.get('/unread/count', messageController.getUnreadCount);
router.get('/search', messageController.searchMessages);

// Update to use Cloudinary upload middleware instead of multer directly
router.post('/attachments', upload.single('file'), messageController.uploadAttachment);

router.get('/:userId', messageController.getMessages);
router.put('/:messageId/read', messageController.markAsRead);
router.put('/:userId/read-all', messageController.markAllAsRead);
// router.delete('/:messageId', messageController.deleteMessage);

export default router;