import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import customerService from '../services/customer.service';

export class CustomerController {
  /**
   * Get customer profile for the authenticated user
   */
  async getCustomerProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const customerProfile = await customerService.getCustomerProfile(userId);
      
      res.status(200).json({
        success: true,
        data: customerProfile
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve customer profile'
      });
    }
  }

  /**
   * Update customer profile for the authenticated user
   */
  async updateCustomerProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profileData = req.body;
      
      const updatedProfile = await customerService.updateCustomerProfile(userId, profileData);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to update customer profile'
      });
    }
  }

  /**
   * Get order history with filtering and pagination
   */
  async getOrderHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      // Parse query parameters
      const options: any = {};
      
      // Parse status filter
      if (req.query.status) {
        if (Array.isArray(req.query.status)) {
          options.status = req.query.status as OrderStatus[];
        } else {
          options.status = req.query.status as OrderStatus;
        }
      }
      
      // Parse date filters
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      // Parse pagination
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      // Parse sorting
      if (req.query.sortBy) {
        options.sortBy = req.query.sortBy as string;
      }
      
      if (req.query.sortOrder) {
        options.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      }
      
      const { orders, total } = await customerService.getOrderHistory(userId, options);
      
      res.status(200).json({
        success: true,
        data: {
          orders,
          total,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve order history'
      });
    }
  }

  /**
   * Get order details by ID
   */
  async getOrderDetails(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const orderDetails = await customerService.getOrderDetails(userId, orderId);
      
      res.status(200).json({
        success: true,
        data: orderDetails
      });
    } catch (error: any) {
      const statusCode = 
        error.message === 'Order not found or does not belong to this customer' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve order details'
      });
    }
  }

  /**
   * Track order delivery status
   */
  async trackOrderDelivery(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      const trackingInfo = await customerService.trackOrderDelivery(userId, orderId);
      
      res.status(200).json({
        success: true,
        data: trackingInfo
      });
    } catch (error: any) {
      const statusCode = 
        error.message === 'Order not found or does not belong to this customer' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve tracking information'
      });
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      const { cancellationReason } = req.body;
      
      if (!orderId) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }
      
      if (!cancellationReason) {
        res.status(400).json({
          success: false,
          message: 'Cancellation reason is required'
        });
        return;
      }
      
      const cancelledOrder = await customerService.cancelOrder(userId, orderId, cancellationReason);
      
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: cancelledOrder
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Order not found or does not belong to this customer') {
        statusCode = 404;
      } else if (error.message.includes('Cannot cancel order')) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to cancel order'
      });
    }
  }

  /**
   * Get customer's wishlist
   */
  async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const wishlist = await customerService.getWishlist(userId);
      
      res.status(200).json({
        success: true,
        data: wishlist
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve wishlist'
      });
    }
  }

  /**
   * Add an item to wishlist
   */
  async addToWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { partId } = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }
      
      const wishlistItem = await customerService.addToWishlist(userId, { partId });
      
      res.status(201).json({
        success: true,
        message: 'Item added to wishlist',
        data: wishlistItem
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Customer profile not found') {
        statusCode = 404;
      } else if (error.message === 'Part not found') {
        statusCode = 404;
      } else if (error.message === 'Item already in wishlist') {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to add item to wishlist'
      });
    }
  }

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { wishlistItemId } = req.params;
      
      if (!wishlistItemId) {
        res.status(400).json({
          success: false,
          message: 'Wishlist item ID is required'
        });
        return;
      }
      
      await customerService.removeFromWishlist(userId, wishlistItemId);
      
      res.status(200).json({
        success: true,
        message: 'Item removed from wishlist'
      });
    } catch (error: any) {
      const statusCode = error.message === 'Wishlist item not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to remove item from wishlist'
      });
    }
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      
      await customerService.clearWishlist(userId);
      
      res.status(200).json({
        success: true,
        message: 'Wishlist cleared successfully'
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to clear wishlist'
      });
    }
  }

  /**
   * Check if a part is in the wishlist
   */
  async isInWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { partId } = req.params;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }
      
      const isInWishlist = await customerService.isInWishlist(userId, partId);
      
      res.status(200).json({
        success: true,
        data: { isInWishlist }
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to check wishlist status'
      });
    }
  }

  /**
   * Track a recently viewed part
   */
  async trackRecentlyViewed(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { partId } = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }
      
      await customerService.trackRecentlyViewed(userId, partId);
      
      res.status(200).json({
        success: true,
        message: 'Recently viewed part tracked successfully'
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Customer profile not found' || error.message === 'Part not found') {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to track recently viewed part'
      });
    }
  }

  /**
   * Get recently viewed parts
   */
  async getRecentlyViewed(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const recentlyViewed = await customerService.getRecentlyViewed(userId, limit);
      
      res.status(200).json({
        success: true,
        data: recentlyViewed
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve recently viewed parts'
      });
    }
  }
}

export default new CustomerController();