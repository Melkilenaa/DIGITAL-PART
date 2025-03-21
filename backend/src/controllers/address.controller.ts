import { Request, Response } from 'express';
import addressService from '../services/address.service';

export class AddressController {
  /**
   * Get all addresses for the authenticated customer
   */
  async getAllAddresses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const addresses = await addressService.getAllAddresses(userId);
      
      res.status(200).json({
        success: true,
        data: addresses
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve addresses'
      });
    }
  }

  /**
   * Get a specific address by ID
   */
  async getAddressById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      
      if (!addressId) {
        res.status(400).json({
          success: false,
          message: 'Address ID is required'
        });
        return;
      }

      const address = await addressService.getAddressById(userId, addressId);
      
      res.status(200).json({
        success: true,
        data: address
      });
    } catch (error: any) {
      const statusCode = error.message === 'Address not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve address'
      });
    }
  }

  /**
   * Create a new address
   */
  async createAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const addressData = req.body;
      
      // Validate required fields
      if (!addressData.name || !addressData.street || !addressData.city || 
          !addressData.state || !addressData.country || !addressData.postalCode) {
        res.status(400).json({
          success: false,
          message: 'Missing required address fields'
        });
        return;
      }

      // Add coordinates if they don't exist
      if (!addressData.latitude || !addressData.longitude) {
        const coordinates = await addressService.validateCoordinates(addressData);
        addressData.latitude = coordinates.latitude;
        addressData.longitude = coordinates.longitude;
      }

      const newAddress = await addressService.createAddress(userId, addressData);
      
      res.status(201).json({
        success: true,
        message: 'Address created successfully',
        data: newAddress
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to create address'
      });
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      const addressData = req.body;
      
      if (!addressId) {
        res.status(400).json({
          success: false,
          message: 'Address ID is required'
        });
        return;
      }

      // Add coordinates if city was updated but coordinates weren't provided
      if (addressData.city && (!addressData.latitude || !addressData.longitude)) {
        const coordinates = await addressService.validateCoordinates(addressData);
        addressData.latitude = coordinates.latitude;
        addressData.longitude = coordinates.longitude;
      }

      const updatedAddress = await addressService.updateAddress(userId, addressId, addressData);
      
      res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        data: updatedAddress
      });
    } catch (error: any) {
      const statusCode = 
        error.message === 'Address not found' || error.message === 'Customer profile not found' 
          ? 404 
          : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update address'
      });
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      
      if (!addressId) {
        res.status(400).json({
          success: false,
          message: 'Address ID is required'
        });
        return;
      }

      await addressService.deleteAddress(userId, addressId);
      
      res.status(200).json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error: any) {
      const statusCode = 
        error.message === 'Address not found' || error.message === 'Customer profile not found' 
          ? 404 
          : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete address'
      });
    }
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { addressId } = req.params;
      
      if (!addressId) {
        res.status(400).json({
          success: false,
          message: 'Address ID is required'
        });
        return;
      }

      const updatedAddress = await addressService.setDefaultAddress(userId, addressId);
      
      res.status(200).json({
        success: true,
        message: 'Default address set successfully',
        data: updatedAddress
      });
    } catch (error: any) {
      const statusCode = 
        error.message === 'Address not found' || error.message === 'Customer profile not found' 
          ? 404 
          : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to set default address'
      });
    }
  }

  /**
   * Get the default address
   */
  async getDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const defaultAddress = await addressService.getDefaultAddress(userId);
      
      if (!defaultAddress) {
        res.status(200).json({
          success: true,
          message: 'No default address found',
          data: null
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: defaultAddress
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve default address'
      });
    }
  }

  /**
   * Validate coordinates for an address (utility endpoint)
   */
  async validateCoordinates(req: Request, res: Response): Promise<void> {
    try {
      const addressData = req.body;
      
      if (!addressData.city) {
        res.status(400).json({
          success: false,
          message: 'City is required for coordinate validation'
        });
        return;
      }

      const coordinates = await addressService.validateCoordinates(addressData);
      
      res.status(200).json({
        success: true,
        data: coordinates
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate coordinates'
      });
    }
  }
}

export default new AddressController();