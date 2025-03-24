import { Request, Response } from 'express';
import promotionService from '../services/promotion.service';
import vendorService from '../services/vendor.service'; // import vendorService to look up the vendor
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class PromotionController {
  /**
   * Create a new promotion
   */
  async createPromotion(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.user?.role === 'VENDOR' ? req.user.userId : req.body.vendorId;
      
      // Combine request data with vendorId
      const promotionData = {
        ...req.body,
        vendorId,
      };

      const promotion = await promotionService.createPromotion(promotionData);
      
      res.status(201).json({
        success: true,
        message: 'Promotion created successfully',
        data: promotion,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create promotion',
      });
    }
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(req: Request, res: Response): Promise<void> {
    try {
      const { promotionId } = req.params;
      const updatedPromotion = await promotionService.updatePromotion(promotionId, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Promotion updated successfully',
        data: updatedPromotion,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update promotion',
      });
    }
  }

  /**
   * Delete a promotion
   */
  async deletePromotion(req: Request, res: Response): Promise<void> {
    try {
      const { promotionId } = req.params;
      const result = await promotionService.deletePromotion(promotionId);
      
      res.status(200).json({
        success: true,
        message: 'Promotion deleted successfully',
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete promotion',
      });
    }
  }

  /**
   * Get promotions for a vendor
   */
  async getVendorPromotions(req: Request, res: Response): Promise<void> {
    try {
      // Instead of using req.params.vendorId or req.user.userId directly,
      // look up the vendor record for the currently authenticated user.
      const userId = req.user?.userId;
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User id is missing',
        });
        return;
      }
      
      // Look up the vendor using the user id. This returns the vendor record,
      // and vendor.id is what is stored on promotion.vendorId.
      const vendor = await vendorService.getVendorProfile(userId);
      
      // Use the actual vendor.id for your where clause.
      const vendorId = vendor.id;
      
      // Extract query parameters
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const type = req.query.type as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      
      const result = await promotionService.getVendorPromotions(vendorId, {
        isActive,
        type: type as any,
        limit,
        offset,
      });
      
      res.status(200).json({
        success: true,
        data: result.promotions,
        pagination: {
          total: result.total,
          limit: limit || 50,
          offset: offset || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get promotions',
      });
    }
  }

  /**
   * Get a promotion by ID
   */
  async getPromotionById(req: Request, res: Response): Promise<void> {
    try {
      const { promotionId } = req.params;
      const promotion = await promotionService.getPromotionById(promotionId);
      
      res.status(200).json({
        success: true,
        data: promotion,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get promotion',
      });
    }
  }

  /**
   * Validate a promotion code
   */
  async validatePromotion(req: Request, res: Response): Promise<void> {
    try {
      const { code, vendorId, cartValue, partIds } = req.body;
      
      if (!code) {
        res.status(400).json({
          success: false,
          message: 'Promotion code is required',
        });
        return;
      }
      
      const result = await promotionService.validatePromotion({
        code,
        vendorId,
        cartValue,
        partIds,
      });
      
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate promotion',
      });
    }
  }

  /**
   * Calculate discount for a cart
   */
  async calculateDiscount(req: Request, res: Response): Promise<void> {
    try {
      const { promotionId, cartValue, cartItems } = req.body;
      
      if (!promotionId || !cartItems || !Array.isArray(cartItems)) {
        res.status(400).json({
          success: false,
          message: 'Promotion ID and cart items are required',
        });
        return;
      }
      
      const result = await promotionService.calculateDiscount({
        promotionId,
        cartValue,
        cartItems,
      });
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to calculate discount',
      });
    }
  }

  /**
   * Get active promotions for a part
   */
  async getPartPromotions(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required',
        });
        return;
      }
      
      const promotions = await promotionService.getPartPromotions(partId);
      
      res.status(200).json({
        success: true,
        data: promotions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get part promotions',
      });
    }
  }

  /**
   * Get analytics for a promotion
   */
  async getPromotionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { promotionId } = req.params;
      
      if (!promotionId) {
        res.status(400).json({
          success: false,
          message: 'Promotion ID is required',
        });
        return;
      }
      
      const analytics = await promotionService.getPromotionAnalytics(promotionId);
      
      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get promotion analytics',
      });
    }
  }
}

export default new PromotionController();