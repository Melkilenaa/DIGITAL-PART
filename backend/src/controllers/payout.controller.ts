import { Request, Response } from 'express';
import payoutService from '../services/payout.service';
import { UserRole, PayoutUserType, PayoutStatus } from '@prisma/client';
import userService from '../services/user.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';

export class PayoutController {
  /**
   * Request a payout for vendor/driver
   */
  async requestPayout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      let entityId: string;
      let userType: PayoutUserType;
      
      // Determine user type and get appropriate entity ID
      if (userRole === UserRole.VENDOR) {
        const vendor = await userService.getUserProfile(userId);
        if (!vendor) {
          res.status(404).json({
            success: false,
            message: 'Vendor profile not found'
          });
          return;
        }
        entityId = vendor.id;
        userType = PayoutUserType.VENDOR;
      } else if (userRole === UserRole.DRIVER) {
        const driver = await userService.getUserProfile(userId);
        if (!driver) {
          res.status(404).json({
            success: false,
            message: 'Driver profile not found'
          });
          return;
        }
        entityId = driver.id;
        userType = PayoutUserType.DRIVER;
      } else {
        res.status(403).json({
          success: false,
          message: 'Only vendors and drivers can request payouts'
        });
        return;
      }
      
      // Validate amount
      const amount = parseFloat(req.body.amount);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
        return;
      }
      
      const payoutRequest = await payoutService.requestPayout({
        userId: entityId,
        userType,
        amount,
        requestedBy: userId
      });
      
      res.status(201).json({
        success: true,
        data: payoutRequest,
        message: 'Payout request submitted successfully'
      });
    } catch (error: any) {
      console.error('Error requesting payout:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to request payout'
      });
    }
  }

  /**
   * Process a payout request (admin only)
   */
  async processPayoutRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      
      // Only admins can process payouts
      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Only administrators can process payout requests'
        });
        return;
      }
      
      // Get admin details
      const adminProfile = await userService.getUserProfile(userId);
      if (!adminProfile || !adminProfile.profile) {
        res.status(404).json({
          success: false,
          message: 'Admin profile not found'
        });
        return;
      }
      
      const { payoutRequestId } = req.params;
      const { action, notes } = req.body;
      
      // Validate action
      if (action !== 'APPROVE' && action !== 'REJECT') {
        res.status(400).json({
          success: false,
          message: 'Action must be either APPROVE or REJECT'
        });
        return;
      }
      
      const result = await payoutService.processPayoutRequest({
        payoutRequestId,
        action,
        adminId: adminProfile.profile.id,
        notes
      });
      
      res.status(200).json({
        success: true,
        data: result.payoutRequest,
        message: action === 'APPROVE' ? 
                'Payout request approved and processing initiated' : 
                'Payout request rejected'
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
   * Get payout requests
   */
  async getPayoutRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      
      // Extract filter parameters
      const {
        userType,
        status,
        startDate,
        endDate,
        page,
        limit,
        sortBy,
        sortOrder
      } = req.query;
      
      // Build filters
      const filters: any = {};
      
      // For non-admins, restrict to their own requests
      if (userRole !== UserRole.ADMIN) {
        let entityId: string;
        
        // Get entity ID based on role
        if (userRole === UserRole.VENDOR) {
          const vendor = await userService.getUserProfile(userId);
          if (!vendor) {
            res.status(404).json({
              success: false,
              message: 'Vendor profile not found'
            });
            return;
          }
          entityId = vendor.id;
          filters.userId = entityId;
          filters.userType = PayoutUserType.VENDOR;
        } else if (userRole === UserRole.DRIVER) {
          const driver = await userService.getUserProfile(userId);
          if (!driver) {
            res.status(404).json({
              success: false,
              message: 'Driver profile not found'
            });
            return;
          }
          entityId = driver.id;
          filters.userId = entityId;
          filters.userType = PayoutUserType.DRIVER;
        } else {
          res.status(403).json({
            success: false,
            message: 'You are not authorized to view payout requests'
          });
          return;
        }
      } else {
        // Admins can filter by user type
        if (userType) filters.userType = userType as PayoutUserType;
      }
      
      // Apply other filters
      if (status) filters.status = status as PayoutStatus;
      
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
      
      const result = await payoutService.getPayoutRequests(filters, pagination);
      
      res.status(200).json({
        success: true,
        data: {
          payoutRequests: result.payoutRequests,
          total: result.total,
          page: pagination.page,
          limit: pagination.limit,
          pages: Math.ceil(result.total / pagination.limit)
        }
      });
    } catch (error: any) {
      console.error('Error getting payout requests:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to get payout requests'
      });
    }
  }

  /**
   * Get available balance and payout status
   */
  async getAvailableBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      let entityId: string;
      let userType: PayoutUserType;
      
      // Determine user type and get appropriate entity ID
      if (userRole === UserRole.VENDOR) {
        const vendor = await userService.getUserProfile(userId);
        if (!vendor) {
          res.status(404).json({
            success: false,
            message: 'Vendor profile not found'
          });
          return;
        }
        entityId = vendor.id;
        userType = PayoutUserType.VENDOR;
      } else if (userRole === UserRole.DRIVER) {
        const driver = await userService.getUserProfile(userId);
        if (!driver) {
          res.status(404).json({
            success: false,
            message: 'Driver profile not found'
          });
          return;
        }
        entityId = driver.id;
        userType = PayoutUserType.DRIVER;
      } else {
        res.status(403).json({
          success: false,
          message: 'Only vendors and drivers can check available balance'
        });
        return;
      }
      
      const balance = await payoutService.getAvailableBalance(entityId, userType);
      
      res.status(200).json({
        success: true,
        data: balance
      });
    } catch (error: any) {
      console.error('Error getting available balance:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to get available balance'
      });
    }
  }
  
  /**
   * Get specific payout request details
   */
//   async getPayoutRequestById(req: Request, res: Response): Promise<void> {
//     try {
//       const userId = req.user!.userId;
//       const userRole = req.user?.role;
//       const { requestId } = req.params;
      
//       if (!requestId) {
//         res.status(400).json({
//           success: false,
//           message: 'Request ID is required'
//         });
//         return;
//       }
      
//       // Get the payout request
//       const requests = await payoutService.getPayoutRequests(
//         { id: requestId },
//         { limit: 1 }
//       );
      
//       if (!requests.payoutRequests.length) {
//         res.status(404).json({
//           success: false,
//           message: 'Payout request not found'
//         });
//         return;
//       }
      
//       const payoutRequest = requests.payoutRequests[0];
      
//       // Check permissions - admins can see all, others only their own
//       if (userRole !== UserRole.ADMIN) {
//         let entityId: string;
//         let requesterType: PayoutUserType;
        
//         if (userRole === UserRole.VENDOR) {
//           const vendor = await userService.getUserProfile(userId);
//           entityId = vendor?.id;
//           requesterType = PayoutUserType.VENDOR;
//         } else if (userRole === UserRole.DRIVER) {
//           const driver = await userService.getUserProfile(userId);
//           entityId = driver?.id;
//           requesterType = PayoutUserType.DRIVER;
//         } else {
//           res.status(403).json({
//             success: false,
//             message: 'You are not authorized to view this payout request'
//           });
//           return;
//         }
        
//         if (payoutRequest.userId !== entityId || payoutRequest.userType !== requesterType) {
//           res.status(403).json({
//             success: false,
//             message: 'You are not authorized to view this payout request'
//           });
//           return;
//         }
//       }
      
//       res.status(200).json({
//         success: true,
//         data: payoutRequest
//       });
//     } catch (error: any) {
//       console.error('Error getting payout request:', error);
      
//       const status = error instanceof BadRequestException ? 400 :
//                      error instanceof NotFoundException ? 404 :
//                      error instanceof UnauthorizedException ? 403 : 500;
                     
//       res.status(status).json({
//         success: false,
//         message: error.message || 'Failed to get payout request'
//       });
//     }
//   }

  /**
   * Handle webhook from payment gateway for transfers
   */
  async handleTransferWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['verif-hash'] as string;
      
      // Always accept the webhook but log if signature is missing
      if (!signature) {
        console.warn('Transfer webhook received without signature');
      }
      
      const result = await payoutService.handleTransferWebhook(req.body, signature);
      
      // Webhook responses should be immediate to avoid retries
      res.status(200).json({
        success: true,
        message: result?.message || 'Webhook processed'
      });
    } catch (error: any) {
      console.error('Error processing transfer webhook:', error);
      
      // Even in case of errors, return 200 to prevent retries
      // Log the error but don't expose details
      res.status(200).json({
        success: false,
        message: 'Webhook received with errors'
      });
    }
  }

  /**
   * Check payout eligibility
   */
  async checkPayoutEligibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const userRole = req.user?.role;
      let entityId: string;
      let userType: PayoutUserType;
      
      // Validate user type
      if (userRole === UserRole.VENDOR) {
        const vendor = await userService.getUserProfile(userId);
        if (!vendor) {
          res.status(404).json({
            success: false,
            message: 'Vendor profile not found'
          });
          return;
        }
        entityId = vendor.id;
        userType = PayoutUserType.VENDOR;
      } else if (userRole === UserRole.DRIVER) {
        const driver = await userService.getUserProfile(userId);
        if (!driver) {
          res.status(404).json({
            success: false,
            message: 'Driver profile not found'
          });
          return;
        }
        entityId = driver.id;
        userType = PayoutUserType.DRIVER;
      } else {
        res.status(403).json({
          success: false,
          message: 'Only vendors and drivers can check payout eligibility'
        });
        return;
      }
      
      // Get balance info which contains eligibility
      const balanceInfo = await payoutService.getAvailableBalance(entityId, userType);
      
      res.status(200).json({
        success: true,
        data: {
          isEligible: balanceInfo.canRequestPayout,
          availableBalance: balanceInfo.availableBalance,
          reasons: !balanceInfo.canRequestPayout ? [
            balanceInfo.availableBalance < 1000 ? 'Minimum payout amount is ₦1000' : null,
            !balanceInfo.isPayoutEnabled ? 'Banking details are missing or incomplete' : null,
            balanceInfo.pendingPayoutRequest ? 'You already have a pending payout request' : null
          ].filter(Boolean) : [],
          pendingRequest: balanceInfo.pendingPayoutRequest
        }
      });
    } catch (error: any) {
      console.error('Error checking payout eligibility:', error);
      
      const status = error instanceof BadRequestException ? 400 :
                     error instanceof NotFoundException ? 404 :
                     error instanceof UnauthorizedException ? 403 : 500;
                     
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to check payout eligibility'
      });
    }
  }
}

export default new PayoutController();