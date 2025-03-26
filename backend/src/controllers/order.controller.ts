import { Request, Response } from 'express';
import { OrderStatus, PaymentStatus, OrderType, PrismaClient } from '@prisma/client';
import orderService from '../services/order.service';

const prisma = new PrismaClient();

export class OrderController {
  /**
   * Create a new order
   * @route POST /api/orders
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, vendorId, items, addressId, orderType, paymentMethod, notes, promoCode } = req.body;
      
      // Validate required fields
      if (!customerId || !vendorId || !items || !orderType || !paymentMethod) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: customerId, vendorId, items, orderType, paymentMethod'
        });
        return;
      }
      
      // Validate items array
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Items must be a non-empty array'
        });
        return;
      }
      
      // Validate address for delivery orders
      if (orderType === OrderType.DELIVERY && !addressId) {
        res.status(400).json({
          success: false,
          message: 'Address ID is required for delivery orders'
        });
        return;
      }
      
      const order = await orderService.createOrder({
        customerId,
        vendorId,
        items,
        addressId,
        orderType,
        paymentMethod,
        notes,
        promoCode
      });
      
      res.status(201).json({
        success: true,
        data: order
      });
    } catch (error: any) {
      console.error('Order creation error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while creating the order'
      });
    }
  }

  /**
   * Get order by ID
   * @route GET /api/orders/:orderId
   */
  async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const order = await orderService.getOrderById(orderId);
      
      res.status(200).json({
        success: true,
        data: order
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving the order'
      });
    }
  }

  /**
   * Get customer orders
   * @route GET /api/orders/customer/:customerId
   */
  async getCustomerOrders(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { status, startDate, endDate, limit, offset } = req.query;
      
      if (!customerId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID is required'
        });
        return;
      }
      
      // Parse query parameters
      const filters = {
        status: status as OrderStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 10,
        offset: offset ? parseInt(offset as string) : 0
      };
      
      const orders = await orderService.getCustomerOrders(customerId, filters);
      
      res.status(200).json({
        success: true,
        data: orders.orders,
        meta: {
          total: orders.total,
          pages: orders.pages,
          limit: filters.limit,
          offset: filters.offset
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving orders'
      });
    }
  }

  /**
   * Get vendor orders
   * @route GET /api/orders/vendor/:vendorId
   */
  async getVendorOrders(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { status, paymentStatus, startDate, endDate, limit, offset } = req.query;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required'
        });
        return;
      }
      
      // Parse query parameters
      const filters = {
        status: status as OrderStatus,
        paymentStatus: paymentStatus as PaymentStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 10,
        offset: offset ? parseInt(offset as string) : 0
      };
      
      const orders = await orderService.getVendorOrders(vendorId, filters);
      
      res.status(200).json({
        success: true,
        data: orders.orders,
        meta: {
          total: orders.total,
          pages: orders.pages,
          limit: filters.limit,
          offset: filters.offset
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving vendor orders'
      });
    }
  }

  /**
   * Update order status
   * @route PATCH /api/orders/:orderId/status
   */
  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required'
        });
        return;
      }
      
      if (!Object.values(OrderStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
        return;
      }
      
      const updatedOrder = await orderService.updateOrderStatus({
        orderId,
        status,
        notes
      });
      
      res.status(200).json({
        success: true,
        data: updatedOrder
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while updating order status'
      });
    }
  }

  /**
   * Cancel order
   * @route POST /api/orders/:orderId/cancel
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.userId || 'system';
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      if (!reason) {
        res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
        return;
      }
      
      const cancelledOrder = await orderService.cancelOrder(orderId, reason, userId);
      
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: cancelledOrder
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while cancelling the order'
      });
    }
  }

  /**
   * Get order tracking information
   * @route GET /api/orders/:orderId/tracking
   */
  async getOrderTracking(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const trackingInfo = await orderService.getOrderTracking(orderId);
      
      res.status(200).json({
        success: true,
        data: trackingInfo
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving tracking information'
      });
    }
  }

  /**
   * Generate order report for vendor
   * @route GET /api/orders/reports/:vendorId
   */
  async generateOrderReport(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { period = 'monthly' } = req.query;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required'
        });
        return;
      }
      
      // Validate period
      if (!['daily', 'weekly', 'monthly'].includes(period as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid period. Must be daily, weekly, or monthly'
        });
        return;
      }
      
      const report = await orderService.generateOrderReport(
        vendorId, 
        period as 'daily' | 'weekly' | 'monthly'
      );
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while generating the report'
      });
    }
  }

  /**
   * Get orders for current customer
   * @route GET /api/orders/my-orders
   */
  async getMyOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }
      
      // Find customer record associated with this user ID
      const customer = await prisma.customer.findUnique({
        where: { userId }
      });
      
      if (!customer) {
        res.status(400).json({
          success: false,
          message: 'Customer profile not found for this user'
        });
        return;
      }
      
      const { status, startDate, endDate, limit, offset } = req.query;
      
      // Parse query parameters
      const filters = {
        status: status as OrderStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 10,
        offset: offset ? parseInt(offset as string) : 0
      };
      
      const orders = await orderService.getCustomerOrders(customer.id, filters);
      
      res.status(200).json({
        success: true,
        data: orders.orders,
        meta: {
          total: orders.total,
          pages: orders.pages,
          limit: filters.limit,
          offset: filters.offset
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving orders'
      });
    }
  }

  /**
   * Get orders for current vendor
   * @route GET /api/orders/my-vendor-orders
   */
  async getMyVendorOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }
      
      // Find vendor record associated with this user ID
      const vendor = await prisma.vendor.findUnique({
        where: { userId }
      });
      
      if (!vendor) {
        res.status(400).json({
          success: false,
          message: 'Vendor profile not found for this user'
        });
        return;
      }
      
      const { status, paymentStatus, startDate, endDate, limit, offset } = req.query;
      
      // Parse query parameters
      const filters = {
        status: status as OrderStatus,
        paymentStatus: paymentStatus as PaymentStatus,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 10,
        offset: offset ? parseInt(offset as string) : 0
      };
      
      const orders = await orderService.getVendorOrders(vendor.id, filters);
      
      res.status(200).json({
        success: true,
        data: orders.orders,
        meta: {
          total: orders.total,
          pages: orders.pages,
          limit: filters.limit,
          offset: filters.offset
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving orders'
      });
    }
  }
}

export default new OrderController();