import { Request, Response } from 'express';
import { PrismaClient, NotificationType } from '@prisma/client';
import notificationService, { NotificationChannel } from '../services/notification.service';

const prisma = new PrismaClient();

/**
 * Controller for notification-related endpoints
 */
export class NotificationController {

  /**
   * Get all notifications for the authenticated user
   */
  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const isRead = req.query.isRead === 'true' ? true : 
                    req.query.isRead === 'false' ? false : undefined;
      const type = req.query.type as NotificationType | undefined;

      const result = await notificationService.getUserNotifications(userId, {
        page,
        limit,
        isRead,
        type
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const notificationId = req.params.id;
      if (!notificationId) {
        res.status(400).json({ error: 'Notification ID is required' });
        return;
      }

      const updatedNotification = await notificationService.markAsRead(notificationId, userId);
      res.status(200).json(updatedNotification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Notification not found' });
      } else {
        res.status(500).json({ error: 'Failed to update notification' });
      }
    }
  }

  /**
   * Mark all notifications as read for the authenticated user
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const count = await notificationService.markAllAsRead(userId);
      res.status(200).json({ 
        message: `Marked ${count} notifications as read`,
        count 
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to update notifications' });
    }
  }

  /**
   * Get notification preferences for the authenticated user
   */
  async getNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const preferences = await notificationService.getNotificationPreferences(userId);
      res.status(200).json(preferences);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
  }

  /**
   * Update notification preferences for the authenticated user
   */
  async updateNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate request body
      const preferences = req.body;
      if (!preferences || typeof preferences !== 'object') {
        res.status(400).json({ error: 'Invalid preferences format' });
        return;
      }

      // Ensure payload doesn't contain userId
      delete preferences.userId;

      const success = await notificationService.updateNotificationPreferences(userId, preferences);
      
      if (success) {
        const updatedPreferences = await notificationService.getNotificationPreferences(userId);
        res.status(200).json(updatedPreferences);
      } else {
        res.status(500).json({ error: 'Failed to update notification preferences' });
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  }

  /**
   * Register a device for push notifications
   */
  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { deviceToken, platform } = req.body;
      if (!deviceToken) {
        res.status(400).json({ error: 'Device token is required' });
        return;
      }

      // Validate platform
      const validPlatforms = ['android', 'ios', 'web'];
      if (platform && !validPlatforms.includes(platform)) {
        res.status(400).json({ 
          error: 'Invalid platform. Platform must be one of: android, ios, web' 
        });
        return;
      }

      const device = await notificationService.registerDevice(
        userId, 
        deviceToken, 
        platform as 'android' | 'ios' | 'web' || 'android'
      );

      res.status(200).json({ 
        message: 'Device registered successfully',
        device 
      });
    } catch (error) {
      console.error('Error registering device:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  }

  /**
   * Unregister a device from push notifications
   */
  async unregisterDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const deviceToken = req.params.token;
      if (!deviceToken) {
        res.status(400).json({ error: 'Device token is required' });
        return;
      }

      const success = await notificationService.unregisterDevice(userId, deviceToken);
      
      if (success) {
        res.status(200).json({ message: 'Device unregistered successfully' });
      } else {
        res.status(404).json({ error: 'Device not found or already unregistered' });
      }
    } catch (error) {
      console.error('Error unregistering device:', error);
      res.status(500).json({ error: 'Failed to unregister device' });
    }
  }

  /**
   * Get unread notification count for the authenticated user
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { unreadCount } = await notificationService.getUserNotifications(userId, {
        page: 1,
        limit: 1, // We only need the count, not the actual notifications
      });
      
      res.status(200).json({ unreadCount });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread notification count' });
    }
  }

  /**
   * Test sending a notification (for development only)
   */
  async testNotification(req: Request, res: Response): Promise<void> {
    // This should only be allowed in development environment
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'This endpoint is not available in production' });
      return;
    }

    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { title, message, type, channels } = req.body;
      
      if (!title || !message || !type) {
        res.status(400).json({ error: 'Title, message, and type are required' });
        return;
      }

      // Validate notification type
      if (!Object.values(NotificationType).includes(type)) {
        res.status(400).json({ 
          error: `Invalid notification type. Must be one of: ${Object.values(NotificationType).join(', ')}` 
        });
        return;
      }

      // Convert channel strings to enum values if provided
      let notificationChannels: NotificationChannel[] | undefined;
      if (channels && Array.isArray(channels)) {
        notificationChannels = channels
          .filter(channel => Object.values(NotificationChannel).includes(channel as NotificationChannel))
          .map(channel => channel as NotificationChannel);
      }

      const notification = await notificationService.createNotification({
        userId,
        title,
        message,
        type,
        data: req.body.data || {},
        channels: notificationChannels,
        referenceId: req.body.referenceId,
        referenceType: req.body.referenceType
      });

      res.status(201).json({
        message: 'Test notification sent',
        notification,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
}

// Create controller instance
const notificationController = new NotificationController();

export default notificationController;