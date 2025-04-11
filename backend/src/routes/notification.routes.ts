import express from 'express';
import notificationController from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

// Create a router instance
const router = express.Router();

// Apply auth middleware to all notification routes
router.use(authMiddleware);

// Notification endpoints
router.get('/', notificationController.getUserNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);

// Preferences endpoints
router.get('/preferences', notificationController.getNotificationPreferences);
router.put('/preferences', notificationController.updateNotificationPreferences);

// Device registration endpoints
router.post('/devices', notificationController.registerDevice);
router.delete('/devices/:token', notificationController.unregisterDevice);

// Test endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', notificationController.testNotification);
}

export default router;