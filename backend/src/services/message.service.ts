import { PrismaClient, Message, User, UserRole } from '@prisma/client';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { NotFoundException, BadRequestException, UnauthorizedException } from '../utils/exceptions.util';
import notificationService from './notification.service';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as crypto from 'crypto';

/**
 * Interface for sending a message
 */
interface SendMessageInput {
  senderId: string;
  receiverId: string;
  content: string;
  attachments?: string[];
}

/**
 * Interface for message filtering
 */
interface GetMessagesOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  unreadOnly?: boolean;
}

/**
 * Interface for conversation participants
 */
interface ConversationParticipant {
  id: string;
  name: string;
  role: UserRole;
  profileImage?: string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    sentAt: Date;
    isRead: boolean;
  };
}

/**
 * Service for handling in-app messaging
 */
export class MessageService {
  private prisma: PrismaClient;
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds[]
  private uploadDir: string;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.uploadDir = process.env.MESSAGE_ATTACHMENTS_DIR || path.join(process.cwd(), 'uploads', 'messages');
    
    // Ensure upload directory exists
    this.ensureUploadDirExists();
  }
  
  /**
   * Set the Socket.IO server for real-time messaging
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }
  
  /**
   * Setup socket event handlers for messaging
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);
      
      // Handle user authentication and registration
      socket.on('register', (userId: string, callback: Function) => {
        if (!userId) {
          return callback({ success: false, error: 'User ID is required' });
        }
        
        // Add user to connected users map
        if (!this.connectedUsers.has(userId)) {
          this.connectedUsers.set(userId, []);
        }
        
        this.connectedUsers.get(userId)?.push(socket.id);
        
        // Join user's personal room
        socket.join(`user-${userId}`);
        
        callback({ success: true });
        
        console.log(`User ${userId} registered with socket ${socket.id}`);
      });
      
      // Handle new message from client
      socket.on('send_message', async (messageData: SendMessageInput, callback: Function) => {
        try {
          const message = await this.sendMessage(messageData);
          callback({ success: true, message });
        } catch (error) {
          console.error('Error sending message via socket:', error);
          callback({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to send message' 
          });
        }
      });
      
      // Handle marking messages as read
      socket.on('mark_read', async (messageId: string, userId: string, callback: Function) => {
        try {
          const message = await this.markMessageAsRead(messageId, userId);
          callback({ success: true, message });
        } catch (error) {
          console.error('Error marking message as read:', error);
          callback({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to mark message as read' 
          });
        }
      });
      
      // Handle client disconnections
      socket.on('disconnect', () => {
        // Remove socket from all user entries
        for (const [userId, sockets] of this.connectedUsers.entries()) {
          const index = sockets.indexOf(socket.id);
          if (index !== -1) {
            sockets.splice(index, 1);
            console.log(`User ${userId} disconnected socket ${socket.id}`);
            
            // Remove user entry if no more sockets
            if (sockets.length === 0) {
              this.connectedUsers.delete(userId);
            }
            break;
          }
        }
      });
    });
  }
  
  /**
   * Ensure upload directory exists
   */
  private ensureUploadDirExists(): void {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }
  
  /**
   * Send a message from one user to another
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    // Validate sender exists
    const sender = await this.prisma.user.findUnique({
      where: { id: input.senderId }
    });
    
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    
    // Validate receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: input.receiverId }
    });
    
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }
    
    // Create the message
    const message = await this.prisma.message.create({
      data: {
        senderId: input.senderId,
        receiverId: input.receiverId,
        content: input.content,
        attachments: input.attachments || [],
        isRead: false,
        sentAt: new Date()
      }
    });
    
    // Emit real-time update to receiver if they're online
    this.emitNewMessage(message);
    
    // Send notification to receiver
    await this.sendMessageNotification(message);
    
    return message;
  }
  
  /**
   * Get messages between two users with pagination
   */
  async getMessagesBetweenUsers(
    userId1: string,
    userId2: string,
    options: GetMessagesOptions = {}
  ): Promise<{ messages: Message[]; total: number; unreadCount: number }> {
    const { 
      page = 1, 
      limit = 20,
      startDate,
      endDate,
      unreadOnly = false
    } = options;
    
    const skip = (page - 1) * limit;
    
    // Build where clause for message filtering
    const whereClause: any = {
      OR: [
        {
          senderId: userId1,
          receiverId: userId2
        },
        {
          senderId: userId2,
          receiverId: userId1
        }
      ]
    };
    
    // Add date filters if provided
    if (startDate) {
      whereClause.sentAt = { ...(whereClause.sentAt || {}), gte: startDate };
    }
    
    if (endDate) {
      whereClause.sentAt = { ...(whereClause.sentAt || {}), lte: endDate };
    }
    
    // Add read status filter if required
    if (unreadOnly) {
      whereClause.AND = [
        { receiverId: userId1 },
        { isRead: false }
      ];
    }
    
    // Execute queries
    const [messages, total, unreadCount] = await Promise.all([
      this.prisma.message.findMany({
        where: whereClause,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.message.count({ where: whereClause }),
      this.prisma.message.count({
        where: {
          senderId: userId2,
          receiverId: userId1,
          isRead: false
        }
      })
    ]);
    
    return {
      messages: messages.reverse(), // Return in chronological order
      total,
      unreadCount
    };
  }
  
  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string): Promise<ConversationParticipant[]> {
    // Find all users this user has communicated with
    const sentMessages = await this.prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId']
    });
    
    const receivedMessages = await this.prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId']
    });
    
    // Combine unique user IDs
    const participantIds = new Set<string>();
    sentMessages.forEach(msg => participantIds.add(msg.receiverId));
    receivedMessages.forEach(msg => participantIds.add(msg.senderId));
    
    const conversations: ConversationParticipant[] = [];
    
    // Get details for each conversation
    for (const participantId of participantIds) {
      // Get user profile information
      const participant = await this.prisma.user.findUnique({
        where: { id: participantId },
        include: {
          customer: true,
          vendor: true,
          driver: true,
          admin: true
        }
      });
      
      if (!participant) continue;
      
      // Get unread count
      const unreadCount = await this.prisma.message.count({
        where: {
          senderId: participantId,
          receiverId: userId,
          isRead: false
        }
      });
      
      // Get last message
      const lastMessage = await this.prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: participantId },
            { senderId: participantId, receiverId: userId }
          ]
        },
        orderBy: { sentAt: 'desc' }
      });
      
      // Determine name based on role
      let name = 'Unknown User';
      let profileImage: string | undefined;
      
      if (participant.customer) {
        name = `${participant.customer.firstName} ${participant.customer.lastName}`;
        profileImage = participant.customer.profileImage || undefined;
      } else if (participant.vendor) {
        name = participant.vendor.businessName;
        profileImage = participant.vendor.businessLogo || undefined;
      } else if (participant.driver) {
        name = `${participant.driver.firstName} ${participant.driver.lastName}`;
        profileImage = participant.driver.profileImage || undefined;
      } else if (participant.admin) {
        name = `${participant.admin.firstName} ${participant.admin.lastName}`;
      }
      
      conversations.push({
        id: participantId,
        name,
        role: participant.role,
        profileImage,
        unreadCount,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          sentAt: lastMessage.sentAt,
          isRead: lastMessage.isRead
        } : undefined
      });
    }
    
    // Sort by last message time (most recent first)
    return conversations.sort((a, b) => {
      const dateA = a.lastMessage?.sentAt || new Date(0);
      const dateB = b.lastMessage?.sentAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }
  
  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    
    // Ensure user is the receiver
    if (message.receiverId !== userId) {
      throw new UnauthorizedException('You can only mark messages sent to you as read');
    }
    
    // If already read, just return
    if (message.isRead) {
      return message;
    }
    
    // Update message as read
    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    
    // Emit read status update to sender
    this.emitMessageRead(updatedMessage);
    
    return updatedMessage;
  }
  
  /**
   * Mark all messages in a conversation as read
   */
  async markAllMessagesAsRead(currentUserId: string, otherUserId: string): Promise<number> {
    // Update all unread messages from other user to current user
    const result = await this.prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    
    // Emit read status update to sender for all messages
    if (result.count > 0) {
      this.emitConversationRead(currentUserId, otherUserId);
    }
    
    return result.count;
  }
  
  /**
   * Handle file upload for message attachments
   */
  async saveAttachment(file: Express.Multer.File, senderId: string): Promise<string> {
    try {
      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const randomId = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const newFilename = `${senderId}_${timestamp}_${randomId}${fileExtension}`;
      
      // Define file path
      const filePath = path.join(this.uploadDir, newFilename);
      
      // Save file
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(filePath, file.buffer);
      
      // Return relative path to be stored in the message
      return `/uploads/messages/${newFilename}`;
    } catch (error) {
      console.error('Failed to save attachment:', error);
      throw new Error('Failed to save attachment');
    }
  }
  
  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId }
    });
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    
    // Ensure user is either sender or receiver
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new UnauthorizedException('You can only delete messages you sent or received');
    }
    
    // For a real implementation, you should retain messages in the database
    // and add a "deletedFor" field to track which users have deleted it
    // For now, we'll just delete it outright
    await this.prisma.message.delete({
      where: { id: messageId }
    });
    
    // Emit deletion to both users
    this.emitMessageDeleted(message);
  }
  
  /**
   * Get unread message count for a user
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });
  }
  
  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && 
           (this.connectedUsers.get(userId)?.length || 0) > 0;
  }
  
  /**
   * Search messages by content
   */
  async searchMessages(
    userId: string, 
    searchTerm: string,
    options: GetMessagesOptions = {}
  ): Promise<{ messages: Message[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    
    // Find messages containing search term that user is part of
    const whereClause = {
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ],
      content: {
        contains: searchTerm,
        mode: 'insensitive' as const
      }
    };
    
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: whereClause,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.message.count({ where: whereClause })
    ]);
    
    return { messages, total };
  }
  
  /**
   * Emit new message event to recipient
   */
  private emitNewMessage(message: Message): void {
    if (!this.io) return;
    
    // Emit to receiver's room
    this.io.to(`user-${message.receiverId}`).emit('new_message', message);
    
    // Also emit to sender for multi-device sync
    this.io.to(`user-${message.senderId}`).emit('message_sent', message);
  }
  
  /**
   * Emit message read event to sender
   */
  private emitMessageRead(message: Message): void {
    if (!this.io) return;
    
    // Emit to sender's room
    this.io.to(`user-${message.senderId}`).emit('message_read', {
      messageId: message.id,
      readAt: message.readAt
    });
    
    // Also emit to receiver for multi-device sync
    this.io.to(`user-${message.receiverId}`).emit('message_read_sync', {
      messageId: message.id,
      readAt: message.readAt
    });
  }
  
  /**
   * Emit all messages in conversation read
   */
  private emitConversationRead(readerId: string, senderId: string): void {
    if (!this.io) return;
    
    // Emit to sender's room
    this.io.to(`user-${senderId}`).emit('conversation_read', {
      readerId,
      readAt: new Date()
    });
  }
  
  /**
   * Emit message deleted event
   */
  private emitMessageDeleted(message: Message): void {
    if (!this.io) return;
    
    const eventData = { messageId: message.id };
    
    // Emit to both sender and receiver rooms
    this.io.to(`user-${message.senderId}`).emit('message_deleted', eventData);
    this.io.to(`user-${message.receiverId}`).emit('message_deleted', eventData);
  }
  
  /**
   * Send notification for new message
   */
  private async sendMessageNotification(message: Message): Promise<void> {
    // Skip notification if user is online
    if (this.isUserOnline(message.receiverId)) return;
    
    try {
      await notificationService.sendNewMessageNotification(
        message.id,
        message.senderId,
        message.receiverId,
        message.content
      );
    } catch (error) {
      console.error('Failed to send message notification:', error);
    }
  }
}

export default new MessageService();