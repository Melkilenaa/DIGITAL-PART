import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Base categories with no parent
const mainCategories = [
  {
    id: uuidv4(),
    name: 'Engine Parts',
    description: 'Components for the engine system including blocks, pistons, and related parts',
    image: 'https://example.com/images/categories/engine.jpg',
    commissionRate: 10.0
  },
  {
    id: uuidv4(),
    name: 'Transmission',
    description: 'Manual and automatic transmission components and assemblies',
    image: 'https://example.com/images/categories/transmission.jpg',
    commissionRate: 9.5
  },
  {
    id: uuidv4(),
    name: 'Brake System',
    description: 'All brake system components including pads, rotors, and calipers',
    image: 'https://example.com/images/categories/brakes.jpg',
    commissionRate: 8.5
  },
  {
    id: uuidv4(),
    name: 'Suspension & Steering',
    description: 'Suspension and steering components including shocks, struts and control arms',
    image: 'https://example.com/images/categories/suspension.jpg',
    commissionRate: 8.0
  },
  {
    id: uuidv4(),
    name: 'Electrical System',
    description: 'Components related to the electrical system including starters and alternators',
    image: 'https://example.com/images/categories/electrical.jpg',
    commissionRate: 11.0
  },
  {
    id: uuidv4(),
    name: 'Body Parts',
    description: 'External body components including panels, bumpers, and mirrors',
    image: 'https://example.com/images/categories/body.jpg',
    commissionRate: 7.5
  },
  {
    id: uuidv4(),
    name: 'Interior',
    description: 'Interior components including seats, dashboards, and trim pieces',
    image: 'https://example.com/images/categories/interior.jpg',
    commissionRate: 7.0
  },
  {
    id: uuidv4(),
    name: 'Heating & Cooling',
    description: 'Components for climate control including radiators and air conditioning',
    image: 'https://example.com/images/categories/cooling.jpg',
    commissionRate: 9.0
  },
  {
    id: uuidv4(),
    name: 'Filters & Fluids',
    description: 'Replacement filters and automotive fluids',
    image: 'https://example.com/images/categories/filters.jpg',
    commissionRate: 12.0
  }
];

// Subcategory definitions
const subCategories = [
  // Engine Parts subcategories
  {
    id: uuidv4(),
    name: 'Engine Blocks & Components',
    description: 'Core engine components including blocks, cranks, and pistons',
    image: 'https://example.com/images/categories/engine-blocks.jpg',
    commissionRate: 9.5,
    parentCategory: 'Engine Parts'
  },
  {
    id: uuidv4(),
    name: 'Camshafts & Valvetrain',
    description: 'Valve control components including camshafts, lifters, and rockers',
    image: 'https://example.com/images/categories/camshafts.jpg',
    commissionRate: 10.0,
    parentCategory: 'Engine Parts'
  },
  {
    id: uuidv4(),
    name: 'Timing Components',
    description: 'Timing belts, chains, and related components',
    image: 'https://example.com/images/categories/timing.jpg',
    commissionRate: 10.5,
    parentCategory: 'Engine Parts'
  },
  
  // Transmission subcategories
  {
    id: uuidv4(),
    name: 'Automatic Transmission',
    description: 'Components for automatic transmission systems',
    image: 'https://example.com/images/categories/auto-transmission.jpg',
    commissionRate: 9.0,
    parentCategory: 'Transmission'
  },
  {
    id: uuidv4(),
    name: 'Manual Transmission',
    description: 'Components for manual transmission systems',
    image: 'https://example.com/images/categories/manual-transmission.jpg',
    commissionRate: 9.0,
    parentCategory: 'Transmission'
  },
  {
    id: uuidv4(),
    name: 'Clutch Components',
    description: 'Clutch discs, pressure plates, and related parts',
    image: 'https://example.com/images/categories/clutch.jpg',
    commissionRate: 8.5,
    parentCategory: 'Transmission'
  },
  
  // Brake System subcategories
  {
    id: uuidv4(),
    name: 'Brake Pads & Shoes',
    description: 'Replacement brake pads and shoes for all vehicle types',
    image: 'https://example.com/images/categories/brake-pads.jpg',
    commissionRate: 8.0,
    parentCategory: 'Brake System'
  },
  {
    id: uuidv4(),
    name: 'Rotors & Drums',
    description: 'Brake rotors and drums for disc and drum brake systems',
    image: 'https://example.com/images/categories/rotors.jpg',
    commissionRate: 8.0,
    parentCategory: 'Brake System'
  },
  {
    id: uuidv4(),
    name: 'Calipers & Hydraulics',
    description: 'Brake calipers, master cylinders, and hydraulic components',
    image: 'https://example.com/images/categories/calipers.jpg',
    commissionRate: 9.0,
    parentCategory: 'Brake System'
  },
  
  // Suspension & Steering subcategories
  {
    id: uuidv4(),
    name: 'Shocks & Struts',
    description: 'Shock absorbers and strut assemblies',
    image: 'https://example.com/images/categories/shocks.jpg',
    commissionRate: 7.5,
    parentCategory: 'Suspension & Steering'
  },
  {
    id: uuidv4(),
    name: 'Control Arms & Parts',
    description: 'Control arms, ball joints, and bushings',
    image: 'https://example.com/images/categories/control-arms.jpg',
    commissionRate: 7.0,
    parentCategory: 'Suspension & Steering'
  },
  {
    id: uuidv4(),
    name: 'Steering Components',
    description: 'Steering racks, gears, and power steering parts',
    image: 'https://example.com/images/categories/steering.jpg',
    commissionRate: 8.0,
    parentCategory: 'Suspension & Steering'
  },
  
  // Electrical System subcategories
  {
    id: uuidv4(),
    name: 'Starters & Alternators',
    description: 'Starting and charging system components',
    image: 'https://example.com/images/categories/starters.jpg',
    commissionRate: 10.0,
    parentCategory: 'Electrical System'
  },
  {
    id: uuidv4(),
    name: 'Sensors & Switches',
    description: 'Engine and transmission sensors and electrical switches',
    image: 'https://example.com/images/categories/sensors.jpg',
    commissionRate: 12.0,
    parentCategory: 'Electrical System'
  },
  {
    id: uuidv4(),
    name: 'Lighting',
    description: 'Headlights, taillights, and other lighting components',
    image: 'https://example.com/images/categories/lighting.jpg',
    commissionRate: 9.0,
    parentCategory: 'Electrical System'
  }
];

// Third-level category definitions
const thirdLevelCategories = [
  // Engine Blocks & Components subcategories
  {
    id: uuidv4(),
    name: 'Pistons & Rings',
    description: 'Pistons, piston rings, and related components',
    image: 'https://example.com/images/categories/pistons.jpg',
    commissionRate: 9.0,
    parentCategory: 'Engine Blocks & Components'
  },
  {
    id: uuidv4(),
    name: 'Crankshafts & Bearings',
    description: 'Crankshafts and engine bearings',
    image: 'https://example.com/images/categories/crankshafts.jpg',
    commissionRate: 9.5,
    parentCategory: 'Engine Blocks & Components'
  },
  
  // Brake Pads & Shoes subcategories
  {
    id: uuidv4(),
    name: 'Ceramic Brake Pads',
    description: 'High-quality ceramic compound brake pads',
    image: 'https://example.com/images/categories/ceramic-pads.jpg',
    commissionRate: 7.5,
    parentCategory: 'Brake Pads & Shoes'
  },
  {
    id: uuidv4(),
    name: 'Metallic Brake Pads',
    description: 'Semi-metallic and metallic compound brake pads',
    image: 'https://example.com/images/categories/metallic-pads.jpg',
    commissionRate: 7.5,
    parentCategory: 'Brake Pads & Shoes'
  }
];

/**
 * Seeds the database with categories
 */
export async function seedCategories() {
  console.log('Starting category seeding...');
  
  // Create a map to store category name to ID mappings
  const categoryMap = new Map<string, string>();
  
  // Insert main categories first
  for (const category of mainCategories) {
    try {
      const createdCategory = await prisma.category.upsert({
        where: { name: category.name },
        update: {
          description: category.description,
          image: category.image,
          commissionRate: category.commissionRate
        },
        create: {
          id: category.id,
          name: category.name,
          description: category.description,
          image: category.image,
          commissionRate: category.commissionRate
        }
      });
      
      categoryMap.set(category.name, createdCategory.id);
      console.log(`Created/updated main category: ${category.name}`);
    } catch (error) {
      console.error(`Error creating main category ${category.name}:`, error);
    }
  }
  
  // Insert subcategories
  for (const subCategory of subCategories) {
    try {
      const parentId = categoryMap.get(subCategory.parentCategory);
      
      if (!parentId) {
        console.error(`Parent category "${subCategory.parentCategory}" not found for "${subCategory.name}"`);
        continue;
      }
      
      const createdSubCategory = await prisma.category.upsert({
        where: { name: subCategory.name },
        update: {
          description: subCategory.description,
          image: subCategory.image,
          commissionRate: subCategory.commissionRate,
          parentId: parentId
        },
        create: {
          id: subCategory.id,
          name: subCategory.name,
          description: subCategory.description,
          image: subCategory.image,
          commissionRate: subCategory.commissionRate,
          parentId: parentId
        }
      });
      
      categoryMap.set(subCategory.name, createdSubCategory.id);
      console.log(`Created/updated subcategory: ${subCategory.name}`);
    } catch (error) {
      console.error(`Error creating subcategory ${subCategory.name}:`, error);
    }
  }
  
  // Insert third-level categories
  for (const thirdCategory of thirdLevelCategories) {
    try {
      const parentId = categoryMap.get(thirdCategory.parentCategory);
      
      if (!parentId) {
        console.error(`Parent category "${thirdCategory.parentCategory}" not found for "${thirdCategory.name}"`);
        continue;
      }
      
      const createdThirdCategory = await prisma.category.upsert({
        where: { name: thirdCategory.name },
        update: {
          description: thirdCategory.description,
          image: thirdCategory.image,
          commissionRate: thirdCategory.commissionRate,
          parentId: parentId
        },
        create: {
          id: thirdCategory.id,
          name: thirdCategory.name,
          description: thirdCategory.description,
          image: thirdCategory.image,
          commissionRate: thirdCategory.commissionRate,
          parentId: parentId
        }
      });
      
      categoryMap.set(thirdCategory.name, createdThirdCategory.id);
      console.log(`Created/updated third-level category: ${thirdCategory.name}`);
    } catch (error) {
      console.error(`Error creating third-level category ${thirdCategory.name}:`, error);
    }
  }
  
  console.log('Category seeding completed successfully!');
  
  // Return the category map for use in other seeders
  return categoryMap;
}

// Run the seeder if this file is executed directly
if (require.main === module) {
  seedCategories()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}