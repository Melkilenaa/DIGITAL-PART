import { PrismaClient, PartCondition } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { seedCategories } from './category.seeder';

const prisma = new PrismaClient();

/**
 * Seed the database with sample parts
 */
export async function seedParts() {
  console.log('Starting part seeding...');

  // Ensure categories exist first and get the category map
  let categoryMap: Map<string, string>;
  try {
    categoryMap = await seedCategories();
  } catch (error) {
    console.error('Failed to seed categories:', error);
    throw error;
  }

  // Get or create a default vendor
  let defaultVendor = await prisma.vendor.findFirst({
    where: { businessName: 'AutoParts Supplier' }
  });

  if (!defaultVendor) {
    // Create a default vendor if none exists
    defaultVendor = await prisma.vendor.create({
      data: {
        businessName: 'AutoParts Supplier',
        businessDescription: 'A primary supplier of quality auto parts',
        businessLogo: 'https://example.com/vendors/autoparts-supplier-logo.jpg',
        address: '123 Parts Avenue',
        city: 'Partsville',
        state: 'PA',
        postalCode: '12345',
        country: 'USA',
        phoneNumber: '000-000-0000',
        operatingHours: '9AM - 5PM',
        rating: 4.8,
        totalRatings: 230,
        isVerified: true,
        user: {
          create: {
            email: 'vendor@autoparts-supplier.com',
            password: '$2b$10$yRlGQhh/vKmBNKHM/nQT7.adlHXcPYrGd8BPXAtf8D3VXr9U2AjuK', // hashed 'password123'
            role: 'VENDOR'
          }
        }
      }
    });
    console.log('Created default vendor:', defaultVendor.businessName);
  }

  // Define parts to seed
  const parts = [
    // Brake Pads & Shoes category
    {
      name: 'Premium Ceramic Brake Pads for Toyota Camry (2018-2022)',
      description: 'High-quality ceramic brake pads with extended wear life and low dust. Includes wear indicators and anti-noise shims.',
      partNumber: 'BP-TC-18-22',
      barcode: '9781234567897',
      price: 79.99,
      discountedPrice: 69.99,
      condition: PartCondition.NEW,
      brand: 'BrakeMaster',
      images: [
        'https://example.com/images/parts/brake-pads-toyota-1.jpg',
        'https://example.com/images/parts/brake-pads-toyota-2.jpg'
      ],
      stockQuantity: 45,
      lowStockAlert: 10,
      specifications: {
        material: 'Ceramic',
        position: 'Front',
        warranty: '24 months or 24,000 miles',
        fitment: 'Direct OEM replacement',
        includes: 'Hardware kit, lubricant'
      },
      compatibleVehicles: [
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2018,
          makeModel: 'Toyota|Camry',
          makeModelYear: 'Toyota|Camry|2018'
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2019,
          makeModel: 'Toyota|Camry',
          makeModelYear: 'Toyota|Camry|2019'
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          makeModel: 'Toyota|Camry',
          makeModelYear: 'Toyota|Camry|2020'
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          makeModel: 'Toyota|Camry',
          makeModelYear: 'Toyota|Camry|2021'
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2022,
          makeModel: 'Toyota|Camry',
          makeModelYear: 'Toyota|Camry|2022'
        }
      ],
      weight: 2.8,
      dimensions: '15.2 x 7.6 x 3.8 cm',
      categoryName: 'Ceramic Brake Pads',
      tags: ['brake', 'ceramic', 'toyota', 'camry', 'front']
    },
    {
      name: 'Metallic Brake Pads for Honda Accord (2016-2020)',
      description: 'Semi-metallic brake pads designed for optimal stopping power and heat dissipation. Perfect for performance driving.',
      partNumber: 'BP-HA-16-20',
      barcode: '9781234567903',
      price: 64.99,
      condition: PartCondition.NEW,
      brand: 'BrakeMaster',
      images: [
        'https://example.com/images/parts/brake-pads-honda-1.jpg',
        'https://example.com/images/parts/brake-pads-honda-2.jpg'
      ],
      stockQuantity: 32,
      lowStockAlert: 8,
      specifications: {
        material: 'Semi-metallic',
        position: 'Front',
        warranty: '18 months or 18,000 miles',
        fitment: 'Direct OEM replacement',
        includes: 'Hardware kit'
      },
      compatibleVehicles: [
        {
          make: 'Honda',
          model: 'Accord',
          year: 2016,
          makeModel: 'Honda|Accord',
          makeModelYear: 'Honda|Accord|2016'
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2017,
          makeModel: 'Honda|Accord',
          makeModelYear: 'Honda|Accord|2017'
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2018,
          makeModel: 'Honda|Accord',
          makeModelYear: 'Honda|Accord|2018'
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2019,
          makeModel: 'Honda|Accord',
          makeModelYear: 'Honda|Accord|2019'
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          makeModel: 'Honda|Accord',
          makeModelYear: 'Honda|Accord|2020'
        }
      ],
      weight: 3.1,
      dimensions: '15.4 x 7.8 x 3.9 cm',
      categoryName: 'Metallic Brake Pads',
      tags: ['brake', 'metallic', 'honda', 'accord', 'front']
    },
    
    // Engine Parts category
    {
      name: 'OEM Piston Ring Set for Ford F-150 5.0L V8',
      description: 'Genuine OEM piston ring set for Ford 5.0L Coyote V8 engines. Standard size, complete set for all cylinders.',
      partNumber: 'PR-FF150-50',
      barcode: '9781234567910',
      price: 189.99,
      condition: PartCondition.NEW,
      brand: 'Ford Motorcraft',
      images: [
        'https://example.com/images/parts/piston-rings-ford-1.jpg',
        'https://example.com/images/parts/piston-rings-ford-2.jpg'
      ],
      stockQuantity: 18,
      lowStockAlert: 5,
      specifications: {
        material: 'Steel alloy with moly coating',
        fitment: 'OEM standard',
        size: 'Standard bore',
        includes: 'Complete 8-cylinder set',
        warranty: '12 months'
      },
      compatibleVehicles: [
        {
          make: 'Ford',
          model: 'F-150',
          year: 2018,
          makeModel: 'Ford|F-150',
          makeModelYear: 'Ford|F-150|2018',
          engineSize: '5.0L V8'
        },
        {
          make: 'Ford',
          model: 'F-150',
          year: 2019,
          makeModel: 'Ford|F-150',
          makeModelYear: 'Ford|F-150|2019',
          engineSize: '5.0L V8'
        },
        {
          make: 'Ford',
          model: 'F-150',
          year: 2020,
          makeModel: 'Ford|F-150',
          makeModelYear: 'Ford|F-150|2020',
          engineSize: '5.0L V8'
        },
        {
          make: 'Ford',
          model: 'Mustang GT',
          year: 2018,
          makeModel: 'Ford|Mustang GT',
          makeModelYear: 'Ford|Mustang GT|2018',
          engineSize: '5.0L V8'
        },
        {
          make: 'Ford',
          model: 'Mustang GT',
          year: 2019,
          makeModel: 'Ford|Mustang GT',
          makeModelYear: 'Ford|Mustang GT|2019',
          engineSize: '5.0L V8'
        }
      ],
      weight: 0.9,
      dimensions: '30.5 x 15.2 x 5.1 cm',
      categoryName: 'Pistons & Rings',
      tags: ['engine', 'piston', 'piston rings', 'ford', 'f-150', 'mustang', 'coyote', '5.0L']
    },
    
    // Suspension category
    {
      name: 'Performance Front Struts for Subaru WRX (2015-2021)',
      description: 'High-performance front struts for Subaru WRX models. Provides improved handling and stability with adjustable damping.',
      partNumber: 'FS-SWRX-15-21',
      barcode: '9781234567927',
      price: 349.99,
      discountedPrice: 299.99,
      condition: PartCondition.NEW,
      brand: 'RideTech',
      images: [
        'https://example.com/images/parts/struts-subaru-1.jpg',
        'https://example.com/images/parts/struts-subaru-2.jpg'
      ],
      stockQuantity: 12,
      lowStockAlert: 4,
      specifications: {
        type: 'MacPherson strut',
        adjustable: 'Yes - 16 positions',
        spring: 'Progressive rate',
        construction: 'Aluminum body with steel internals',
        warranty: '36 months or 36,000 miles'
      },
      compatibleVehicles: [
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2015,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2015'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2016,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2016'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2017,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2017'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2018,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2018'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2019,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2019'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2020,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2020'
        },
        {
          make: 'Subaru',
          model: 'WRX',
          year: 2021,
          makeModel: 'Subaru|WRX',
          makeModelYear: 'Subaru|WRX|2021'
        }
      ],
      weight: 8.4,
      dimensions: '65.0 x 25.0 x 25.0 cm',
      categoryName: 'Shocks & Struts',
      tags: ['suspension', 'strut', 'performance', 'subaru', 'wrx', 'adjustable']
    },
    
    // Electrical category
    {
      name: 'Premium Alternator for Chevrolet Silverado 1500 (2014-2020)',
      description: 'High-output alternator with improved durability and charging capacity. Direct replacement for OEM unit.',
      partNumber: 'ALT-CS-14-20',
      barcode: '9781234567934',
      price: 249.99,
      condition: PartCondition.NEW,
      brand: 'PowerMax',
      images: [
        'https://example.com/images/parts/alternator-chevy-1.jpg',
        'https://example.com/images/parts/alternator-chevy-2.jpg'
      ],
      stockQuantity: 22,
      lowStockAlert: 6,
      specifications: {
        output: '220 Amp',
        voltage: '12V',
        pulley: '6-groove serpentine',
        mounting: 'Direct bolt-on',
        warranty: '24 months unlimited mileage'
      },
      compatibleVehicles: [
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2014,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2014'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2015,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2015'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2016,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2016'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2017,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2017'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2018,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2018'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2019,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2019'
        },
        {
          make: 'Chevrolet',
          model: 'Silverado 1500',
          year: 2020,
          makeModel: 'Chevrolet|Silverado 1500',
          makeModelYear: 'Chevrolet|Silverado 1500|2020'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2014,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2014'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2015,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2015'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2016,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2016'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2017,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2017'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2018,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2018'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2019,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2019'
        },
        {
          make: 'GMC',
          model: 'Sierra 1500',
          year: 2020,
          makeModel: 'GMC|Sierra 1500',
          makeModelYear: 'GMC|Sierra 1500|2020'
        }
      ],
      weight: 7.6,
      dimensions: '28.0 x 18.0 x 18.0 cm',
      categoryName: 'Starters & Alternators',
      tags: ['electrical', 'alternator', 'charging', 'chevrolet', 'silverado', 'gmc', 'sierra']
    }
  ];

  // Create or update parts
  for (const part of parts) {
    try {
      // Get category ID from name
      const categoryId = categoryMap.get(part.categoryName);
      
      if (!categoryId) {
        console.error(`Category "${part.categoryName}" not found for part "${part.name}"`);
        continue;
      }
      
      const existingPart = await prisma.part.findFirst({
        where: { partNumber: part.partNumber },
      });
      const partId = existingPart ? existingPart.id : uuidv4();
      await prisma.part.upsert({
        where: { id: partId },
        update: {
          name: part.name,
          description: part.description,
          price: part.price,
          discountedPrice: part.discountedPrice,
          condition: part.condition,
          brand: part.brand,
          images: part.images,
          stockQuantity: part.stockQuantity,
          lowStockAlert: part.lowStockAlert,
          specifications: part.specifications,
          compatibleVehicles: part.compatibleVehicles,
          weight: part.weight,
          dimensions: part.dimensions,
          tags: part.tags
        },
        create: {
          id: partId,
          name: part.name,
          description: part.description,
          partNumber: part.partNumber,
          barcode: part.barcode,
          price: part.price,
          discountedPrice: part.discountedPrice,
          condition: part.condition,
          brand: part.brand,
          images: part.images,
          stockQuantity: part.stockQuantity,
          lowStockAlert: part.lowStockAlert,
          specifications: part.specifications,
          compatibleVehicles: part.compatibleVehicles,
          weight: part.weight,
          dimensions: part.dimensions,
          categoryId: categoryId,
          vendorId: defaultVendor.id,
          tags: part.tags,
          isActive: true
        }
      });
      
      console.log(`Created/updated part: ${part.name}`);
    } catch (error) {
      console.error(`Error creating part ${part.name}:`, error);
    }
  }
  
  console.log('Part seeding completed successfully!');
}

// Run the seeder if this file is executed directly
if (require.main === module) {
  seedParts()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}