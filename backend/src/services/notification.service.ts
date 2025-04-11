import { PrismaClient, Notification, NotificationType, User, UserRole } from '@prisma/client';
import { NotFoundException, BadRequestException } from '../utils/exceptions.util';
import resendService from '../utils/resend.util';
import admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import { Server as SocketIOServer } from 'socket.io';

// Define notification channels
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

/**
 * Interface for creating a notification
 */
interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string; // References another entity like an order, delivery, etc.
  referenceType?: string;
  data?: Record<string, any>; // Additional data specific to the notification
  channels?: NotificationChannel[]; // Default is to notify on all enabled channels
}

/**
 * Interface for notification preference settings
 * This is stored in user preferences or settings
 */
interface NotificationPreferenceSettings {
  userId: string;
  orderUpdates?: boolean;
  deliveryUpdates?: boolean;
  messageReceipts?: boolean;
  paymentNotifications?: boolean;
  promotions?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
}

/**
 * Class for handling all notification functionality
 */
export class NotificationService {
  private prisma: PrismaClient;
  private io: SocketIOServer | null = null;
  private isFirebaseInitialized: boolean = false;

  constructor() {
    this.prisma = new PrismaClient();

    // Initialize Firebase Admin if not already initialized
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          // Optional database URL
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        this.isFirebaseInitialized = true;
      } else {
        this.isFirebaseInitialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      this.isFirebaseInitialized = false;
    }
  }

  /**
   * Set the Socket.IO server instance for real-time notifications
   */
  setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Create and send a notification
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: {
        deviceTokens: true,
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine which channels to use
    let channels = input.channels || [];
    if (channels.length === 0) {
      // If no specific channels provided, use all available channels
      channels = await this.determineEnabledChannels(user.id, input.type);
    }

    // Create notification record in database
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        data: input.data || {},
        isRead: false,
      }
    });

    // Send through requested channels
    await this.sendThroughChannels(notification, user, channels);

    return notification;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() }
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Get all notifications for a user with pagination and filtering
   */
  async getUserNotifications(
    userId: string,
    { page = 1, limit = 20, isRead, type }: { page?: number; limit?: number; isRead?: boolean; type?: NotificationType }
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = { userId };
    if (isRead !== undefined) {
      whereClause.isRead = isRead;
    }
    if (type) {
      whereClause.type = type;
    }

    // Execute queries
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.notification.count({ where: whereClause }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      })
    ]);

    return {
      notifications,
      total,
      unreadCount
    };
  }

  /**
   * Get notification preferences for a user from system settings
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceSettings> {
    // Check if we have settings stored in SystemConfig or other tables
    const defaultPrefs = {
      userId,
      orderUpdates: true,
      deliveryUpdates: true,
      messageReceipts: true,
      paymentNotifications: true,
      promotions: true,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true
    };

    try {
      // Try to find preferences in system config
      const preferences = await this.prisma.systemConfig.findFirst({
        where: {
          key: `notification_preferences_${userId}`
        }
      });

      if (preferences) {
        return {
          userId,
          ...JSON.parse(preferences.value)
        };
      }

      // If not found, create default preferences
      await this.prisma.systemConfig.create({
        data: {
          key: `notification_preferences_${userId}`,
          value: JSON.stringify({
            orderUpdates: true,
            deliveryUpdates: true,
            messageReceipts: true,
            paymentNotifications: true,
            promotions: true,
            emailEnabled: true,
            pushEnabled: true,
            inAppEnabled: true
          }),
          description: `Notification preferences for user ${userId}`
        }
      });

      return defaultPrefs;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return defaultPrefs;
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferenceSettings>): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get current preferences
      const currentPrefs = await this.getNotificationPreferences(userId);
      
      // Update preferences
      const updatedPrefs = {
        ...currentPrefs,
        ...preferences
      };

      // Save to system config
      await this.prisma.systemConfig.upsert({
        where: {
          key: `notification_preferences_${userId}`
        },
        update: {
          value: JSON.stringify(updatedPrefs)
        },
        create: {
          key: `notification_preferences_${userId}`,
          value: JSON.stringify(updatedPrefs),
          description: `Notification preferences for user ${userId}`
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  /**
   * Register a device for push notifications
   */
  async registerDevice(userId: string, deviceToken: string, platform: 'android' | 'ios' | 'web'): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if device is already registered
    const existing = await this.prisma.deviceToken.findFirst({
      where: {
        token: deviceToken,
        userId
      }
    });

    if (existing) {
      // Update last active time
      return this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: {
          updatedAt: new Date(),
          platform
        }
      });
    } else {
      // Register new device
      return this.prisma.deviceToken.create({
        data: {
          userId,
          token: deviceToken,
          platform,
          device: platform
        }
      });
    }
  }

  /**
   * Unregister a device from push notifications
   */
  async unregisterDevice(userId: string, deviceToken: string): Promise<boolean> {
    try {
      await this.prisma.deviceToken.deleteMany({
        where: {
          userId,
          token: deviceToken
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to unregister device:', error);
      return false;
    }
  }

  /**
   * Send order status notifications
   */
  async sendOrderStatusNotification(
    orderId: string,
    status: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          vendor: {
            include: {
              user: true
            }
          }
        }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Create notification for customer
      const title = `Order #${order.orderNumber} ${status}`;
      let message = `Your order #${order.orderNumber} has been ${status.toLowerCase()}.`;

      // Customize message based on status
      switch (status.toUpperCase()) {
        case 'CONFIRMED':
          message = `Your order #${order.orderNumber} has been confirmed and is being processed.`;
          break;
        case 'PROCESSING':
          message = `Your order #${order.orderNumber} is now being processed.`;
          break;
        case 'READY_FOR_PICKUP':
          message = `Great news! Your order #${order.orderNumber} is ready for pickup.`;
          break;
        case 'IN_TRANSIT':
          message = `Your order #${order.orderNumber} is now out for delivery!`;
          break;
        case 'DELIVERED':
          message = `Your order #${order.orderNumber} has been delivered successfully.`;
          break;
        case 'CANCELLED':
          message = `We're sorry, your order #${order.orderNumber} has been cancelled.`;
          break;
      }

      const data = {
        ...additionalData,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: status,
        total: order.total,
        vendorId: order.vendorId,
        vendorName: order.vendor.businessName
      };

      // Send notification to customer
      return this.createNotification({
        userId: order.customer.userId,
        title,
        message,
        type: NotificationType.ORDER_STATUS,
        referenceId: order.id,
        referenceType: 'Order',
        data
      });
    } catch (error) {
      console.error('Failed to send order status notification:', error);
      return null;
    }
  }

  /**
   * Send delivery status notifications
   */
  async sendDeliveryStatusNotification(
    deliveryId: string,
    status: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    try {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: {
            include: {
              customer: {
                include: {
                  user: true
                }
              }
            }
          },
          driver: {
            include: {
              user: true
            }
          }
        }
      });

      if (!delivery) {
        throw new NotFoundException('Delivery not found');
      }

      // Create notification for customer
      const title = `Delivery Update: ${status}`;
      let message = `Your delivery for order #${delivery.order.orderNumber} has been ${status.toLowerCase()}.`;

      // Customize message based on status
      switch (status.toUpperCase()) {
        case 'ASSIGNED':
          message = `A driver has been assigned to your order #${delivery.order.orderNumber}.`;
          break;
        case 'PICKUP_IN_PROGRESS':
          message = `The driver is on the way to pick up your order #${delivery.order.orderNumber}.`;
          break;
        case 'PICKED_UP':
          message = `Your order #${delivery.order.orderNumber} has been picked up by the driver.`;
          break;
        case 'IN_TRANSIT':
          message = `Your order #${delivery.order.orderNumber} is now in transit.`;
          break;
        case 'ARRIVED':
          message = `The driver has arrived with your order #${delivery.order.orderNumber}.`;
          break;
        case 'DELIVERED':
          message = `Your order #${delivery.order.orderNumber} has been delivered successfully.`;
          break;
        case 'FAILED':
          message = `We're sorry, there was an issue delivering your order #${delivery.order.orderNumber}.`;
          break;
      }

      const data = {
        ...additionalData,
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        orderNumber: delivery.order.orderNumber,
        status: status,
        driverId: delivery.driverId,
        driverName: delivery.driver ? `${delivery.driver.firstName} ${delivery.driver.lastName}` : 'Unknown'
      };

      // Send notification to customer
      return this.createNotification({
        userId: delivery.order.customer.userId,
        title,
        message,
        type: NotificationType.DELIVERY,
        referenceId: delivery.id,
        referenceType: 'Delivery',
        data
      });
    } catch (error) {
      console.error('Failed to send delivery status notification:', error);
      return null;
    }
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(
    paymentId: string,
    status: string,
    userId: string,
    additionalData?: Record<string, any>
  ): Promise<Notification | null> {
    try {
      const payment = await this.prisma.transaction.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Create notification
      const title = `Payment ${status}`;
      let message = `Your payment of $${payment.amount.toFixed(2)} has been ${status.toLowerCase()}.`;

      // Customize message based on status
      switch (status.toUpperCase()) {
        case 'SUCCESSFUL':
          message = `Your payment of $${payment.amount.toFixed(2)} has been processed successfully.`;
          break;
        case 'FAILED':
          message = `We're sorry, your payment of $${payment.amount.toFixed(2)} has failed.`;
          break;
        case 'PENDING':
          message = `Your payment of $${payment.amount.toFixed(2)} is being processed.`;
          break;
        case 'REFUNDED':
          message = `A refund of $${payment.amount.toFixed(2)} has been processed to your account.`;
          break;
      }

      const data = {
        ...additionalData,
        paymentId: payment.id,
        amount: payment.amount,
        status: status,
        referenceNumber: payment.reference
      };

      // Send notification to user
      return this.createNotification({
        userId,
        title,
        message,
        type: NotificationType.PAYMENT,
        referenceId: payment.id,
        referenceType: 'Payment',
        data
      });
    } catch (error) {
      console.error('Failed to send payment notification:', error);
      return null;
    }
  }

  /**
   * Send low stock notification to vendor
   */
  async sendLowStockNotification(
    partId: string,
    vendorId: string,
    currentStock: number,
    threshold: number
  ): Promise<Notification | null> {
    try {
      const part = await this.prisma.part.findUnique({
        where: { id: partId },
        include: {
          vendor: {
            include: {
              user: true
            }
          }
        }
      });

      if (!part) {
        throw new NotFoundException('Part not found');
      }

      const title = 'Low Stock Alert';
      const message = `Your product "${part.name}" is running low on stock (${currentStock} units remaining).`;

      const data = {
        partId: part.id,
        partName: part.name,
        currentStock,
        threshold,
        partNumber: part.partNumber
      };

      // Send notification to vendor
      return this.createNotification({
        userId: part.vendor.userId,
        title,
        message,
        type: NotificationType.INVENTORY,
        referenceId: part.id,
        referenceType: 'Part',
        data
      });
    } catch (error) {
      console.error('Failed to send low stock notification:', error);
      return null;
    }
  }

  /**
   * Send new message notification
   */
  async sendNewMessageNotification(
    messageId: string,
    senderId: string,
    receiverId: string,
    messageText: string
  ): Promise<Notification | null> {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        include: {
          customer: true,
          vendor: true,
          driver: true,
          admin: true
        }
      });

      if (!sender) {
        throw new NotFoundException('Sender not found');
      }

      // Get sender name based on role
      let senderName = 'System';
      if (sender.customer) {
        senderName = `${sender.customer.firstName} ${sender.customer.lastName}`;
      } else if (sender.vendor) {
        senderName = sender.vendor.businessName;
      } else if (sender.driver) {
        senderName = `${sender.driver.firstName} ${sender.driver.lastName}`;
      } else if (sender.admin) {
        senderName = `${sender.admin.firstName} ${sender.admin.lastName}`;
      }

      // Truncate message for notification
      const truncatedMessage = messageText.length > 50 
        ? `${messageText.substring(0, 47)}...` 
        : messageText;

      const title = `New message from ${senderName}`;
      const message = truncatedMessage;

      const data = {
        messageId,
        senderId,
        senderName,
        messageText,
        timestamp: new Date().toISOString()
      };

      // Send notification to receiver
      return this.createNotification({
        userId: receiverId,
        title,
        message,
        type: NotificationType.SYSTEM,
        referenceId: messageId,
        referenceType: 'Message',
        data,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH] // Skip email for messages
      });
    } catch (error) {
      console.error('Failed to send new message notification:', error);
      return null;
    }
  }

  /**
   * Send price drop notification
   */
  async sendPriceDropNotification(
    partId: string,
    userIds: string[],
    oldPrice: number,
    newPrice: number
  ): Promise<number> {
    try {
      const part = await this.prisma.part.findUnique({
        where: { id: partId },
        include: { vendor: true }
      });

      if (!part) {
        throw new NotFoundException('Part not found');
      }

      const discount = ((oldPrice - newPrice) / oldPrice * 100).toFixed(0);
      const title = `Price Drop: ${part.name}`;
      const message = `Good news! The price of ${part.name} has dropped by ${discount}%.`;

      const data = {
        partId: part.id,
        partName: part.name,
        oldPrice,
        newPrice,
        discount: `${discount}%`,
        vendorName: part.vendor.businessName
      };

      // Send notifications to all interested users
      let successCount = 0;
      for (const userId of userIds) {
        try {
          await this.createNotification({
            userId,
            title,
            message,
            type: NotificationType.PRICE_DROP,
            referenceId: part.id,
            referenceType: 'Part',
            data
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to send price drop notification to user ${userId}:`, error);
        }
      }

      return successCount;
    } catch (error) {
      console.error('Failed to send price drop notifications:', error);
      return 0;
    }
  }

  /**
   * Send promotion notification
   */
  async sendPromotionNotification(
    promotionId: string,
    userIds: string[],
    promotionData: Record<string, any>
  ): Promise<number> {
    try {
      const { name, description, discountValue, isPercentage, vendorName } = promotionData;

      const discount = isPercentage ? `${discountValue}%` : `$${discountValue.toFixed(2)}`;
      const title = `New Promotion: ${name}`;
      const message = description || `${vendorName} is offering a ${discount} discount on selected items.`;

      const data = {
        promotionId,
        ...promotionData
      };

      // Send notifications to all targeted users
      let successCount = 0;
      for (const userId of userIds) {
        try {
          await this.createNotification({
            userId,
            title,
            message,
            type: NotificationType.PROMOTION,
            referenceId: promotionId,
            referenceType: 'Promotion',
            data
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to send promotion notification to user ${userId}:`, error);
        }
      }

      return successCount;
    } catch (error) {
      console.error('Failed to send promotion notifications:', error);
      return 0;
    }
  }

  /**
   * Send review notification to vendor when a new review is posted
   */
  async sendReviewNotification(
    reviewId: string,
    vendorId: string,
    customerName: string,
    rating: number,
    reviewText?: string
  ): Promise<Notification | null> {
    try {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { user: true }
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const title = `New Review: ${rating} Stars`;
      const message = reviewText 
        ? `${customerName} gave you a ${rating}-star review: "${reviewText.substring(0, 50)}${reviewText.length > 50 ? '...' : ''}"`
        : `${customerName} gave you a ${rating}-star review.`;

      const data = {
        reviewId,
        vendorId,
        customerName,
        rating,
        reviewText
      };

      // Send notification to vendor
      return this.createNotification({
        userId: vendor.userId,
        title,
        message,
        type: NotificationType.REVIEW,
        referenceId: reviewId,
        referenceType: 'Review',
        data
      });
    } catch (error) {
      console.error('Failed to send review notification:', error);
      return null;
    }
  }

  /**
   * Send user registration confirmation
   */
  async sendRegistrationNotification(
    userId: string,
    userRole: UserRole,
    name: string
  ): Promise<Notification | null> {
    try {
      let title = 'Welcome to DAMPS';
      let message = '';

      switch (userRole) {
        case UserRole.CUSTOMER:
          message = `Welcome to DAMPS, ${name}! Your customer account has been created successfully.`;
          break;
        case UserRole.VENDOR:
          message = `Welcome to DAMPS! Your vendor account for "${name}" has been created successfully.`;
          break;
        case UserRole.DRIVER:
          message = `Welcome to DAMPS, ${name}! Your driver account has been created successfully.`;
          break;
        default:
          message = `Welcome to DAMPS! Your account has been created successfully.`;
      }

      // Send notification to user
      return this.createNotification({
        userId,
        title,
        message,
        type: NotificationType.SYSTEM,
        referenceType: 'Registration',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP] // No push since they just signed up
      });
    } catch (error) {
      console.error('Failed to send registration notification:', error);
      return null;
    }
  }

  /**
   * Determine which channels to use based on user preferences
   */
  private async determineEnabledChannels(userId: string, notificationType: NotificationType): Promise<NotificationChannel[]> {
    try {
      // Get user preferences
      const preferences = await this.getNotificationPreferences(userId);
      const channels: NotificationChannel[] = [];

      // Always include in-app if enabled
      if (preferences.inAppEnabled) {
        channels.push(NotificationChannel.IN_APP);
      }

      // Check preferences for each notification type
      let shouldSendExternal = false;
      switch (notificationType) {
        case NotificationType.ORDER_STATUS:
          shouldSendExternal = !!preferences.orderUpdates;
          break;
        case NotificationType.DELIVERY:
          shouldSendExternal = !!preferences.deliveryUpdates;
          break;
        case NotificationType.SYSTEM: // Used for messages and system notifications
          shouldSendExternal = !!preferences.messageReceipts;
          break;
        case NotificationType.PAYMENT:
          shouldSendExternal = !!preferences.paymentNotifications;
          break;
        case NotificationType.PROMOTION:
        case NotificationType.PRICE_DROP:
          shouldSendExternal = !!preferences.promotions;
          break;
        // Some notifications should always be sent regardless of preferences
        case NotificationType.INVENTORY:
        case NotificationType.REVIEW:
          shouldSendExternal = true;
          break;
        default:
          shouldSendExternal = true;
      }

      // Add email and push if they are enabled and this type should be sent
      if (shouldSendExternal) {
        if (preferences.emailEnabled) {
          channels.push(NotificationChannel.EMAIL);
        }
        if (preferences.pushEnabled) {
          channels.push(NotificationChannel.PUSH);
        }
      }

      return channels;
    } catch (error) {
      console.error('Error determining notification channels:', error);
      // Default to all channels if there's an error
      return [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.IN_APP];
    }
  }

  /**
   * Send notification through selected channels
   */
  private async sendThroughChannels(
    notification: Notification,
    user: User & { deviceTokens?: any[] },
    channels: NotificationChannel[]
  ): Promise<void> {
    try {
      // Process each channel in parallel for efficiency
      await Promise.all(
        channels.map(async (channel) => {
          try {
            switch (channel) {
              case NotificationChannel.EMAIL:
                await this.sendEmailNotification(notification, user);
                break;
              case NotificationChannel.PUSH:
                await this.sendPushNotification(notification, user);
                break;
              case NotificationChannel.IN_APP:
                await this.sendInAppNotification(notification, user);
                break;
            }
          } catch (channelError) {
            console.error(`Error sending notification through ${channel}:`, channelError);
          }
        })
      );
    } catch (error) {
      console.error('Error sending notifications through channels:', error);
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmailNotification(notification: Notification, user: User): Promise<void> {
    try {
      // Get email address from user or associated profile
      const userWithProfile = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          customer: true,
          vendor: true,
          driver: true,
          admin: true
        }
      });

      if (!userWithProfile || !userWithProfile.email) return;

      let recipientEmail = userWithProfile.email;
      let recipientName = 'User';

      // Get name based on role
      if (userWithProfile.customer) {
        recipientName = `${userWithProfile.customer.firstName} ${userWithProfile.customer.lastName}`;
      } else if (userWithProfile.vendor) {
        recipientName = userWithProfile.vendor.businessName;
        recipientEmail = userWithProfile.vendor.email || recipientEmail;
      } else if (userWithProfile.driver) {
        recipientName = `${userWithProfile.driver.firstName} ${userWithProfile.driver.lastName}`;
      } else if (userWithProfile.admin) {
        recipientName = `${userWithProfile.admin.firstName} ${userWithProfile.admin.lastName}`;
      }

      // Determine email template based on notification type
      let templateName: string;
      let templateData: Record<string, any> = { 
        name: recipientName,
        ...((notification.data && typeof notification.data === 'object') ? notification.data : {})
      };

      switch (notification.type) {
        case NotificationType.ORDER_STATUS:
          templateName = 'order-confirmation';
          templateData = {
            customerName: recipientName,
            orderNumber: (notification.data as any)?.orderNumber,
            orderTotal: (notification.data as any)?.total,
            items: (notification.data as any)?.items || []
          };
          break;
        case NotificationType.DELIVERY:
          templateName = 'delivery-update';
          templateData = {
            customerName: recipientName,
            orderNumber: (notification.data as any)?.orderNumber,
            status: (notification.data as Record<string, any>)?.status,
            estimatedDelivery: (notification.data as any)?.estimatedDelivery,
            trackingLink: (notification.data as any)?.trackingLink || `${process.env.FRONTEND_URL}/order-tracking/${(notification.data as any)?.orderId}`
          };
          break;
        case NotificationType.INVENTORY:
          templateName = 'low-stock';
          templateData = {
            vendorName: recipientName,
            partName: (notification.data as Record<string, any>)?.partName,
            currentStock: (notification.data as Record<string, any>)?.currentStock,
            threshold: (notification.data as Record<string, any>)?.threshold
          };
          break;
        case NotificationType.PAYMENT:
          templateName = 'payment';
          break;
        case NotificationType.SYSTEM:
          if ((notification.data as any)?.referenceType === 'Registration') {
            templateName = 'welcome';
            templateData = {
              name: recipientName,
              verificationLink: (notification.data as Record<string, any>)?.verificationLink || `${process.env.FRONTEND_URL}/verify-email/${(notification.data as Record<string, any>)?.token || ''}`
            };
          } else {
            templateName = 'general';
          }
          break;
        default:
          templateName = 'general';
          break;
      }

      // Send the email
      await resendService.sendTemplateEmail({
        to: recipientEmail,
        subject: notification.title,
        templateName,
        templateData
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Send a push notification
   */
  private async sendPushNotification(notification: Notification, user: User & { deviceTokens?: any[] }): Promise<void> {
    try {
      if (!this.isFirebaseInitialized) {
        console.warn('Firebase is not initialized. Push notification not sent.');
        return;
      }

      // Get user's active devices
      const devices = user.deviceTokens || await this.prisma.deviceToken.findMany({
        where: {
          userId: user.id
        }
      });

      // Also check if user has legacy pushNotificationToken
      if (devices.length === 0 && user.pushNotificationToken) {
        // Send to legacy token
        try {
          const message = {
            notification: {
              title: notification.title,
              body: notification.message
            },
            data: {
                notificationId: notification.id,
                type: notification.type,
                referenceId: (notification as any).referenceId || '',
                referenceType: (notification as any).referenceType || '',
                createdAt: notification.createdAt.toISOString(),
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                ...((notification.data && typeof notification.data === 'object') ? this.sanitizeDataForPush(notification.data as Record<string, any>) : {})
              },
            token: user.pushNotificationToken
          };
          
          await getMessaging().send(message);
        } catch (tokenError) {
          console.error('Failed to send to legacy push token:', tokenError);
        }
        return;
      }

      if (devices.length === 0) {
        return; // No devices to send to
      }

      // Prepare the notification payload optimized for Flutter
      const message = {
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: {
          notificationId: notification.id,
          type: notification.type,
          referenceId: (notification as any).referenceId || '',
          referenceType: (notification as any).referenceType || '',
          createdAt: notification.createdAt.toISOString(),
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          ...((notification.data && typeof notification.data === 'object') ? this.sanitizeDataForPush(notification.data as Record<string, any>) : {})
        }
      };

      // Send to each device
      for (const device of devices) {
        try {
          await getMessaging().send({
            token: device.token,
            ...message
          });
        } catch (deviceError) {
          console.error(`Failed to send push notification to device ${device.token}:`, deviceError);
          
          // If token is invalid, remove it
          if (typeof deviceError === 'object' && deviceError !== null && 'code' in deviceError) {
            const errorCode = (deviceError as any).code;
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered') {
              // Delete invalid token
              await this.prisma.deviceToken.deleteMany({
                where: { id: device.id }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  /**
   * Sanitize data for push notifications
   * FCM requires all values in data payload to be strings
   */
  private sanitizeDataForPush(data: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }
      
      if (typeof value === 'object') {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    
    return result;
  }

  /**
   * Send an in-app notification (via WebSockets)
   */
  private async sendInAppNotification(notification: Notification, user: User): Promise<void> {
    try {
      // Socket.IO broadcast to user's room if available
      if (this.io) {
        this.io.to(`user-${user.id}`).emit('notification', {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          referenceId: (notification as any).referenceId,
          referenceType: (notification as any).referenceType,
          data: notification.data,
          createdAt: notification.createdAt,
          isRead: notification.isRead
        });
      }
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
    }
  }
}

export default new NotificationService();