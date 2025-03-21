import { PrismaClient, Customer, WishlistItem, OrderStatus } from '@prisma/client';

interface CustomerProfileDto {
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}

interface WishlistItemDto {
  partId: string;
}

interface OrderFilterOptions {
  status?: OrderStatus | OrderStatus[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CustomerService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get customer profile by user ID
   */
  async getCustomerProfile(userId: string): Promise<any> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    if (!customer) {
      throw new Error('Customer profile not found');
    }

    return customer;
  }

  /**
   * Update customer profile
   */
  async updateCustomerProfile(userId: string, data: CustomerProfileDto): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId }
    });

    if (!customer) {
      throw new Error('Customer profile not found');
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { userId },
      data
    });

    await this.logActivity(
      userId,
      'CUSTOMER_PROFILE_UPDATED',
      'Customer profile updated',
      { customerId: customer.id, updatedFields: Object.keys(data) }
    );

    return updatedCustomer;
  }

  /**
   * Get customer's order history with filtering and pagination
   */
  async getOrderHistory(userId: string, options: OrderFilterOptions = {}): Promise<{ orders: any[], total: number }> {
    const customer = await this.validateCustomer(userId);

    // Build filter conditions
    const filterConditions: any = {
      customerId: customer.id
    };

    if (options.status) {
      if (Array.isArray(options.status)) {
        filterConditions.orderStatus = { in: options.status };
      } else {
        filterConditions.orderStatus = options.status;
      }
    }

    if (options.startDate || options.endDate) {
      filterConditions.createdAt = {};
      if (options.startDate) {
        filterConditions.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        filterConditions.createdAt.lte = options.endDate;
      }
    }

    // Count total orders matching the filter
    const total = await this.prisma.order.count({
      where: filterConditions
    });

    // Set default pagination and sorting
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    // Get orders with pagination and sorting
    const orders = await this.prisma.order.findMany({
      where: filterConditions,
      include: {
        items: {
          include: {
            part: {
              select: {
                name: true,
                images: true,
              }
            }
          }
        },
        vendor: {
          select: {
            businessName: true,
            businessLogo: true
          }
        },
        address: true,
        delivery: {
          include: {
            driver: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true,
                phoneNumber: true,
                rating: true
              }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    return { orders, total };
  }

  /**
   * Get order details by ID
   */
  async getOrderDetails(userId: string, orderId: string): Promise<any> {
    const customer = await this.validateCustomer(userId);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: customer.id
      },
      include: {
        items: {
          include: {
            part: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            address: true,
            city: true,
            state: true
          }
        },
        address: true,
        delivery: {
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                phoneNumber: true,
                rating: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found or does not belong to this customer');
    }

    return order;
  }

  /**
   * Track an order's delivery status
   */
  async trackOrderDelivery(userId: string, orderId: string): Promise<any> {
    const customer = await this.validateCustomer(userId);

    const orderDelivery = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: customer.id
      },
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        delivery: {
          select: {
            id: true,
            status: true,
            pickupTime: true,
            deliveredTime: true,
            estimatedDeliveryTime: true,
            currentLatitude: true,
            currentLongitude: true,
            destinationLatitude: true,
            destinationLongitude: true,
            distance: true,
            driver: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true,
                phoneNumber: true
              }
            }
          }
        }
      }
    });

    if (!orderDelivery) {
      throw new Error('Order not found or does not belong to this customer');
    }

    return orderDelivery;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(userId: string, orderId: string, cancellationReason: string): Promise<any> {
    const customer = await this.validateCustomer(userId);

    // Find the order
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: customer.id
      }
    });

    if (!order) {
      throw new Error('Order not found or does not belong to this customer');
    }

    // Check if order can be cancelled
    if (order.orderStatus !== OrderStatus.RECEIVED && order.orderStatus !== OrderStatus.PROCESSING) {
      throw new Error(`Cannot cancel order in ${order.orderStatus} status`);
    }

    // Update order status
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        isCancelled: true,
        cancellationReason,
        updatedAt: new Date()
      }
    });

    await this.logActivity(
      userId,
      'ORDER_CANCELLED',
      `Order #${order.orderNumber} cancelled`,
      { orderId, reason: cancellationReason }
    );

    return updatedOrder;
  }

  /**
   * Get customer's wishlist
   */
  async getWishlist(userId: string): Promise<WishlistItem[]> {
    const customer = await this.validateCustomer(userId);

    return this.prisma.wishlistItem.findMany({
      where: { customerId: customer.id },
      include: {
        part: {
          include: {
            vendor: {
              select: {
                businessName: true,
                businessLogo: true
              }
            }
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    });
  }

  /**
   * Add item to wishlist
   */
  async addToWishlist(userId: string, data: WishlistItemDto): Promise<WishlistItem> {
    const customer = await this.validateCustomer(userId);

    // Check if part exists
    const part = await this.prisma.part.findUnique({
      where: { id: data.partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findFirst({
      where: {
        customerId: customer.id,
        partId: data.partId
      }
    });

    if (existing) {
      throw new Error('Item already in wishlist');
    }

    // Add to wishlist
    const wishlistItem = await this.prisma.wishlistItem.create({
      data: {
        customerId: customer.id,
        partId: data.partId
      },
      include: {
        part: true
      }
    });

    await this.logActivity(
      userId,
      'WISHLIST_ITEM_ADDED',
      `Added ${part.name} to wishlist`,
      { partId: data.partId }
    );

    return wishlistItem;
  }

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(userId: string, wishlistItemId: string): Promise<void> {
    const customer = await this.validateCustomer(userId);

    // Check if item exists and belongs to customer
    const wishlistItem = await this.prisma.wishlistItem.findFirst({
      where: {
        id: wishlistItemId,
        customerId: customer.id
      },
      include: {
        part: true
      }
    });

    if (!wishlistItem) {
      throw new Error('Wishlist item not found');
    }

    // Remove item
    await this.prisma.wishlistItem.delete({
      where: { id: wishlistItemId }
    });

    await this.logActivity(
      userId,
      'WISHLIST_ITEM_REMOVED',
      `Removed ${wishlistItem.part.name} from wishlist`,
      { partId: wishlistItem.partId }
    );
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(userId: string): Promise<void> {
    const customer = await this.validateCustomer(userId);

    await this.prisma.wishlistItem.deleteMany({
      where: { customerId: customer.id }
    });

    await this.logActivity(
      userId,
      'WISHLIST_CLEARED',
      'Cleared entire wishlist'
    );
  }

  /**
   * Check if a part is in wishlist
   */
  async isInWishlist(userId: string, partId: string): Promise<boolean> {
    const customer = await this.validateCustomer(userId);

    const count = await this.prisma.wishlistItem.count({
      where: {
        customerId: customer.id,
        partId
      }
    });

    return count > 0;
  }

  /**
   * Track recently viewed parts
   */
  async trackRecentlyViewed(userId: string, partId: string): Promise<void> {
    const customer = await this.validateCustomer(userId);

    // Check if part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Check if already in recently viewed
    const existing = await this.prisma.recentlyViewed.findFirst({
      where: {
        customerId: customer.id,
        partId
      }
    });

    if (existing) {
      // Update timestamp
      await this.prisma.recentlyViewed.update({
        where: { id: existing.id },
        data: { viewedAt: new Date() }
      });
    } else {
      // Add to recently viewed
      await this.prisma.recentlyViewed.create({
        data: {
          customerId: customer.id,
          partId
        }
      });
    }

    // Limit to 50 most recent items
    const recentItems = await this.prisma.recentlyViewed.findMany({
      where: { customerId: customer.id },
      orderBy: { viewedAt: 'desc' },
      take: 51 // Get one extra to check if we're over the limit
    });

    if (recentItems.length > 50) {
      // Remove oldest items
      await this.prisma.recentlyViewed.delete({
        where: { id: recentItems[50].id }
      });
    }
  }

  /**
   * Get recently viewed parts
   */
  async getRecentlyViewed(userId: string, limit: number = 10): Promise<any[]> {
    const customer = await this.validateCustomer(userId);

    return this.prisma.recentlyViewed.findMany({
      where: { customerId: customer.id },
      include: {
        part: {
          include: {
            vendor: {
              select: {
                businessName: true
              }
            }
          }
        }
      },
      orderBy: { viewedAt: 'desc' },
      take: limit
    });
  }

  /**
   * Helper method to validate customer exists
   */
  private async validateCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId }
    });

    if (!customer) {
      throw new Error('Customer profile not found');
    }

    return customer;
  }

  /**
   * Log user activity
   */
  private async logActivity(userId: string, action: string, description: string, details?: any) {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType: 'Customer',
          performedById: userId,
          details: { description, ...details }
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

export default new CustomerService();