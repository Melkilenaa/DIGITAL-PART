import { PrismaClient, User, UserRole } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Interfaces
interface RegisterUserDto {
  email?: string;
  phone?: string;
  password: string;
  role: UserRole;
}

interface CustomerRegistrationDto extends RegisterUserDto {
  firstName: string;
  lastName: string;
  profileImage?: string;
}

interface VendorRegistrationDto extends RegisterUserDto {
  businessName: string;
  businessLogo?: string;
  businessDescription?: string;
  phoneNumber: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  operatingHours: any; // JSON structure for operating hours
  specializations?: string[];
  certifications?: string[];
}

interface DriverRegistrationDto extends RegisterUserDto {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profileImage?: string;
  vehicleType: string;
  vehicleColor?: string;
  licensePlate: string;
  drivingLicense: string;
  insuranceDocument?: string;
  identificationDoc: string;
}

interface AdminRegistrationDto extends RegisterUserDto {
  firstName: string;
  lastName: string;
  permissionLevel?: string;
}

interface LoginDto {
  email?: string;
  phone?: string;
  password: string;
  deviceInfo?: {
    token: string;
    device?: string;
    platform?: string;
  };
}

interface TokenPayload {
  userId: string;
  role: UserRole;
  sessionId: string;
}

interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

interface TwoFactorSetupDto {
  userId: string;
  phoneNumber: string;
}

interface TwoFactorVerifyDto {
  userId: string;
  code: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly saltRounds: number = 10;
  private readonly resetTokenExpiry: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.prisma = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  /**
   * Register a new user based on their role
   */
  async register(userData: RegisterUserDto): Promise<User> {
    // Validate required fields
    if (!userData.email && !userData.phone) {
      throw new Error('Email or phone number is required');
    }

    if (!userData.password) {
      throw new Error('Password is required');
    }

    // Check if user already exists
    const existingUser = await this.findUserByEmailOrPhone(userData.email, userData.phone);
    if (existingUser) {
      throw new Error('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        role: userData.role,
      },
    });

    return user;
  }

  /**
   * Register a customer
   */
  async registerCustomer(customerData: CustomerRegistrationDto): Promise<any> {
    const user = await this.register({
      ...customerData,
      role: UserRole.CUSTOMER,
    });

    const customer = await this.prisma.customer.create({
      data: {
        userId: user.id,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        profileImage: customerData.profileImage,
      },
      include: {
        user: true,
      },
    });

    // Log the registration
    await this.logSystemAction('REGISTRATION', 'User', user.id, { role: 'CUSTOMER' });

    return {
      user: this.excludePassword(user),
      customer,
    };
  }

  /**
   * Register a vendor
   */
  async registerVendor(vendorData: VendorRegistrationDto): Promise<any> {
    const user = await this.register({
      ...vendorData,
      role: UserRole.VENDOR,
    });

    const vendor = await this.prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: vendorData.businessName,
        businessLogo: vendorData.businessLogo,
        businessDescription: vendorData.businessDescription,
        phoneNumber: vendorData.phoneNumber,
        email: vendorData.email,
        address: vendorData.address,
        city: vendorData.city,
        state: vendorData.state,
        country: vendorData.country,
        postalCode: vendorData.postalCode,
        latitude: vendorData.latitude,
        longitude: vendorData.longitude,
        operatingHours: vendorData.operatingHours,
        specializations: vendorData.specializations || [],
        certifications: vendorData.certifications || [],
        tags: [],
      },
      include: {
        user: true,
      },
    });

    // Log the registration
    await this.logSystemAction('REGISTRATION', 'User', user.id, { role: 'VENDOR' });

    return {
      user: this.excludePassword(user),
      vendor,
    };
  }

  /**
   * Register a driver
   */
  async registerDriver(driverData: DriverRegistrationDto): Promise<any> {
    const user = await this.register({
      ...driverData,
      role: UserRole.DRIVER,
    });

    const driver = await this.prisma.driver.create({
      data: {
        userId: user.id,
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        phoneNumber: driverData.phoneNumber,
        profileImage: driverData.profileImage,
        vehicleType: driverData.vehicleType,
        vehicleColor: driverData.vehicleColor,
        licensePlate: driverData.licensePlate,
        drivingLicense: driverData.drivingLicense,
        insuranceDocument: driverData.insuranceDocument,
        identificationDoc: driverData.identificationDoc,
      },
      include: {
        user: true,
      },
    });

    // Log the registration
    await this.logSystemAction('REGISTRATION', 'User', user.id, { role: 'DRIVER' });

    return {
      user: this.excludePassword(user),
      driver,
    };
  }

  /**
   * Register an admin (restricted to super admins)
   */
  async registerAdmin(adminData: AdminRegistrationDto, creatorUserId: string): Promise<any> {
    // Check if creator is a super admin
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorUserId },
      include: {
        admin: true,
      },
    });

    if (!creator || creator.role !== UserRole.ADMIN || creator.admin?.permissionLevel !== 'SUPER_ADMIN') {
      throw new Error('Only super admins can create new admin accounts');
    }

    const user = await this.register({
      ...adminData,
      role: UserRole.ADMIN,
    });

    const admin = await this.prisma.admin.create({
      data: {
        userId: user.id,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        permissionLevel: adminData.permissionLevel as any || 'STANDARD',
      },
      include: {
        user: true,
      },
    });

    // Log the registration
    await this.logSystemAction('REGISTRATION', 'User', user.id, { 
      role: 'ADMIN', 
      createdBy: creatorUserId 
    });

    return {
      user: this.excludePassword(user),
      admin,
    };
  }

  /**
   * User login
   */
  async login(loginData: LoginDto, ipAddress?: string, userAgent?: string): Promise<any> {
    // Find user by email or phone
    const user = await this.findUserByEmailOrPhone(loginData.email, loginData.phone);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('This account has been deactivated');
    }

    // Compare password
    const isPasswordValid = await bcryptjs.compare(loginData.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate session ID for this login
    const sessionId = uuidv4();

    // Generate tokens
    const accessToken = this.generateToken(user.id, user.role, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, user.role, sessionId);

    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Register device token if provided
    if (loginData.deviceInfo?.token) {
      await this.registerDeviceToken(
        user.id, 
        loginData.deviceInfo.token,
        loginData.deviceInfo.device,
        loginData.deviceInfo.platform
      );
    }

    // Log the login action
    await this.logSystemAction('LOGIN', 'User', user.id, { ipAddress, userAgent });

    // Get profile data based on user role
    const profile = await this.getUserProfile(user);

    return {
      user: this.excludePassword(user),
      profile,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as TokenPayload;

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid token or inactive user');
      }

      // Generate new tokens using the same session ID
      const accessToken = this.generateToken(user.id, user.role, decoded.sessionId);
      const newRefreshToken = this.generateRefreshToken(user.id, user.role, decoded.sessionId);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, deviceToken?: string): Promise<void> {
    // If device token is provided, remove just that token
    if (deviceToken) {
      await this.prisma.deviceToken.deleteMany({
        where: {
          userId: userId,
          token: deviceToken,
        },
      });
    }

    // Log the logout action
    await this.logSystemAction('LOGOUT', 'User', userId, {});
  }

 /**
 * Request password reset
 */
async requestPasswordReset(emailOrPhone: string): Promise<{ message: string, token?: string }> {
    // Find user by email or phone
    const user = await this.findUserByEmailOrPhone(emailOrPhone, emailOrPhone);
  
    if (!user) {
      // For security reasons, always return success even if user is not found
      return { message: 'If your account exists, a password reset link has been sent' };
    }
  
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + this.resetTokenExpiry);
  
    // Store the token directly in the user model
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry,
      },
    });
  
    // Log the action for audit purposes
    await this.logSystemAction('PASSWORD_RESET_REQUEST', 'User', user.id, {
      requestedAt: new Date(),
    });
  
    // In a real implementation, you would send this to the user via email or SMS
    // For now we just return success message
    return { 
      message: 'Password reset requested successfully',
      // In development, you might want to return the token for testing
      // Remove this in production
      token: resetToken
    };
  }
  
  /**
   * Reset password using token
   */
  async resetPassword(resetData: ResetPasswordDto): Promise<{ message: string }> {
    // Find user by reset token
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: resetData.token,
        resetTokenExpiry: {
          gte: new Date(), // Token must not be expired
        },
      },
    });
  
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
  
    // Hash new password
    const hashedPassword = await this.hashPassword(resetData.newPassword);
    
    // Update user password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  
    // Log the successful password reset
    await this.logSystemAction('PASSWORD_RESET_COMPLETED', 'User', user.id, {
      completedAt: new Date(),
    });
    
    return { message: 'Password has been reset successfully' };
  }

  /**
   * Set up two-factor authentication
   */
//   async setupTwoFactorAuth(data: TwoFactorSetupDto): Promise<{ secret: string }> {
//     // In a real implementation, you would:
//     // 1. Generate a secret key
//     // 2. Store it associated with the user
//     // 3. Return the secret or QR code for the user to scan
    
//     // Mock implementation
//     const secret = crypto.randomBytes(20).toString('hex');
    
//     // In a real implementation, store this secret with the user
//     // await this.prisma.user.update({
//     //   where: { id: data.userId },
//     //   data: { twoFactorSecret: secret },
//     // });
    
//     return { secret };
//   }

//   /**
//    * Verify two-factor code
//    */
//   async verifyTwoFactorCode(data: TwoFactorVerifyDto): Promise<{ isValid: boolean }> {
//     // In a real implementation, you would:
//     // 1. Retrieve the user's 2FA secret
//     // 2. Validate the provided code against the secret
    
//     // Mock implementation - always returns true
//     return { isValid: true };
//   }

  /**
   * Helper to find a user by email or phone
   */
  private async findUserByEmailOrPhone(email?: string, phone?: string): Promise<User | null> {
    if (!email && !phone) {
      return null;
    }

    return await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email || '' },
          { phone: phone || '' },
        ],
      },
    });
  }

  /**
   * Helper to hash passwords
   */
  private async hashPassword(password: string): Promise<string> {
    return await bcryptjs.hash(password, this.saltRounds);
  }

  /**
   * Generate JWT access token
   */
  private generateToken(userId: string, role: UserRole, sessionId: string): string {
    const payload: TokenPayload = {
      userId,
      role,
      sessionId,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string, role: UserRole, sessionId: string): string {
    const payload: TokenPayload = {
      userId,
      role,
      sessionId,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.refreshTokenExpiresIn } as jwt.SignOptions);
  }

  /**
   * Register a device token for push notifications
   */
  private async registerDeviceToken(userId: string, token: string, device?: string, platform?: string): Promise<void> {
    // Check if token already exists for this user
    const existingToken = await this.prisma.deviceToken.findFirst({
      where: {
        userId,
        token,
      },
    });

    if (existingToken) {
      // Update existing token
      await this.prisma.deviceToken.update({
        where: { id: existingToken.id },
        data: {
          device,
          platform,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new token
      await this.prisma.deviceToken.create({
        data: {
          userId,
          token,
          device,
          platform,
        },
      });
    }
  }

  /**
   * Get user profile based on role
   */
  private async getUserProfile(user: User): Promise<any> {
    switch (user.role) {
      case UserRole.CUSTOMER:
        return await this.prisma.customer.findUnique({
          where: { userId: user.id },
        });
      case UserRole.VENDOR:
        return await this.prisma.vendor.findUnique({
          where: { userId: user.id },
        });
      case UserRole.DRIVER:
        return await this.prisma.driver.findUnique({
          where: { userId: user.id },
        });
      case UserRole.ADMIN:
        return await this.prisma.admin.findUnique({
          where: { userId: user.id },
        });
      default:
        return null;
    }
  }

  /**
   * Exclude password from user object
   */
  private excludePassword(user: User): any {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Log system actions for auditing
   */
  private async logSystemAction(
    action: string, 
    entityType: string, 
    entityId: string, 
    details: any, 
    performedById?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType,
          entityId,
          performedById: performedById || entityId,
          details,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to log system action:', error);
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}