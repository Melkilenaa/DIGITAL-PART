import { Resend } from 'resend';

/**
 * Email interface for standard email parameters
 */
interface EmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

/**
 * Email template interface extending basic email parameters
 */
interface TemplateEmailParams extends Omit<EmailParams, 'html' | 'text'> {
  templateName: string;
  templateData: Record<string, any>;
}

/**
 * Email response interface
 */
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: any;
}

/**
 * Service for sending emails using Resend
 */
class ResendEmailService {
  private resend!: Resend;
  private defaultFromEmail: string;
  private isInitialized: boolean = false;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'no-reply@damps.com';
    
    if (!apiKey) {
      console.error('⚠️ WARNING: RESEND_API_KEY environment variable is not set. Email functionality will not work.');
      this.isInitialized = false;
    } else {
      this.resend = new Resend(apiKey);
      this.isInitialized = true;
    }
  }

  /**
   * Validates email params and returns formatted recipients
   */
  private validateAndFormatRecipients(recipients: string | string[]): string[] {
    if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
      throw new Error('Email recipients are required');
    }

    const emailArray = Array.isArray(recipients) ? recipients : [recipients];
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emailArray) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email format: ${email}`);
      }
    }

    return emailArray;
  }

  /**
   * Send a standard email
   */
  async sendEmail(params: EmailParams): Promise<EmailResponse> {
    if (!this.isInitialized) {
      console.error('Cannot send email: Resend service not properly initialized');
      return { success: false, error: 'Email service not initialized' };
    }

    try {
      const { 
        to, 
        from = this.defaultFromEmail, 
        subject, 
        html, 
        text,
        cc,
        bcc,
        replyTo,
        attachments 
      } = params;

      if (!subject) {
        throw new Error('Email subject is required');
      }

      if (!html && !text) {
        throw new Error('Either HTML or text content is required for the email');
      }

      const toAddresses = this.validateAndFormatRecipients(to);
      const ccAddresses = cc ? this.validateAndFormatRecipients(cc) : undefined;
      const bccAddresses = bcc ? this.validateAndFormatRecipients(bcc) : undefined;

      const { data, error } = await this.resend.emails.send({
        from,
        to: toAddresses,
        subject,
        html,
        text,
        cc: ccAddresses,
        bcc: bccAddresses,
        replyTo: replyTo,
        attachments,
        react: false
      });
      
      if (error) {
        console.error('Error sending email:', error);
        return { 
          success: false, 
          error 
        };
      }
      
      return { 
        success: true, 
        messageId: data?.id 
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Send an email with a template
   * For Resend, we need to use their API for templates or provide HTML
   */
  async sendTemplateEmail(params: TemplateEmailParams): Promise<EmailResponse> {
    if (!this.isInitialized) {
      console.error('Cannot send email: Resend service not properly initialized');
      return { success: false, error: 'Email service not initialized' };
    }

    try {
      const { 
        to, 
        from = this.defaultFromEmail, 
        subject, 
        templateName,
        templateData,
        cc,
        bcc,
        replyTo,
        attachments 
      } = params;

      // Get the HTML content based on the template
      const html = await this.renderTemplate(templateName, templateData);

      if (!html) {
        throw new Error(`Failed to render template: ${templateName}`);
      }

      // Use the standard email sending with the rendered HTML
      return this.sendEmail({
        to,
        from,
        subject,
        html,
        cc,
        bcc,
        replyTo,
        attachments
      });
    } catch (error) {
      console.error('Failed to send template email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Render a template with the given data
   * This is a placeholder method - you would implement this according to your template system
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string | null> {
    // Simple implementation for predefined templates
    switch(templateName) {
      case 'welcome':
        return this.renderWelcomeTemplate(data);
      case 'order-confirmation':
        return this.renderOrderConfirmationTemplate(data);
      case 'reset-password':
        return this.renderResetPasswordTemplate(data);
      case 'delivery-update':
        return this.renderDeliveryUpdateTemplate(data);
      case 'low-stock':
        return this.renderLowStockTemplate(data);
      case 'invoice':
        return this.renderInvoiceTemplate(data);
      default:
        console.error(`Unknown template: ${templateName}`);
        return null;
    }
  }

  /**
   * Template rendering methods - in a real implementation, you might use a templating engine
   */
  private renderWelcomeTemplate(data: Record<string, any>): string {
    const { name, verificationLink } = data;
    return `
      <html>
        <body>
          <h1>Welcome to DAMPS!</h1>
          <p>Hello ${name},</p>
          <p>Thank you for joining DAMPS. We're excited to have you onboard.</p>
          ${verificationLink ? `<p>Please <a href="${verificationLink}">verify your email</a> to complete your registration.</p>` : ''}
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }

  private renderOrderConfirmationTemplate(data: Record<string, any>): string {
    const { orderNumber, customerName, orderTotal, items } = data;
    
    let itemsList = '';
    if (items && Array.isArray(items)) {
      itemsList = '<ul>' + items.map(item => 
        `<li>${item.quantity}x ${item.name} - $${item.price.toFixed(2)}</li>`
      ).join('') + '</ul>';
    }

    return `
      <html>
        <body>
          <h1>Order Confirmation</h1>
          <p>Hello ${customerName},</p>
          <p>Thank you for your order. Your order #${orderNumber} has been confirmed.</p>
          <h2>Order Details:</h2>
          ${itemsList}
          <p><strong>Total:</strong> $${orderTotal.toFixed(2)}</p>
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }

  private renderResetPasswordTemplate(data: Record<string, any>): string {
    const { name, resetLink } = data;
    return `
      <html>
        <body>
          <h1>Reset Your Password</h1>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. If you did not make this request, please ignore this email.</p>
          <p>To reset your password, click the link below:</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }

  private renderDeliveryUpdateTemplate(data: Record<string, any>): string {
    const { customerName, orderNumber, status, estimatedDelivery, trackingLink } = data;
    return `
      <html>
        <body>
          <h1>Delivery Update</h1>
          <p>Hello ${customerName},</p>
          <p>Your order #${orderNumber} status has been updated to: <strong>${status}</strong></p>
          ${estimatedDelivery ? `<p>Estimated delivery: ${estimatedDelivery}</p>` : ''}
          ${trackingLink ? `<p><a href="${trackingLink}">Track your order</a></p>` : ''}
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }

  private renderLowStockTemplate(data: Record<string, any>): string {
    const { vendorName, partName, currentStock, threshold } = data;
    return `
      <html>
        <body>
          <h1>Low Stock Alert</h1>
          <p>Hello ${vendorName},</p>
          <p>This is to inform you that your product <strong>${partName}</strong> is running low on stock.</p>
          <p>Current stock: ${currentStock} units</p>
          <p>Stock threshold: ${threshold} units</p>
          <p>Please consider restocking soon to avoid stockouts.</p>
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }

  private renderInvoiceTemplate(data: Record<string, any>): string {
    const { invoiceNumber, customerName, invoiceDate, dueDate, items, subtotal, tax, total } = data;
    
    let itemsTable = '';
    if (items && Array.isArray(items)) {
      itemsTable = `
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
          ${items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${item.price.toFixed(2)}</td>
              <td>$${(item.quantity * item.price).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    return `
      <html>
        <body>
          <h1>Invoice #${invoiceNumber}</h1>
          <p>Hello ${customerName},</p>
          <p>Please find your invoice details below:</p>
          
          <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          
          <h2>Invoice Items</h2>
          ${itemsTable}
          
          <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
          <p><strong>Tax:</strong> $${tax.toFixed(2)}</p>
          <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
          
          <p>Thank you for your business!</p>
          <p>Regards,<br>The DAMPS Team</p>
        </body>
      </html>
    `;
  }
}

export const resendService = new ResendEmailService();
export default resendService;