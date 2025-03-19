import { PrismaClient, UserRole, AdminPermission } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import { AuthService } from '../services/auth.service';

export class AuthSeeder {
  private prisma: PrismaClient;
  private authService: AuthService;
  private saltRounds = 10;

  constructor() {
    this.prisma = new PrismaClient();
    this.authService = new AuthService();
  }

  async seed() {
    console.log('🌱 Starting Auth Seeder...');

    await this.createAdmins();
    await this.createCustomers();
    await this.createVendors();
    await this.createDrivers();

    console.log('✅ Auth Seeding completed!');
  }

  private async createAdmins() {
    console.log('Creating admin accounts...');

    const adminUsers = [
      {
        email: 'superadmin@damps.com',
        phone: '+2347001234567',
        password: 'SuperAdmin123!',
        firstName: 'Super',
        lastName: 'Admin',
        permissionLevel: AdminPermission.SUPER_ADMIN
      },
      {
        email: 'admin@damps.com',
        phone: '+2347012345678',
        password: 'Admin123!',
        firstName: 'Standard',
        lastName: 'Admin',
        permissionLevel: AdminPermission.STANDARD
      }
    ];

    for (const adminData of adminUsers) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: adminData.email },
            { phone: adminData.phone }
          ]
        }
      });

      if (!existingUser) {
        // Create user
        const hashedPassword = await bcryptjs.hash(adminData.password, this.saltRounds);
        
        const user = await this.prisma.user.create({
          data: {
            email: adminData.email,
            phone: adminData.phone,
            password: hashedPassword,
            role: UserRole.ADMIN,
            lastLogin: new Date()
          }
        });

        // Create admin profile
        await this.prisma.admin.create({
          data: {
            userId: user.id,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            permissionLevel: adminData.permissionLevel
          }
        });

        console.log(`Created admin: ${adminData.email}`);
      } else {
        console.log(`Admin ${adminData.email} already exists, skipping...`);
      }
    }
  }

  private async createCustomers() {
    console.log('Creating customer accounts...');

    const customers = [
      {
        email: 'john@example.com',
        phone: '+2347023456789',
        password: 'Customer123!',
        firstName: 'John',
        lastName: 'Doe',
        profileImage: 'https://randomuser.me/api/portraits/men/1.jpg'
      },
      {
        email: 'jane@example.com',
        phone: '+2347034567890',
        password: 'Customer123!',
        firstName: 'Jane',
        lastName: 'Smith',
        profileImage: 'https://randomuser.me/api/portraits/women/1.jpg'
      },
      {
        email: 'michael@example.com',
        phone: '+2347045678901',
        password: 'Customer123!',
        firstName: 'Michael',
        lastName: 'Johnson',
        profileImage: 'https://randomuser.me/api/portraits/men/2.jpg'
      }
    ];

    for (const customerData of customers) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: customerData.email },
            { phone: customerData.phone }
          ]
        }
      });

      if (!existingUser) {
        try {
          // Use the auth service to create customers properly
          await this.authService.registerCustomer({
            email: customerData.email,
            phone: customerData.phone,
            password: customerData.password,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            profileImage: customerData.profileImage,
            role: UserRole.CUSTOMER
          });
          
          console.log(`Created customer: ${customerData.email}`);
          
          // Create sample vehicle for the first customer
          if (customerData.email === 'john@example.com') {
            const customer = await this.prisma.customer.findFirst({
              where: {
                user: {
                  email: customerData.email
                }
              }
            });
            
            if (customer) {
              await this.prisma.vehicle.create({
                data: {
                  customerId: customer.id,
                  make: 'Toyota',
                  model: 'Camry',
                  year: 2019,
                  licensePlate: 'ABC123',
                  engineType: 'Petrol',
                  transmissionType: 'Automatic',
                  isDefault: true
                }
              });
              
              // Create a second vehicle
              await this.prisma.vehicle.create({
                data: {
                  customerId: customer.id,
                  make: 'Honda',
                  model: 'Civic',
                  year: 2020,
                  licensePlate: 'XYZ789',
                  engineType: 'Hybrid',
                  transmissionType: 'CVT'
                }
              });
              
              // Create address
              await this.prisma.address.create({
                data: {
                  customerId: customer.id,
                  name: 'Home',
                  street: '123 Main Street',
                  city: 'Lagos',
                  state: 'Lagos State',
                  country: 'Nigeria',
                  postalCode: '100001',
                  latitude: 6.5244,
                  longitude: 3.3792,
                  isDefault: true,
                  phoneNumber: customerData.phone
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error creating customer ${customerData.email}:`, error);
        }
      } else {
        console.log(`Customer ${customerData.email} already exists, skipping...`);
      }
    }
  }

  private async createVendors() {
    console.log('Creating vendor accounts...');

    const vendors = [
      {
        email: 'autoparts@example.com',
        phone: '+2347056789012',
        password: 'Vendor123!',
        businessName: 'AutoParts Plus',
        businessLogo: 'https://placehold.co/400x400?text=AutoParts+Plus',
        businessDescription: 'Quality auto parts for all vehicle makes and models',
        address: '456 Market Street',
        city: 'Lagos',
        state: 'Lagos State',
        country: 'Nigeria',
        postalCode: '100002',
        operatingHours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '09:00', close: '14:00' },
          sunday: { open: 'closed', close: 'closed' }
        },
        specializations: ['Engine Parts', 'Brake Systems', 'Electrical Components'],
        certifications: ['ISO 9001', 'Automotive Service Excellence']
      },
      {
        email: 'premiumparts@example.com',
        phone: '+2347067890123',
        password: 'Vendor123!',
        businessName: 'Premium Parts Ltd',
        businessLogo: 'https://placehold.co/400x400?text=Premium+Parts',
        businessDescription: 'Specialized in luxury and high-performance vehicle parts',
        address: '789 Commerce Avenue',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        postalCode: '900001',
        operatingHours: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
          saturday: { open: '10:00', close: '15:00' },
          sunday: { open: 'closed', close: 'closed' }
        },
        specializations: ['Performance Parts', 'Luxury Vehicles', 'Imported Parts'],
        certifications: ['Certified Luxury Automotive Specialist']
      }
    ];

    for (const vendorData of vendors) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: vendorData.email },
            { phone: vendorData.phone }
          ]
        }
      });

      if (!existingUser) {
        try {
          // Use the auth service to create vendors properly
          await this.authService.registerVendor({
            email: vendorData.email,
            phone: vendorData.phone,
            password: vendorData.password,
            businessName: vendorData.businessName,
            businessLogo: vendorData.businessLogo,
            businessDescription: vendorData.businessDescription,
            phoneNumber: vendorData.phone,
            address: vendorData.address,
            city: vendorData.city,
            state: vendorData.state,
            country: vendorData.country,
            postalCode: vendorData.postalCode,
            operatingHours: vendorData.operatingHours,
            specializations: vendorData.specializations,
            certifications: vendorData.certifications,
            role: UserRole.VENDOR
          });
          
          // For the first vendor, set them as verified
          if (vendorData.email === 'autoparts@example.com') {
            const vendor = await this.prisma.vendor.findFirst({
              where: {
                user: {
                  email: vendorData.email
                }
              }
            });
            
            if (vendor) {
              await this.prisma.vendor.update({
                where: { id: vendor.id },
                data: { isVerified: true }
              });
            }
          }
          
          console.log(`Created vendor: ${vendorData.email}`);
        } catch (error) {
          console.error(`Error creating vendor ${vendorData.email}:`, error);
        }
      } else {
        console.log(`Vendor ${vendorData.email} already exists, skipping...`);
      }
    }
  }

  private async createDrivers() {
    console.log('Creating driver accounts...');

    const drivers = [
      {
        email: 'driver1@example.com',
        phone: '+2347078901234',
        password: 'Driver123!',
        firstName: 'David',
        lastName: 'Wilson',
        profileImage: 'https://randomuser.me/api/portraits/men/30.jpg',
        vehicleType: 'Motorcycle',
        vehicleColor: 'Red',
        licensePlate: 'DRV123',
        drivingLicense: 'DL12345678',
        insuranceDocument: 'https://example.com/insurance1.pdf',
        identificationDoc: 'https://example.com/id1.pdf'
      },
      {
        email: 'driver2@example.com',
        phone: '+2347089012345',
        password: 'Driver123!',
        firstName: 'Sarah',
        lastName: 'Brown',
        profileImage: 'https://randomuser.me/api/portraits/women/30.jpg',
        vehicleType: 'Car',
        vehicleColor: 'Blue',
        licensePlate: 'DRV456',
        drivingLicense: 'DL87654321',
        insuranceDocument: 'https://example.com/insurance2.pdf',
        identificationDoc: 'https://example.com/id2.pdf'
      }
    ];

    for (const driverData of drivers) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: driverData.email },
            { phone: driverData.phone }
          ]
        }
      });

      if (!existingUser) {
        try {
          // Use the auth service to create drivers properly
          await this.authService.registerDriver({
            email: driverData.email,
            phone: driverData.phone,
            password: driverData.password,
            firstName: driverData.firstName,
            lastName: driverData.lastName,
            phoneNumber: driverData.phone,
            profileImage: driverData.profileImage,
            vehicleType: driverData.vehicleType,
            vehicleColor: driverData.vehicleColor,
            licensePlate: driverData.licensePlate,
            drivingLicense: driverData.drivingLicense,
            insuranceDocument: driverData.insuranceDocument,
            identificationDoc: driverData.identificationDoc,
            role: UserRole.DRIVER
          });
          
          // Verify the first driver
          if (driverData.email === 'driver1@example.com') {
            const driver = await this.prisma.driver.findFirst({
              where: {
                user: {
                  email: driverData.email
                }
              }
            });
            
            if (driver) {
              await this.prisma.driver.update({
                where: { id: driver.id },
                data: { 
                  isVerified: true,
                  rating: 4.8,
                  totalRatings: 25
                }
              });
            }
          }
          
          console.log(`Created driver: ${driverData.email}`);
        } catch (error) {
          console.error(`Error creating driver ${driverData.email}:`, error);
        }
      } else {
        console.log(`Driver ${driverData.email} already exists, skipping...`);
      }
    }
  }

  async cleanDatabase() {
    console.log('Cleaning existing auth data...');
    
    // Delete data in reverse order of dependencies
    await this.prisma.vehicle.deleteMany({});
    await this.prisma.address.deleteMany({});
    await this.prisma.customer.deleteMany({});
    await this.prisma.vendor.deleteMany({});
    await this.prisma.driver.deleteMany({});
    await this.prisma.admin.deleteMany({});
    await this.prisma.deviceToken.deleteMany({});
    await this.prisma.user.deleteMany({});
    
    console.log('Database cleaned.');
  }
}

// For direct execution (e.g., node -r ts-node/register src/seeders/auth.seeder.ts)
if (require.main === module) {
  const seeder = new AuthSeeder();
  
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

export default new AuthSeeder();