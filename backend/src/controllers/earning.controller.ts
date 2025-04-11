import { Request, Response } from 'express';
import { PayoutUserType, PayoutStatus, TransactionType, TransactionStatus, UserRole } from '@prisma/client';
import earningService from '../services/earning.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';

export class EarningController {
  /**
   * Calculate earnings for a completed delivery
   * @route POST /api/earnings/calculate/:deliveryId
   */
  async calculateDeliveryEarnings(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      
      if (!deliveryId) {
        res.status(400).json({
          success: false,
          message: 'Delivery ID is required'
        });
        return;
      }
      
      // This endpoint should be admin-only or called internally
      if (req.user?.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to perform this action'
        });
        return;
      }
      
      const earnings = await earningService.calculateDeliveryEarnings(deliveryId);
      
      res.status(200).json({
        success: true,
        data: earnings
      });
    } catch (error: any) {
      console.error('Error calculating delivery earnings:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to calculate delivery earnings'
      });
    }
  }

  /**
   * Get earnings for a driver
   * @route GET /api/earnings/driver
   */
  async getDriverEarnings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.DRIVER && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      const userId = req.user.userId;
      
      // Parse query parameters
      const options: any = {};
      
      if (req.query.isPaid !== undefined) {
        options.isPaid = req.query.isPaid === 'true';
      }
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      const result = await earningService.getDriverEarnings(userId, options);
      
      res.status(200).json({
        success: true,
        data: {
          earnings: result.earnings,
          summary: result.summary
        },
        meta: {
          total: result.total,
          pages: result.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting driver earnings:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve driver earnings'
      });
    }
  }

  /**
   * Get earnings for a vendor
   * @route GET /api/earnings/vendor
   */
  async getVendorEarnings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.VENDOR && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      const userId = req.user.userId;
      
      // Parse query parameters
      const options: any = {};
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      const result = await earningService.getVendorEarnings(userId, options);
      
      res.status(200).json({
        success: true,
        data: {
          orders: result.orders,
          summary: result.summary
        },
        meta: {
          total: result.total,
          pages: result.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting vendor earnings:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve vendor earnings'
      });
    }
  }

  /**
   * Request a payout for a driver
   * @route POST /api/earnings/driver/payout
   */
  async requestDriverPayout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.DRIVER) {
        res.status(403).json({
          success: false,
          message: 'Only drivers can request driver payouts'
        });
        return;
      }
      
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        res.status(400).json({
          success: false,
          message: 'A valid positive amount is required'
        });
        return;
      }
      
      const payoutRequest = await earningService.requestDriverPayout(
        req.user.userId, 
        parseFloat(amount)
      );
      
      res.status(201).json({
        success: true,
        message: 'Payout request submitted successfully',
        data: payoutRequest
      });
    } catch (error: any) {
      console.error('Error requesting driver payout:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to submit payout request'
      });
    }
  }

  /**
   * Request a payout for a vendor
   * @route POST /api/earnings/vendor/payout
   */
  async requestVendorPayout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.VENDOR) {
        res.status(403).json({
          success: false,
          message: 'Only vendors can request vendor payouts'
        });
        return;
      }
      
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        res.status(400).json({
          success: false,
          message: 'A valid positive amount is required'
        });
        return;
      }
      
      const payoutRequest = await earningService.requestVendorPayout(
        req.user.userId, 
        parseFloat(amount)
      );
      
      res.status(201).json({
        success: true,
        message: 'Payout request submitted successfully',
        data: payoutRequest
      });
    } catch (error: any) {
      console.error('Error requesting vendor payout:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to submit payout request'
      });
    }
  }

  /**
   * Process a payout request (admin only)
   * @route PATCH /api/earnings/payout-requests/:payoutRequestId
   */
  async processPayoutRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only administrators can process payout requests'
        });
        return;
      }
      
      const { payoutRequestId } = req.params;
      const { approved, notes } = req.body;
      
      if (!payoutRequestId) {
        res.status(400).json({
          success: false,
          message: 'Payout request ID is required'
        });
        return;
      }
      
      if (approved === undefined) {
        res.status(400).json({
          success: false,
          message: 'Decision (approved) is required'
        });
        return;
      }
      
      const result = await earningService.processPayoutRequest(
        req.user.userId,
        payoutRequestId,
        { 
          approved: approved === true || approved === 'true',
          notes
        }
      );
      
      res.status(200).json({
        success: true,
        message: `Payout request ${approved ? 'approved' : 'rejected'} successfully`,
        data: result
      });
    } catch (error: any) {
      console.error('Error processing payout request:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to process payout request'
      });
    }
  }

  /**
   * Get all payout requests (admin only)
   * @route GET /api/earnings/payout-requests
   */
  async getAllPayoutRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only administrators can view all payout requests'
        });
        return;
      }
      
      // Parse query parameters
      const options: any = {};
      
      if (req.query.status) {
        options.status = req.query.status as PayoutStatus;
      }
      
      if (req.query.userType) {
        options.userType = req.query.userType as PayoutUserType;
      }
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      const result = await earningService.getAllPayoutRequests(req.user.userId, options);
      
      res.status(200).json({
        success: true,
        data: result.requests,
        meta: {
          total: result.total,
          pages: result.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting payout requests:', error);
      
      const status = error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve payout requests'
      });
    }
  }

  /**
   * Generate tax report for a driver
   * @route GET /api/earnings/driver/tax-report/:year
   */
  async generateDriverTaxReport(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.DRIVER && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      const year = parseInt(req.params.year || new Date().getFullYear().toString());
      
      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          message: 'A valid year is required'
        });
        return;
      }
      
      const report = await earningService.generateDriverTaxReport(req.user.userId, year);
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Error generating driver tax report:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to generate tax report'
      });
    }
  }

  /**
   * Generate tax report for a vendor
   * @route GET /api/earnings/vendor/tax-report/:year
   */
  async generateVendorTaxReport(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.VENDOR && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      const year = parseInt(req.params.year || new Date().getFullYear().toString());
      
      if (isNaN(year) || year < 2000 || year > 2100) {
        res.status(400).json({
          success: false,
          message: 'A valid year is required'
        });
        return;
      }
      
      const report = await earningService.generateVendorTaxReport(req.user.userId, year);
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Error generating vendor tax report:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to generate tax report'
      });
    }
  }

  /**
   * Get transaction history for a driver
   * @route GET /api/earnings/driver/transactions
   */
  async getDriverTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.DRIVER && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      // Parse query parameters
      const options: any = {};
      
      if (req.query.type) {
        options.type = req.query.type as TransactionType;
      }
      
      if (req.query.status) {
        options.status = req.query.status as TransactionStatus;
      }
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      const result = await earningService.getDriverTransactionHistory(req.user.userId, options);
      
      res.status(200).json({
        success: true,
        data: result.transactions,
        meta: {
          total: result.total,
          pages: result.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting driver transaction history:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve transaction history'
      });
    }
  }

  /**
   * Get transaction history for a vendor
   * @route GET /api/earnings/vendor/transactions
   */
  async getVendorTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      if (req.user.role !== UserRole.VENDOR && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }
      
      // Parse query parameters
      const options: any = {};
      
      if (req.query.type) {
        options.type = req.query.type as TransactionType;
      }
      
      if (req.query.status) {
        options.status = req.query.status as TransactionStatus;
      }
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      }
      
      if (req.query.offset) {
        options.offset = parseInt(req.query.offset as string);
      }
      
      const result = await earningService.getVendorTransactionHistory(req.user.userId, options);
      
      res.status(200).json({
        success: true,
        data: result.transactions,
        meta: {
          total: result.total,
          pages: result.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      console.error('Error getting vendor transaction history:', error);
      
      const status = error instanceof NotFoundException ? 404 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to retrieve transaction history'
      });
    }
  }
}

export default new EarningController();