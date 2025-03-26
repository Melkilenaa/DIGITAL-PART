import { PrismaClient, OrderStatus, PaymentStatus, OrderType, PaymentType, Prisma, DeliveryStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';
import deliveryService from './delivery.service';
import locationService from './location.service';
import inventoryService from './inventory.service';
// import notificationService from './notification.service';
import { generateOrderNumber } from '../utils/reference.util';

export interface CreateOrderInput {
  customerId: string;
  vendorId: string;
  items: {
    partId: string;
    quantity: number;
    notes?: string;
  }[];
  addressId?: string;
  orderType: OrderType;
  paymentMethod: PaymentType;
  notes?: string;
  promoCode?: string;
}

export interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  notes?: string;
}

export class OrderService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a new order
   * @param data Order creation data
   */
  async createOrder(data: CreateOrderInput) {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate vendor exists
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: data.vendorId }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Validate address for delivery orders
    if (data.orderType === OrderType.DELIVERY && !data.addressId) {
      throw new BadRequestException('Address is required for delivery orders');
    }

    if (data.addressId) {
      const address = await this.prisma.address.findUnique({
        where: { id: data.addressId }
      });

      if (!address || address.customerId !== data.customerId) {
        throw new BadRequestException('Invalid address selected');
      }
    }

    // Validate items and calculate totals
    if (!data.items.length) {
      throw new BadRequestException('Order must contain at least one item');
    }

    let orderItems = [];
    let subtotal = 0;

    // Process all items in a transaction to ensure stock availability
    try {
      // Use Prisma transaction to ensure all operations succeed or fail together
      return await this.prisma.$transaction(async (tx) => {
        // Process each order item
        for (const item of data.items) {
          // Get part with latest pricing
          const part = await tx.part.findUnique({
            where: { 
              id: item.partId,
              isActive: true,
              vendorId: data.vendorId
            }
          });

          if (!part) {
            throw new NotFoundException(`Part with ID ${item.partId} not found or unavailable`);
          }

          // Check stock availability
          if (part.stockQuantity < item.quantity) {
            throw new BadRequestException(`Not enough stock for ${part.name}, only ${part.stockQuantity} available`);
          }

          // Calculate item price (respect discounted price if available)
          const unitPrice = part.discountedPrice || part.price;
          const itemSubtotal = unitPrice * item.quantity;

          // Add to order items array
          orderItems.push({
            partId: item.partId,
            quantity: item.quantity,
            unitPrice,
            subtotal: itemSubtotal,
            notes: item.notes
          });

          // Add to order subtotal
          subtotal += itemSubtotal;

          // Update inventory
          await tx.part.update({
            where: { id: item.partId },
            data: { 
              stockQuantity: { decrement: item.quantity }
            }
          });
        }

        // Calculate delivery fee
        let deliveryFee = 0;
        if (data.orderType === OrderType.DELIVERY && data.addressId) {
          const address = await tx.address.findUnique({
            where: { id: data.addressId },
            select: { latitude: true, longitude: true }
          });

          if (address?.latitude && address?.longitude && vendor.latitude && vendor.longitude) {
            const distance = await locationService.calculateDistance(
              address.latitude,
              address.longitude,
              vendor.latitude,
              vendor.longitude
            );
            
            deliveryFee = await this.calculateDeliveryFee(distance, data.items.length);
          } else {
            // Default delivery fee if coordinates not available
            deliveryFee = 1000;
          }
        }

        // Apply discount if promo code provided
        let discount = 0;
        if (data.promoCode) {
          const promotion = await tx.promotion.findFirst({
            where: {
              promotionCode: data.promoCode,
              vendorId: data.vendorId,
              isActive: true,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() }
            }
          });

          if (promotion) {
            // Apply discount
            discount = promotion.isPercentage 
              ? (subtotal * promotion.discountValue) / 100
              : Math.min(promotion.discountValue, subtotal); // Don't exceed subtotal
            
            // Check minimum order value if specified
            if (promotion.minimumOrderValue && subtotal < promotion.minimumOrderValue) {
              discount = 0; // No discount if below minimum order value
            }
          }
        }

        // Calculate tax (assuming 5% VAT)
        const taxRate = 0.05;
        const tax = (subtotal - discount) * taxRate;

        // Calculate total
        const total = subtotal + deliveryFee + tax - discount;
        
        // Create order
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            customerId: data.customerId,
            vendorId: data.vendorId,
            subtotal,
            deliveryFee,
            tax,
            discount,
            total,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentMethod === PaymentType.CASH_ON_DELIVERY 
              ? PaymentStatus.PENDING 
              : PaymentStatus.PENDING,
            orderStatus: OrderStatus.RECEIVED,
            orderType: data.orderType,
            addressId: data.addressId,
            notes: data.notes,
            items: {
              create: orderItems
            },
            commissionAmount: (subtotal * (vendor.commissionRate || 5.0)) / 100,
            vendorEarning: subtotal - ((subtotal * (vendor.commissionRate || 5.0)) / 100)
          },
          include: {
            items: {
              include: {
                part: {
                  select: {
                    name: true,
                    images: true,
                    partNumber: true
                  }
                }
              }
            },
            customer: {
              select: {
                firstName: true,
                lastName: true,
                user: {
                  select: {
                    email: true,
                    phone: true
                  }
                }
              }
            },
            vendor: {
              select: {
                businessName: true,
                phoneNumber: true,
                email: true
              }
            },
            address: true
          }
        });

        // Create delivery record if order type is delivery
        if (data.orderType === OrderType.DELIVERY) {
          await deliveryService.createDelivery(order.id);
        }

        // Notify vendor about new order
        // await notificationService.sendOrderNotification(order, 'NEW_ORDER');

        // If any parts are now low in stock, notify vendor
        for (const item of order.items) {
          await inventoryService.checkAndNotifyLowStock(item.partId);
        }

        return order;
      }, {
        maxWait: 10000, // wait at most 10s for transaction to start
        timeout: 30000, // transaction will be automatically aborted after 30s
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Order creation error:', error);
      throw new BadRequestException('Failed to process order, please try again');
    }
  }

  /**
   * Calculate delivery fee based on distance and order size
   */
  private async calculateDeliveryFee(distanceInKm: number, itemCount: number): Promise<number> {
    // Base fee
    let baseFee = 500;
    
    // Distance fee: ₦100 per km after first 5km
    let distanceFee = 0;
    if (distanceInKm > 5) {
      distanceFee = Math.ceil(distanceInKm - 5) * 100;
    }
    
    // Size fee: ₦50 per item after first 3 items
    let sizeFee = 0;
    if (itemCount > 3) {
      sizeFee = (itemCount - 3) * 50;
    }
    
    return baseFee + distanceFee + sizeFee;
  }

  /**
   * Get order by ID with details
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            part: {
              select: {
                name: true,
                images: true,
                partNumber: true,
                description: true
              }
            }
          }
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true,
            user: {
              select: {
                email: true,
                phone: true
              }
            }
          }
        },
        vendor: {
          select: {
            businessName: true,
            businessLogo: true,
            phoneNumber: true,
            email: true,
            address: true
          }
        },
        address: true,
        delivery: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get order history for a customer
   */
  async getCustomerOrders(customerId: string, filters: {
    status?: OrderStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { status, startDate, endDate, limit = 10, offset = 0 } = filters;
    
    // Build where clause
    const where: Prisma.OrderWhereInput = {
      customerId,
      ...(status && { orderStatus: status }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } })
    };

    // Get total count for pagination
    const totalCount = await this.prisma.order.count({ where });

    // Get orders with pagination
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        items: {
          include: {
            part: {
              select: {
                name: true,
                images: true
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
        delivery: {
          select: {
            status: true,
            driverId: true,
            estimatedDeliveryTime: true
          }
        }
      }
    });

    return {
      orders,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Get vendor orders
   */
  async getVendorOrders(vendorId: string, filters: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { status, paymentStatus, startDate, endDate, limit = 10, offset = 0 } = filters;
    
    // Build where clause
    const where: Prisma.OrderWhereInput = {
      vendorId,
      ...(status && { orderStatus: status }),
      ...(paymentStatus && { paymentStatus }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } })
    };

    // Get total count for pagination
    const totalCount = await this.prisma.order.count({ where });

    // Get orders with pagination
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        items: {
          include: {
            part: {
              select: {
                name: true,
                images: true
              }
            }
          }
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        delivery: {
          select: {
            status: true,
            driverId: true,
            estimatedDeliveryTime: true
          }
        },
        address: true
      }
    });

    return {
      orders,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(data: UpdateOrderStatusInput) {
    const { orderId, status, notes } = data;

    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        },
        vendor: {
          select: {
            businessName: true,
            userId: true
          }
        },
        delivery: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Update order status
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { 
        orderStatus: status,
        notes: notes ? `${order.notes || ''}\n${new Date().toISOString()}: ${notes}` : order.notes
      },
      include: {
        items: true,
        customer: {
          include: {
            user: true
          }
        },
        vendor: true,
        delivery: true
      }
    });

    // Update delivery status if needed
    if (order.delivery) {
      await this.syncDeliveryStatus(orderId, status);
    }

    // Send notifications
    // await notificationService.sendOrderStatusUpdateNotification(updatedOrder);

    // Special handling for cancelled orders
    if (status === OrderStatus.CANCELLED && !order.isCancelled) {
      await this.handleOrderCancellation(orderId);
    }

    return updatedOrder;
  }

  /**
   * Cancel an order and handle inventory restoration
   */
  async cancelOrder(orderId: string, reason: string, cancelledBy: string) {
    // Validate order exists and can be cancelled
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order can be cancelled
    const cancelableStatuses: OrderStatus[] = [
      OrderStatus.RECEIVED, 
      OrderStatus.PROCESSING
    ];

    if (!cancelableStatuses.includes(order.orderStatus)) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    // Use transaction to ensure all operations succeed
    return await this.prisma.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          isCancelled: true,
          cancellationReason: reason,
          notes: `${order.notes || ''}\n${new Date().toISOString()}: Order cancelled. Reason: ${reason}`
        },
        include: {
          items: {
            include: {
              part: true
            }
          },
          customer: {
            include: {
              user: true
            }
          },
          vendor: true
        }
      });

      // Restore inventory for each item
      for (const item of order.items) {
        await tx.part.update({
          where: { id: item.partId },
          data: {
            stockQuantity: {
              increment: item.quantity
            }
          }
        });
      }

      // Update delivery status if exists
      if (order.orderType === OrderType.DELIVERY) {
        // First find the delivery by orderId
        const delivery = await tx.delivery.findUnique({
          where: { orderId }
        });
        
        if (delivery) {
          await deliveryService.updateDeliveryStatus(
            delivery.id,
            DeliveryStatus.CANCELLED
          );
        }
      }

      // Create system log
      await tx.systemLog.create({
        data: {
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: orderId,
          performedById: cancelledBy,
          details: {
            reason,
            orderNumber: order.orderNumber,
            customerEmail: updatedOrder.customer.user.email
          }
        }
      });

      // Send notifications
    //   await notificationService.sendOrderNotification(updatedOrder, 'ORDER_CANCELLED');

      return updatedOrder;
    });
  }

  /**
   * Handle internal tasks when order is cancelled
   */
  private async handleOrderCancellation(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) return;

    // Restore inventory
    await Promise.all(order.items.map(async (item) => {
      await this.prisma.part.update({
        where: { id: item.partId },
        data: {
          stockQuantity: {
            increment: item.quantity
          }
        }
      });
    }));
  }

  /**
   * Sync delivery status based on order status
   */
  private async syncDeliveryStatus(orderId: string, orderStatus: OrderStatus) {
    // Map order status to delivery status
    const statusMap: Partial<Record<OrderStatus, DeliveryStatus>> = {
      [OrderStatus.READY_FOR_PICKUP]: DeliveryStatus.PENDING,
      [OrderStatus.IN_TRANSIT]: DeliveryStatus.IN_TRANSIT,
      [OrderStatus.DELIVERED]: DeliveryStatus.DELIVERED,
      [OrderStatus.CANCELLED]: DeliveryStatus.CANCELLED
    };

    const deliveryStatus = statusMap[orderStatus];
    if (deliveryStatus) {
      // Get delivery by orderId first
      const delivery = await this.prisma.delivery.findUnique({
        where: { orderId }
      });
      
      if (delivery) {
        await deliveryService.updateDeliveryStatus(
          delivery.id, 
          deliveryStatus
        );
      }
    }
  }

  /**
   * Get order tracking information
   */
  async getOrderTracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        delivery: {
          include: {
            driver: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
                profileImage: true,
                vehicleType: true,
                vehicleColor: true,
                licensePlate: true,
                latitude: true,
                longitude: true,
                rating: true,
                totalRatings: true
              }
            }
          }
        },
        vendor: {
          select: {
            businessName: true,
            address: true,
            city: true,
            state: true,
            phoneNumber: true,
            latitude: true,
            longitude: true
          }
        },
        address: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.delivery) {
      throw new BadRequestException('No delivery information for this order');
    }

    // For delivery orders, build tracking info
    const trackingInfo = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.delivery.estimatedDeliveryTime
      },
      delivery: {
        status: order.delivery.status,
        pickupTime: order.delivery.pickupTime,
        deliveredTime: order.delivery.deliveredTime,
        distance: order.delivery.distance,
        driver: order.delivery.driver,
        currentLocation: order.delivery.driver ? {
          latitude: order.delivery.driver.latitude,
          longitude: order.delivery.driver.longitude
        } : null
      },
      pickup: {
        businessName: order.vendor.businessName,
        address: order.vendor.address,
        city: order.vendor.city,
        state: order.vendor.state,
        location: {
          latitude: order.vendor.latitude,
          longitude: order.vendor.longitude
        }
      },
      destination: {
        address: order.address?.street,
        city: order.address?.city,
        state: order.address?.state,
        location: {
          latitude: order.address?.latitude,
          longitude: order.address?.longitude
        }
      },
      timeline: await this.getOrderTimeline(orderId)
    };

    return trackingInfo;
  }

  /**
   * Get order timeline events
   */
  private async getOrderTimeline(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        delivery: true
      }
    });

    if (!order) return [];

    const timeline = [
      {
        status: 'Order Received',
        time: order.createdAt,
        completed: true
      },
      {
        status: 'Order Processing',
        time: order.orderStatus === 'RECEIVED' ? null : order.updatedAt,
        completed: order.orderStatus !== 'RECEIVED'
      }
    ];

    // Add delivery-related timeline events if it's a delivery order
    if (order.orderType === OrderType.DELIVERY && order.delivery) {
      timeline.push(
        {
          status: 'Ready for Pickup',
          time: order.orderStatus === 'READY_FOR_PICKUP' ? order.updatedAt : null,
          completed: ['READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'].includes(order.orderStatus)
        },
        {
          status: 'In Transit',
          time: order.orderStatus === 'IN_TRANSIT' ? order.updatedAt : null,
          completed: ['IN_TRANSIT', 'DELIVERED'].includes(order.orderStatus)
        },
        {
          status: 'Delivered',
          time: order.orderStatus === 'DELIVERED' ? order.updatedAt : null,
          completed: order.orderStatus === 'DELIVERED'
        }
      );
    } else {
      // Collection order timeline
      timeline.push(
        {
          status: 'Ready for Collection',
          time: order.orderStatus === 'READY_FOR_PICKUP' ? order.updatedAt : null,
          completed: ['READY_FOR_PICKUP', 'COLLECTED'].includes(order.orderStatus)
        },
        {
          status: 'Collected',
          time: order.orderStatus === 'COLLECTED' ? order.updatedAt : null,
          completed: order.orderStatus === 'COLLECTED'
        }
      );
    }

    return timeline;
  }

  /**
   * Generate order report
   */
  async generateOrderReport(vendorId: string, period: 'daily' | 'weekly' | 'monthly') {
    const today = new Date();
    let startDate: Date;
    
    // Determine date range based on period
    switch (period) {
      case 'daily':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
    }

    // Get orders within the specified period
    const orders = await this.prisma.order.findMany({
      where: {
        vendorId,
        createdAt: { gte: startDate }
      },
      include: {
        items: true
      }
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalItems = orders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    // Get orders by status
    const ordersByStatus: Record<OrderStatus, number> = {} as Record<OrderStatus, number>;
    for (const order of orders) {
      ordersByStatus[order.orderStatus] = (ordersByStatus[order.orderStatus] || 0) + 1;
    }

    // Get popular parts
    const partCounts: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items) {
        partCounts[item.partId] = (partCounts[item.partId] || 0) + item.quantity;
      }
    }
    
    // Sort parts by popularity
    const popularPartsIds = Object.keys(partCounts)
      .sort((a, b) => partCounts[b] - partCounts[a])
      .slice(0, 5);
    
    // Get part details for popular parts
    const popularParts = await this.prisma.part.findMany({
      where: {
        id: { in: popularPartsIds }
      },
      select: {
        id: true,
        name: true,
        partNumber: true,
        price: true,
        images: true
      }
    });
    
    const popularPartsWithCount = popularParts.map(part => ({
      ...part,
      soldCount: partCounts[part.id]
    }));

    return {
      period,
      dateRange: {
        from: startDate,
        to: today
      },
      metrics: {
        totalOrders,
        totalSales,
        totalItems,
        ordersByStatus
      },
      popularParts: popularPartsWithCount
    };
  }
}

export default new OrderService();