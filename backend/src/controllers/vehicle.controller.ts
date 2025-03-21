import { Request, Response } from 'express';
import vehicleService from '../services/vehicle.service';

export class VehicleController {
  /**
   * Get all vehicles for the authenticated customer
   */
  async getAllVehicles(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const vehicles = await vehicleService.getAllVehicles(userId);
      
      res.status(200).json({
        success: true,
        data: vehicles
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve vehicles'
      });
    }
  }

  /**
   * Get a specific vehicle by ID
   */
  async getVehicleById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      const vehicle = await vehicleService.getVehicleById(userId, vehicleId);
      
      res.status(200).json({
        success: true,
        data: vehicle
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve vehicle'
      });
    }
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const vehicleData = req.body;
      
      // Validate required fields
      if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
        res.status(400).json({
          success: false,
          message: 'Make, model, and year are required'
        });
        return;
      }

      const newVehicle = await vehicleService.createVehicle(userId, vehicleData);
      
      res.status(201).json({
        success: true,
        message: 'Vehicle created successfully',
        data: newVehicle
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to create vehicle'
      });
    }
  }

  /**
   * Update an existing vehicle
   */
  async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      const vehicleData = req.body;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      const updatedVehicle = await vehicleService.updateVehicle(userId, vehicleId, vehicleData);
      
      res.status(200).json({
        success: true,
        message: 'Vehicle updated successfully',
        data: updatedVehicle
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update vehicle'
      });
    }
  }

  /**
   * Delete a vehicle
   */
  async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      await vehicleService.deleteVehicle(userId, vehicleId);
      
      res.status(200).json({
        success: true,
        message: 'Vehicle deleted successfully'
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete vehicle'
      });
    }
  }

  /**
   * Set a vehicle as default
   */
  async setDefaultVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      const updatedVehicle = await vehicleService.setDefaultVehicle(userId, vehicleId);
      
      res.status(200).json({
        success: true,
        message: 'Default vehicle set successfully',
        data: updatedVehicle
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to set default vehicle'
      });
    }
  }

  /**
   * Get the default vehicle
   */
  async getDefaultVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const defaultVehicle = await vehicleService.getDefaultVehicle(userId);
      
      if (!defaultVehicle) {
        res.status(200).json({
          success: true,
          message: 'No default vehicle found',
          data: null
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: defaultVehicle
      });
    } catch (error: any) {
      res.status(error.message === 'Customer profile not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to retrieve default vehicle'
      });
    }
  }

  /**
   * Find compatible parts for a specific vehicle
   */
  async findCompatibleParts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      const { categoryId, limit } = req.query;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      const compatibleParts = await vehicleService.findCompatibleParts(
        userId, 
        vehicleId, 
        categoryId as string | undefined, 
        limit ? parseInt(limit as string) : undefined
      );
      
      res.status(200).json({
        success: true,
        data: compatibleParts
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to find compatible parts'
      });
    }
  }

  /**
   * Get maintenance recommendations for a vehicle
   */
  async getMaintenanceRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { vehicleId } = req.params;
      
      if (!vehicleId) {
        res.status(400).json({
          success: false,
          message: 'Vehicle ID is required'
        });
        return;
      }

      const recommendations = await vehicleService.getMaintenanceRecommendations(userId, vehicleId);
      
      res.status(200).json({
        success: true,
        data: recommendations
      });
    } catch (error: any) {
      const statusCode = error.message === 'Vehicle not found' || 
                         error.message === 'Customer profile not found' ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get maintenance recommendations'
      });
    }
  }
}

export default new VehicleController();