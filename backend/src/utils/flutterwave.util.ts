// filepath: /home/user/Documents/freelance/Assignment 6/DAMPS/backend/src/utils/flutterwave.util.ts
import Flutterwave from 'flutterwave-node-v3';
import { BadRequestException } from './exceptions.util';
import { generateReference } from './reference.util';

/**
 * Interface for initializing payment
 */
interface PaymentInitializeDto {
  amount: number;
  currency: string;
  redirectUrl: string;
  customerName: string;
  customerEmail: string;
  customerPhoneNumber?: string;
  paymentReference: string;
  meta?: Record<string, any>;
}

/**
 * Interface for bank transfer
 */
interface TransferDto {
  amount: number;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  narration: string;
  reference: string;
}

/**
 * Interface for creating a subaccount
 */
interface SubaccountDto {
  accountBank: string;
  accountNumber: string;
  businessName: string;
  businessEmail: string;
  businessMobile: string;
  country: string;
  splitValue: number;
  splitType: 'percentage' | 'flat';
}

/**
 * Flutterwave utility for payment processing using the official SDK
 */
export class FlutterwaveUtil {
  private flw: any;
  
  /**
   * Constructor
   */
  constructor() {
    // Load keys from environment variables
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
    
    if (!secretKey || !publicKey) {
      console.warn('Flutterwave API keys not properly configured');
    }
    
    // Initialize Flutterwave SDK
    this.flw = new Flutterwave(publicKey, secretKey);
  }
  
  /**
   * Initialize a payment transaction
   */
  async initializePayment(payload: PaymentInitializeDto): Promise<any> {
    try {
      const paymentPayload = {
        tx_ref: payload.paymentReference || generateReference('DAMPS-PAY'),
        amount: payload.amount,
        currency: payload.currency || 'NGN',
        redirect_url: payload.redirectUrl,
        customer: {
          email: payload.customerEmail,
          phone_number: payload.customerPhoneNumber,
          name: payload.customerName,
        },
        meta: payload.meta || {},
        customizations: {
          title: 'DAMPS Auto Parts Payment',
          logo: process.env.COMPANY_LOGO_URL || '',
        },
      };
      
      // Use the SDK to initialize payment
      const response = await this.flw.Charge.initialize(paymentPayload);
      return response;
    } catch (error: any) {
      console.error('Flutterwave payment initialization error:', error.message);
      throw new BadRequestException(`Payment initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Verify a payment transaction
   */
  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      // Use the SDK to verify transaction
      const response = await this.flw.Transaction.verify({ id: transactionId });
      return response;
    } catch (error: any) {
      console.error('Flutterwave verification error:', error.message);
      throw new BadRequestException(`Transaction verification failed: ${error.message}`);
    }
  }
  
  /**
   * Verify transaction by reference
   */
  async verifyTransactionByReference(reference: string): Promise<any> {
    try {
      // Use the SDK to verify transaction by reference
      const response = await this.flw.Transaction.verify({ tx_ref: reference });
      return response;
    } catch (error: any) {
      console.error('Flutterwave reference verification error:', error.message);
      throw new BadRequestException(`Transaction reference verification failed: ${error.message}`);
    }
  }
  
  /**
   * Process a bank transfer
   */
  async processTransfer(data: TransferDto): Promise<any> {
    try {
      const transferPayload = {
        account_bank: data.bankCode,
        account_number: data.accountNumber,
        amount: data.amount,
        narration: data.narration,
        currency: data.currency || 'NGN',
        reference: data.reference || generateReference('DAMPS-TRF'),
        callback_url: process.env.FLUTTERWAVE_WEBHOOK_URL,
        debit_currency: 'NGN',
      };
      
      // Use the SDK to process transfer
      const response = await this.flw.Transfer.initiate(transferPayload);
      return response;
    } catch (error: any) {
      console.error('Flutterwave transfer error:', error.message);
      throw new BadRequestException(`Transfer failed: ${error.message}`);
    }
  }
  
  /**
   * Create a subaccount
   */
  async createSubaccount(data: SubaccountDto): Promise<any> {
    try {
      const subaccountPayload = {
        account_bank: data.accountBank,
        account_number: data.accountNumber,
        business_name: data.businessName,
        business_email: data.businessEmail,
        business_contact: data.businessMobile,
        country: data.country || 'NG',
        split_type: data.splitType,
        split_value: data.splitValue,
      };
      
      // Use the SDK to create subaccount
      const response = await this.flw.Subaccount.create(subaccountPayload);
      return response;
    } catch (error: any) {
      console.error('Flutterwave subaccount creation error:', error.message);
      throw new BadRequestException(`Subaccount creation failed: ${error.message}`);
    }
  }
  
  /**
   * Get bank list
   */
  async getBanks(country: string = 'NG'): Promise<any> {
    try {
      // Use the SDK to get banks list
      const response = await this.flw.Bank.country({ country });
      return response;
    } catch (error: any) {
      console.error('Flutterwave banks list error:', error.message);
      throw new BadRequestException(`Failed to fetch banks: ${error.message}`);
    }
  }
  
  /**
   * Resolve bank account
   */
  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<any> {
    try {
      const payload = {
        account_number: accountNumber,
        account_bank: bankCode,
      };
      
      // Use the SDK to resolve account
      const response = await this.flw.Resolve.account(payload);
      return response;
    } catch (error: any) {
      console.error('Flutterwave account resolve error:', error.message);
      throw new BadRequestException(`Failed to resolve account: ${error.message}`);
    }
  }
  
  /**
   * Process webhook data
   */
  verifyWebhookSignature(signature: string, data: any): boolean {
    // Use the SDK to verify webhook signature
    // For Flutterwave, typically you would verify using the secretHash from the webhook
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || '';
    
    // This is a simplified verification, in production use proper signature verification
    return signature === secretHash;
  }
}

export default new FlutterwaveUtil();