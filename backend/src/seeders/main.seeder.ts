import authSeeder from './auth.seeder';
// Import other seeders as needed

async function runSeeders() {
  console.log('🚀 Starting database seeding...');
  
  // Set this to true if you want to clean the database before seeding
  const shouldClean = process.argv.includes('--clean');
  
  try {
    if (shouldClean) {
      console.log('Cleaning database before seeding...');
      await authSeeder.cleanDatabase();
      // Add other cleaners here
    }
    
    // Run seeders in the right order (considering dependencies)
    await authSeeder.seed();
    // Add other seeders here
    
    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeders
runSeeders();