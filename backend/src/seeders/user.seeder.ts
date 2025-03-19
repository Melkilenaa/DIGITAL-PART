import { PrismaClient, UserRole, AdminPermission } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

export class UserSeeder {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async seed() {
    console.log('🌱 Starting User Module Seeder...');

    // Seed in logical sequence
    await this.seedDeviceTokens();
    await this.seedUserPreferences();
    await this.seedVerificationDocuments();
    await this.seedSystemLogs();

    console.log('✅ User Module Seeding completed!');
  }

  /**
   * Seed device tokens for push notifications
   */
  private async seedDeviceTokens() {
    console.log('Seeding device tokens...');

    const deviceTokenData = [
      // Customer devices
      {
        email: 'john@example.com',
        tokens: [
          {
            token: 'fcm-customer1-ios-token',
            device: 'iPhone 13 Pro',
            platform: 'iOS'
          },
          {
            token: 'fcm-customer1-web-token',
            device: 'Chrome Browser',
            platform: 'Web'
          }
        ]
      },
      {
        email: 'jane@example.com',
        tokens: [
          {
            token: 'fcm-customer2-android-token',
            device: 'Samsung Galaxy S21',
            platform: 'Android'
          }
        ]
      },
      // Vendor devices
      {
        email: 'vendor@example.com',
        tokens: [
          {
            token: 'fcm-vendor1-android-token',
            device: 'Google Pixel 6',
            platform: 'Android'
          },
          {
            token: 'fcm-vendor1-web-token',
            device: 'Firefox Browser',
            platform: 'Web'
          }
        ]
      },
      // Driver devices
      {
        email: 'driver@example.com',
        tokens: [
          {
            token: 'fcm-driver1-android-token',
            device: 'Xiaomi Redmi Note 10',
            platform: 'Android'
          }
        ]
      },
      // Admin devices
      {
        email: 'admin@example.com',
        tokens: [
          {
            token: 'fcm-admin-web-token',
            device: 'Chrome Browser',
            platform: 'Web'
          }
        ]
      }
    ];

    for (const userData of deviceTokenData) {
      const user = await this.prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (user) {
        for (const tokenData of userData.tokens) {
          try {
            await this.prisma.deviceToken.create({
              data: {
                userId: user.id,
                token: tokenData.token,
                device: tokenData.device,
                platform: tokenData.platform
              }
            });
            console.log(`Created device token for user ${userData.email}: ${tokenData.device}`);
          } catch (error) {
            console.error(`Error creating device token for user ${userData.email}:`, error);
          }
        }
      } else {
        console.log(`User ${userData.email} not found, skipping device tokens`);
      }
    }
  }

  /**
   * Seed user preferences by updating users directly
   * Note: In your schema, preferences are likely stored in the User model or related models
   */
  private async seedUserPreferences() {
    console.log('Seeding user preferences...');

    // Get all users
    const users = await this.prisma.user.findMany();

    for (const user of users) {
      try {
        // Different defaults based on user role
        if (user.role === UserRole.CUSTOMER) {
          // Update customer with customer-specific preferences
          const customer = await this.prisma.customer.findUnique({
            where: { userId: user.id }
          });

          if (customer) {
            // Update customer preferences
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                pushNotificationToken: Math.random() > 0.5 ? 'sample-token-' + user.id.substring(0, 8) : null,
              }
            });
            console.log(`Updated preferences for customer: ${user.email || user.phone}`);
          }
        } else if (user.role === UserRole.VENDOR) {
          // Update vendor with vendor-specific preferences
          const vendor = await this.prisma.vendor.findUnique({
            where: { userId: user.id }
          });

          if (vendor) {
            // Update vendor with operating hours
            await this.prisma.vendor.update({
              where: { id: vendor.id },
              data: {
                operatingHours: {
                  monday: { open: "08:00", close: "18:00", isOpen: true },
                  tuesday: { open: "08:00", close: "18:00", isOpen: true },
                  wednesday: { open: "08:00", close: "18:00", isOpen: true },
                  thursday: { open: "08:00", close: "18:00", isOpen: true },
                  friday: { open: "08:00", close: "18:00", isOpen: true },
                  saturday: { open: "10:00", close: "16:00", isOpen: true },
                  sunday: { open: "00:00", close: "00:00", isOpen: false }
                },
                specialHolidays: [
                  { date: "2023-12-25", isOpen: false, name: "Christmas" },
                  { date: "2024-01-01", isOpen: false, name: "New Year" }
                ]
              }
            });
            
            // Update user push notification token
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                pushNotificationToken: 'vendor-token-' + user.id.substring(0, 8),
              }
            });
            
            console.log(`Updated preferences for vendor: ${user.email || user.phone}`);
          }
        } else if (user.role === UserRole.DRIVER) {
          // Update driver with driver-specific preferences
          const driver = await this.prisma.driver.findUnique({
            where: { userId: user.id }
          });

          if (driver) {
            // Update driver with service areas and working hours
            await this.prisma.driver.update({
              where: { id: driver.id },
              data: {
                serviceAreas: [
                  { name: "Lagos Mainland", radius: 15 },
                  { name: "Lagos Island", radius: 10 }
                ],
                workingHours: {
                  monday: { start: "08:00", end: "18:00", isWorking: true },
                  tuesday: { start: "08:00", end: "18:00", isWorking: true },
                  wednesday: { start: "08:00", end: "18:00", isWorking: true },
                  thursday: { start: "08:00", end: "18:00", isWorking: true },
                  friday: { start: "08:00", end: "18:00", isWorking: true },
                  saturday: { start: "10:00", end: "16:00", isWorking: true },
                  sunday: { start: "00:00", end: "00:00", isWorking: false }
                },
                maxPackageSize: "MEDIUM",
                maxPackageWeight: 25.0,
                isAvailable: Math.random() > 0.3 // 70% chance of being available
              }
            });
            
            // Update user push notification token
            await this.prisma.user.update({
              where: { id: user.id },
              data: {
                pushNotificationToken: 'driver-token-' + user.id.substring(0, 8),
              }
            });
            
            console.log(`Updated preferences for driver: ${user.email || user.phone}`);
          }
        }
      } catch (error) {
        console.error(`Error updating preferences for user ${user.email || user.phone}:`, error);
      }
    }
  }

  /**
   * Seed verification documents for vendors and drivers
   */
  private async seedVerificationDocuments() {
    console.log('Seeding verification documents...');

    // Find an admin to use for verification
    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      include: { admin: true }
    });

    if (!admin) {
      console.log('No admin found for verification documents');
      return;
    }

    // Seed vendor verification documents
    const vendors = await this.prisma.vendor.findMany({
      include: { user: true }
    });

    for (const [index, vendor] of vendors.entries()) {
      try {
        // Alternate between verified and pending vendors
        const isVerified = index % 2 === 0;
        
        const verificationDocuments = {
          "BUSINESS_LICENSE": {
            url: `https://example.com/docs/vendor-${vendor.id}-license.pdf`,
            submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            status: isVerified ? "APPROVED" : "PENDING",
            reviewedAt: isVerified ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) : null, // 10 days ago
            reviewedBy: isVerified ? admin.id : null
          },
          "TAX_CERTIFICATE": {
            url: `https://example.com/docs/vendor-${vendor.id}-tax.pdf`,
            submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            status: isVerified ? "APPROVED" : "PENDING"
          },
          "ID_CARD": {
            url: `https://example.com/docs/vendor-${vendor.id}-id.pdf`,
            submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            status: isVerified ? "APPROVED" : "PENDING"
          }
        };

        await this.prisma.vendor.update({
          where: { id: vendor.id },
          data: {
            verificationDocuments,
            isVerified
          }
        });

        console.log(`Updated verification documents for vendor: ${vendor.user.email || vendor.user.phone}`);
      } catch (error) {
        console.error(`Error updating verification documents for vendor ${vendor.user.email || vendor.user.phone}:`, error);
      }
    }

    // Seed driver verification
    const drivers = await this.prisma.driver.findMany({
      include: { user: true }
    });

    for (const [index, driver] of drivers.entries()) {
      try {
        // Alternate between verified and unverified drivers
        const isVerified = index % 2 === 0;
        
        await this.prisma.driver.update({
          where: { id: driver.id },
          data: {
            isVerified,
            drivingLicense: `https://example.com/docs/driver-${driver.id}-license.pdf`,
            insuranceDocument: `https://example.com/docs/driver-${driver.id}-insurance.pdf`,
            identificationDoc: `https://example.com/docs/driver-${driver.id}-id.pdf`
          }
        });

        console.log(`Updated verification documents for driver: ${driver.user.email || driver.user.phone}`);
      } catch (error) {
        console.error(`Error updating verification documents for driver ${driver.user.email || driver.user.phone}:`, error);
      }
    }
  }

  /**
   * Seed system logs for various user activities
   */
  private async seedSystemLogs() {
    console.log('Seeding system logs...');

    // Get a sample of users for log generation
    const users = await this.prisma.user.findMany({
      take: 5,
      include: {
        customer: true,
        vendor: true,
        driver: true,
        admin: true
      }
    });

    for (const user of users) {
      try {
        // Generate login logs
        await this.prisma.systemLog.create({
          data: {
            action: 'USER_LOGIN',
            entityType: 'User',
            entityId: user.id,
            performedById: user.id,
            details: {
              device: 'Mobile App',
              ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
              timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
            }
          }
        });

        // Generate profile update logs
        await this.prisma.systemLog.create({
          data: {
            action: 'PROFILE_UPDATE',
            entityType: user.role,
            entityId: user.id,
            performedById: user.id,
            details: {
              updatedFields: ['profileImage', 'phoneNumber'],
              timestamp: new Date(Date.now() - Math.floor(Math.random() * 15) * 24 * 60 * 60 * 1000)
            }
          }
        });

        // Generate role-specific logs
        if (user.role === UserRole.VENDOR && user.vendor) {
          await this.prisma.systemLog.create({
            data: {
              action: 'VERIFICATION_SUBMITTED',
              entityType: 'Vendor',
              entityId: user.vendor.id,
              performedById: user.id,
              details: {
                documentTypes: ['BUSINESS_LICENSE', 'TAX_CERTIFICATE'],
                timestamp: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000)
              }
            }
          });
        } else if (user.role === UserRole.DRIVER && user.driver) {
          await this.prisma.systemLog.create({
            data: {
              action: 'DRIVER_STATUS_CHANGED',
              entityType: 'Driver',
              entityId: user.driver.id,
              performedById: user.id,
              details: {
                newStatus: 'AVAILABLE',
                timestamp: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000)
              }
            }
          });
        } else if (user.role === UserRole.ADMIN && user.admin) {
          // Get a random vendor
          const randomVendor = await this.prisma.vendor.findFirst({
            orderBy: { createdAt: 'desc' }
          });

          if (randomVendor) {
            await this.prisma.systemLog.create({
              data: {
                action: 'VENDOR_VERIFICATION_APPROVED',
                entityType: 'Vendor',
                entityId: randomVendor.id,
                performedById: user.id,
                details: {
                  timestamp: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
                }
              }
            });
          }
        }

        // Generate device token logs
        await this.prisma.systemLog.create({
          data: {
            action: 'DEVICE_TOKEN_REGISTERED',
            entityType: 'User',
            entityId: user.id,
            performedById: user.id,
            details: {
              device: 'iPhone ' + Math.floor(Math.random() * 13 + 8),
              timestamp: new Date(Date.now() - Math.floor(Math.random() * 45) * 24 * 60 * 60 * 1000)
            }
          }
        });

        console.log(`Created system logs for user: ${user.email || user.phone}`);
      } catch (error) {
        console.error(`Error creating system logs for user ${user.email || user.phone}:`, error);
      }
    }
  }

  /**
   * Clean database tables related to user module
   * This doesn't delete users created by the auth seeder
   */
  async cleanDatabase() {
    console.log('Cleaning existing user module data...');
    
    // Delete data in reverse order of dependencies
    await this.prisma.systemLog.deleteMany({});
    await this.prisma.deviceToken.deleteMany({});
    
    // Reset verification status and documents for vendors
    await this.prisma.vendor.updateMany({
      data: {
        isVerified: false,
        verificationDocuments: {}
      }
    });

    // Reset verification status and documents for drivers
    await this.prisma.driver.updateMany({
      data: {
        isVerified: false,
        drivingLicense: "",
        insuranceDocument: "",
        identificationDoc: ""
      }
    });
    
    // Reset push notification tokens
    await this.prisma.user.updateMany({
      data: {
        pushNotificationToken: null
      }
    });
    
    console.log('User module data cleaned.');
  }
}

// For direct execution (e.g., node -r ts-node/register src/seeders/user.seeder.ts)
if (require.main === module) {
  const seeder = new UserSeeder();
  
  // Set this to true if you want to clean the database before seeding
  const shouldClean = process.argv.includes('--clean');
  
  (async () => {
    try {
      if (shouldClean) {
        await seeder.cleanDatabase();
      }
      await seeder.seed();
      process.exit(0);
    } catch (error) {
      console.error('Error during seeding:', error);
      process.exit(1);
    }
  })();
}

export default new UserSeeder();