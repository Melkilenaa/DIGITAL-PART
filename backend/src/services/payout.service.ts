import { PrismaClient, PayoutStatus, PayoutUserType, TransactionType, TransactionStatus, PaymentType } from '@prisma/client';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';
import { generateReference } from '../utils/reference.util';
import flutterwaveUtil from '../utils/flutterwave.util';
import { prisma } from '../app';

interface CreatePayoutRequestDto {
  userId: string;
  userType: PayoutUserType;
  amount: number;
  requestedBy: string;
}

interface ProcessPayoutRequestDto {
  payoutRequestId: string;
  action: 'APPROVE' | 'REJECT';
  adminId: string;
  notes?: string;
}

export class PayoutService {
  private prisma: PrismaClient;
  
  // Minimum payout amount in NGN
  private readonly MINIMUM_PAYOUT_AMOUNT = 1000;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Request a payout for vendor or driver
   */
  async requestPayout(data: CreatePayoutRequestDto): Promise<any> {
    try {
      // Check if amount is valid
      if (!data.amount || data.amount <= 0) {
        throw new BadRequestException('Payout amount must be greater than zero');
      }

      // Check minimum payout amount
      if (data.amount < this.MINIMUM_PAYOUT_AMOUNT) {
        throw new BadRequestException(`Minimum payout amount is ₦${this.MINIMUM_PAYOUT_AMOUNT}`);
      }

      // Get user and bank details based on user type
      let userRecord: any;
      let bankDetails: any = {};
      let unpaidAmount = 0;

      switch(data.userType) {
        case PayoutUserType.VENDOR:
          userRecord = await this.prisma.vendor.findUnique({
            where: { id: data.userId }
          });

          if (!userRecord) {
            throw new NotFoundException('Vendor not found');
          }

          // Calculate unpaid earnings for vendor
          const vendorTotalEarnings = userRecord.totalEarnings || 0;
          const vendorTotalPaidOut = userRecord.totalPaidOut || 0;
          unpaidAmount = vendorTotalEarnings - vendorTotalPaidOut;
          
          break;

        case PayoutUserType.DRIVER:
          userRecord = await this.prisma.driver.findUnique({
            where: { id: data.userId }
          });

          if (!userRecord) {
            throw new NotFoundException('Driver not found');
          }

          // Calculate unpaid earnings for driver
          const driverTotalEarnings = userRecord.totalEarnings || 0;
          const driverTotalPaidOut = userRecord.totalPaidOut || 0;
          unpaidAmount = driverTotalEarnings - driverTotalPaidOut;
          
          break;

        default:
          throw new BadRequestException('Invalid user type');
      }

      // Check if bank details are set
      if (!userRecord.bankName || !userRecord.bankAccountName || !userRecord.bankAccountNumber) {
        throw new BadRequestException('Banking details are not set');
      }

      // Check if user has sufficient unpaid balance
      if (unpaidAmount < data.amount) {
        throw new BadRequestException(`Insufficient unpaid balance. Available: ₦${unpaidAmount.toFixed(2)}`);
      }

      // Check for existing pending payout request
      const pendingRequest = await this.prisma.payoutRequest.findFirst({
        where: {
          userId: data.userId,
          userType: data.userType,
          status: PayoutStatus.PENDING
        }
      });

      if (pendingRequest) {
        throw new BadRequestException('You already have a pending payout request');
      }

      // Create payout request
      const payoutRequest = await this.prisma.payoutRequest.create({
        data: {
          userId: data.userId,
          userType: data.userType,
          amount: data.amount,
          status: PayoutStatus.PENDING,
          bankName: userRecord.bankName,
          bankAccountName: userRecord.bankAccountName,
          bankAccountNumber: userRecord.bankAccountNumber,
          requestedEarnings: {
            totalEarnings: userRecord.totalEarnings || 0,
            totalPaidOut: userRecord.totalPaidOut || 0,
            unpaidAmount,
            requestedAmount: data.amount
          }
        }
      });

      // Log the payout request
      await this.prisma.systemLog.create({
        data: {
          action: 'PAYOUT_REQUESTED',
          entityType: 'PayoutRequest',
          entityId: payoutRequest.id,
          performedById: data.requestedBy,
          details: {
            amount: data.amount,
            userType: data.userType,
            userId: data.userId
          }
        }
      });

      return payoutRequest;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to request payout: ${error.message}`);
    }
  }

  /**
   * Process (approve/reject) a payout request
   */
  async processPayoutRequest(data: ProcessPayoutRequestDto): Promise<any> {
    try {
      // Get the payout request
      const payoutRequest = await this.prisma.payoutRequest.findUnique({
        where: { id: data.payoutRequestId }
      });

      if (!payoutRequest) {
        throw new NotFoundException('Payout request not found');
      }

      // Check if request is pending
      if (payoutRequest.status !== PayoutStatus.PENDING) {
        throw new BadRequestException(`This request is already ${payoutRequest.status}`);
      }

      // Reject the request if action is REJECT
      if (data.action === 'REJECT') {
        const rejectedRequest = await this.prisma.payoutRequest.update({
          where: { id: data.payoutRequestId },
          data: {
            status: PayoutStatus.REJECTED,
            processedById: data.adminId,
            processedAt: new Date(),
            notes: data.notes || 'Rejected by admin'
          }
        });

        // Log the rejection
        await this.prisma.systemLog.create({
          data: {
            action: 'PAYOUT_REJECTED',
            entityType: 'PayoutRequest',
            entityId: payoutRequest.id,
            performedById: data.adminId,
            details: {
              amount: payoutRequest.amount,
              userType: payoutRequest.userType,
              userId: payoutRequest.userId,
              notes: data.notes || 'No reason provided'
            }
          }
        });

        return {
          success: true,
          payoutRequest: rejectedRequest,
          message: 'Payout request rejected successfully'
        };
      }

      // If action is APPROVE, process the payout
      // Create a transaction record first
      const transactionRef = generateReference('POUT');
      
      const transaction = await this.prisma.transaction.create({
        data: {
          reference: transactionRef,
          type: TransactionType.PAYOUT,
          amount: payoutRequest.amount,
          fee: this.calculatePayoutFee(payoutRequest.amount),
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentType.BANK_TRANSFER,
          currency: 'NGN',
          vendorId: payoutRequest.userType === PayoutUserType.VENDOR ? payoutRequest.userId : undefined,
          driverId: payoutRequest.userType === PayoutUserType.DRIVER ? payoutRequest.userId : undefined,
          metadata: {
            payoutRequestId: payoutRequest.id,
            bankName: payoutRequest.bankName,
            bankAccountName: payoutRequest.bankAccountName,
            bankAccountNumber: payoutRequest.bankAccountNumber,
          }
        }
      });

      // Update payout request status to APPROVED
      const approvedRequest = await this.prisma.payoutRequest.update({
        where: { id: data.payoutRequestId },
        data: {
          status: PayoutStatus.APPROVED,
          processedById: data.adminId,
          processedAt: new Date(),
          notes: data.notes || 'Approved by admin',
          transactionId: transaction.id
        }
      });

      // Process the bank transfer through Flutterwave
      try {
        // Get bank code - this would typically come from a mapping or bank code lookup
        // For now we're hardcoding it, but in production you'd have a better solution
        const bankCode = await this.getBankCode(payoutRequest.bankName);

        // Process the transfer
        const transferPayload = {
          amount: payoutRequest.amount,
          bankName: payoutRequest.bankName,
          bankCode: bankCode,
          accountNumber: payoutRequest.bankAccountNumber,
          accountName: payoutRequest.bankAccountName,
          currency: 'NGN',
          narration: `Payout from DAMPS - Ref: ${transactionRef}`,
          reference: transactionRef
        };

        // In production, you'd actually call Flutterwave here
        // For development, we're simulating the response
        // const transferResult = await flutterwaveUtil.processTransfer(transferPayload);
        const transferResult = {
          status: 'success',
          data: {
            id: `FLW-${Date.now()}`,
            reference: transactionRef,
            status: 'NEW',
            amount: payoutRequest.amount,
            fee: this.calculatePayoutFee(payoutRequest.amount)
          }
        };

        // Update transaction with gateway reference
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            gatewayReference: transferResult.data.id,
            status: TransactionStatus.SUCCESSFUL,
            metadata: {
                ...((transaction.metadata as Record<string, any>) || {}),
                gatewayResponse: transferResult
            }
          }
        });

        // Update payout request
        await this.prisma.payoutRequest.update({
          where: { id: data.payoutRequestId },
          data: {
            status: PayoutStatus.PROCESSED,
            // Store gateway reference in metadata or notes if needed
            notes: `Processed with gateway reference: ${transferResult.data.id}`
          }
        });

        // Update user's totalPaidOut
        if (payoutRequest.userType === PayoutUserType.VENDOR) {
          await this.prisma.vendor.update({
            where: { id: payoutRequest.userId },
            data: {
              totalPaidOut: {
                increment: payoutRequest.amount
              },
              lastPayoutDate: new Date()
            }
          });
        } else {
          await this.prisma.driver.update({
            where: { id: payoutRequest.userId },
            data: {
              totalPaidOut: {
                increment: payoutRequest.amount
              },
              lastPayoutDate: new Date()
            }
          });
        }

        // Log the payout
        await this.prisma.systemLog.create({
          data: {
            action: 'PAYOUT_PROCESSED',
            entityType: 'PayoutRequest',
            entityId: payoutRequest.id,
            performedById: data.adminId,
            details: {
              amount: payoutRequest.amount,
              userType: payoutRequest.userType,
              userId: payoutRequest.userId,
              transactionId: transaction.id,
              gatewayReference: transferResult.data.id
            }
          }
        });

        return {
          success: true,
          payoutRequest: approvedRequest,
          transaction,
          message: 'Payout processed successfully'
        };

      } catch (transferError: any) {
        // Handle transfer failure
        console.error('Transfer failed:', transferError);

        // Update transaction to FAILED
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.FAILED,
            metadata: {
                ...((transaction.metadata as Record<string, any>) || {}),
                error: transferError.message
            }
          }
        });

        // Update payout request to REJECTED when transfer fails
        await this.prisma.payoutRequest.update({
          where: { id: data.payoutRequestId },
          data: {
            status: PayoutStatus.REJECTED,
            notes: `Transfer failed: ${transferError.message}`
          }
        });

        throw new BadRequestException(`Transfer failed: ${transferError.message}`);
      }
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to process payout request: ${error.message}`);
    }
  }

  /**
   * Get payout requests with filters
   */
  async getPayoutRequests(
    filters: {
      userId?: string;
      userType?: PayoutUserType;
      status?: PayoutStatus;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ payoutRequests: any[]; total: number }> {
    try {
      // Build where clause
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.userType) where.userType = filters.userType;
      if (filters.status) where.status = filters.status;

      // Date range
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      // Pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const skip = (page - 1) * limit;
      
      // Sorting
      const orderBy: any = {};
      orderBy[pagination.sortBy || 'createdAt'] = pagination.sortOrder || 'desc';

      // Execute query
      const [payoutRequests, total] = await Promise.all([
        this.prisma.payoutRequest.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            processedBy: {
              select: {
                firstName: true,
                lastName: true,
                // email field doesn't exist in Admin model
              }
            },
            transaction: {
              select: {
                id: true,
                reference: true,
                status: true,
                gatewayReference: true,
                fee: true,
              }
            }
          }
        }),
        this.prisma.payoutRequest.count({ where }),
      ]);

      return {
        payoutRequests,
        total,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get payout requests: ${error.message}`);
    }
  }

  /**
   * Get available balance for a user
   */
  async getAvailableBalance(userId: string, userType: PayoutUserType): Promise<any> {
    try {
      let userRecord;

      if (userType === PayoutUserType.VENDOR) {
        userRecord = await this.prisma.vendor.findUnique({
          where: { id: userId },
          select: {
            totalEarnings: true,
            totalPaidOut: true,
            lastPayoutDate: true,
            isPayoutEnabled: true,
          }
        });

        if (!userRecord) {
          throw new NotFoundException('Vendor not found');
        }
      } else if (userType === PayoutUserType.DRIVER) {
        userRecord = await this.prisma.driver.findUnique({
          where: { id: userId },
          select: {
            totalEarnings: true,
            totalPaidOut: true,
            lastPayoutDate: true,
            isPayoutEnabled: true,
          }
        });

        if (!userRecord) {
          throw new NotFoundException('Driver not found');
        }
      } else {
        throw new BadRequestException('Invalid user type');
      }

      const totalEarnings = userRecord.totalEarnings || 0;
      const totalPaidOut = userRecord.totalPaidOut || 0;
      const availableBalance = totalEarnings - totalPaidOut;

      // Get pending payout request if any
      const pendingPayout = await this.prisma.payoutRequest.findFirst({
        where: {
          userId,
          userType,
          status: PayoutStatus.PENDING
        }
      });

      return {
        totalEarnings,
        totalPaidOut,
        availableBalance,
        pendingPayoutRequest: pendingPayout,
        lastPayoutDate: userRecord.lastPayoutDate,
        isPayoutEnabled: userRecord.isPayoutEnabled,
        canRequestPayout: availableBalance >= this.MINIMUM_PAYOUT_AMOUNT && userRecord.isPayoutEnabled && !pendingPayout
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get available balance: ${error.message}`);
    }
  }

  /**
   * Calculate payout fee
   */
  private calculatePayoutFee(amount: number): number {
    // Simple fee calculation - 1% capped at 100 NGN
    return Math.min(100, amount * 0.01);
  }

  /**
   * Get bank code for a given bank name
   * In a real implementation, this would use a lookup table or API
   */
  private async getBankCode(bankName: string): Promise<string> {
    // Simplified bank code mapping
    const bankCodes: Record<string, string> = {
      'ACCESS BANK': '044',
      'FIRST BANK': '011',
      'GTB': '058',
      'GTBANK': '058',
      'ZENITH BANK': '057',
      'UBA': '033',
      'STANDARD CHARTERED': '068',
    };

    // Normalize bank name for lookup
    const normalizedBankName = bankName.toUpperCase().trim();
    
    // Find matching bank code
    let bankCode = '000'; // Default code if not found
    
    // Try exact match first
    if (bankCodes[normalizedBankName]) {
      bankCode = bankCodes[normalizedBankName];
    } else {
      // Try partial match
      for (const [bank, code] of Object.entries(bankCodes)) {
        if (normalizedBankName.includes(bank) || bank.includes(normalizedBankName)) {
          bankCode = code;
          break;
        }
      }
    }
    
    // In production, if not found, you'd call the Flutterwave API to get the bank code
    
    return bankCode;
  }

  /**
   * Handle transfer webhook
   */
  async handleTransferWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      const isValid = flutterwaveUtil.verifyWebhookSignature(signature, payload);
      
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      if (payload.event === 'transfer.completed') {
        const data = payload.data;
        const reference = data.reference;

        // Find the transaction
        const transaction = await this.prisma.transaction.findFirst({
          where: { reference }
        });

        if (!transaction) {
          throw new NotFoundException('Transaction not found');
        }

        // Update the transaction status based on transfer status
        let newStatus;
        switch(data.status.toLowerCase()) {
          case 'successful':
            newStatus = TransactionStatus.SUCCESSFUL;
            break;
          case 'failed':
            newStatus = TransactionStatus.FAILED;
            break;
          default:
            newStatus = TransactionStatus.PENDING;
        }

        // Update transaction
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: newStatus,
            metadata: {
              ...((transaction.metadata as Record<string, any>) || {}),
              webhookData: payload
            }
          }
        });

        // If this was a payout and it failed, update the payout request
        if (transaction.type === TransactionType.PAYOUT && newStatus === TransactionStatus.FAILED) {
          // Find associated payout request
          const payoutRequest = await this.prisma.payoutRequest.findFirst({
            where: { transactionId: transaction.id }
          });

          if (payoutRequest) {
            await this.prisma.payoutRequest.update({
              where: { id: payoutRequest.id },
              data: {
                status: PayoutStatus.REJECTED,
                notes: `Transfer failed: ${data.complete_message || 'No details provided'}`
              }
            });
          }
        }

        return { success: true, message: 'Transfer webhook processed' };
      }

      // Log other events
      console.info(`Received ${payload.event} webhook from Flutterwave`);
      
      return { success: true, message: 'Webhook received' };
    } catch (error: any) {
      console.error('Transfer webhook error:', error);
      throw new BadRequestException(`Failed to process transfer webhook: ${error.message}`);
    }
  }
}

export default new PayoutService();