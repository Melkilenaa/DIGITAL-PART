import { PrismaClient, Vehicle } from '@prisma/client';

interface VehicleDto {
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate?: string;
  engineType?: string;
  transmissionType?: string;
  additionalDetails?: any;
  isDefault?: boolean;
}

export class VehicleService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all vehicles for a customer
   */
  async getAllVehicles(userId: string): Promise<Vehicle[]> {
    const customer = await this.validateCustomer(userId);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { customerId: customer.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return vehicles;
  }

  /**
   * Get a specific vehicle by ID
   */
  async getVehicleById(userId: string, vehicleId: string): Promise<Vehicle> {
    const customer = await this.validateCustomer(userId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return vehicle;
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(userId: string, vehicleData: VehicleDto): Promise<Vehicle> {
    const customer = await this.validateCustomer(userId);

    // Validate required fields
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
      throw new Error('Make, model, and year are required');
    }

    // If setting as default, unset all other defaults
    if (vehicleData.isDefault) {
      await this.prisma.vehicle.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    } else {
      // If this is the first vehicle, make it default automatically
      const vehicleCount = await this.prisma.vehicle.count({
        where: { customerId: customer.id }
      });

      if (vehicleCount === 0) {
        vehicleData.isDefault = true;
      }
    }

    // Create new vehicle
    const newVehicle = await this.prisma.vehicle.create({
      data: {
        customerId: customer.id,
        make: vehicleData.make,
        model: vehicleData.model,
        year: vehicleData.year,
        vin: vehicleData.vin,
        licensePlate: vehicleData.licensePlate,
        engineType: vehicleData.engineType,
        transmissionType: vehicleData.transmissionType,
        additionalDetails: vehicleData.additionalDetails,
        isDefault: vehicleData.isDefault || false
      }
    });

    await this.logActivity(
      userId,
      'VEHICLE_CREATED',
      `Added new vehicle: ${vehicleData.make} ${vehicleData.model} (${vehicleData.year})`,
      { vehicleId: newVehicle.id }
    );

    return newVehicle;
  }

  /**
   * Update an existing vehicle
   */
  async updateVehicle(userId: string, vehicleId: string, vehicleData: Partial<VehicleDto>): Promise<Vehicle> {
    const customer = await this.validateCustomer(userId);

    // Verify the vehicle exists and belongs to this customer
    const existingVehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!existingVehicle) {
      throw new Error('Vehicle not found');
    }

    // If setting as default, unset all other defaults
    if (vehicleData.isDefault) {
      await this.prisma.vehicle.updateMany({
        where: {
          customerId: customer.id,
          id: { not: vehicleId }
        },
        data: { isDefault: false }
      });
    }

    // Update the vehicle
    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: vehicleData
    });

    await this.logActivity(
      userId,
      'VEHICLE_UPDATED',
      `Updated vehicle: ${existingVehicle.make} ${existingVehicle.model} (${existingVehicle.year})`,
      { vehicleId }
    );

    return updatedVehicle;
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(userId: string, vehicleId: string): Promise<void> {
    const customer = await this.validateCustomer(userId);

    // Verify the vehicle exists and belongs to this customer
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Delete the vehicle
    await this.prisma.vehicle.delete({
      where: { id: vehicleId }
    });

    // If this was the default vehicle, set another one as default
    if (vehicle.isDefault) {
      const nextVehicle = await this.prisma.vehicle.findFirst({
        where: { customerId: customer.id }
      });

      if (nextVehicle) {
        await this.prisma.vehicle.update({
          where: { id: nextVehicle.id },
          data: { isDefault: true }
        });
      }
    }

    await this.logActivity(
      userId,
      'VEHICLE_DELETED',
      `Deleted vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.year})`,
      { vehicleId }
    );
  }

  /**
   * Set a vehicle as default
   */
  async setDefaultVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    const customer = await this.validateCustomer(userId);

    // Verify the vehicle exists and belongs to this customer
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Unset all defaults first
    await this.prisma.vehicle.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false }
    });

    // Set the new default
    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isDefault: true }
    });

    await this.logActivity(
      userId,
      'VEHICLE_SET_DEFAULT',
      `Set vehicle as default: ${vehicle.make} ${vehicle.model} (${vehicle.year})`,
      { vehicleId }
    );

    return updatedVehicle;
  }

  /**
   * Get the default vehicle for a customer
   */
  async getDefaultVehicle(userId: string): Promise<Vehicle | null> {
    const customer = await this.validateCustomer(userId);

    const defaultVehicle = await this.prisma.vehicle.findFirst({
      where: {
        customerId: customer.id,
        isDefault: true
      }
    });

    return defaultVehicle;
  }

  /**
   * Find compatible parts for a specific vehicle
   */
  async findCompatibleParts(userId: string, vehicleId: string, categoryId?: string, limit: number = 20): Promise<any[]> {
    const customer = await this.validateCustomer(userId);

    // Verify the vehicle exists and belongs to this customer
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Build query to find compatible parts
    const queryConditions: any = {
      compatibleVehicles: {
        path: '$',
        array_contains: [{ make: vehicle.make, model: vehicle.model, year: vehicle.year }]
      },
      isActive: true
    };

    // Add category filter if provided
    if (categoryId) {
      queryConditions.categoryId = categoryId;
    }

    // Find compatible parts
    const compatibleParts = await this.prisma.part.findMany({
      where: queryConditions,
      include: {
        vendor: {
          select: {
            businessName: true,
            businessLogo: true,
            rating: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { 
          vendor: {
            rating: 'desc'
          }
        },
        { price: 'asc' }
      ],
      take: limit
    });

    return compatibleParts;
  }

  /**
   * Get maintenance recommendations based on vehicle age and type
   */
  async getMaintenanceRecommendations(userId: string, vehicleId: string): Promise<any> {
    const customer = await this.validateCustomer(userId);

    // Verify the vehicle exists and belongs to this customer
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        customerId: customer.id
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // Calculate vehicle age
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - vehicle.year;

    // Generate recommendations based on vehicle age
    // Note: In a real app, this would be based on more sophisticated logic or database
    const recommendations: any = {
      serviceDue: [],
      scheduledMaintenance: [],
      inspectionItems: []
    };

    // Basic recommendations for all vehicles
    recommendations.inspectionItems.push(
      { item: 'Check tire pressure and condition', interval: 'Monthly' },
      { item: 'Check all fluid levels', interval: 'Monthly' },
      { item: 'Check lights and signals', interval: 'Monthly' }
    );

    // Age-based recommendations
    if (vehicleAge < 3) {
      // Newer vehicles
      recommendations.serviceDue.push(
        { item: 'Engine oil and filter change', interval: 'Every 5,000 - 7,500 miles' },
        { item: 'Tire rotation', interval: 'Every 5,000 - 8,000 miles' }
      );
      recommendations.scheduledMaintenance.push(
        { item: 'Cabin air filter replacement', interval: 'Every 15,000 - 30,000 miles' },
        { item: 'Air filter replacement', interval: 'Every 15,000 - 30,000 miles' }
      );
    } else if (vehicleAge < 6) {
      // Middle-aged vehicles
      recommendations.serviceDue.push(
        { item: 'Engine oil and filter change', interval: 'Every 5,000 miles' },
        { item: 'Tire rotation', interval: 'Every 5,000 miles' },
        { item: 'Brake fluid check', interval: 'Every 20,000 miles' }
      );
      recommendations.scheduledMaintenance.push(
        { item: 'Cabin air filter replacement', interval: 'Every 15,000 miles' },
        { item: 'Air filter replacement', interval: 'Every 15,000 miles' },
        { item: 'Brake pads inspection', interval: 'Every 20,000 miles' },
        { item: 'Battery check', interval: 'Every 20,000 miles' }
      );
    } else {
      // Older vehicles
      recommendations.serviceDue.push(
        { item: 'Engine oil and filter change', interval: 'Every 3,000 - 5,000 miles' },
        { item: 'Tire rotation', interval: 'Every 5,000 miles' },
        { item: 'Brake fluid check', interval: 'Every 15,000 miles' },
        { item: 'Transmission fluid check', interval: 'Every 30,000 miles' }
      );
      recommendations.scheduledMaintenance.push(
        { item: 'Cabin air filter replacement', interval: 'Every 15,000 miles' },
        { item: 'Air filter replacement', interval: 'Every 15,000 miles' },
        { item: 'Brake pads inspection', interval: 'Every 15,000 miles' },
        { item: 'Battery replacement', interval: 'Every 4-5 years' },
        { item: 'Spark plugs replacement', interval: 'Every 60,000 - 100,000 miles' },
        { item: 'Timing belt inspection', interval: 'Every 60,000 - 90,000 miles' }
      );
    }

    return {
      vehicle: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        age: vehicleAge
      },
      recommendations
    };
  }

  /**
   * Helper method to validate customer exists
   */
  private async validateCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId }
    });

    if (!customer) {
      throw new Error('Customer profile not found');
    }

    return customer;
  }

  /**
   * Log user activity
   */
  private async logActivity(userId: string, action: string, description: string, details?: any) {
    try {
      await this.prisma.systemLog.create({
        data: {
          action,
          entityType: 'Vehicle',
          entityId: details?.vehicleId,
          performedById: userId,
          details: { description, ...details }
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

export default new VehicleService();