import { Request, Response } from 'express';
import paymentService from '../services/payment.service';
import { PaymentType, TransactionType, TransactionStatus, UserRole } from '@prisma/client';
import userService from '../services/user.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';

export class PaymentController {
  /**
   * Add a new payment method for a customer
   */
  async addPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.body.customerId;
      const userId = req.user!.userId;
      
      // Verify the customer belongs to this user
      const userCustomer = await userService.getUserProfile(userId);
      if (!userCustomer || userCustomer.id !== customerId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to add payment methods for this customer'
        });
        return;
      }
      
      const paymentMethod = await paymentService.addPaymentMethod({
        customerId,
        type: req.body.type as PaymentType,
        provider: req.body.provider,
        lastFourDigits: req.body.lastFourDigits,
        expiryDate: req.body.expiryDate,
        accountName: req.body.accountName,
        tokenizedDetails: req.body.tokenizedDetails,
        isDefault: req.body.isDefault
      });
      
      res.status(201).json({
        success: true,
        data: paymentMethod
      });
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      const status = error.status || 400;
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to add payment method'
      });
    }
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const customerId = req.params.customerId || req.query.customerId as string;
      
      if (!customerId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID is required'
        });
        return;
      }
      
      // Verify the customer belongs to this user
      const userCustomer = await userService.getUserProfile(userId);
      if (!userCustomer || userCustomer.id !== customerId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to view payment methods for this customer'
        });
        return;
      }
      
      const paymentMethods = await paymentService.getPaymentMethods(customerId);
      
      res.status(200).json({
        success: true,
        data: paymentMethods
      });
    } catch (error: any) {
      console.error('Error getting payment methods:', error);
      const status = error instanceof NotFoundException ? 404 : 
                     error instanceof UnauthorizedException ? 403 : 400;
      
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to get payment methods'
      });
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { customerId, paymentMethodId } = req.body;
      
      if (!customerId || !paymentMethodId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID and payment method ID are required'
        });
        return;
      }
      
      // Verify the customer belongs to this user
      const userCustomer = await userService.getUserProfile(userId);
      if (!userCustomer || userCustomer.id !== customerId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to modify payment methods for this customer'
        });
        return;
      }
      
      const result = await paymentService.setDefaultPaymentMethod(
        customerId,
        paymentMethodId
      );
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Default payment method updated successfully'
      });
    } catch (error: any) {
      console.error('Error setting default payment method:', error);
      const status = error instanceof NotFoundException ? 404 : 
                     error instanceof UnauthorizedException ? 403 : 400;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to set default payment method'
      });
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { customerId, paymentMethodId } = req.params;
      
      if (!customerId || !paymentMethodId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID and payment method ID are required'
        });
        return;
      }
      
      // Verify the customer belongs to this user
      const userCustomer = await userService.getUserProfile(userId);
      if (!userCustomer || userCustomer.id !== customerId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to delete payment methods for this customer'
        });
        return;
      }
      
      await paymentService.deletePaymentMethod(
        customerId,
        paymentMethodId
      );
      
      res.status(200).json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      const status = error instanceof NotFoundException ? 404 : 
                     error instanceof UnauthorizedException ? 403 : 400;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to delete payment method'
      });
    }
  }

  /**
   * Initialize payment for an order
   */
  async initializePayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, customerId, vendorId, amount, paymentMethod, redirectUrl, currency } = req.body;
      const userId = req.user!.userId;
      
      // Basic validation
      if (!orderId || !customerId || !vendorId || !amount || !paymentMethod) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: orderId, customerId, vendorId, amount, paymentMethod'
        });
        return;
      }
      
      // Verify the customer belongs to this user if not admin
      if (req.user?.role === UserRole.CUSTOMER) {
        const userCustomer = await userService.getUserProfile(userId);
        if (!userCustomer || userCustomer.id !== customerId) {
          res.status(403).json({
            success: false,
            message: 'You are not authorized to initiate payment for this customer'
          });
          return;
        }
      }
      
      const result = await paymentService.initializePayment({
        orderId,
        customerId,
        vendorId,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod as PaymentType,
        redirectUrl,
        currency
      });
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error initializing payment:', error);
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to initialize payment'
      });
    }
  }

  /**
   * Verify payment
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, reference } = req.body;
      
      if (!transactionId && !reference) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID or reference is required'
        });
        return;
      }
      
      const result = await paymentService.verifyPayment({ 
        transactionId, 
        reference 
      });
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Payment verified successfully'
      });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to verify payment'
      });
    }
  }

  /**
   * Request refund
   */
  async requestRefund(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, transactionId, amount, reason } = req.body;
      
      // Validate required fields
      if (!orderId || !transactionId || amount === undefined || !reason) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: orderId, transactionId, amount, reason'
        });
        return;
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Amount must be a positive number'
        });
        return;
      }
      
      const result = await paymentService.requestRefund({
        orderId,
        transactionId,
        amount: parsedAmount,
        reason
      });
      
      res.status(200).json({
        success: true,
        data: result.refund,
        message: result.message
      });
    } catch (error: any) {
      console.error('Error requesting refund:', error);
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to request refund'
      });
    }
  }

  /**
   * Process refund (admin only)
   */
  async processRefund(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      
      // Only admins can process refunds
      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only administrators can process refunds'
        });
        return;
      }
      
      const { refundId } = req.params;
      if (!refundId) {
        res.status(400).json({
          success: false,
          message: 'Refund ID is required'
        });
        return;
      }
      
      const result = await paymentService.processRefund(refundId, userId);
      
      res.status(200).json({
        success: true,
        data: result.refund,
        message: result.message
      });
    } catch (error: any) {
      console.error('Error processing refund:', error);
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to process refund'
      });
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      // Extract filter parameters
      const {
        customerId,
        vendorId,
        driverId,
        type,
        status,
        startDate,
        endDate,
        page,
        limit,
        sortBy,
        sortOrder
      } = req.query;
      
      // Check user permissions based on requested data
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      
      // Build filters
      const filters: any = {};
      
      // Apply filters based on role and requested data
      if (customerId) {
        filters.customerId = customerId as string;
        
        // If customer filter and not admin, verify it's the user's own data
        if (userRole === UserRole.CUSTOMER) {
          const userCustomer = await userService.getUserProfile(userId);
          if (!userCustomer || userCustomer.id !== customerId) {
            res.status(403).json({
              success: false,
              message: 'You can only view your own transactions'
            });
            return;
          }
        }
      }
      
      if (vendorId) {
        filters.vendorId = vendorId as string;
        
        // If vendor filter and not admin, verify it's the user's own data
        if (userRole === UserRole.VENDOR) {
          const userVendor = await userService.getUserProfile(userId);
          if (!userVendor || userVendor.id !== vendorId) {
            res.status(403).json({
              success: false,
              message: 'You can only view your own transactions'
            });
            return;
          }
        }
      }
      
      if (driverId) {
        filters.driverId = driverId as string;
        
        // If driver filter and not admin, verify it's the user's own data
        if (userRole === UserRole.DRIVER) {
          const userDriver = await userService.getUserProfile(userId);
          if (!userDriver || userDriver.id !== driverId) {
            res.status(403).json({
              success: false,
              message: 'You can only view your own transactions'
            });
            return;
          }
        }
      }
      
      // Add other filters
      if (type) filters.type = type as TransactionType;
      if (status) filters.status = status as TransactionStatus;
      
      // Date filters
      if (startDate) {
        const start = new Date(startDate as string);
        if (!isNaN(start.getTime())) {
          filters.startDate = start;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate as string);
        if (!isNaN(end.getTime())) {
          filters.endDate = end;
        }
      }
      
      // Pagination
      const pagination = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        sortBy: sortBy as string || 'createdAt',
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc'
      };
      
      const result = await paymentService.getTransactionHistory(filters, pagination);
      
      res.status(200).json({
        success: true,
        data: {
          transactions: result.transactions,
          total: result.total,
          page: pagination.page,
          limit: pagination.limit,
          pages: Math.ceil(result.total / pagination.limit)
        }
      });
    } catch (error: any) {
      console.error('Error getting transaction history:', error);
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to get transaction history'
      });
    }
  }

  /**
   * Handle webhook from payment gateway
   */
  async handlePaymentWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['verif-hash'] as string;
      
      // Validate webhook signature
      if (!signature) {
        // Log the warning but still accept the webhook to prevent retries
        console.warn('Payment webhook received without signature');
      }
      
      const result = await paymentService.handlePaymentWebhook(req.body, signature);
      
      // Webhook responses should be immediate to avoid retries
      res.status(200).json({
        success: true,
        message: result.message || 'Webhook processed'
      });
    } catch (error: any) {
      console.error('Error processing payment webhook:', error);
      
      // Even in case of errors, return 200 to prevent retries
      // Log the error but don't expose details
      res.status(200).json({
        success: false,
        message: 'Webhook received with errors'
      });
    }
  }
}

export default new PaymentController();