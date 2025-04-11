import { PrismaClient, Driver, Vendor, DeliveryStatus, PayoutStatus, TransactionStatus, TransactionType, PayoutUserType } from '@prisma/client';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';
import { generateReference } from '../utils/reference.util';

export class EarningService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Calculate earnings for a completed delivery
   * This is typically called automatically when a delivery status is updated to DELIVERED
   */
  async calculateDeliveryEarnings(deliveryId: string): Promise<any> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { driver: true }
    });
    
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    
    if (!delivery.driverId) {
      throw new BadRequestException('Delivery has no assigned driver');
    }
    
    if (delivery.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Earnings can only be calculated for completed deliveries');
    }
    
    // Check if earnings have already been calculated
    const existingEarning = await this.prisma.driverEarning.findUnique({
      where: { deliveryId }
    });
    
    if (existingEarning) {
      return existingEarning;
    }
    
    // Calculate driver's earning (typically 80% of delivery fee)
    const driverCommissionRate = 0.8; // 80%
    const amount = delivery.deliveryFee * driverCommissionRate;
    const transactionFee = delivery.deliveryFee * 0.02; // 2% transaction fee
    const netAmount = amount - transactionFee;
    
    return this.prisma.$transaction(async (tx) => {
      // Create earning record
      const driverEarning = await tx.driverEarning.create({
        data: {
          driverId: delivery.driverId!,
          deliveryId: delivery.id,
          amount,
          transactionFee,
          netAmount,
          isPaid: false,
          earningDate: new Date()
        }
      });
      
      // Update driver's total earnings
      await tx.driver.update({
        where: { id: delivery.driverId! },
        data: {
          totalEarnings: { increment: netAmount }
        }
      });
      
      // Create transaction record
      await tx.transaction.create({
        data: {
          reference: `DEL-${generateReference()}`,
          type: TransactionType.PAYMENT,
          amount: netAmount,
          status: TransactionStatus.SUCCESSFUL,
          paymentMethod: 'BANK_TRANSFER',
          currency: 'NGN',
          driverId: delivery.driverId,
          metadata: {
            deliveryId: delivery.id,
            type: 'DRIVER_EARNING',
            isPaid: false
          }
        }
      });
      
      return driverEarning;
    });
  }

  /**
   * Get earnings for a driver
   */
  async getDriverEarnings(userId: string, options: {
    isPaid?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ earnings: any[]; total: number; pages: number; summary: any }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const where: any = { driverId: driver.id };
    
    if (options.isPaid !== undefined) {
      where.isPaid = options.isPaid;
    }
    
    if (options.startDate) {
      where.earningDate = {
        ...(where.earningDate || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.earningDate = {
        ...(where.earningDate || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [earnings, total] = await Promise.all([
      this.prisma.driverEarning.findMany({
        where,
        include: {
          delivery: {
            include: {
              order: {
                select: {
                  orderNumber: true,
                  total: true
                }
              }
            }
          }
        },
        orderBy: { earningDate: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.driverEarning.count({ where })
    ]);

    // Calculate summary statistics
    const [totalEarned, totalPaid, availableForPayout] = await Promise.all([
      this.prisma.driverEarning.aggregate({
        where: { driverId: driver.id },
        _sum: { netAmount: true }
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId: driver.id, isPaid: true },
        _sum: { netAmount: true }
      }),
      this.prisma.driverEarning.aggregate({
        where: { driverId: driver.id, isPaid: false },
        _sum: { netAmount: true }
      })
    ]);

    return {
      earnings,
      total,
      pages: Math.ceil(total / limit),
      summary: {
        totalEarned: totalEarned._sum.netAmount || 0,
        totalPaid: totalPaid._sum.netAmount || 0,
        availableForPayout: availableForPayout._sum.netAmount || 0,
        pendingPayoutRequests: await this.prisma.payoutRequest.count({
          where: {
            driverId: driver.id,
            status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] }
          }
        })
      }
    };
  }

  /**
   * Get earnings for a vendor (commissions, etc.)
   */
  async getVendorEarnings(userId: string, options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ orders: any[]; total: number; pages: number; summary: any }> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    const where: any = { vendorId: vendor.id };
    
    if (options.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          subtotal: true,
          total: true,
          commissionAmount: true,
          vendorEarning: true,
          paymentStatus: true,
          orderStatus: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          items: {
            select: {
              quantity: true,
              part: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.order.count({ where })
    ]);

    // Calculate summary statistics
    const [totalEarnings, totalCommissions] = await Promise.all([
      this.prisma.order.aggregate({
        where: { vendorId: vendor.id },
        _sum: { vendorEarning: true }
      }),
      this.prisma.order.aggregate({
        where: { vendorId: vendor.id },
        _sum: { commissionAmount: true }
      })
    ]);

    // Get available for payout (total earnings minus what's already been paid out)
    const availableForPayout = Math.max(0, (vendor.totalEarnings || 0) - (vendor.totalPaidOut || 0));

    return {
      orders,
      total,
      pages: Math.ceil(total / limit),
      summary: {
        totalEarnings: totalEarnings._sum.vendorEarning || 0,
        totalCommissions: totalCommissions._sum.commissionAmount || 0,
        availableForPayout,
        pendingPayoutRequests: await this.prisma.payoutRequest.count({
          where: {
            vendorId: vendor.id,
            status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] }
          }
        })
      }
    };
  }

  /**
   * Request a payout for a driver
   */
  async requestDriverPayout(userId: string, amount: number): Promise<any> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: true
      }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Check if driver has banking details
    if (!driver.bankName || !driver.bankAccountName || !driver.bankAccountNumber) {
      throw new BadRequestException('Banking details are incomplete. Please update before requesting payout.');
    }

    // Check if driver is verified
    if (!driver.isVerified) {
      throw new BadRequestException('Account must be verified before requesting payouts');
    }

    // Check if payout is enabled for this driver
    if (!driver.isPayoutEnabled) {
      throw new BadRequestException('Payouts are not enabled for this account');
    }

    // Calculate available earnings
    const availableEarnings = driver.totalEarnings - driver.totalPaidOut;

    // Validate payout amount
    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    if (amount > availableEarnings) {
      throw new BadRequestException(`Insufficient funds. Available balance: ${availableEarnings}`);
    }

    // Check if there's already a pending payout request
    const pendingRequest = await this.prisma.payoutRequest.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] }
      }
    });

    if (pendingRequest) {
      throw new BadRequestException('You already have a pending payout request');
    }

    // Get unpaid earnings (detailed breakdown)
    const unpaidEarnings = await this.prisma.driverEarning.findMany({
      where: {
        driverId: driver.id,
        isPaid: false
      },
      include: {
        delivery: {
          select: {
            id: true,
            orderId: true
          }
        }
      }
    });

    // Create payout request
    const payoutRequest = await this.prisma.payoutRequest.create({
      data: {
        userId: driver.id,
        userType: PayoutUserType.DRIVER,
        amount,
        status: PayoutStatus.PENDING,
        bankName: driver.bankName,
        bankAccountName: driver.bankAccountName,
        bankAccountNumber: driver.bankAccountNumber,
        driverId: driver.id,
        requestedEarnings: unpaidEarnings
      }
    });

    await this.logEarningActivity(
      'PAYOUT_REQUESTED',
      driver.id,
      'Driver',
      { amount, payoutRequestId: payoutRequest.id }
    );

    return payoutRequest;
  }

  /**
   * Request a payout for a vendor
   */
  async requestVendorPayout(userId: string, amount: number): Promise<any> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: {
        user: true
      }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    // Check if vendor has banking details
    if (!vendor.bankName || !vendor.bankAccountName || !vendor.bankAccountNumber) {
      throw new BadRequestException('Banking details are incomplete. Please update before requesting payout.');
    }

    // Check if vendor is verified
    if (!vendor.isVerified) {
      throw new BadRequestException('Account must be verified before requesting payouts');
    }

    // Check if payout is enabled for this vendor
    if (!vendor.isPayoutEnabled) {
      throw new BadRequestException('Payouts are not enabled for this account');
    }

    // Calculate available earnings
    const availableEarnings = vendor.totalEarnings - vendor.totalPaidOut;

    // Validate payout amount
    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    if (amount > availableEarnings) {
      throw new BadRequestException(`Insufficient funds. Available balance: ${availableEarnings}`);
    }

    // Check if there's already a pending payout request
    const pendingRequest = await this.prisma.payoutRequest.findFirst({
      where: {
        vendorId: vendor.id,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] }
      }
    });

    if (pendingRequest) {
      throw new BadRequestException('You already have a pending payout request');
    }

    // Create payout request
    const payoutRequest = await this.prisma.payoutRequest.create({
      data: {
        userId: vendor.id,
        userType: PayoutUserType.VENDOR,
        amount,
        status: PayoutStatus.PENDING,
        bankName: vendor.bankName,
        bankAccountName: vendor.bankAccountName,
        bankAccountNumber: vendor.bankAccountNumber,
        vendorId: vendor.id,
        requestedEarnings: { vendorEarnings: availableEarnings }
      }
    });

    await this.logEarningActivity(
      'PAYOUT_REQUESTED',
      vendor.id,
      'Vendor',
      { amount, payoutRequestId: payoutRequest.id }
    );

    return payoutRequest;
  }

  /**
   * Process a payout request (admin only)
   */
  async processPayoutRequest(adminId: string, payoutRequestId: string, decision: {
    approved: boolean;
    notes?: string;
  }): Promise<any> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId: adminId }
    });

    if (!admin) {
      throw new UnauthorizedException('Admin access required');
    }

    const payoutRequest = await this.prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId }
    });

    if (!payoutRequest) {
      throw new NotFoundException('Payout request not found');
    }

    if (payoutRequest.status !== PayoutStatus.PENDING) {
      throw new BadRequestException('This payout request has already been processed');
    }

    if (decision.approved) {
      // Approve the payout request
      return this.prisma.$transaction(async (tx) => {
        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            reference: `PAYOUT-${generateReference()}`,
            type: TransactionType.PAYOUT,
            amount: payoutRequest.amount,
            status: TransactionStatus.SUCCESSFUL,
            paymentMethod: 'BANK_TRANSFER',
            currency: 'NGN',
            metadata: {
              payoutRequestId: payoutRequest.id,
              bankName: payoutRequest.bankName,
              bankAccountName: payoutRequest.bankAccountName,
              bankAccountNumber: payoutRequest.bankAccountNumber,
              notes: decision.notes
            }
          }
        });

        // Update the payout request
        const updatedRequest = await tx.payoutRequest.update({
          where: { id: payoutRequestId },
          data: {
            status: PayoutStatus.PROCESSED,
            processedAt: new Date(),
            processedById: admin.id,
            notes: decision.notes,
            transactionId: transaction.id
          }
        });

        // Update driver/vendor records
        if (payoutRequest.userType === PayoutUserType.DRIVER && payoutRequest.driverId) {
          // Mark driver earnings as paid
          if (payoutRequest.requestedEarnings && Array.isArray(payoutRequest.requestedEarnings)) {
            const earningIds = payoutRequest.requestedEarnings.map((e: any) => e.id);
            
            await tx.driverEarning.updateMany({
              where: {
                id: { in: earningIds },
                driverId: payoutRequest.driverId
              },
              data: {
                isPaid: true,
                paidDate: new Date(),
                transactionRef: transaction.reference
              }
            });
          }

          await tx.driver.update({
            where: { id: payoutRequest.driverId },
            data: {
              totalPaidOut: { increment: payoutRequest.amount },
              lastPayoutDate: new Date()
            }
          });
        } else if (payoutRequest.userType === PayoutUserType.VENDOR && payoutRequest.vendorId) {
          await tx.vendor.update({
            where: { id: payoutRequest.vendorId },
            data: {
              totalPaidOut: { increment: payoutRequest.amount },
              lastPayoutDate: new Date()
            }
          });
        }

        await this.logEarningActivity(
          'PAYOUT_PROCESSED',
          payoutRequest.userId,
          payoutRequest.userType === PayoutUserType.DRIVER ? 'Driver' : 'Vendor',
          {
            amount: payoutRequest.amount,
            payoutRequestId: payoutRequest.id,
            transactionId: transaction.id,
            processedBy: admin.id
          }
        );

        return updatedRequest;
      });
    } else {
      // Reject the payout request
      const updatedRequest = await this.prisma.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: PayoutStatus.REJECTED,
          processedAt: new Date(),
          processedById: admin.id,
          notes: decision.notes
        }
      });

      await this.logEarningActivity(
        'PAYOUT_REJECTED',
        payoutRequest.userId,
        payoutRequest.userType === PayoutUserType.DRIVER ? 'Driver' : 'Vendor',
        {
          amount: payoutRequest.amount,
          payoutRequestId: payoutRequest.id,
          reason: decision.notes,
          processedBy: admin.id
        }
      );

      return updatedRequest;
    }
  }

  /**
   * Get all payout requests for admin
   */
  async getAllPayoutRequests(adminId: string, options: {
    status?: PayoutStatus;
    userType?: PayoutUserType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ requests: any[]; total: number; pages: number }> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId: adminId }
    });

    if (!admin) {
      throw new UnauthorizedException('Admin access required');
    }

    const where: any = {};
    
    if (options.status) {
      where.status = options.status;
    }
    
    if (options.userType) {
      where.userType = options.userType;
    }
    
    if (options.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [requests, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        include: {
          vendor: options.userType === PayoutUserType.VENDOR || !options.userType ? {
            select: {
              businessName: true,
              email: true,
              phoneNumber: true
            }
          } : undefined,
          driver: options.userType === PayoutUserType.DRIVER || !options.userType ? {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true
            }
          } : undefined,
          processedBy: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          transaction: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.payoutRequest.count({ where })
    ]);

    return {
      requests,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Generate tax report for a driver
   */
  async generateDriverTaxReport(userId: string, year: number): Promise<any> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: true
      }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Calculate date range for the year
    const startDate = new Date(year, 0, 1); // January 1
    const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31, 23:59:59

    // Get all paid earnings for the year
    const earnings = await this.prisma.driverEarning.findMany({
      where: {
        driverId: driver.id,
        earningDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        delivery: true
      }
    });

    // Calculate totals
    const totalEarnings = earnings.reduce((sum, item) => sum + item.amount, 0);
    const totalFees = earnings.reduce((sum, item) => sum + item.transactionFee, 0);
    const netEarnings = earnings.reduce((sum, item) => sum + item.netAmount, 0);

    // Group earnings by month
    const monthlyBreakdown = Array(12).fill(0).map((_, index) => {
      const monthEarnings = earnings.filter(e => {
        const earningMonth = new Date(e.earningDate).getMonth();
        return earningMonth === index;
      });

      return {
        month: index + 1,
        monthName: new Date(year, index).toLocaleString('default', { month: 'long' }),
        earnings: monthEarnings.reduce((sum, item) => sum + item.amount, 0),
        fees: monthEarnings.reduce((sum, item) => sum + item.transactionFee, 0),
        net: monthEarnings.reduce((sum, item) => sum + item.netAmount, 0),
        deliveryCount: monthEarnings.length
      };
    });

    return {
      year,
      driverInfo: {
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
        email: driver.user.email,
        phone: driver.phoneNumber
      },
      summary: {
        totalEarnings,
        totalFees,
        netEarnings,
        deliveryCount: earnings.length
      },
      monthlyBreakdown,
      taxInformation: {
        taxableIncome: netEarnings,
        estimatedTaxRate: 0.15, // 15% example rate
        estimatedTaxAmount: netEarnings * 0.15
      }
    };
  }

  /**
   * Generate tax report for a vendor
   */
  async generateVendorTaxReport(userId: string, year: number): Promise<any> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
      include: {
        user: true
      }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    // Calculate date range for the year
    const startDate = new Date(year, 0, 1); // January 1
    const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31, 23:59:59

    // Get all orders for the year
    const orders = await this.prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate totals
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalCommissions = orders.reduce((sum, order) => sum + order.commissionAmount, 0);
    const netEarnings = orders.reduce((sum, order) => sum + order.vendorEarning, 0);

    // Group orders by month
    const monthlyBreakdown = Array(12).fill(0).map((_, index) => {
      const monthOrders = orders.filter(o => {
        const orderMonth = new Date(o.createdAt).getMonth();
        return orderMonth === index;
      });

      return {
        month: index + 1,
        monthName: new Date(year, index).toLocaleString('default', { month: 'long' }),
        revenue: monthOrders.reduce((sum, item) => sum + item.total, 0),
        commissions: monthOrders.reduce((sum, item) => sum + item.commissionAmount, 0),
        net: monthOrders.reduce((sum, item) => sum + item.vendorEarning, 0),
        orderCount: monthOrders.length
      };
    });

    return {
      year,
      vendorInfo: {
        id: vendor.id,
        businessName: vendor.businessName,
        email: vendor.email || vendor.user.email,
        phone: vendor.phoneNumber
      },
      summary: {
        totalRevenue,
        totalCommissions,
        netEarnings,
        orderCount: orders.length
      },
      monthlyBreakdown,
      taxInformation: {
        taxableIncome: netEarnings,
        estimatedTaxRate: 0.25, // 25% example rate
        estimatedTaxAmount: netEarnings * 0.25
      }
    };
  }

  /**
   * Get transaction history for a driver
   */
  async getDriverTransactionHistory(userId: string, options: {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ transactions: any[]; total: number; pages: number }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId }
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const where: any = { driverId: driver.id };
    
    if (options.type) {
      where.type = options.type;
    }
    
    if (options.status) {
      where.status = options.status;
    }
    
    if (options.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.transaction.count({ where })
    ]);

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get transaction history for a vendor
   */
  async getVendorTransactionHistory(userId: string, options: {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ transactions: any[]; total: number; pages: number }> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId }
    });

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    const where: any = { vendorId: vendor.id };
    
    if (options.type) {
      where.type = options.type;
    }
    
    if (options.status) {
      where.status = options.status;
    }
    
    if (options.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: options.startDate
      };
    }
    
    if (options.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: options.endDate
      };
    }
    
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.transaction.count({ where })
    ]);

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Log activity related to earnings
   */
  private async logEarningActivity(
    action: string,
    entityId: string,
    entityType: string,
    details?: any
  ): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType,
          entityId,
          details: details || {}
        }
      });
    } catch (error) {
      console.error('Failed to log earnings activity:', error);
      // Don't throw - logging shouldn't break functionality
    }
  }
}

export default new EarningService();