import { PrismaClient, User, UserRole, AdminPermission } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';

// Define interfaces for input data
interface UpdateProfileDto {
  userId: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  // For vendors
  businessName?: string;
  businessLogo?: string;
  businessDescription?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  operatingHours?: any;
  specializations?: string[];
  certifications?: string[];
  // Banking details for vendors/drivers
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  // For drivers
  vehicleType?: string;
  vehicleColor?: string;
  licensePlate?: string;
}

interface AccountSettingsDto {
  userId: string;
  email?: string;
  phone?: string;
  password?: string;
  oldPassword?: string;
  notificationPreferences?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
  };
  privacySettings?: {
    shareLocation?: boolean;
    shareContactInfo?: boolean;
    profileVisibility?: 'public' | 'private' | 'registered';
  };
  languagePreference?: string;
  currencyPreference?: string;
}

interface VerificationSubmissionDto {
  userId: string;
  type: 'VENDOR' | 'DRIVER';
  documents: {
    type: string; // e.g., 'BUSINESS_LICENSE', 'IDENTITY', 'VEHICLE_REGISTRATION'
    fileUrl: string;
    description?: string;
  }[];
  additionalInfo?: any;
}

interface VerificationDecisionDto {
  userId: string;
  type: 'VENDOR' | 'DRIVER';
  isApproved: boolean;
  rejectionReason?: string;
  reviewedBy: string; // Admin user ID
}

interface DeviceTokenDto {
  userId: string;
  token: string;
  device?: string;
  platform?: string;
}

export class UserService {
  private prisma: PrismaClient;
  private readonly saltRounds: number = 10;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get profile based on user role
    let profile;
    switch (user.role) {
      case UserRole.CUSTOMER:
        profile = await this.prisma.customer.findUnique({
          where: { userId },
          include: {
            addresses: true,
            vehicles: true,
          },
        });
        break;
      case UserRole.VENDOR:
        profile = await this.prisma.vendor.findUnique({
          where: { userId },
        });
        break;
      case UserRole.DRIVER:
        profile = await this.prisma.driver.findUnique({
          where: { userId },
        });
        break;
      case UserRole.ADMIN:
        profile = await this.prisma.admin.findUnique({
          where: { userId },
        });
        break;
      default:
        throw new Error('Invalid user role');
    }

    // Don't return password
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      profile,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    switch (user.role) {
      case UserRole.CUSTOMER:
        return this.updateCustomerProfile(data);
      case UserRole.VENDOR:
        return this.updateVendorProfile(data);
      case UserRole.DRIVER:
        return this.updateDriverProfile(data);
      case UserRole.ADMIN:
        return this.updateAdminProfile(data);
      default:
        throw new Error('Invalid user role');
    }
  }

  /**
   * Update customer profile
   */
  async updateCustomerProfile(data: UpdateProfileDto): Promise<any> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: data.userId },
    });

    if (!customer) {
      throw new Error('Customer profile not found');
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { userId: data.userId },
      data: {
        firstName: data.firstName ?? customer.firstName,
        lastName: data.lastName ?? customer.lastName,
        profileImage: data.profileImage ?? customer.profileImage,
      },
    });

    await this.logSystemAction('PROFILE_UPDATE', 'Customer', customer.id, {
      updatedFields: this.getUpdatedFields(data, ['firstName', 'lastName', 'profileImage']),
    });

    return updatedCustomer;
  }

  /**
   * Update vendor profile
   */
  async updateVendorProfile(data: UpdateProfileDto): Promise<any> {
    console.log(`DEBUG: Looking for vendor with userId: ${data.userId}`);
    
    // Check if user exists first (should be true based on the token)
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId }
    });
    
    if (!user) {
      console.error(`User with ID ${data.userId} not found`);
      throw new Error('User not found');
    }
    
    console.log(`DEBUG: Found user with role ${user.role} and email ${user.email}`);
    
    // See if there's any vendor record with this email
    if (user.email) {
      const vendorByEmail = await this.prisma.vendor.findFirst({
        where: { email: user.email }
      });
      
      if (vendorByEmail) {
        console.log(`DEBUG: Found vendor with matching email ${user.email}`);
        console.log(`DEBUG: Vendor.userId=${vendorByEmail.userId}, User.id=${user.id}`);
        
        // If IDs don't match, we found the issue
        if (vendorByEmail.userId !== user.id) {
          console.log(`DEBUG: MISMATCH - Updating userId reference to fix the issue...`);
          
          // Fix the mismatch by updating the vendor's userId
          await this.prisma.vendor.update({
            where: { id: vendorByEmail.id },
            data: { userId: user.id }
          });
          
          console.log(`DEBUG: Fixed userId reference for vendor ${vendorByEmail.id}`);
        }
      } else {
        console.log(`DEBUG: No vendor found with email ${user.email}`);
      }
    }
    
    // Try the normal lookup
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: data.userId },
    });

    if (!vendor) {
      // Last resort - look at all vendors in the database
      const allVendors = await this.prisma.vendor.findMany({
        select: { id: true, userId: true, email: true, businessName: true }
      });
      
      console.log(`DEBUG: All vendors in system (${allVendors.length}):`);
      console.log(JSON.stringify(allVendors, null, 2));
      
      throw new Error('Vendor profile not found');
    }

    // Build update data with only provided fields
    const updateData: any = {};
    
    if (data.businessName) updateData.businessName = data.businessName;
    if (data.businessLogo) updateData.businessLogo = data.businessLogo;
    if (data.businessDescription) updateData.businessDescription = data.businessDescription;
    if (data.address) updateData.address = data.address;
    if (data.city) updateData.city = data.city;
    if (data.state) updateData.state = data.state;
    if (data.country) updateData.country = data.country;
    if (data.postalCode) updateData.postalCode = data.postalCode;
    if (data.latitude) updateData.latitude = data.latitude;
    if (data.longitude) updateData.longitude = data.longitude;
    if (data.operatingHours) updateData.operatingHours = data.operatingHours;
    if (data.specializations) updateData.specializations = data.specializations;
    if (data.certifications) updateData.certifications = data.certifications;
    if (data.bankName) updateData.bankName = data.bankName;
    if (data.bankAccountName) updateData.bankAccountName = data.bankAccountName;
    if (data.bankAccountNumber) updateData.bankAccountNumber = data.bankAccountNumber;
    
    if (data.bankName || data.bankAccountName || data.bankAccountNumber) {
      // Enable payouts if all banking fields are present
      if (
        (data.bankName || vendor.bankName) && 
        (data.bankAccountName || vendor.bankAccountName) && 
        (data.bankAccountNumber || vendor.bankAccountNumber)
      ) {
        updateData.isPayoutEnabled = true;
      }
    }

    const updatedVendor = await this.prisma.vendor.update({
      where: { userId: data.userId },
      data: updateData,
    });

    await this.logSystemAction('PROFILE_UPDATE', 'Vendor', vendor.id, {
      updatedFields: Object.keys(updateData),
    });

    return updatedVendor;
  }

  /**
   * Update driver profile
   */
  async updateDriverProfile(data: UpdateProfileDto): Promise<any> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: data.userId },
    });

    if (!driver) {
      throw new Error('Driver profile not found');
    }

    // Build update data with only provided fields
    const updateData: any = {};
    
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.profileImage) updateData.profileImage = data.profileImage;
    if (data.vehicleType) updateData.vehicleType = data.vehicleType;
    if (data.vehicleColor) updateData.vehicleColor = data.vehicleColor;
    if (data.licensePlate) updateData.licensePlate = data.licensePlate;
    if (data.bankName) updateData.bankName = data.bankName;
    if (data.bankAccountName) updateData.bankAccountName = data.bankAccountName;
    if (data.bankAccountNumber) updateData.bankAccountNumber = data.bankAccountNumber;
    
    if (data.bankName || data.bankAccountName || data.bankAccountNumber) {
      // Enable payouts if all banking fields are present
      if (
        (data.bankName || driver.bankName) && 
        (data.bankAccountName || driver.bankAccountName) && 
        (data.bankAccountNumber || driver.bankAccountNumber)
      ) {
        updateData.isPayoutEnabled = true;
      }
    }

    const updatedDriver = await this.prisma.driver.update({
      where: { userId: data.userId },
      data: updateData,
    });

    await this.logSystemAction('PROFILE_UPDATE', 'Driver', driver.id, {
      updatedFields: Object.keys(updateData),
    });

    return updatedDriver;
  }

  /**
   * Update admin profile
   */
  async updateAdminProfile(data: UpdateProfileDto): Promise<any> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId: data.userId },
    });

    if (!admin) {
      throw new Error('Admin profile not found');
    }

    // Build update data with only provided fields
    const updateData: any = {};
    
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;

    const updatedAdmin = await this.prisma.admin.update({
      where: { userId: data.userId },
      data: updateData,
    });

    await this.logSystemAction('PROFILE_UPDATE', 'Admin', admin.id, {
      updatedFields: Object.keys(updateData),
    });

    return updatedAdmin;
  }

  /**
   * Update account settings and preferences
   */
  async updateAccountSettings(data: AccountSettingsDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prepare update data
    const updateData: any = {};

    // Handle email update
    if (data.email && data.email !== user.email) {
      // Check if email is already in use
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: data.userId },
        },
      });

      if (existingUser) {
        throw new Error('Email already in use');
      }

      updateData.email = data.email;
    }

    // Handle phone update
    if (data.phone && data.phone !== user.phone) {
      // Check if phone is already in use
      const existingUser = await this.prisma.user.findFirst({
        where: {
          phone: data.phone,
          id: { not: data.userId },
        },
      });

      if (existingUser) {
        throw new Error('Phone number already in use');
      }

      updateData.phone = data.phone;
    }

    

    // Handle password update
    if (data.password) {
      // Verify old password if provided
      if (data.oldPassword) {
        const isPasswordValid = await bcryptjs.compare(data.oldPassword, user.password);
        if (!isPasswordValid) {
          throw new Error('Current password is incorrect');
        }
      }

      // Hash new password
      updateData.password = await bcryptjs.hash(data.password, this.saltRounds);
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: data.userId },
      data: updateData,
    });

    // Process preference updates
    const preferencesToUpdate: any = {};
    
    if (data.notificationPreferences) {
      preferencesToUpdate.notificationPreferences = data.notificationPreferences;
    }
    
    if (data.privacySettings) {
      preferencesToUpdate.privacySettings = data.privacySettings;
    }
    
    if (data.languagePreference) {
      preferencesToUpdate.languagePreference = data.languagePreference;
    }
    
    if (data.currencyPreference) {
      preferencesToUpdate.currencyPreference = data.currencyPreference;
    }

    // In a real implementation, you would store these in a UserPreferences table
    // For now, we'll log that preferences would be updated
    await this.logSystemAction('ACCOUNT_SETTINGS_UPDATE', 'User', user.id, {
      updatedFields: {
        ...Object.keys(updateData).reduce((obj: any, key) => {
          obj[key] = key === 'password' ? '(changed)' : 'changed';
          return obj;
        }, {}),
        preferences: Object.keys(preferencesToUpdate).length > 0 ? preferencesToUpdate : undefined,
      },
    });

    // Return updated user without password
    const { password, ...userWithoutPassword } = updatedUser;
    return {
      user: userWithoutPassword,
      preferences: preferencesToUpdate,
    };
  }
/**
 * Update banking details for a user
 */
async updateBankingDetails(userId: string, data: {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
}): Promise<any> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Validate all required banking fields are provided
  if (!data.bankName || !data.bankAccountName || !data.bankAccountNumber) {
    throw new Error('Bank name, account name, and account number are all required');
  }

  let result;
  
  // Update banking details based on user role
  if (user.role === UserRole.VENDOR) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    
    if (!vendor) {
      throw new Error('Vendor profile not found');
    }
    
    result = await this.prisma.vendor.update({
      where: { userId },
      data: {
        bankName: data.bankName,
        bankAccountName: data.bankAccountName, 
        bankAccountNumber: data.bankAccountNumber,
        isPayoutEnabled: true,
      },
    });
  } else if (user.role === UserRole.DRIVER) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });
    
    if (!driver) {
      throw new Error('Driver profile not found');
    }
    
    result = await this.prisma.driver.update({
      where: { userId },
      data: {
        bankName: data.bankName,
        bankAccountName: data.bankAccountName,
        bankAccountNumber: data.bankAccountNumber,
        isPayoutEnabled: true,
      },
    });
  } else {
    throw new Error('Banking details can only be updated for vendors and drivers');
  }

  await this.logSystemAction('BANKING_DETAILS_UPDATE', user.role === UserRole.VENDOR ? 'Vendor' : 'Driver', 
    result.id, {
      updatedFields: ['bankName', 'bankAccountName', 'bankAccountNumber']
    }
  );

  return result;
}
  /**
   * Manage user permissions (admin only)
   */
  async updateUserPermissions(
    adminId: string, 
    targetUserId: string, 
    newRole?: UserRole, 
    adminPermission?: AdminPermission
  ): Promise<any> {
    // First, verify that the requesting user is an admin with appropriate permissions
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: {
        admin: true,
      },
    });

    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only admins can modify user permissions');
    }

    if (admin.admin?.permissionLevel !== AdminPermission.SUPER_ADMIN && 
        adminPermission === AdminPermission.SUPER_ADMIN) {
      throw new Error('Unauthorized: Only super admins can grant super admin permissions');
    }

    // Find the target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        admin: true,
      },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // If changing role, validate and perform role change
    if (newRole && newRole !== targetUser.role) {
      // Changing roles is complex and requires creating and removing related records
      // This is a simplified implementation
      throw new Error('Role changes require data migration and are not implemented in this version');
    }

    // If updating admin permissions
    if (adminPermission && targetUser.role === UserRole.ADMIN) {
      await this.prisma.admin.update({
        where: { userId: targetUserId },
        data: {
          permissionLevel: adminPermission,
        },
      });

      await this.logSystemAction('PERMISSION_UPDATE', 'Admin', targetUser.admin!.id, {
        updatedBy: adminId,
        newPermission: adminPermission,
      });
    }

    return this.getUserProfile(targetUserId);
  }

  /**
   * Update user active status (enable/disable account)
   */
  async updateUserActiveStatus(adminId: string, targetUserId: string, isActive: boolean): Promise<any> {
    // Verify requesting user is an admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: {
        admin: true,
      },
    });

    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only admins can modify user status');
    }

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Prevent deactivating super admins unless requester is also super admin
    if (targetUser.role === UserRole.ADMIN && !isActive) {
      const targetAdmin = await this.prisma.admin.findUnique({
        where: { userId: targetUserId },
      });

      if (targetAdmin?.permissionLevel === AdminPermission.SUPER_ADMIN && 
          admin.admin?.permissionLevel !== AdminPermission.SUPER_ADMIN) {
        throw new Error('Unauthorized: Only super admins can deactivate other super admins');
      }
    }

    // Update user active status
    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });

    await this.logSystemAction(
      isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED', 
      'User', 
      targetUserId, 
      { performedBy: adminId }
    );

    // Return updated user without password
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Submit verification documents (for vendors and drivers)
   */
  async submitVerificationDocuments(data: VerificationSubmissionDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Validate user type based on verification type
    if ((data.type === 'VENDOR' && user.role !== UserRole.VENDOR) || 
        (data.type === 'DRIVER' && user.role !== UserRole.DRIVER)) {
      throw new Error('Invalid verification type for this user');
    }

    // Store the verification submission
    // In a real system, you'd have a separate VerificationDocument model
    // For this implementation, we'll update the entity's verification documents field
    
    if (data.type === 'VENDOR') {
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId: data.userId },
      });

      if (!vendor) {
        throw new Error('Vendor profile not found');
      }

      // Store documents in the verificationDocuments JSON field
      await this.prisma.vendor.update({
        where: { userId: data.userId },
        data: {
          verificationDocuments: data.documents,
        },
      });

      await this.logSystemAction('VERIFICATION_SUBMITTED', 'Vendor', vendor.id, {
        documentCount: data.documents.length,
        documentTypes: data.documents.map(doc => doc.type),
      });
    } else if (data.type === 'DRIVER') {
      const driver = await this.prisma.driver.findUnique({
        where: { userId: data.userId },
      });

      if (!driver) {
        throw new Error('Driver profile not found');
      }

      // For driver, we update specific documents
      const updateData: any = {};
      
      for (const doc of data.documents) {
        switch (doc.type) {
          case 'DRIVING_LICENSE':
            updateData.drivingLicense = doc.fileUrl;
            break;
          case 'INSURANCE':
            updateData.insuranceDocument = doc.fileUrl;
            break;
          case 'IDENTIFICATION':
            updateData.identificationDoc = doc.fileUrl;
            break;
        }
      }

      await this.prisma.driver.update({
        where: { userId: data.userId },
        data: updateData,
      });

      await this.logSystemAction('VERIFICATION_SUBMITTED', 'Driver', driver.id, {
        documentCount: data.documents.length,
        documentTypes: data.documents.map(doc => doc.type),
      });
    }

    return { message: 'Verification documents submitted successfully' };
  }

  /**
   * Process verification decision (admin only)
   */
  async processVerificationDecision(data: VerificationDecisionDto): Promise<any> {
    // Verify requestor is an admin
    const admin = await this.prisma.user.findUnique({
      where: { id: data.reviewedBy },
      include: {
        admin: true,
      },
    });

    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized: Only admins can process verification decisions');
    }

    // Find target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Process decision based on user type
    if (data.type === 'VENDOR' && targetUser.role === UserRole.VENDOR) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId: data.userId },
      });

      if (!vendor) {
        throw new Error('Vendor profile not found');
      }

      await this.prisma.vendor.update({
        where: { userId: data.userId },
        data: {
          isVerified: data.isApproved,
        },
      });

      await this.logSystemAction(
        data.isApproved ? 'VENDOR_VERIFICATION_APPROVED' : 'VENDOR_VERIFICATION_REJECTED',
        'Vendor',
        vendor.id,
        {
          reviewedBy: data.reviewedBy,
          rejectionReason: data.rejectionReason,
        }
      );
    } else if (data.type === 'DRIVER' && targetUser.role === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findUnique({
        where: { userId: data.userId },
      });

      if (!driver) {
        throw new Error('Driver profile not found');
      }

      await this.prisma.driver.update({
        where: { userId: data.userId },
        data: {
          isVerified: data.isApproved,
        },
      });

      await this.logSystemAction(
        data.isApproved ? 'DRIVER_VERIFICATION_APPROVED' : 'DRIVER_VERIFICATION_REJECTED',
        'Driver',
        driver.id,
        {
          reviewedBy: data.reviewedBy,
          rejectionReason: data.rejectionReason,
        }
      );
    } else {
      throw new Error('Invalid verification type for this user');
    }

    return { 
      message: `Verification ${data.isApproved ? 'approved' : 'rejected'} successfully`,
      isVerified: data.isApproved
    };
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(data: DeviceTokenDto): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if token already exists
    const existingToken = await this.prisma.deviceToken.findFirst({
      where: {
        userId: data.userId,
        token: data.token,
      },
    });

    if (existingToken) {
      // Update existing token
      await this.prisma.deviceToken.update({
        where: { id: existingToken.id },
        data: {
          device: data.device,
          platform: data.platform,
          updatedAt: new Date(),
        },
      });

      return { message: 'Device token updated successfully' };
    } else {
      // Create new token
      await this.prisma.deviceToken.create({
        data: {
          userId: data.userId,
          token: data.token,
          device: data.device,
          platform: data.platform,
        },
      });

      return { message: 'Device token registered successfully' };
    }
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<any> {
    const deviceToken = await this.prisma.deviceToken.findFirst({
      where: {
        userId,
        token,
      },
    });

    if (!deviceToken) {
      throw new Error('Device token not found');
    }

    await this.prisma.deviceToken.delete({
      where: { id: deviceToken.id },
    });

    return { message: 'Device token removed successfully' };
  }

  /**
   * Get all device tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId },
    });

    return deviceTokens;
  }

  /**
   * Helper to log system actions
   */
  private async logSystemAction(
    action: string,
    entityType: string,
    entityId: string,
    details: any
  ): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType,
          entityId,
          details,
        },
      });
    } catch (error) {
      console.error('Failed to log system action:', error);
    }
  }

  /**
   * Helper to extract updated fields
   */
  private getUpdatedFields(data: any, fields: string[]): string[] {
    return fields.filter(field => data[field] !== undefined);
  }
}

export default new UserService();