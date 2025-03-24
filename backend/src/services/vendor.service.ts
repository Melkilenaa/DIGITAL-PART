import { PrismaClient, Vendor, OrderStatus, SystemLog } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

// Define interfaces for input data
interface VendorProfileUpdateDto {
  businessName?: string;
  businessLogo?: string;
  businessDescription?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  operatingHours?: Record<string, { open: string; close: string }>;
  specialHolidays?: Record<string, { isOpen: boolean; note?: string }>;
  specializations?: string[];
  certifications?: string[];
  tags?: string[];
}

interface OperatingHoursDto {
  monday?: { open: string; close: string };
  tuesday?: { open: string; close: string };
  wednesday?: { open: string; close: string };
  thursday?: { open: string; close: string };
  friday?: { open: string; close: string };
  saturday?: { open: string; close: string };
  sunday?: { open: string; close: string };
  [key: string]: { open: string; close: string } | undefined;
}

interface VendorVerificationDto {
  documents: Array<{
    type: string;
    url: string;
    description?: string;
  }>;
  notes?: string;
}

interface VendorMetricsDto {
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month';
}

export class VendorService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get vendor profile by user ID
   */
  async getVendorProfile(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendor;
  }

  /**
   * Get vendor profile by vendor ID
   */
  async getVendorById(vendorId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  /**
   * Update vendor profile
   */
  async updateVendorProfile(userId: string, data: VendorProfileUpdateDto): Promise<Vendor> {
    try {
      // Find the vendor first
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor profile not found');
      }

      // Update the vendor profile
      return await this.prisma.vendor.update({
        where: { userId },
        data,
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update vendor profile: ${error.message}`);
    }
  }

  /**
   * Update vendor operating hours
   */
  async updateOperatingHours(vendorId: string, operatingHours: OperatingHoursDto): Promise<Vendor> {
    try {
      // Validate operating hours format
      for (const [day, hours] of Object.entries(operatingHours)) {
        if (hours && hours.open && hours.close) {
          // Validate time format (HH:MM)
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$|^closed$/i;
          
          if (!timeRegex.test(hours.open) || !timeRegex.test(hours.close)) {
            throw new BadRequestException(
              `Invalid time format for ${day}. Use HH:MM (24-hour) or "closed"`
            );
          }
          
          // Ensure open time is before close time
          if (hours.open !== 'closed' && hours.close !== 'closed') {
            const openTime = new Date(`1970-01-01T${hours.open}`);
            const closeTime = new Date(`1970-01-01T${hours.close}`);
            
            if (openTime >= closeTime) {
              throw new BadRequestException(
                `Open time must be before close time for ${day}`
              );
            }
          }
        }
      }

      return await this.prisma.vendor.update({
        where: { id: vendorId },
        data: { operatingHours },
      });
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update operating hours: ${error.message}`);
    }
  }

  /**
   * Update vendor special holidays
   */
  async updateSpecialHolidays(vendorId: string, specialHolidays: Record<string, { isOpen: boolean; note?: string }>): Promise<Vendor> {
    try {
      // Validate date format in keys (YYYY-MM-DD)
      for (const dateStr of Object.keys(specialHolidays)) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          throw new BadRequestException(
            `Invalid date format: ${dateStr}. Use YYYY-MM-DD format.`
          );
        }
        
        // Validate the date is valid
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date: ${dateStr}`);
        }
      }

      return await this.prisma.vendor.update({
        where: { id: vendorId },
        data: { specialHolidays },
      });
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update special holidays: ${error.message}`);
    }
  }

  /**
   * Submit verification documents
   */
  async submitVerificationDocuments(vendorId: string, data: VendorVerificationDto): Promise<Vendor> {
    try {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Save the verification documents
      return await this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          verificationDocuments: data.documents,
          // Don't automatically set to verified - admin needs to review
        },
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to submit verification documents: ${error.message}`);
    }
  }

  /**
   * Get vendor performance metrics
   */
  async getVendorMetrics(vendorId: string, options: VendorMetricsDto): Promise<any> {
    try {
      const { startDate, endDate, groupBy = 'day' } = options;

      // Ensure vendor exists
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Calculate total sales for the period
      const completedOrders = await this.prisma.order.findMany({
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          orderStatus: {
            in: [OrderStatus.DELIVERED, OrderStatus.COLLECTED],
          },
          isCancelled: false,
        },
      });

      // Calculate total revenue
      const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + order.vendorEarning,
        0
      );

      // Get total number of orders
      const totalOrders = await this.prisma.order.count({
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get average order value
      const averageOrderValue = 
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Get top selling parts
      const topSellingParts = await this.prisma.$queryRaw`
        SELECT p.id, p.name, p.partNumber, SUM(oi.quantity) as totalSold
        FROM "Part" p
        JOIN "OrderItem" oi ON p.id = oi.partId
        JOIN "Order" o ON oi.orderId = o.id
        WHERE p.vendorId = ${vendorId}
        AND o.createdAt BETWEEN ${startDate} AND ${endDate}
        GROUP BY p.id, p.name, p.partNumber
        ORDER BY totalSold DESC
        LIMIT 10
      `;

      // Get order status breakdown
      const orderStatusCounts = await this.prisma.order.groupBy({
        by: ['orderStatus'],
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          orderStatus: true,
        },
      });

      // Get customer retention (repeat customers)
      const customerOrders = await this.prisma.order.groupBy({
        by: ['customerId'],
        where: {
          vendorId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
      });

      const repeatCustomers = customerOrders.filter(c => c._count.id > 1).length;
      const totalCustomers = customerOrders.length;
      const retentionRate = totalCustomers > 0 
        ? (repeatCustomers / totalCustomers * 100) 
        : 0;

      return {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        topSellingParts,
        orderStatusCounts: orderStatusCounts.reduce((acc, curr) => {
          (acc as Record<OrderStatus, number>)[curr.orderStatus] = curr._count.orderStatus;
          return acc;
        }, {} as Record<OrderStatus, number>),
        customerRetention: {
          totalCustomers,
          repeatCustomers,
          retentionRate,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get vendor metrics: ${error.message}`);
    }
  }

  /**
   * Get vendor reviews
   */
  async getVendorReviews(vendorId: string, page = 1, limit = 10): Promise<any> {
    try {
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: {
            vendorId,
            isHidden: false,
          },
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.review.count({
          where: {
            vendorId,
            isHidden: false,
          },
        }),
      ]);

      return {
        reviews,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get vendor reviews: ${error.message}`);
    }
  }

  /**
   * Get vendor rating summary
   */
  async getVendorRatingSummary(vendorId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          rating: true,
          totalRatings: true,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Get rating distribution
      const ratingDistribution = await this.prisma.review.groupBy({
        by: ['rating'],
        where: {
          vendorId,
          isHidden: false,
        },
        _count: {
          rating: true,
        },
      });

      // Format the distribution
      const distribution: { [key: number]: number } = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      ratingDistribution.forEach(item => {
        distribution[item.rating] = item._count.rating;
      });

      return {
        averageRating: vendor.rating,
        totalRatings: vendor.totalRatings,
        distribution,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get vendor rating summary: ${error.message}`);
    }
  }

  /**
   * Log vendor activity
   */
  async logVendorActivity(vendorId: string, action: string, details?: any): Promise<SystemLog | null> {
    try {
      return await this.prisma.systemLog.create({
        data: {
          action,
          entityType: 'Vendor',
          entityId: vendorId,
          details,
        },
      });
    } catch (error: any) {
      console.error('Failed to log vendor activity:', error);
      // Don't throw - logging shouldn't break functionality
      return null;
    }
  }
}

export default new VendorService();