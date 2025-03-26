import { Request, Response } from 'express';
import { DeliveryStatus, PrismaClient } from '@prisma/client';
import deliveryService from '../services/delivery.service';

const prisma = new PrismaClient();

export class DeliveryController {
  /**
   * Create a new delivery for an order
   * @route POST /api/deliveries
   */
  async createDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const delivery = await deliveryService.createDelivery(orderId);
      
      res.status(201).json({
        success: true,
        data: delivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while creating the delivery'
      });
    }
  }

  /**
   * Get delivery details by ID
   * @route GET /api/deliveries/:deliveryId
   */
  async getDeliveryDetails(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      const deliveryDetails = await deliveryService.getDeliveryDetails(deliveryId);
      
      res.status(200).json({
        success: true,
        data: deliveryDetails
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving delivery details'
      });
    }
  }

  /**
   * Find available drivers for a delivery
   * @route GET /api/deliveries/:deliveryId/available-drivers
   */
  async findAvailableDrivers(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      const drivers = await deliveryService.findAvailableDrivers(deliveryId);
      
      res.status(200).json({
        success: true,
        data: drivers
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while finding available drivers'
      });
    }
  }

  /**
   * Assign a driver to a delivery
   * @route POST /api/deliveries/:deliveryId/assign-driver
   */
  async assignDriver(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      const { driverId } = req.body;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      if (!driverId) {
        res.status(400).json({
          success: false,
          message: 'Driver ID is required'
        });
        return;
      }
      
      const delivery = await deliveryService.assignDriver(deliveryId, driverId);
      
      res.status(200).json({
        success: true,
        data: delivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while assigning driver'
      });
    }
  }

  /**
   * Update delivery status
   * @route PATCH /api/deliveries/:deliveryId/status
   */
  async updateDeliveryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      const { status, latitude, longitude } = req.body;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      if (!status || !Object.values(DeliveryStatus).includes(status as DeliveryStatus)) {
        res.status(400).json({
          success: false,
          message: 'Valid status is required'
        });
        return;
      }
      
      let locationData;
      if (latitude !== undefined && longitude !== undefined) {
        locationData = { latitude, longitude };
      }
      
      const updatedDelivery = await deliveryService.updateDeliveryStatus(
        deliveryId,
        status as DeliveryStatus,
        locationData
      );
      
      res.status(200).json({
        success: true,
        data: updatedDelivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while updating delivery status'
      });
    }
  }

  /**
   * Submit proof of delivery
   * @route POST /api/deliveries/:deliveryId/proof
   */
  async submitDeliveryProof(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      const { proofUrl } = req.body;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      if (!proofUrl) {
        res.status(400).json({
          success: false,
          message: 'Proof URL is required'
        });
        return;
      }
      
      const delivery = await deliveryService.submitDeliveryProof(deliveryId, proofUrl);
      
      res.status(200).json({
        success: true,
        data: delivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while submitting delivery proof'
      });
    }
  }

  /**
   * Rate a delivery
   * @route POST /api/deliveries/:deliveryId/rate
   */
  async rateDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      const { rating, comment } = req.body;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      if (rating === undefined || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
        return;
      }
      
      const delivery = await deliveryService.rateDelivery(deliveryId, rating, comment || '');
      
      res.status(200).json({
        success: true,
        data: delivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while rating delivery'
      });
    }
  }

  /**
   * Get all deliveries for a driver
   * @route GET /api/deliveries/driver/:driverId
   */
  async getDriverDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const { driverId } = req.params;
      const { status, startDate, endDate, limit, offset } = req.query;
      
      if (!driverId) {
        res.status(400).json({
          success: false,
          message: 'Driver ID is required'
        });
        return;
      }
      
      // Using Prisma directly since this method doesn't exist in the service
      const where: any = { driverId };
      
      if (status) {
        where.status = status;
      }
      
      if (startDate) {
        where.createdAt = {
          ...(where.createdAt || {}),
          gte: new Date(startDate as string)
        };
      }
      
      if (endDate) {
        where.createdAt = {
          ...(where.createdAt || {}),
          lte: new Date(endDate as string)
        };
      }
      
      const parsedLimit = limit ? parseInt(limit as string) : 10;
      const parsedOffset = offset ? parseInt(offset as string) : 0;
      
      const [deliveries, total] = await Promise.all([
        prisma.delivery.findMany({
          where,
          include: {
            order: {
              select: {
                orderNumber: true,
                vendor: {
                  select: {
                    businessName: true,
                    address: true
                  }
                },
                address: true
              }
            }
          },
          take: parsedLimit,
          skip: parsedOffset
        }),
        prisma.delivery.count({ where })
      ]);
      
      res.status(200).json({
        success: true,
        data: deliveries,
        meta: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
          pages: Math.ceil(total / parsedLimit)
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving driver deliveries'
      });
    }
  }

  /**
   * Get deliveries for current driver
   * @route GET /api/deliveries/my-deliveries
   */
  async getMyDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }
      
      // Find driver record associated with this user ID
      const driver = await prisma.driver.findUnique({
        where: { userId }
      });
      
      if (!driver) {
        res.status(400).json({
          success: false,
          message: 'Driver profile not found for this user'
        });
        return;
      }
      
      const { status, startDate, endDate, limit, offset } = req.query;
      
      // Using Prisma directly
      const where: any = { driverId: driver.id };
      
      if (status) {
        where.status = status;
      }
      
      if (startDate) {
        where.createdAt = {
          ...(where.createdAt || {}),
          gte: new Date(startDate as string)
        };
      }
      
      if (endDate) {
        where.createdAt = {
          ...(where.createdAt || {}),
          lte: new Date(endDate as string)
        };
      }
      
      const parsedLimit = limit ? parseInt(limit as string) : 10;
      const parsedOffset = offset ? parseInt(offset as string) : 0;
      
      const [deliveries, total] = await Promise.all([
        prisma.delivery.findMany({
          where,
          include: {
            order: {
              select: {
                orderNumber: true,
                vendor: {
                  select: {
                    businessName: true,
                    address: true
                  }
                },
                address: true
              }
            }
          },
          take: parsedLimit,
          skip: parsedOffset
        }),
        prisma.delivery.count({ where })
      ]);
      
      res.status(200).json({
        success: true,
        data: deliveries,
        meta: {
          total,
          limit: parsedLimit,
          offset: parsedOffset,
          pages: Math.ceil(total / parsedLimit)
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving deliveries'
      });
    }
  }

  /**
   * Get delivery for an order
   * @route GET /api/deliveries/order/:orderId
   */
  async getOrderDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const delivery = await prisma.delivery.findFirst({
        where: { orderId },
        include: {
          driver: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true,
              rating: true,
              vehicleType: true,
            }
          }
        }
      });
      
      if (!delivery) {
        res.status(404).json({
          success: false,
          message: 'No delivery found for this order'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: delivery
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving the delivery'
      });
    }
  }
}

export default new DeliveryController();