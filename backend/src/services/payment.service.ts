// import { PrismaClient, PaymentType, TransactionType, TransactionStatus, PaymentStatus } from '@prisma/client';
// import { BadRequestException, NotFoundException } from '../utils/exceptions.util';
// import { generateReference } from '../utils/reference.util';

// interface PaymentMethodDto {
//   customerId: string;
//   type: PaymentType;
//   provider: string;
//   lastFourDigits?: string;
//   expiryDate?: string;
//   accountName?: string;
//   tokenizedDetails?: string;
//   isDefault?: boolean;
// }

// interface ProcessPaymentDto {
//   orderId: string;
//   customerId: string;
//   vendorId: string;
//   amount: number;
//   paymentMethod: PaymentType;
//   paymentReference?: string;
//   currency?: string;
// }

// interface RefundRequestDto {
//   orderId: string;
//   transactionId: string;
//   amount: number;
//   reason: string;
// }

// interface PayoutRequestDto {
//   recipientType: 'VENDOR' | 'DRIVER';
//   recipientId: string;
//   amount: number;
//   reference?: string;
// }

// export class PaymentService {
//   private prisma: PrismaClient;

//   constructor() {
//     this.prisma = new PrismaClient();
//   }

//   /**
//    * Add a new payment method for a customer
//    */
//   async addPaymentMethod(data: PaymentMethodDto): Promise<any> {
//     try {
//       // Check if customer exists
//       const customer = await this.prisma.customer.findUnique({
//         where: { id: data.customerId }
//       });

//       if (!customer) {
//         throw new NotFoundException('Customer not found');
//       }

//       // If setting as default, unset any existing default
//       if (data.isDefault) {
//         await this.prisma.paymentMethod.updateMany({
//           where: { customerId: data.customerId },
//           data: { isDefault: false }
//         });
//       }

//       // Create new payment method
//       const paymentMethod = await this.prisma.paymentMethod.create({
//         data: {
//           customerId: data.customerId,
//           type: data.type,
//           provider: data.provider,
//           lastFourDigits: data.lastFourDigits,
//           expiryDate: data.expiryDate,
//           accountName: data.accountName,
//           tokenizedDetails: data.tokenizedDetails,
//           isDefault: data.isDefault || false
//         }
//       });

//       return paymentMethod;
//     } catch (error: any) {
//       if (error instanceof NotFoundException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to add payment method: ${error.message}`);
//     }
//   }

//   /**
//    * Get customer payment methods
//    */
//   async getPaymentMethods(customerId: string): Promise<any[]> {
//     try {
//       // Check if customer exists
//       const customer = await this.prisma.customer.findUnique({
//         where: { id: customerId }
//       });

//       if (!customer) {
//         throw new NotFoundException('Customer not found');
//       }

//       // Get payment methods
//       const paymentMethods = await this.prisma.paymentMethod.findMany({
//         where: { customerId },
//         orderBy: [
//           { isDefault: 'desc' },
//           { createdAt: 'desc' }
//         ]
//       });

//       // Mask sensitive data for security
//       return paymentMethods.map(method => ({
//         ...method,
//         tokenizedDetails: undefined // Don't return tokenized details
//       }));
//     } catch (error: any) {
//       if (error instanceof NotFoundException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to get payment methods: ${error.message}`);
//     }
//   }

//   /**
//    * Set default payment method
//    */
//   async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<any> {
//     try {
//       // Check if payment method exists and belongs to this customer
//       const paymentMethod = await this.prisma.paymentMethod.findFirst({
//         where: {
//           id: paymentMethodId,
//           customerId
//         }
//       });

//       if (!paymentMethod) {
//         throw new NotFoundException('Payment method not found');
//       }

//       // Update in a transaction
//       return this.prisma.$transaction(async (tx) => {
//         // Unset any existing default
//         await tx.paymentMethod.updateMany({
//           where: { 
//             customerId,
//             isDefault: true 
//           },
//           data: { isDefault: false }
//         });

//         // Set the new default
//         return tx.paymentMethod.update({
//           where: { id: paymentMethodId },
//           data: { isDefault: true }
//         });
//       });
//     } catch (error: any) {
//       if (error instanceof NotFoundException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to set default payment method: ${error.message}`);
//     }
//   }

//   /**
//    * Delete a payment method
//    */
//   async deletePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
//     try {
//       // Check if payment method exists and belongs to this customer
//       const paymentMethod = await this.prisma.paymentMethod.findFirst({
//         where: {
//           id: paymentMethodId,
//           customerId
//         }
//       });

//       if (!paymentMethod) {
//         throw new NotFoundException('Payment method not found');
//       }

//       // Delete payment method
//       await this.prisma.paymentMethod.delete({
//         where: { id: paymentMethodId }
//       });
//     } catch (error: any) {
//       if (error instanceof NotFoundException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to delete payment method: ${error.message}`);
//     }
//   }

//   /**
//    * Process payment for an order
//    */
//   async processPayment(data: ProcessPaymentDto): Promise<any> {
//     try {
//       // Check if order exists
//       const order = await this.prisma.order.findUnique({
//         where: { id: data.orderId }
//       });

//       if (!order) {
//         throw new NotFoundException('Order not found');
//       }

//       if (order.paymentStatus === PaymentStatus.PAID) {
//         throw new BadRequestException('Order has already been paid');
//       }

//       // Generate reference if not provided
//       const paymentReference = data.paymentReference || generateReference('PAY');

//       // Create transaction record
//       const transaction = await this.prisma.transaction.create({
//         data: {
//           reference: paymentReference,
//           type: TransactionType.PAYMENT,
//           amount: data.amount,
//           fee: this.calculateTransactionFee(data.amount),
//           status: TransactionStatus.PENDING,
//           paymentMethod: data.paymentMethod,
//           currency: data.currency || 'NGN',
//           orderId: data.orderId,
//           customerId: data.customerId,
//           vendorId: data.vendorId,
//           metadata: {
//             orderNumber: order.orderNumber
//           }
//         }
//       });

//       // In a real implementation, you'd call payment gateway API here
//       // For this implementation, we'll simulate a successful payment
//       const paymentResult = await this.simulatePaymentGateway(transaction.reference);
      
//       if (paymentResult.success) {
//         // Update transaction status
//         const updatedTransaction = await this.prisma.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: TransactionStatus.SUCCESSFUL,
//             gatewayReference: paymentResult.gatewayReference
//           }
//         });

//         // Update order payment status
//         await this.prisma.order.update({
//           where: { id: data.orderId },
//           data: {
//             paymentStatus: PaymentStatus.PAID,
//             paymentReference: transaction.reference,
//             paymentMethod: data.paymentMethod,
//             orderStatus: 'PROCESSING'
//           }
//         });

//         // Log the payment
//         await this.prisma.systemLog.create({
//           data: {
//             action: 'PAYMENT_PROCESSED',
//             entityType: 'Order',
//             entityId: data.orderId,
//             performedById: data.customerId,
//             details: {
//               transactionId: transaction.id,
//               amount: data.amount,
//               method: data.paymentMethod
//             }
//           }
//         });

//         return {
//           success: true,
//           transaction: updatedTransaction,
//           message: 'Payment processed successfully'
//         };
//       } else {
//         // Update transaction to failed
//         await this.prisma.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: TransactionStatus.FAILED
//           }
//         });

//         throw new BadRequestException('Payment processing failed');
//       }
//     } catch (error: any) {
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to process payment: ${error.message}`);
//     }
//   }

//   /**
//    * Request a refund
//    */
//   async requestRefund(data: RefundRequestDto): Promise<any> {
//     try {
//       // Check if order exists
//       const order = await this.prisma.order.findUnique({
//         where: { id: data.orderId }
//       });

//       if (!order) {
//         throw new NotFoundException('Order not found');
//       }

//       // Check if the transaction exists
//       const transaction = await this.prisma.transaction.findUnique({
//         where: { id: data.transactionId }
//       });

//       if (!transaction) {
//         throw new NotFoundException('Transaction not found');
//       }

//       // Check if order is paid
//       if (order.paymentStatus !== PaymentStatus.PAID) {
//         throw new BadRequestException('Order must be paid before requesting refund');
//       }

//       // Check if refund amount is valid
//       if (data.amount <= 0 || data.amount > order.total) {
//         throw new BadRequestException('Invalid refund amount');
//       }

//       // Check for existing refunds
//       const existingRefunds = await this.prisma.refund.findMany({
//         where: { orderId: data.orderId }
//       });
      
//       const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.amount, 0);
      
//       // Check if refund exceeds remaining balance
//       if (totalRefunded + data.amount > order.total) {
//         throw new BadRequestException('Refund amount exceeds order total');
//       }

//       // Create refund record
//       const refund = await this.prisma.refund.create({
//         data: {
//           orderId: data.orderId,
//           transactionId: data.transactionId,
//           amount: data.amount,
//           reason: data.reason,
//           status: 'PENDING'
//         }
//       });

//       // Update order payment status if this is a full refund
//       if (totalRefunded + data.amount === order.total) {
//         await this.prisma.order.update({
//           where: { id: data.orderId },
//           data: { paymentStatus: PaymentStatus.REFUNDED }
//         });
//       } else if (totalRefunded + data.amount > 0) {
//         await this.prisma.order.update({
//           where: { id: data.orderId },
//           data: { paymentStatus: PaymentStatus.PARTIALLY_REFUNDED }
//         });
//       }

//       return {
//         success: true,
//         refund,
//         message: 'Refund request submitted successfully'
//       };
//     } catch (error: any) {
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to request refund: ${error.message}`);
//     }
//   }

//   /**
//    * Process a payout to vendor or driver
//    */
//   async processPayout(data: PayoutRequestDto): Promise<any> {
//     try {
//       // Generate reference if not provided
//       const payoutReference = data.reference || generateReference('POUT');
      
//       let recipientDetails: any = null;
      
//       // Validate recipient exists
//       if (data.recipientType === 'VENDOR') {
//         recipientDetails = await this.prisma.vendor.findUnique({
//           where: { id: data.recipientId }
//         });
//       } else if (data.recipientType === 'DRIVER') {
//         recipientDetails = await this.prisma.driver.findUnique({
//           where: { id: data.recipientId }
//         });
//       }
      
//       if (!recipientDetails) {
//         throw new NotFoundException(`${data.recipientType} not found`);
//       }

//       // Calculate fees
//       const fee = this.calculateTransactionFee(data.amount, 'PAYOUT');
//       const netAmount = data.amount - fee;

//       // Create transaction record
//       const transaction = await this.prisma.transaction.create({
//         data: {
//           reference: payoutReference,
//           type: TransactionType.PAYOUT,
//           amount: data.amount,
//           fee,
//           status: TransactionStatus.PENDING,
//           paymentMethod: PaymentType.BANK_TRANSFER, // Default for payouts
//           currency: 'NGN',
//           vendorId: data.recipientType === 'VENDOR' ? data.recipientId : undefined,
//           driverId: data.recipientType === 'DRIVER' ? data.recipientId : undefined,
//           metadata: {
//             recipientType: data.recipientType,
//             netAmount
//           }
//         }
//       });

//       // In a real implementation, you'd call payment gateway API here
//       // For this implementation, we'll simulate a successful payout
//       const payoutResult = await this.simulatePayoutGateway(transaction.reference);
      
//       if (payoutResult.success) {
//         // Update transaction status
//         const updatedTransaction = await this.prisma.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: TransactionStatus.SUCCESSFUL,
//             gatewayReference: payoutResult.gatewayReference
//           }
//         });

//         // Update driver earnings if applicable
//         if (data.recipientType === 'DRIVER' && data.reference) {
//           await this.prisma.driverEarning.updateMany({
//             where: {
//               driverId: data.recipientId,
//               transactionRef: data.reference
//             },
//             data: {
//               isPaid: true,
//               paidDate: new Date()
//             }
//           });
//         }

//         return {
//           success: true,
//           transaction: updatedTransaction,
//           message: 'Payout processed successfully',
//           netAmount
//         };
//       } else {
//         // Update transaction to failed
//         await this.prisma.transaction.update({
//           where: { id: transaction.id },
//           data: {
//             status: TransactionStatus.FAILED
//           }
//         });

//         throw new BadRequestException('Payout processing failed');
//       }
//     } catch (error: any) {
//       if (error instanceof NotFoundException || error instanceof BadRequestException) {
//         throw error;
//       }
//       throw new BadRequestException(`Failed to process payout: ${error.message}`);
//     }
//   }

//   /**
//    * Get transaction history
//    */
//   async getTransactionHistory(
//     filters: {
//       customerId?: string;
//       vendorId?: string;
//       driverId?: string;
//       type?: TransactionType;
//       status?: TransactionStatus;
//       startDate?: Date;
//       endDate?: Date;
//     },
//     pagination: {
//       page?: number;
//       limit?: number;
//       sortBy?: string;
//       sortOrder?: 'asc' | 'desc';
//     } = {}
//   ): Promise<{ transactions: any[]; total: number }> {
//     try {
//       // Build where clause
//       const where: any = {};

//       if (filters.customerId) where.customerId = filters.customerId;
//       if (filters.vendorId) where.vendorId = filters.vendorId;
//       if (filters.driverId) where.driverId = filters.driverId;
//       if (filters.type) where.type = filters.type;
//       if (filters.status) where.status = filters.status;

//       // Date range
//       if (filters.startDate || filters.endDate) {
//         where.createdAt = {};
//         if (filters.startDate) where.createdAt.gte = filters.startDate;
//         if (filters.endDate) where.createdAt.lte = filters.endDate;
//       }

//       // Pagination
//       const page = pagination.page || 1;
//       const limit = pagination.limit || 10;
//       const skip = (page - 1) * limit;
      
//       // Sorting
//       const orderBy: any = {};
//       orderBy[pagination.sortBy || 'createdAt'] = pagination.sortOrder || 'desc';

//       // Execute query
//       const [transactions, total] = await Promise.all([
//         this.prisma.transaction.findMany({
//           where,
//           orderBy,
//           skip,
//           take: limit,
//         }),
//         this.prisma.transaction.count({ where }),
//       ]);

//       return {
//         transactions,
//         total,
//       };
//     } catch (error: any) {
//       throw new BadRequestException(`Failed to get transaction history: ${error.message}`);
//     }
//   }

//   /**
//    * Calculate transaction fee
//    */
//   private calculateTransactionFee(amount: number, type: string = 'PAYMENT'): number {
//     // Simple fee calculation - can be made more complex based on requirements
//     if (type === 'PAYOUT') {
//       return Math.min(100, amount * 0.01); // 1% capped at 100
//     }
//     return Math.min(200, amount * 0.015); // 1.5% capped at 200
//   }

//   /**
//    * Simulate payment gateway API call
//    * In a real application, this would be replaced with an actual payment gateway integration
//    */
//   private async simulatePaymentGateway(reference: string): Promise<any> {
//     // Simulate network delay
//     await new Promise(resolve => setTimeout(resolve, 1000));
    
//     return {
//       success: true,
//       gatewayReference: `SIMULATED-${reference}-${Date.now()}`,
//       message: 'Payment processed successfully'
//     };
//   }

//   /**
//    * Simulate payout gateway API call
//    * In a real application, this would be replaced with an actual payout gateway integration
//    */
//   private async simulatePayoutGateway(reference: string): Promise<any> {
//     // Simulate network delay
//     await new Promise(resolve => setTimeout(resolve, 1500));
    
//     return {
//       success: true,
//       gatewayReference: `PAYOUT-${reference}-${Date.now()}`,
//       message: 'Payout processed successfully'
//     };
//   }
// }

// export default new PaymentService();