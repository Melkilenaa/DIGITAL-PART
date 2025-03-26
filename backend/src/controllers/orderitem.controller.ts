import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import orderItemService from '../services/orderitem.service';

const prisma = new PrismaClient();

export class OrderItemController {
  /**
   * Get all items for an order
   * @route GET /api/order-items/:orderId
   */
  async getOrderItems(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      // No getOrderItems method in the service, so using prisma directly
      const items = await prisma.orderItem.findMany({
        where: { orderId },
        include: {
          part: {
            select: {
              name: true,
              description: true,
              images: true,
              partNumber: true,
              price: true,
              discountedPrice: true,
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
      
      res.status(200).json({
        success: true,
        data: items
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving order items'
      });
    }
  }

  /**
   * Get a specific order item
   * @route GET /api/order-items/item/:itemId
   */
  async getOrderItemById(req: Request, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      
      if (!itemId) {
        res.status(400).json({
          success: false,
          message: 'Order item ID is required'
        });
        return;
      }
      
      // No getOrderItemById method in the service, so using prisma directly
      const item = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: {
          part: {
            select: {
              name: true,
              description: true,
              images: true,
              partNumber: true,
              price: true,
              discountedPrice: true,
              stockQuantity: true,
              category: {
                select: {
                  name: true
                }
              }
            }
          },
          order: {
            select: {
              orderStatus: true,
              orderNumber: true
            }
          }
        }
      });
      
      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Order item not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving the order item'
      });
    }
  }

  /**
   * Add item to an order
   * @route POST /api/order-items
   */
  async addItemToOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, partId, quantity, notes } = req.body;
      
      // Validate required fields
      if (!orderId || !partId || !quantity) {
        res.status(400).json({
          success: false,
          message: 'Order ID, part ID, and quantity are required'
        });
        return;
      }
      
      // Validate quantity is a positive number
      const parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be a positive number'
        });
        return;
      }
      
      // Check permission if user is authenticated
      if (req.user?.userId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            customer: true,
            vendor: true
          }
        });
        
        if (!order) {
          res.status(404).json({
            success: false,
            message: 'Order not found'
          });
          return;
        }
        
        // Check if user owns this order (as customer or vendor)
        const isOrderCustomer = order.customer?.userId === req.user.userId;
        const isOrderVendor = order.vendor?.userId === req.user.userId;
        
        if (!isOrderCustomer && !isOrderVendor && req.user.role !== 'ADMIN') {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to modify this order'
          });
          return;
        }
      }
      
      // The service takes separate parameters, not an object
      const result = await orderItemService.addItemToOrder(orderId, partId, parsedQuantity, notes);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while adding item to order'
      });
    }
  }

  /**
   * Update item quantity
   * @route PATCH /api/order-items/:orderItemId
   */
  async updateItemQuantity(req: Request, res: Response): Promise<void> {
    try {
      const { orderItemId } = req.params;
      const { quantity } = req.body;
      
      if (!orderItemId) {
        res.status(400).json({
          success: false,
          message: 'Order item ID is required'
        });
        return;
      }
      
      if (quantity === undefined) {
        res.status(400).json({
          success: false,
          message: 'Quantity is required'
        });
        return;
      }
      
      const parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity < 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be a non-negative number'
        });
        return;
      }
      
      // Check permission if user is authenticated
      if (req.user?.userId) {
        const orderItem = await prisma.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            order: {
              include: {
                customer: true,
                vendor: true
              }
            }
          }
        });
        
        if (!orderItem) {
          res.status(404).json({
            success: false,
            message: 'Order item not found'
          });
          return;
        }
        
        // Check if user owns this order (as customer or vendor)
        const isOrderCustomer = orderItem.order.customer?.userId === req.user.userId;
        const isOrderVendor = orderItem.order.vendor?.userId === req.user.userId;
        
        if (!isOrderCustomer && !isOrderVendor && req.user.role !== 'ADMIN') {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to modify this order item'
          });
          return;
        }
      }
      
      // The service takes direct parameters, not an object
      const updatedItem = await orderItemService.updateItemQuantity(orderItemId, parsedQuantity);
      
      res.status(200).json({
        success: true,
        data: updatedItem
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while updating item quantity'
      });
    }
  }

  /**
   * Remove item from order
   * @route DELETE /api/order-items/:orderItemId
   */
  async removeOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const { orderItemId } = req.params;
      
      if (!orderItemId) {
        res.status(400).json({
          success: false,
          message: 'Order item ID is required'
        });
        return;
      }
      
      // Check permission if user is authenticated
      if (req.user?.userId) {
        const orderItem = await prisma.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            order: {
              include: {
                customer: true,
                vendor: true
              }
            }
          }
        });
        
        if (!orderItem) {
          res.status(404).json({
            success: false,
            message: 'Order item not found'
          });
          return;
        }
        
        // Check if user owns this order (as customer or vendor)
        const isOrderCustomer = orderItem.order.customer?.userId === req.user.userId;
        const isOrderVendor = orderItem.order.vendor?.userId === req.user.userId;
        
        if (!isOrderCustomer && !isOrderVendor && req.user.role !== 'ADMIN') {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to remove this order item'
          });
          return;
        }
      }
      
      const result = await orderItemService.removeItemFromOrder(orderItemId);
      
      res.status(200).json({
        success: true,
        message: 'Item removed successfully',
        data: result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while removing the item'
      });
    }
  }

  /**
   * Calculate order totals
   * @route GET /api/order-items/calculate/:orderId
   */
  async calculateOrderTotals(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const totals = await orderItemService.calculateOrderTotals(orderId);
      
      res.status(200).json({
        success: true,
        data: totals
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while calculating order totals'
      });
    }
  }

  /**
   * Apply promotion to order
   * @route POST /api/order-items/:orderId/apply-promotion
   */
  async applyPromotionToOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { promotionCode } = req.body;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      if (!promotionCode) {
        res.status(400).json({
          success: false,
          message: 'Promotion code is required'
        });
        return;
      }
      
      // Check permission if user is authenticated
      if (req.user?.userId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            customer: true,
            vendor: true
          }
        });
        
        if (!order) {
          res.status(404).json({
            success: false,
            message: 'Order not found'
          });
          return;
        }
        
        // Check if user owns this order (as customer or vendor)
        const isOrderCustomer = order.customer?.userId === req.user.userId;
        const isOrderVendor = order.vendor?.userId === req.user.userId;
        
        if (!isOrderCustomer && !isOrderVendor && req.user.role !== 'ADMIN') {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to apply promotions to this order'
          });
          return;
        }
      }
      
      const result = await orderItemService.applyPromotionToItems(orderId, promotionCode);
      
      res.status(200).json({
        success: true,
        message: 'Promotion applied successfully',
        data: result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while applying the promotion'
      });
    }
  }
}

export default new OrderItemController();