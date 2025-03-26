import { PrismaClient } from '@prisma/client';
import locationService from './location.service';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';
import { DeliveryStatus } from '@prisma/client';
import { generateReference } from '../utils/reference.util';

// Define interface for location service to avoid circular reference
interface LocationService {
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
  estimateDeliveryTime(distance: number): number;
  findNearestDrivers(latitude: number, longitude: number, radius: number): Promise<any[]>;
  getMapRenderingData(startLat: number, startLong: number, destLat: number, destLong: number): any;
}

export class DeliveryService {
  constructor(
    private prisma: PrismaClient,
    public locationService: LocationService
  ) {}

  /**
   * Create a new delivery for an order
   */
  async createDelivery(orderId: string) {
    // Get the order with address and vendor info
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        vendor: true,
        address: true
      }
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    if (!order.address) {
      throw new BadRequestException('Order must have a delivery address');
    }
    
    // Calculate distance if coordinates are available
    let distance = 0;
    let estimatedDeliveryTime = null;
    
    if (
      order.vendor.latitude && 
      order.vendor.longitude && 
      order.address.latitude && 
      order.address.longitude
    ) {
      distance = this.locationService.calculateDistance(
        order.vendor.latitude,
        order.vendor.longitude,
        order.address.latitude,
        order.address.longitude
      );
      
      // Estimate delivery time
      const estimatedMinutes = this.locationService.estimateDeliveryTime(distance);
      estimatedDeliveryTime = new Date();
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + estimatedMinutes);
    }
    
    // Create the delivery record
    return this.prisma.delivery.create({
      data: {
        orderId,
        status: DeliveryStatus.PENDING,
        startLatitude: order.vendor.latitude,
        startLongitude: order.vendor.longitude,
        destinationLatitude: order.address.latitude,
        destinationLongitude: order.address.longitude,
        distance,
        deliveryFee: order.deliveryFee,
        estimatedDeliveryTime,
        driverInstructions: order.address.additionalInfo
      }
    });
  }

  /**
   * Find available drivers near a delivery location
   */
  async findAvailableDrivers(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    if (!delivery.startLatitude || !delivery.startLongitude) {
      throw new BadRequestException('Delivery location coordinates not available');
    }
    
    return this.locationService.findNearestDrivers(
      delivery.startLatitude,
      delivery.startLongitude,
      10 // Search within 10km radius
    );
  }

  /**
   * Assign a driver to a delivery
   */
  async assignDriver(deliveryId: string, driverId: string) {
    // Check if driver exists and is available
    const driver = await this.prisma.driver.findFirst({
      where: { 
        id: driverId, 
        isAvailable: true, 
        isVerified: true 
      }
    });
    
    if (!driver) {
      throw new BadRequestException('Driver not available or not verified');
    }
    
    // Check if delivery exists and is in pending status
    const delivery = await this.prisma.delivery.findFirst({
      where: { 
        id: deliveryId, 
        status: DeliveryStatus.PENDING 
      }
    });
    
    if (!delivery) {
      throw new BadRequestException('Delivery not available for assignment');
    }
    
    // Update the delivery with driver information
    return this.prisma.$transaction(async (tx) => {
      // Assign driver to delivery
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          driverId,
          status: DeliveryStatus.ASSIGNED
        }
      });
      
      // Update driver availability
      await tx.driver.update({
        where: { id: driverId },
        data: { isAvailable: false }
      });
      
      return updatedDelivery;
    });
  }

  /**
   * Update delivery status and location
   */
  async updateDeliveryStatus(
    deliveryId: string, 
    status: DeliveryStatus, 
    locationData?: { latitude: number; longitude: number }
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    // Validate status transition
    this.validateStatusTransition(delivery.status, status);
    
    const updateData: any = { status };
    
    // Update current location if provided
    if (locationData) {
      updateData.currentLatitude = locationData.latitude;
      updateData.currentLongitude = locationData.longitude;
    }
    
    // Add timestamps based on status
    if (status === DeliveryStatus.PICKED_UP) {
      updateData.pickupTime = new Date();
    } else if (status === DeliveryStatus.DELIVERED) {
      updateData.deliveredTime = new Date();
    }
    
    return this.prisma.$transaction(async (tx) => {
      // Update delivery
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: updateData
      });
      
      // Update order status based on delivery status
      if (status === DeliveryStatus.PICKED_UP) {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { orderStatus: 'IN_TRANSIT' }
        });
      } else if (status === DeliveryStatus.DELIVERED) {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { orderStatus: 'DELIVERED' }
        });
        
        // If delivery is completed, calculate driver earnings
        await this.calculateDriverEarnings(tx, deliveryId);
        
        // Make driver available again
        if (delivery.driverId) {
          await tx.driver.update({
            where: { id: delivery.driverId },
            data: { isAvailable: true }
          });
        }
      } else if (status === DeliveryStatus.FAILED || status === DeliveryStatus.CANCELLED) {
        // Make driver available again
        if (delivery.driverId) {
          await tx.driver.update({
            where: { id: delivery.driverId },
            data: { isAvailable: true }
          });
        }
      }
      
      return updatedDelivery;
    });
  }

  /**
   * Validate delivery status transition
   */
  private validateStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus) {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.CANCELLED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKUP_IN_PROGRESS, DeliveryStatus.CANCELLED],
      [DeliveryStatus.PICKUP_IN_PROGRESS]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
      [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.FAILED],
      [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.ARRIVED, DeliveryStatus.FAILED],
      [DeliveryStatus.ARRIVED]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [],
      [DeliveryStatus.CANCELLED]: []
    };
    
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Submit proof of delivery (image or signature)
   */
  async submitDeliveryProof(deliveryId: string, proofUrl: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    if (!([DeliveryStatus.ARRIVED, DeliveryStatus.DELIVERED] as DeliveryStatus[]).includes(delivery.status)) {
      throw new BadRequestException('Delivery must be arrived or delivered to submit proof');
    }
    
    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { deliveryProof: proofUrl }
    });
  }

  /**
   * Rate a delivery
   */
  async rateDelivery(deliveryId: string, rating: number, comment: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { driver: true }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    if (delivery.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be rated');
    }
    
    if (!delivery.driver) {
      throw new BadRequestException('This delivery has no assigned driver');
    }
    
    return this.prisma.$transaction(async (tx) => {
      // Update delivery rating
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          rating,
          reviewComment: comment
        }
      });
      
      // Update driver's average rating
      const newTotalRatings = delivery.driver!.totalRatings + 1;
      const newRatingSum = (delivery.driver!.rating * delivery.driver!.totalRatings) + rating;
      const newRating = parseFloat((newRatingSum / newTotalRatings).toFixed(2));
      
      await tx.driver.update({
        where: { id: delivery.driverId! },
        data: {
          rating: newRating,
          totalRatings: newTotalRatings
        }
      });
      
      return updatedDelivery;
    });
  }

  /**
   * Calculate earnings for a driver after completing a delivery
   */
  async calculateDriverEarnings(tx: any, deliveryId: string) {
    const delivery = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: { driver: true }
    });
    
    if (!delivery || !delivery.driverId) {
      throw new BadRequestException('Delivery has no assigned driver');
    }
    
    // Calculate driver's earning (typically 80% of delivery fee)
    const driverCommissionRate = 0.8; // 80%
    const amount = delivery.deliveryFee * driverCommissionRate;
    const transactionFee = delivery.deliveryFee * 0.02; // 2% transaction fee
    const netAmount = amount - transactionFee;
    
    // Create earning record
    const driverEarning = await tx.driverEarning.create({
      data: {
        driverId: delivery.driverId,
        deliveryId: delivery.id,
        amount,
        transactionFee,
        netAmount,
        isPaid: false,
        earningDate: new Date()
      }
    });
    
    // Update driver's total earnings
    await tx.driver.update({
      where: { id: delivery.driverId! },
      data: {
        totalEarnings: { increment: netAmount }
      }
    });
    
    // Create transaction record
    await tx.transaction.create({
      data: {
        reference: `DEL-${generateReference()}`,
        type: 'PAYMENT',
        amount: netAmount,
        status: 'SUCCESSFUL',
        paymentMethod: 'BANK_TRANSFER',
        currency: 'NGN',
        driverId: delivery.driverId,
        metadata: {
          deliveryId: delivery.id,
          type: 'DRIVER_EARNING',
          isPaid: false
        }
      }
    });
    
    return driverEarning;
  }

  /**
   * Get detailed delivery status with tracking info
   */
  async getDeliveryDetails(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            vendor: true,
            address: true,
            customer: true
          }
        },
        driver: true,
        driverEarning: true
      }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    // Generate map data if coordinates are available
    let mapData = null;
    if (
      delivery.startLatitude &&
      delivery.startLongitude &&
      delivery.destinationLatitude &&
      delivery.destinationLongitude
    ) {
      mapData = this.locationService.getMapRenderingData(
        delivery.startLatitude,
        delivery.startLongitude,
        delivery.destinationLatitude,
        delivery.destinationLongitude
      );
    }
    
    return {
      ...delivery,
      mapData
    };
  }
}

export default new DeliveryService(new PrismaClient(), locationService);

