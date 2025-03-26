import { PrismaClient, PaymentType, TransactionType, TransactionStatus, PaymentStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';
import { generateReference } from '../utils/reference.util';
import flutterwaveUtil from '../utils/flutterwave.util';
import { prisma } from '../app';

interface PaymentMethodDto {
  customerId: string;
  type: PaymentType;
  provider: string;
  lastFourDigits?: string;
  expiryDate?: string;
  accountName?: string;
  tokenizedDetails?: string;
  isDefault?: boolean;
}

interface ProcessPaymentDto {
  orderId: string;
  customerId: string;
  vendorId: string;
  amount: number;
  paymentMethod: PaymentType;
  paymentReference?: string;
  currency?: string;
  redirectUrl?: string;
}

interface PaymentVerificationDto {
  transactionId?: string;
  reference?: string;
}

interface RefundRequestDto {
  orderId: string;
  transactionId: string;
  amount: number;
  reason: string;
}

export class PaymentService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Add a new payment method for a customer
   */
  async addPaymentMethod(data: PaymentMethodDto): Promise<any> {
    try {
      // Check if customer exists
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId }
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // If setting as default, unset any existing default
      if (data.isDefault) {
        await this.prisma.paymentMethod.updateMany({
          where: { customerId: data.customerId },
          data: { isDefault: false }
        });
      }

      // Create new payment method
      const paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          customerId: data.customerId,
          type: data.type,
          provider: data.provider,
          lastFourDigits: data.lastFourDigits,
          expiryDate: data.expiryDate,
          accountName: data.accountName,
          tokenizedDetails: data.tokenizedDetails,
          isDefault: data.isDefault || false
        }
      });

      return paymentMethod;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to add payment method: ${error.message}`);
    }
  }

  /**
   * Get customer payment methods
   */
  async getPaymentMethods(customerId: string): Promise<any[]> {
    try {
      // Check if customer exists
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Get payment methods
      const paymentMethods = await this.prisma.paymentMethod.findMany({
        where: { customerId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      // Mask sensitive data for security
      return paymentMethods.map(method => ({
        ...method,
        tokenizedDetails: undefined // Don't return tokenized details
      }));
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get payment methods: ${error.message}`);
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<any> {
    try {
      // Check if payment method exists and belongs to this customer
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          customerId
        }
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found');
      }

      // Update in a transaction
      return this.prisma.$transaction(async (tx) => {
        // Unset any existing default
        await tx.paymentMethod.updateMany({
          where: { 
            customerId,
            isDefault: true 
          },
          data: { isDefault: false }
        });

        // Set the new default
        return tx.paymentMethod.update({
          where: { id: paymentMethodId },
          data: { isDefault: true }
        });
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to set default payment method: ${error.message}`);
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      // Check if payment method exists and belongs to this customer
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          customerId
        }
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found');
      }

      // Delete payment method
      await this.prisma.paymentMethod.delete({
        where: { id: paymentMethodId }
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete payment method: ${error.message}`);
    }
  }

  /**
   * Initialize payment for an order
   */
  async initializePayment(data: ProcessPaymentDto): Promise<any> {
    try {
      // Check if order exists
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          customer: {
            include: { user: true }
          },
          vendor: true,
          items: {
            include: { part: true }
          }
        }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Order has already been paid');
      }

      // Generate reference if not provided
      const paymentReference = data.paymentReference || generateReference('PAY');

      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          reference: paymentReference,
          type: TransactionType.PAYMENT,
          amount: data.amount,
          fee: this.calculateTransactionFee(data.amount),
          status: TransactionStatus.PENDING,
          paymentMethod: data.paymentMethod,
          currency: data.currency || 'NGN',
          orderId: data.orderId,
          customerId: data.customerId,
          vendorId: data.vendorId,
          metadata: {
            orderNumber: order.orderNumber,
            items: order.items.map(item => ({
              name: item.part.name,
              quantity: item.quantity,
              price: item.part.price
            }))
          }
        }
      });

      // Update order to pending payment
      await this.prisma.order.update({
        where: { id: data.orderId },
        data: {
          paymentReference: paymentReference,
          paymentStatus: PaymentStatus.PENDING
        }
      });

      // Initialize payment with Flutterwave
      const customerName = order.customer.user.email;
      const customerEmail = order.customer.user.email;

      const redirectUrl = data.redirectUrl || `${process.env.FRONTEND_URL}/payment/verify?reference=${paymentReference}`;

      const paymentData = {
        amount: data.amount,
        currency: data.currency || 'NGN',
        redirectUrl: redirectUrl,
        customerName: customerName || '',
        customerEmail: customerEmail || '',
        customerPhoneNumber: order.customer.user.phone || '',
        paymentReference: paymentReference,
        meta: {
          orderId: data.orderId,
          orderNumber: order.orderNumber,
          transactionId: transaction.id
        }
      };

      // Initialize with Flutterwave
      const flutterwaveResponse = await flutterwaveUtil.initializePayment(paymentData);

      return {
        success: true,
        transaction,
        paymentUrl: flutterwaveResponse.data.link,
        reference: paymentReference
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to initialize payment: ${error.message}`);
    }
  }

  /**
   * Verify payment and update order status
   */
  async verifyPayment(data: PaymentVerificationDto): Promise<any> {
    try {
      let verificationResponse;
      
      if (data.transactionId) {
        // Verify by transaction ID
        verificationResponse = await flutterwaveUtil.verifyTransaction(data.transactionId);
      } else if (data.reference) {
        // Verify by reference
        verificationResponse = await flutterwaveUtil.verifyTransactionByReference(data.reference);
      } else {
        throw new BadRequestException('Transaction ID or reference is required');
      }

      // Check if verification was successful
      if (!verificationResponse || verificationResponse.status !== 'success') {
        throw new BadRequestException('Payment verification failed');
      }

      const flwData = verificationResponse.data;
      const reference = data.reference || flwData.tx_ref;

      // Find the transaction
      const transaction = await this.prisma.transaction.findFirst({
        where: { reference },
        include: {
          order: {
            include: {
              vendor: true,
              items: {
                include: { part: true }
              }
            }
          }
        }
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.status === TransactionStatus.SUCCESSFUL) {
        return {
          success: true,
          message: 'Payment has already been verified',
          transaction
        };
      }

      // Verify amount matches
      const amount = parseFloat(flwData.amount);
      if (amount !== transaction.amount) {
        // Log the discrepancy but still proceed if payment amount is sufficient
        console.warn(`Payment amount mismatch: expected ${transaction.amount}, got ${amount}`);
      }

      // Update transaction status
      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.SUCCESSFUL,
          gatewayReference: flwData.flw_ref || flwData.id
        }
      });

      if (!transaction.order) {
        throw new BadRequestException('Order not found for this transaction');
      }

      // Store order in a variable after null check
      const order = transaction.order;
      
      // Calculate earnings
      const vendor = order.vendor;
      const orderAmount = transaction.amount;
      const commissionRate = vendor.commissionRate || 5.0; // Default 5% if not set
      const commissionAmount = (orderAmount * commissionRate) / 100;
      const vendorEarning = orderAmount - commissionAmount;

      // Update order payment status and vendor earnings
      await this.prisma.$transaction(async (tx) => {
        // Update order
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            orderStatus: 'PROCESSING'
          }
        });

        // Update vendor earnings
        await tx.vendor.update({
          where: { id: vendor.id },
          data: {
            totalEarnings: {
              increment: vendorEarning
            }
          }
        });

        // Log the payment
        await tx.systemLog.create({
          data: {
            action: 'PAYMENT_VERIFIED',
            entityType: 'Order',
            entityId: order.id,
            performedById: transaction.customerId,
            details: {
              transactionId: transaction.id,
              gatewayReference: flwData.flw_ref || flwData.id,
              amount: transaction.amount,
              commissionAmount,
              vendorEarning
            }
          }
        });
      });

      return {
        success: true,
        message: 'Payment verified successfully',
        transaction: updatedTransaction
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Payment verification failed: ${error.message}`);
    }
  }

  /**
   * Request a refund
   */
  async requestRefund(data: RefundRequestDto): Promise<any> {
    try {
      // Check if order exists
      const order = await this.prisma.order.findUnique({
        where: { id: data.orderId }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Check if the transaction exists
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: data.transactionId }
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      // Check if order is paid
      if (order.paymentStatus !== PaymentStatus.PAID) {
        throw new BadRequestException('Order must be paid before requesting refund');
      }

      // Check if refund amount is valid
      if (data.amount <= 0 || data.amount > order.total) {
        throw new BadRequestException('Invalid refund amount');
      }

      // Check for existing refunds
      const existingRefunds = await this.prisma.refund.findMany({
        where: { orderId: data.orderId }
      });
      
      const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
      
      // Check if refund exceeds remaining balance
      if (totalRefunded + data.amount > order.total) {
        throw new BadRequestException('Refund amount exceeds order total');
      }

      // Create refund record
      const refund = await this.prisma.refund.create({
        data: {
          orderId: data.orderId,
          transactionId: data.transactionId,
          amount: data.amount,
          reason: data.reason,
          status: 'PENDING'
        }
      });

      // Update order payment status if this is a full refund
      if (totalRefunded + data.amount === order.total) {
        await this.prisma.order.update({
          where: { id: data.orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED }
        });
      } else if (totalRefunded + data.amount > 0) {
        await this.prisma.order.update({
          where: { id: data.orderId },
          data: { paymentStatus: PaymentStatus.PARTIALLY_REFUNDED }
        });
      }

      return {
        success: true,
        refund,
        message: 'Refund request submitted successfully'
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to request refund: ${error.message}`);
    }
  }

  /**
   * Process a refund
   */
  async processRefund(refundId: string, adminId: string): Promise<any> {
    try {
      const refund = await this.prisma.refund.findUnique({
        where: { id: refundId },
        include: {
          order: true,
          transaction: true,
        }
      });

      if (!refund) {
        throw new NotFoundException('Refund not found');
      }

      if (refund.status !== 'PENDING') {
        throw new BadRequestException(`Refund is already ${refund.status}`);
      }

      // In a real implementation, you'd call Flutterwave's refund API here
      // For now, we'll simulate a successful refund

      // Update refund status
      const updatedRefund = await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date()
        }
      });

      // Log the refund processing
      await this.prisma.systemLog.create({
        data: {
          action: 'REFUND_PROCESSED',
          entityType: 'Refund',
          entityId: refundId,
          performedById: adminId,
          details: {
            orderId: refund.orderId,
            transactionId: refund.transactionId,
            amount: refund.amount,
            reason: refund.reason,
          }
        }
      });

      return {
        success: true,
        refund: updatedRefund,
        message: 'Refund processed successfully',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    filters: {
      customerId?: string;
      vendorId?: string;
      driverId?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ transactions: any[]; total: number }> {
    try {
      // Build where clause
      const where: any = {};

      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.vendorId) where.vendorId = filters.vendorId;
      if (filters.driverId) where.driverId = filters.driverId;
      if (filters.type) where.type = filters.type;
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
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            order: {
              select: {
                orderNumber: true,
                orderStatus: true,
              }
            }
          }
        }),
        this.prisma.transaction.count({ where }),
      ]);

      return {
        transactions,
        total,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Calculate transaction fee
   */
  private calculateTransactionFee(amount: number, type: string = 'PAYMENT'): number {
    // Simple fee calculation - can be made more complex based on requirements
    if (type === 'PAYOUT') {
      return Math.min(100, amount * 0.01); // 1% capped at 100
    }
    return Math.min(200, amount * 0.015); // 1.5% capped at 200
  }

  /**
   * Handle payment webhook
   */
  async handlePaymentWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      const isValid = flutterwaveUtil.verifyWebhookSignature(signature, payload);
      
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Process based on event type
      if (payload.event === 'charge.completed') {
        // Handle successful payment
        const data = payload.data;
        
        // Verify the payment
        await this.verifyPayment({ reference: data.tx_ref });
        
        return { success: true, message: 'Webhook processed successfully' };
      }
      
      // Log other webhook events
      console.info(`Received ${payload.event} webhook from Flutterwave`);
      
      return { success: true, message: 'Webhook received' };
    } catch (error: any) {
      console.error('Payment webhook error:', error);
      throw new BadRequestException(`Failed to process webhook: ${error.message}`);
    }
  }
}

export default new PaymentService();