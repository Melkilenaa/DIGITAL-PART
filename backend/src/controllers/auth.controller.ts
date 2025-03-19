import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRole } from '@prisma/client';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Customer registration endpoint
   */
  async registerCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerData = req.body;
      
      // Validate required fields
      if (!customerData.firstName || !customerData.lastName) {
        res.status(400).json({ message: 'First name and last name are required' });
        return;
      }
      
      const result = await this.authService.registerCustomer(customerData);
      
      res.status(201).json({
        message: 'Customer registered successfully',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * Vendor registration endpoint
   */
  async registerVendor(req: Request, res: Response): Promise<void> {
    try {
      const vendorData = req.body;
      
      // Validate required fields
      if (!vendorData.businessName || !vendorData.phoneNumber || 
          !vendorData.address || !vendorData.city || 
          !vendorData.state || !vendorData.country) {
        res.status(400).json({ message: 'Business details are incomplete' });
        return;
      }
      
      const result = await this.authService.registerVendor(vendorData);
      
      res.status(201).json({
        message: 'Vendor registered successfully. Awaiting admin verification.',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * Driver registration endpoint
   */
  async registerDriver(req: Request, res: Response): Promise<void> {
    try {
      const driverData = req.body;
      
      // Validate required fields
      if (!driverData.firstName || !driverData.lastName || 
          !driverData.phoneNumber || !driverData.vehicleType || 
          !driverData.licensePlate || !driverData.drivingLicense || 
          !driverData.identificationDoc) {
        res.status(400).json({ message: 'Driver details are incomplete' });
        return;
      }
      
      const result = await this.authService.registerDriver(driverData);
      
      res.status(201).json({
        message: 'Driver registered successfully. Awaiting admin verification.',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * Admin registration endpoint (restricted to super admins)
   */
  async registerAdmin(req: Request, res: Response): Promise<void> {
    try {
      const adminData = req.body;
      
      // Get creator user ID from authenticated user
      const creatorUserId = req.user?.userId;
      
      if (!creatorUserId) {
        res.status(401).json({ message: 'Authentication required' });
        
      }
      
      // Validate required fields
      if (!adminData.firstName || !adminData.lastName) {
        res.status(400).json({ message: 'First name and last name are required' });
       
      }
      
      const result = await this.authService.registerAdmin(adminData, creatorUserId!);
      
      res.status(201).json({
        message: 'Admin registered successfully',
        data: result
      });
    } catch (error: any) {
      res.status(403).json({
        message: 'Admin registration failed',
        error: error.message
      });
    }
  }

  /**
   * Login endpoint for all user types
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, phone, password, deviceInfo } = req.body;
      
      if ((!email && !phone) || !password) {
        res.status(400).json({ message: 'Email/phone and password are required' });
        return;
      }
      
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      
      const result = await this.authService.login(
        { email, phone, password, deviceInfo },
        ipAddress,
        userAgent
      );
      
      res.status(200).json({
        message: 'Login successful',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        message: 'Authentication failed',
        error: error.message
      });
    }
  }

  /**
   * Refresh token endpoint
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({ message: 'Refresh token is required' });
        return;
      }
      
      const result = await this.authService.refreshToken(refreshToken);
      
      res.status(200).json({
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        message: 'Token refresh failed',
        error: error.message
      });
    }
  }

  /**
   * Logout endpoint
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { deviceToken } = req.body;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        
      }
      
      if (deviceToken) {
        await this.authService.logout(userId!, deviceToken);
      } else {
        await this.authService.logout(userId!);
      }
      
      res.status(200).json({
        message: 'Logout successful'
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Logout failed',
        error: error.message
      });
    }
  }

  /**
   * Request password reset endpoint
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { emailOrPhone } = req.body;
      
      if (!emailOrPhone) {
        res.status(400).json({ message: 'Email or phone number is required' });
        return;
      }
      
      const result = await this.authService.requestPasswordReset(emailOrPhone);
      
      res.status(200).json({
        message: result.message,
        ...(process.env.NODE_ENV === 'development' && { token: result.token }) // Only in development
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Password reset request failed',
        error: error.message
      });
    }
  }

  /**
   * Reset password endpoint
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        res.status(400).json({ message: 'Token and new password are required' });
        return;
      }
      
      const result = await this.authService.resetPassword({ token, newPassword });
      
      res.status(200).json({
        message: result.message
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Password reset failed',
        error: error.message
      });
    }
  }

  /**
   * Validate token endpoint (useful for client-side validation)
   */
  async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      
      if (!token) {
        res.status(400).json({ message: 'Token is required' });
        return;
      }
      
      const payload = await this.authService.validateToken(token);
      
      res.status(200).json({
        message: 'Token is valid',
        data: {
          userId: payload.userId,
          role: payload.role
        }
      });
    } catch (error: any) {
      res.status(401).json({
        message: 'Token is invalid',
        error: error.message
      });
    }
  }
}

// Export a singleton instance
export const authController = new AuthController();