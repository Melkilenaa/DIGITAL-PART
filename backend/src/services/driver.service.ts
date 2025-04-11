import { PrismaClient, Driver, DeliveryStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class DriverService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get driver profile by user ID
   */
  async getDriverProfile(userId: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  /**
   * Get driver profile by driver ID
   */
  async getDriverById(driverId: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  /**
   * Update driver profile
   */
  async updateDriverProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profileImage?: string;
  }): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data
    });

    await this.logDriverActivity(driver.id, 'PROFILE_UPDATED', { updatedFields: Object.keys(data) });
    
    return updatedDriver;
  }

  /**
   * Update driver vehicle information
   */
  async updateVehicleInfo(userId: string, data: {
    vehicleType?: string;
    vehicleColor?: string;
    licensePlate?: string;
    maxPackageSize?: string;
    maxPackageWeight?: number;
  }): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Validate license plate format if provided
    if (data.licensePlate) {
      const licenseRegex = /^[A-Z0-9-]+$/;
      if (!licenseRegex.test(data.licensePlate)) {
        throw new BadRequestException('Invalid license plate format');
      }
    }

    // Validate maxPackageWeight if provided
    if (data.maxPackageWeight !== undefined && data.maxPackageWeight <= 0) {
      throw new BadRequestException('Maximum package weight must be greater than 0');
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data
    });

    await this.logDriverActivity(driver.id, 'VEHICLE_INFO_UPDATED', { updatedFields: Object.keys(data) });
    
    return updatedDriver;
  }

  /**
   * Update driver document information
   */
  async updateDriverDocuments(userId: string, data: {
    drivingLicense?: string;
    insuranceDocument?: string;
    identificationDoc?: string;
  }): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: {
        ...data,
        isVerified: false, // Reset verification status when new documents are uploaded
      }
    });

    await this.logDriverActivity(driver.id, 'DOCUMENTS_UPDATED', { 
      updatedDocuments: Object.keys(data)
    });
    
    return updatedDriver;
  }

  /**
   * Update driver availability status
   */
  async updateAvailabilityStatus(userId: string, isAvailable: boolean): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // If driver is not verified, they cannot set themselves as available
    if (isAvailable && !driver.isVerified) {
      throw new BadRequestException('Driver must be verified before setting availability');
    }

    // Check if driver has any ongoing deliveries
    if (!isAvailable) {
      const activeDeliveries = await this.prisma.delivery.count({
        where: {
          driverId: driver.id,
          status: {
            in: [
              DeliveryStatus.ASSIGNED,
              DeliveryStatus.PICKUP_IN_PROGRESS,
              DeliveryStatus.PICKED_UP,
              DeliveryStatus.IN_TRANSIT,
              DeliveryStatus.ARRIVED
            ]
          }
        }
      });

      if (activeDeliveries > 0) {
        throw new BadRequestException('Cannot set status to unavailable while having active deliveries');
      }
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: { isAvailable }
    });

    await this.logDriverActivity(driver.id, isAvailable ? 'MARKED_AVAILABLE' : 'MARKED_UNAVAILABLE', {});
    
    return updatedDriver;
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(userId: string, latitude: number, longitude: number): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Invalid coordinates');
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: { latitude, longitude }
    });
    
    return updatedDriver;
  }

  /**
   * Set or update driver service areas
   */
  async updateServiceAreas(userId: string, serviceAreas: any): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: { serviceAreas }
    });

    await this.logDriverActivity(driver.id, 'SERVICE_AREAS_UPDATED', {});
    
    return updatedDriver;
  }

  /**
   * Set or update driver working hours
   */
  async updateWorkingHours(userId: string, workingHours: any): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Validate working hours format
    for (const [day, hours] of Object.entries(workingHours)) {
      const hourData = hours as { start: string; end: string };
      if (hourData && hourData.start && hourData.end) {
        // Validate time format (HH:MM)
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$|^closed$/i;
          
        if (!timeRegex.test(hourData.start) || !timeRegex.test(hourData.end)) {
          throw new BadRequestException(
            `Invalid time format for ${day}. Use HH:MM (24-hour) or "closed"`
          );
        }
          
        // Ensure start time is before end time
        if (hourData.start !== 'closed' && hourData.end !== 'closed') {
          const startTime = new Date(`1970-01-01T${hourData.start}`);
          const endTime = new Date(`1970-01-01T${hourData.end}`);
            
          if (startTime >= endTime) {
            throw new BadRequestException(
              `Start time must be before end time for ${day}`
            );
          }
        }
      }
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: { workingHours }
    });

    await this.logDriverActivity(driver.id, 'WORKING_HOURS_UPDATED', {});
    
    return updatedDriver;
  }

  /**
   * Get driver delivery history
   */
  async getDeliveryHistory(userId: string, options: {
    status?: DeliveryStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ deliveries: any[]; total: number; pages: number }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const where: any = { driverId: driver.id };
    
    if (options.status) {
      where.status = options.status;
    }
    
    if (options.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [deliveries, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true,
              createdAt: true,
              address: true
            }
          },
          driverEarning: true
        },
        orderBy: { order: { createdAt: 'desc' } },
        take: limit,
        skip: offset
      }),
      this.prisma.delivery.count({ where })
    ]);

    return {
      deliveries,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get driver performance metrics
   */
  async getPerformanceMetrics(userId: string, period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<any> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get completed deliveries in the period
    const completedDeliveries = await this.prisma.delivery.findMany({
      where: {
        driverId: driver.id,
        status: DeliveryStatus.DELIVERED,
        deliveredTime: {
          gte: startDate
        }
      },
      include: {
        driverEarning: true
      },
      orderBy: {
        deliveredTime: 'asc'
      }
    });

    // Calculate total earnings
    const totalEarnings = completedDeliveries.reduce((total, delivery) => {
      return total + (delivery.driverEarning?.netAmount || 0);
    }, 0);

    // Calculate average rating
    const ratedDeliveries = completedDeliveries.filter(d => d.rating !== null);
    const averageRating = ratedDeliveries.length > 0
      ? ratedDeliveries.reduce((sum, d) => sum + (d.rating || 0), 0) / ratedDeliveries.length
      : 0;

    // Calculate average delivery time
    let totalDeliveryTimeInMinutes = 0;
    let deliveriesWithValidTimes = 0;

    for (const delivery of completedDeliveries) {
      if (delivery.pickupTime && delivery.deliveredTime) {
        const pickupTime = new Date(delivery.pickupTime);
        const deliveredTime = new Date(delivery.deliveredTime);
        const timeInMinutes = (deliveredTime.getTime() - pickupTime.getTime()) / (1000 * 60);
        totalDeliveryTimeInMinutes += timeInMinutes;
        deliveriesWithValidTimes++;
      }
    }

    const avgDeliveryTimeInMinutes = deliveriesWithValidTimes > 0 
      ? Math.round(totalDeliveryTimeInMinutes / deliveriesWithValidTimes)
      : 0;

    // Group deliveries by date for chart data
    const deliveriesByDate = new Map();
    const earningsByDate = new Map();

    for (const delivery of completedDeliveries) {
      if (delivery.deliveredTime) {
        const dateKey = delivery.deliveredTime.toISOString().split('T')[0];
        
        // Count deliveries by date
        const currentCount = deliveriesByDate.get(dateKey) || 0;
        deliveriesByDate.set(dateKey, currentCount + 1);
        
        // Sum earnings by date
        const currentEarnings = earningsByDate.get(dateKey) || 0;
        earningsByDate.set(dateKey, currentEarnings + (delivery.driverEarning?.netAmount || 0));
      }
    }

    // Return metrics
    return {
      period,
      totalDeliveries: completedDeliveries.length,
      totalEarnings,
      averageRating,
      avgDeliveryTimeMinutes: avgDeliveryTimeInMinutes,
      deliveryCompletion: {
        completed: completedDeliveries.length,
        total: await this.prisma.delivery.count({
          where: {
            driverId: driver.id,
            deliveredTime: {
              gte: startDate
            }
          }
        })
      },
      chartData: {
        deliveriesByDate: Array.from(deliveriesByDate.entries()).map(([date, count]) => ({ date, count })),
        earningsByDate: Array.from(earningsByDate.entries()).map(([date, amount]) => ({ date, amount }))
      }
    };
  }

  /**
   * Log driver activity to system log
   */
  private async logDriverActivity(driverId: string, action: string, details?: any): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType: 'Driver',
          entityId: driverId,
          details: details || {}
        }
      });
    } catch (error) {
      console.error('Failed to log driver activity:', error);
      // Don't throw - logging shouldn't break functionality
    }
  }
}

export default new DriverService();