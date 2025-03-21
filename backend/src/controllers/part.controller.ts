import { Request, Response } from 'express';
import { PartCondition } from '@prisma/client';
import partService from '../services/part.service';

export class PartController {
  /**
   * Get all parts with filtering and pagination
   */
  async getAllParts(req: Request, res: Response): Promise<void> {
    try {
      // Parse filter options from query parameters
      const options: any = {};
      
      // Text search
      if (req.query.search) {
        options.search = req.query.search as string;
      }
      
      // Category filter
      if (req.query.categoryId) {
        options.categoryId = req.query.categoryId as string;
      }
      
      // Vendor filter
      if (req.query.vendorId) {
        options.vendorId = req.query.vendorId as string;
      }
      
      // Condition filter
      if (req.query.condition) {
        options.condition = req.query.condition as PartCondition;
      }
      
      // Price range filter
      if (req.query.minPrice) {
        options.minPrice = parseFloat(req.query.minPrice as string);
      }
      
      if (req.query.maxPrice) {
        options.maxPrice = parseFloat(req.query.maxPrice as string);
      }
      
      // Brand filter
      if (req.query.brand) {
        options.brand = req.query.brand as string;
      }
      
      // Tags filter (comma-separated list)
      if (req.query.tags) {
        options.tags = (req.query.tags as string).split(',');
      }
      
      // Stock filter
      if (req.query.inStock !== undefined) {
        options.inStock = req.query.inStock === 'true';
      }
      
      // Active filter
      if (req.query.isActive !== undefined) {
        options.isActive = req.query.isActive === 'true';
      }
      
      // Pagination
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      // Sorting
      if (req.query.sortBy) {
        options.sortBy = req.query.sortBy as string;
      }
      
      if (req.query.sortOrder) {
        options.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      }
      
      const { parts, total } = await partService.getAllParts(options);
      
      res.status(200).json({
        success: true,
        data: {
          parts,
          total,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve parts'
      });
    }
  }

  /**
   * Get part by ID
   */
  async getPartById(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      const part = await partService.getPartById(partId);
      
      if (!part) {
        res.status(404).json({
          success: false,
          message: 'Part not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: part
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve part'
      });
    }
  }

  /**
   * Create a new part
   */
  async createPart(req: Request, res: Response): Promise<void> {
    try {
      const partData = req.body;
      
      // Validate required fields
      if (!partData.name || !partData.price || !partData.stockQuantity || 
          !partData.categoryId || !partData.vendorId) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: name, price, stockQuantity, categoryId, and vendorId are required'
        });
        return;
      }

      // Validate numeric fields
      if (typeof partData.price !== 'number' || partData.price <= 0) {
        res.status(400).json({
          success: false,
          message: 'Price must be a positive number'
        });
        return;
      }

      if (typeof partData.stockQuantity !== 'number' || partData.stockQuantity < 0) {
        res.status(400).json({
          success: false,
          message: 'Stock quantity must be a non-negative number'
        });
        return;
      }

      const newPart = await partService.createPart(partData);
      
      res.status(201).json({
        success: true,
        message: 'Part created successfully',
        data: newPart
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Category not found' || error.message === 'Vendor not found') {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create part'
      });
    }
  }

  /**
   * Update an existing part
   */
  async updatePart(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const partData = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      // Validate numeric fields if provided
      if (partData.price !== undefined && (typeof partData.price !== 'number' || partData.price <= 0)) {
        res.status(400).json({
          success: false,
          message: 'Price must be a positive number'
        });
        return;
      }

      if (partData.stockQuantity !== undefined && 
          (typeof partData.stockQuantity !== 'number' || partData.stockQuantity < 0)) {
        res.status(400).json({
          success: false,
          message: 'Stock quantity must be a non-negative number'
        });
        return;
      }

      const updatedPart = await partService.updatePart(partId, partData);
      
      res.status(200).json({
        success: true,
        message: 'Part updated successfully',
        data: updatedPart
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Part not found') {
        statusCode = 404;
      } else if (error.message === 'Category not found' || error.message === 'Vendor not found') {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update part'
      });
    }
  }

  /**
   * Delete a part
   */
  async deletePart(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      await partService.deletePart(partId);
      
      res.status(200).json({
        success: true,
        message: 'Part deleted successfully'
      });
    } catch (error: any) {
      const statusCode = error.message === 'Part not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete part'
      });
    }
  }

  /**
   * Update part stock quantity
   */
  async updateStock(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const { quantity } = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      if (quantity === undefined || quantity === null) {
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

      const updatedPart = await partService.updateStock(partId, parsedQuantity);
      
      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: updatedPart
      });
    } catch (error: any) {
      const statusCode = error.message === 'Part not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update stock'
      });
    }
  }

  /**
   * Apply discount to a part
   */
  async applyDiscount(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const { discountedPrice } = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      if (discountedPrice === undefined || discountedPrice === null) {
        res.status(400).json({
          success: false,
          message: 'Discounted price is required'
        });
        return;
      }

      const parsedPrice = parseFloat(discountedPrice);
      if (isNaN(parsedPrice)) {
        res.status(400).json({
          success: false,
          message: 'Discounted price must be a number'
        });
        return;
      }

      const updatedPart = await partService.applyDiscount(partId, parsedPrice);
      
      res.status(200).json({
        success: true,
        message: 'Discount applied successfully',
        data: updatedPart
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Part not found') {
        statusCode = 404;
      } else if (
        error.message === 'Discounted price must be less than original price' ||
        error.message === 'Discounted price cannot be negative'
      ) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to apply discount'
      });
    }
  }

  /**
   * Remove discount from a part
   */
  async removeDiscount(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      const updatedPart = await partService.removeDiscount(partId);
      
      res.status(200).json({
        success: true,
        message: 'Discount removed successfully',
        data: updatedPart
      });
    } catch (error: any) {
      const statusCode = error.message === 'Part not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to remove discount'
      });
    }
  }

  /**
   * Find parts compatible with a specific vehicle
   */
  async findCompatibleParts(req: Request, res: Response): Promise<void> {
    try {
      // Extract vehicle details from query params
      const { make, model, year } = req.query;
      
      if (!make || !model || !year) {
        res.status(400).json({
          success: false,
          message: 'Make, model, and year are required'
        });
        return;
      }

      const parsedYear = parseInt(year as string);
      if (isNaN(parsedYear)) {
        res.status(400).json({
          success: false,
          message: 'Year must be a number'
        });
        return;
      }

      const vehicle = {
        make: make as string,
        model: model as string,
        year: parsedYear
      };

      // Parse filter options
      const options: any = {};
      
      if (req.query.categoryId) {
        options.categoryId = req.query.categoryId as string;
      }
      
      if (req.query.vendorId) {
        options.vendorId = req.query.vendorId as string;
      }
      
      if (req.query.condition) {
        options.condition = req.query.condition as PartCondition;
      }
      
      if (req.query.minPrice) {
        options.minPrice = parseFloat(req.query.minPrice as string);
      }
      
      if (req.query.maxPrice) {
        options.maxPrice = parseFloat(req.query.maxPrice as string);
      }
      
      if (req.query.brand) {
        options.brand = req.query.brand as string;
      }
      
      if (req.query.inStock !== undefined) {
        options.inStock = req.query.inStock === 'true';
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      if (req.query.sortBy) {
        options.sortBy = req.query.sortBy as string;
      }
      
      if (req.query.sortOrder) {
        options.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      }

      const { parts, total } = await partService.findCompatibleParts(vehicle, options);
      
      res.status(200).json({
        success: true,
        data: {
          parts,
          total,
          limit: options.limit || 10,
          offset: options.offset || 0,
          vehicle
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to find compatible parts'
      });
    }
  }

  /**
   * Track a part as recently viewed by a customer
   */
  async trackRecentlyViewed(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const { partId } = req.body;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      await partService.trackRecentlyViewed(customerId, partId);
      
      res.status(200).json({
        success: true,
        message: 'Part tracked as recently viewed'
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Part not found' || error.message === 'Customer not found') {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to track recently viewed part'
      });
    }
  }

  /**
   * Get recently viewed parts for a customer
   */
  async getRecentlyViewedParts(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }

      const parts = await partService.getRecentlyViewedParts(customerId, limit);
      
      res.status(200).json({
        success: true,
        data: parts
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve recently viewed parts'
      });
    }
  }

  /**
   * Get popular parts
   */
  async getPopularParts(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }

      const parts = await partService.getPopularParts(limit);
      
      res.status(200).json({
        success: true,
        data: parts
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve popular parts'
      });
    }
  }

  /**
   * Get related parts
   */
  async getRelatedParts(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      if (!partId) {
        res.status(400).json({
          success: false,
          message: 'Part ID is required'
        });
        return;
      }

      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }

      const parts = await partService.getRelatedParts(partId, limit);
      
      res.status(200).json({
        success: true,
        data: parts
      });
    } catch (error: any) {
      const statusCode = error.message === 'Part not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve related parts'
      });
    }
  }

  /**
   * Search parts by keyword
   */
  async searchParts(req: Request, res: Response): Promise<void> {
    try {
      const { keyword } = req.query;
      
      if (!keyword) {
        res.status(400).json({
          success: false,
          message: 'Search keyword is required'
        });
        return;
      }

      // Parse filter options
      const options: any = {};
      
      if (req.query.categoryId) {
        options.categoryId = req.query.categoryId as string;
      }
      
      if (req.query.vendorId) {
        options.vendorId = req.query.vendorId as string;
      }
      
      if (req.query.condition) {
        options.condition = req.query.condition as PartCondition;
      }
      
      if (req.query.minPrice) {
        options.minPrice = parseFloat(req.query.minPrice as string);
      }
      
      if (req.query.maxPrice) {
        options.maxPrice = parseFloat(req.query.maxPrice as string);
      }
      
      if (req.query.brand) {
        options.brand = req.query.brand as string;
      }
      
      if (req.query.inStock !== undefined) {
        options.inStock = req.query.inStock === 'true';
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      if (req.query.sortBy) {
        options.sortBy = req.query.sortBy as string;
      }
      
      if (req.query.sortOrder) {
        options.sortOrder = req.query.sortOrder as 'asc' | 'desc';
      }

      const { parts, total } = await partService.searchParts(keyword as string, options);
      
      res.status(200).json({
        success: true,
        data: {
          parts,
          total,
          keyword,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search parts'
      });
    }
  }

  /**
   * Get top brands with part counts
   */
  async getTopBrands(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }

      const brands = await partService.getTopBrands(limit);
      
      res.status(200).json({
        success: true,
        data: brands
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve top brands'
      });
    }
  }
}

export default new PartController();