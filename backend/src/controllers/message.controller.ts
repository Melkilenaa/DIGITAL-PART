import { Request, Response } from 'express';
import messageService from '../services/message.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';

export class MessageController {
  /**
   * Send a message from one user to another
   * @route POST /api/messages
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { receiverId, content, attachments } = req.body;
      const senderId = req.user?.userId;

      if (!senderId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!receiverId || !content) {
        res.status(400).json({ error: 'Receiver ID and content are required' });
        return;
      }

      const message = await messageService.sendMessage({
        senderId,
        receiverId,
        content,
        attachments
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof NotFoundException) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to send message' });
      }
    }
  }

  /**
   * Get messages between current user and another user
   * @route GET /api/messages/:userId
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.userId;
      const otherUserId = req.params.userId;
      
      if (!currentUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!otherUserId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Parse query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await messageService.getMessagesBetweenUsers(
        currentUserId,
        otherUserId,
        {
          page,
          limit,
          startDate,
          endDate,
          unreadOnly
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  /**
   * Get all conversations for the current user
   * @route GET /api/messages/conversations
   */
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversations = await messageService.getUserConversations(userId);
      res.status(200).json(conversations);
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }

  /**
   * Mark a message as read
   * @route PUT /api/messages/:messageId/read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const messageId = req.params.messageId;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      const message = await messageService.markMessageAsRead(messageId, userId);
      res.status(200).json(message);
    } catch (error) {
      console.error('Error marking message as read:', error);
      
      if (error instanceof NotFoundException) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof UnauthorizedException) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to mark message as read' });
      }
    }
  }

  /**
   * Mark all messages in a conversation as read
   * @route PUT /api/messages/:userId/read-all
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.userId;
      const otherUserId = req.params.userId;
      
      if (!currentUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!otherUserId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const count = await messageService.markAllMessagesAsRead(currentUserId, otherUserId);
      res.status(200).json({ 
        message: `Marked ${count} messages as read`,
        count 
      });
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  }

  /**
   * Upload a file attachment for a message
   * @route POST /api/messages/attachments
   */
  async uploadAttachment(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const filePath = await messageService.saveAttachment(req.file, userId);
      res.status(201).json({ filePath });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  }

  /**
   * Delete a message
   * @route DELETE /api/messages/:messageId
   */
  async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const messageId = req.params.messageId;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      await messageService.deleteMessage(messageId, userId);
      res.status(200).json({ 
        message: 'Message deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      
      if (error instanceof NotFoundException) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof UnauthorizedException) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete message' });
      }
    }
  }

  /**
   * Get unread message count for current user
   * @route GET /api/messages/unread/count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await messageService.getUnreadMessageCount(userId);
      res.status(200).json({ count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread message count' });
    }
  }

  /**
   * Search messages by content
   * @route GET /api/messages/search
   */
  async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const searchTerm = req.query.q as string;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      if (!searchTerm) {
        res.status(400).json({ error: 'Search term is required' });
        return;
      }

      // Parse pagination params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await messageService.searchMessages(userId, searchTerm, { page, limit });
      res.status(200).json(result);
    } catch (error) {
      console.error('Error searching messages:', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  }
}

export default new MessageController();