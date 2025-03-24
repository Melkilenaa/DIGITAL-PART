import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRole } from '@prisma/client';
import { uploadToCloudinary } from '../utils/cloudinary.util';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Customer registration endpoint with profile image upload
   */
  async registerCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerData = req.body;
      
      // Check if file was uploaded
      if (req.file) {
        try {
          // The file is already uploaded to Cloudinary by multer-storage-cloudinary
          // The URL will be in file.path
          customerData.profileImage = req.file.path;
          console.log('Profile image uploaded to:', req.file.path);
        } catch (uploadError: any) {
          console.error('Profile image upload error:', uploadError);
          // Continue registration without image if upload fails
        }
      }
      
      const result = await this.authService.registerCustomer(customerData);
      
      res.status(201).json({
        success: true,
        message: 'Customer registered successfully',
        data: result
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed'
      });
    }
  }

  /**
   * Vendor registration endpoint with business logo upload
   */
  async registerVendor(req: Request, res: Response): Promise<void> {
    try {
      const vendorData = req.body;
      
      // Handle business logo upload if file is present
      if (req.file) {
        vendorData.businessLogo = req.file.path;
      }
      
      // Convert string values to appropriate types for Prisma model
      
      // 1. Parse latitude and longitude as floats
      if (vendorData.latitude && typeof vendorData.latitude === 'string') {
        vendorData.latitude = parseFloat(vendorData.latitude);
      }
      
      if (vendorData.longitude && typeof vendorData.longitude === 'string') {
        vendorData.longitude = parseFloat(vendorData.longitude);
      }
      
      // 2. Parse JSON strings into objects/arrays
      if (vendorData.operatingHours && typeof vendorData.operatingHours === 'string') {
        try {
          vendorData.operatingHours = JSON.parse(vendorData.operatingHours);
        } catch (e) {
          console.error('Failed to parse operatingHours:', e);
          res.status(400).json({
            success: false,
            message: 'Invalid operating hours format'
          });
          return;
        }
      }
      
      if (vendorData.specializations && typeof vendorData.specializations === 'string') {
        try {
          vendorData.specializations = JSON.parse(vendorData.specializations);
        } catch (e) {
          console.error('Failed to parse specializations:', e);
          vendorData.specializations = [];
        }
      }
      
      if (vendorData.certifications && typeof vendorData.certifications === 'string') {
        try {
          vendorData.certifications = JSON.parse(vendorData.certifications);
        } catch (e) {
          console.error('Failed to parse certifications:', e);
          vendorData.certifications = [];
        }
      }
      
      // Now pass the properly typed data to the service
      const result = await this.authService.registerVendor(vendorData);
      
      res.status(201).json({
        success: true,
        message: 'Vendor registered successfully. Awaiting admin verification.',
        data: result
      });
    } catch (error: any) {
      console.error('Vendor registration error:', error);
      res.status(400).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * Driver registration endpoint with document uploads
   */
  async registerDriver(req: Request, res: Response): Promise<void> {
    try {
      const driverData = req.body;
      
      // Validate required fields
      if (!driverData.firstName || !driverData.lastName || 
          !driverData.phoneNumber || !driverData.vehicleType || 
          !driverData.licensePlate) {
        res.status(400).json({ message: 'Driver details are incomplete' });
        return;
      }
      
      // Handle document uploads if files are present
      if (req.files && typeof req.files === 'object') {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        try {
          // Upload profile image
          if (files.profileImage?.[0]) {
            driverData.profileImage = await uploadToCloudinary(files.profileImage[0]);
          }
          
          // Upload driving license (required)
          if (files.drivingLicense?.[0]) {
            driverData.drivingLicense = await uploadToCloudinary(files.drivingLicense[0]);
          } else {
            res.status(400).json({ message: 'Driving license document is required' });
            return;
          }
          
          // Upload insurance document (optional)
          if (files.insuranceDocument?.[0]) {
            driverData.insuranceDocument = await uploadToCloudinary(files.insuranceDocument[0]);
          }
          
          // Upload identification document (required)
          if (files.identificationDoc?.[0]) {
            driverData.identificationDoc = await uploadToCloudinary(files.identificationDoc[0]);
          } else {
            res.status(400).json({ message: 'Identification document is required' });
            return;
          }
        } catch (uploadError) {
          console.error('Document upload failed:', uploadError);
          res.status(400).json({ message: 'Document upload failed', error: uploadError });
          return;
        }
      } else {
        res.status(400).json({ message: 'Required documents are missing' });
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
   * Admin registration endpoint with profile image upload
   */
  async registerAdmin(req: Request, res: Response): Promise<void> {
    try {
      const adminData = req.body;
      
      // Get creator user ID from authenticated user
      const creatorUserId = req.user?.userId;
      
      if (!creatorUserId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      
      // Validate required fields
      if (!adminData.firstName || !adminData.lastName) {
        res.status(400).json({ message: 'First name and last name are required' });
        return;
      }
      
      // Handle profile image upload if file is present
      // if (req.file) {
      //   try {
      //     const imageUrl = await uploadToCloudinary(req.file);
      //     adminData.profileImage = imageUrl;
      //   } catch (uploadError) {
      //     console.error('Profile image upload failed:', uploadError);
      //     // Continue registration without image if upload fails
      //   }
      // }
      
      const result = await this.authService.registerAdmin(adminData, creatorUserId);
      
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
        return;
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