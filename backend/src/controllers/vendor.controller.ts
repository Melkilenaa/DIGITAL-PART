import { Request, Response } from 'express';
import vendorService from '../services/vendor.service';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class VendorController {
  /**
   * Get vendor profile by user ID
   */
  async getVendorProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const vendor = await vendorService.getVendorProfile(userId);
      
      res.status(200).json({
        success: true,
        data: vendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get vendor profile',
      });
    }
  }

  /**
   * Get vendor profile by vendor ID (public)
   */
  async getVendorById(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      const vendor = await vendorService.getVendorById(vendorId);
      
      res.status(200).json({
        success: true,
        data: vendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get vendor',
      });
    }
  }

  /**
   * Update vendor profile
   */
  async updateVendorProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      // Extract profile data from request
      const profileData = { ...req.body };

      // If file was uploaded (via multer), add it to the profile data
      if (req.file) {
        profileData.businessLogo = req.file.path;
      }
      
      const updatedVendor = await vendorService.updateVendorProfile(userId, profileData);
      
      res.status(200).json({
        success: true,
        message: 'Vendor profile updated successfully',
        data: updatedVendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update vendor profile',
      });
    }
  }

  /**
   * Update operating hours
   */
  async updateOperatingHours(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      // Get vendor ID from user ID
      const vendor = await vendorService.getVendorProfile(userId);
      
      // Update operating hours
      const operatingHours = req.body;
      const updatedVendor = await vendorService.updateOperatingHours(vendor.id, operatingHours);
      
      res.status(200).json({
        success: true,
        message: 'Operating hours updated successfully',
        data: updatedVendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update operating hours',
      });
    }
  }

  /**
   * Update special holidays
   */
  async updateSpecialHolidays(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      // Get vendor ID from user ID
      const vendor = await vendorService.getVendorProfile(userId);
      
      // Update special holidays
      const specialHolidays = req.body;
      const updatedVendor = await vendorService.updateSpecialHolidays(vendor.id, specialHolidays);
      
      res.status(200).json({
        success: true,
        message: 'Special holidays updated successfully',
        data: updatedVendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update special holidays',
      });
    }
  }

  /**
   * Submit verification documents
   */
  async submitVerificationDocuments(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      // Get vendor ID from user ID
      const vendor = await vendorService.getVendorProfile(userId);
      
      // Process uploaded documents
      const files = req.files as Express.Multer.File[];
      const documents = files ? 
        files.map(file => ({
          type: req.body.documentType || 'GENERIC',
          url: file.path,
          description: req.body.description || 'Verification document',
        })) : [];
      
      if (documents.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one document is required',
        });
        return;
      }
      
      // Submit documents
      const updatedVendor = await vendorService.submitVerificationDocuments(vendor.id, {
        documents,
        notes: req.body.notes,
      });
      
      res.status(200).json({
        success: true,
        message: 'Verification documents submitted successfully',
        data: updatedVendor,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to submit verification documents',
      });
    }
  }

  /**
   * Get vendor performance metrics
   */
  async getVendorMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      // Get vendor ID from user ID
      const vendor = await vendorService.getVendorProfile(userId);
      
      // Parse date range and group by options
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const groupBy = req.query.groupBy as 'day' | 'week' | 'month' || 'day';
      
      // Get metrics
      const metrics = await vendorService.getVendorMetrics(vendor.id, {
        startDate,
        endDate,
        groupBy,
      });
      
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get vendor metrics',
      });
    }
  }

  /**
   * Get vendor reviews
   */
  async getVendorReviews(req: Request, res: Response): Promise<void> {
    try {
      // Allow fetching reviews for any vendor (public data)
      const vendorId = req.params.vendorId;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      // Parse pagination parameters
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Get reviews
      const reviews = await vendorService.getVendorReviews(vendorId, page, limit);
      
      res.status(200).json({
        success: true,
        data: reviews,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get vendor reviews',
      });
    }
  }

  /**
 * Get vendor banking details
 */
async getVendorBankingDetails(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }
    
    // Get vendor ID from user ID
    const vendor = await vendorService.getVendorProfile(userId);
    
    // Get banking details
    const bankingDetails = await vendorService.getVendorBankingDetails(vendor.id);
    
    res.status(200).json({
      success: true,
      data: bankingDetails,
    });
  } catch (error: any) {
    const statusCode = error instanceof NotFoundException ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get banking details',
    });
  }
}

/**
 * Update vendor banking details
 */
async updateVendorBankingDetails(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }
    
    // Get vendor ID from user ID
    const vendor = await vendorService.getVendorProfile(userId);
    
    // Validate input
    const { bankName, bankAccountName, bankAccountNumber } = req.body;
    
    if (!bankName || !bankAccountName || !bankAccountNumber) {
      res.status(400).json({
        success: false,
        message: 'Bank name, account name, and account number are all required',
      });
      return;
    }
    
    // Update banking details
    const updatedVendor = await vendorService.updateVendorBankingDetails(vendor.id, {
      bankName,
      bankAccountName,
      bankAccountNumber,
    });
    
    res.status(200).json({
      success: true,
      message: 'Banking details updated successfully',
      data: {
        bankName: updatedVendor.bankName,
        bankAccountName: updatedVendor.bankAccountName,
        bankAccountNumber: updatedVendor.bankAccountNumber,
        isPayoutEnabled: updatedVendor.isPayoutEnabled,
      },
    });
  } catch (error: any) {
    const statusCode = error instanceof NotFoundException ? 404 : 
                      error instanceof BadRequestException ? 400 : 500;
                      
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update banking details',
    });
  }
}

  /**
   * Get vendor rating summary
   */
  async getVendorRatingSummary(req: Request, res: Response): Promise<void> {
    try {
      // Allow fetching rating summary for any vendor (public data)
      const vendorId = req.params.vendorId;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      // Get rating summary
      const ratingSummary = await vendorService.getVendorRatingSummary(vendorId);
      
      res.status(200).json({
        success: true,
        data: ratingSummary,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get vendor rating summary',
      });
    }
  }
}

export default new VendorController();