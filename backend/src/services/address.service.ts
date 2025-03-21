import { PrismaClient, Address } from '@prisma/client';

interface AddressDto {
  name: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  phoneNumber?: string;
  additionalInfo?: string;
}

export class AddressService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all addresses for a customer
   */
  async getAllAddresses(userId: string): Promise<Address[]> {
    const customer = await this.validateCustomer(userId);

    const addresses = await this.prisma.address.findMany({
      where: { customerId: customer.id },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    return addresses;
  }

  /**
   * Get a specific address by ID
   */
  async getAddressById(userId: string, addressId: string): Promise<Address> {
    const customer = await this.validateCustomer(userId);

    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      throw new Error('Address not found');
    }

    return address;
  }

  /**
   * Create a new address
   */
  async createAddress(userId: string, addressData: AddressDto): Promise<Address> {
    const customer = await this.validateCustomer(userId);

    // If setting as default, unset all other defaults
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    } else {
      // If this is the first address, make it default automatically
      const addressCount = await this.prisma.address.count({
        where: { customerId: customer.id }
      });

      if (addressCount === 0) {
        addressData.isDefault = true;
      }
    }

    // Create new address
    const newAddress = await this.prisma.address.create({
      data: {
        customerId: customer.id,
        name: addressData.name,
        street: addressData.street,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
        postalCode: addressData.postalCode,
        latitude: addressData.latitude,
        longitude: addressData.longitude,
        isDefault: addressData.isDefault || false,
        phoneNumber: addressData.phoneNumber,
        additionalInfo: addressData.additionalInfo
      }
    });

    await this.logActivity(
      userId,
      'ADDRESS_CREATED',
      `Added new address: ${addressData.name}`,
      { addressId: newAddress.id }
    );

    return newAddress;
  }

  /**
   * Update an existing address
   */
  async updateAddress(userId: string, addressId: string, addressData: Partial<AddressDto>): Promise<Address> {
    const customer = await this.validateCustomer(userId);

    // Verify the address exists and belongs to this customer
    const existingAddress = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: customer.id
      }
    });

    if (!existingAddress) {
      throw new Error('Address not found');
    }

    // If setting as default, unset all other defaults
    if (addressData.isDefault) {
      await this.prisma.address.updateMany({
        where: {
          customerId: customer.id,
          id: { not: addressId }
        },
        data: { isDefault: false }
      });
    }

    // Update the address
    const updatedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: addressData
    });

    await this.logActivity(
      userId,
      'ADDRESS_UPDATED',
      `Updated address: ${existingAddress.name}`,
      { addressId }
    );

    return updatedAddress;
  }

  /**
   * Delete an address
   */
  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const customer = await this.validateCustomer(userId);

    // Verify the address exists and belongs to this customer
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      throw new Error('Address not found');
    }

    // Delete the address
    await this.prisma.address.delete({
      where: { id: addressId }
    });

    // If this was the default address, set another one as default
    if (address.isDefault) {
      const nextAddress = await this.prisma.address.findFirst({
        where: { customerId: customer.id }
      });

      if (nextAddress) {
        await this.prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true }
        });
      }
    }

    await this.logActivity(
      userId,
      'ADDRESS_DELETED',
      `Deleted address: ${address.name}`,
      { addressId }
    );
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    const customer = await this.validateCustomer(userId);

    // Verify the address exists and belongs to this customer
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      throw new Error('Address not found');
    }

    // Unset all defaults first
    await this.prisma.address.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false }
    });

    // Set the new default
    const updatedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true }
    });

    await this.logActivity(
      userId,
      'ADDRESS_SET_DEFAULT',
      `Set address as default: ${address.name}`,
      { addressId }
    );

    return updatedAddress;
  }

  /**
   * Get the default address for a customer
   */
  async getDefaultAddress(userId: string): Promise<Address | null> {
    const customer = await this.validateCustomer(userId);

    const defaultAddress = await this.prisma.address.findFirst({
      where: {
        customerId: customer.id,
        isDefault: true
      }
    });

    return defaultAddress;
  }

  /**
   * Validate coordinates for an address (geocoding)
   * Note: In a real application, this would call a geocoding service
   */
  async validateCoordinates(addressData: Partial<AddressDto>): Promise<{ latitude: number; longitude: number }> {
    // This is a mock implementation
    // In a real app, you would call Google Maps or another geocoding service
    
    if (addressData.latitude && addressData.longitude) {
      return {
        latitude: addressData.latitude,
        longitude: addressData.longitude
      };
    }

    // Mock coordinates for demo purposes
    const mockCoordinates = {
      'Lagos': { latitude: 6.5244, longitude: 3.3792 },
      'Abuja': { latitude: 9.0765, longitude: 7.3986 },
      'Kano': { latitude: 12.0022, longitude: 8.5920 },
      'Ibadan': { latitude: 7.3775, longitude: 3.9470 },
      'Port Harcourt': { latitude: 4.8156, longitude: 7.0498 }
    };

    const city = addressData.city?.trim();
    if (city && city in mockCoordinates) {
      return mockCoordinates[city as keyof typeof mockCoordinates];
    }

    // Return default coordinates (center of Nigeria)
    return { latitude: 9.0820, longitude: 8.6753 };
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
          entityType: 'Address',
          entityId: details?.addressId,
          performedById: userId,
          details: { description, ...details }
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

export default new AddressService();