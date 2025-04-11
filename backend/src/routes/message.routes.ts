import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth.middleware';
import messageController from '../controllers/message.controller';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per upload
  } 
});

// Apply auth middleware to all message routes
router.use(authMiddleware);

// Message endpoints
router.post('/', messageController.sendMessage);
router.get('/conversations', messageController.getConversations);
router.get('/unread/count', messageController.getUnreadCount);
router.get('/search', messageController.searchMessages);
router.post('/attachments', upload.single('file'), messageController.uploadAttachment);
router.get('/:userId', messageController.getMessages);
router.put('/:messageId/read', messageController.markAsRead);
router.put('/:userId/read-all', messageController.markAllAsRead);
router.delete('/:messageId', messageController.deleteMessage);

export default router;