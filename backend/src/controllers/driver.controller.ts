import { Request, Response } from 'express';
import driverService from '../services/driver.service';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/exceptions.util';

export class DriverController {
  /**
   * Get the profile of the currently authenticated driver
   * @route GET /api/drivers/profile
   */
  async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const driver = await driverService.getDriverProfile(req.user.userId);
      
      res.status(200).json({
        success: true,
        data: driver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to get driver profile'
        });
      }
    }
  }

  /**
   * Get a driver by ID (for admin or appropriate role)
   * @route GET /api/drivers/:driverId
   */
  async getDriverById(req: Request, res: Response): Promise<void> {
    try {
      const { driverId } = req.params;
      
      if (!driverId) {
        res.status(400).json({
          success: false,
          message: 'Driver ID is required'
        });
        return;
      }

      // Check if user has permission
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'VENDOR') {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
        return;
      }

      const driver = await driverService.getDriverById(driverId);
      
      res.status(200).json({
        success: true,
        data: driver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to get driver'
        });
      }
    }
  }

  /**
   * Update the profile of the currently authenticated driver
   * @route PATCH /api/drivers/profile
   */
  async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { firstName, lastName, phoneNumber } = req.body;
      const profileImage = req.file?.path || req.body.profileImage;

      const updatedDriver = await driverService.updateDriverProfile(req.user.userId, {
        firstName,
        lastName,
        phoneNumber,
        profileImage
      });
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedDriver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update driver profile'
        });
      }
    }
  }

  /**
   * Update driver vehicle information
   * @route PATCH /api/drivers/vehicle
   */
  async updateVehicleInfo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { vehicleType, vehicleColor, licensePlate, maxPackageSize, maxPackageWeight } = req.body;

      const updatedDriver = await driverService.updateVehicleInfo(req.user.userId, {
        vehicleType,
        vehicleColor,
        licensePlate,
        maxPackageSize,
        maxPackageWeight: maxPackageWeight ? parseFloat(maxPackageWeight) : undefined
      });
      
      res.status(200).json({
        success: true,
        message: 'Vehicle information updated successfully',
        data: updatedDriver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update vehicle information'
        });
      }
    }
  }

  /**
   * Update driver documents
   * @route PATCH /api/drivers/documents
   */
  async updateDocuments(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
  
      // For properly formatted multipart requests with uploads
      if (req.files) {
        // Parse document types and descriptions if provided
        const docTypes = req.body.docTypes ? JSON.parse(req.body.docTypes) : {};
        const docDescriptions = req.body.docDescriptions ? JSON.parse(req.body.docDescriptions) : {};
  
        const documents: any = {};
        
        // Handle uploaded files with metadata
        if ((req.files as any).drivingLicense) {
          documents.drivingLicense = (req.files as any).drivingLicense[0].path;
        }
        
        if ((req.files as any).insuranceDocument) {
          documents.insuranceDocument = (req.files as any).insuranceDocument[0].path;
        }
        
        if ((req.files as any).identificationDoc) {
          documents.identificationDoc = (req.files as any).identificationDoc[0].path;
        }
  
        // Check if at least one document is provided
        if (Object.keys(documents).length === 0) {
          res.status(400).json({
            success: false,
            message: 'At least one document must be provided'
          });
          return;
        }
  
        // Log document details
        console.log('Uploading driver documents:', {
          docTypes,
          docDescriptions,
          documents
        });
  
        const updatedDriver = await driverService.updateDriverDocuments(req.user.userId, documents);
        
        res.status(200).json({
          success: true,
          message: 'Documents uploaded successfully. Your verification status will be reviewed.',
          data: updatedDriver
        });
      } 
      // For JSON requests with document URLs
      else {
        const { drivingLicense, insuranceDocument, identificationDoc } = req.body;
  
        const documents: any = {};
        if (drivingLicense) documents.drivingLicense = drivingLicense;
        if (insuranceDocument) documents.insuranceDocument = insuranceDocument;
        if (identificationDoc) documents.identificationDoc = identificationDoc;
  
        // Check if at least one document is provided
        if (Object.keys(documents).length === 0) {
          res.status(400).json({
            success: false,
            message: 'At least one document must be provided'
          });
          return;
        }
  
        const updatedDriver = await driverService.updateDriverDocuments(req.user.userId, documents);
        
        res.status(200).json({
          success: true,
          message: 'Documents updated successfully. Your verification status will be reviewed.',
          data: updatedDriver
        });
      }
    } catch (error: any) {
      console.error('Document upload error:', error);
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update documents'
        });
      }
    }
  }

  /**
   * Update driver availability status
   * @route PATCH /api/drivers/availability
   */
  async updateAvailability(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { isAvailable } = req.body;

      if (isAvailable === undefined) {
        res.status(400).json({
          success: false,
          message: 'isAvailable field is required'
        });
        return;
      }

      const updatedDriver = await driverService.updateAvailabilityStatus(req.user.userId, isAvailable);
      
      res.status(200).json({
        success: true,
        message: `You are now ${isAvailable ? 'available' : 'unavailable'} for deliveries`,
        data: updatedDriver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update availability status'
        });
      }
    }
  }

  /**
   * Update driver location
   * @route PATCH /api/drivers/location
   */
  async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        res.status(400).json({
          success: false,
          message: 'Both latitude and longitude are required'
        });
        return;
      }

      const parsedLatitude = parseFloat(latitude);
      const parsedLongitude = parseFloat(longitude);

      if (isNaN(parsedLatitude) || isNaN(parsedLongitude)) {
        res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be valid numbers'
        });
        return;
      }

      const updatedDriver = await driverService.updateDriverLocation(
        req.user.userId,
        parsedLatitude,
        parsedLongitude
      );
      
      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: {
          latitude: updatedDriver.latitude,
          longitude: updatedDriver.longitude
        }
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update location'
        });
      }
    }
  }

  /**
   * Update driver service areas
   * @route PATCH /api/drivers/service-areas
   */
  async updateServiceAreas(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { serviceAreas } = req.body;

      if (!serviceAreas || !Array.isArray(serviceAreas)) {
        res.status(400).json({
          success: false,
          message: 'Service areas must be provided as an array'
        });
        return;
      }

      const updatedDriver = await driverService.updateServiceAreas(req.user.userId, serviceAreas);
      
      res.status(200).json({
        success: true,
        message: 'Service areas updated successfully',
        data: updatedDriver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update service areas'
        });
      }
    }
  }

  /**
   * Update driver working hours
   * @route PATCH /api/drivers/working-hours
   */
  async updateWorkingHours(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { workingHours } = req.body;

      if (!workingHours || typeof workingHours !== 'object') {
        res.status(400).json({
          success: false,
          message: 'Working hours must be provided as an object'
        });
        return;
      }

      const updatedDriver = await driverService.updateWorkingHours(req.user.userId, workingHours);
      
      res.status(200).json({
        success: true,
        message: 'Working hours updated successfully',
        data: updatedDriver
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else if (error instanceof BadRequestException) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update working hours'
        });
      }
    }
  }

  /**
   * Get delivery history for the authenticated driver
   * @route GET /api/drivers/delivery-history
   */
  async getDeliveryHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { status, startDate, endDate, limit, offset } = req.query;

      const options: any = {};
      if (status) options.status = status;
      if (startDate) options.startDate = new Date(startDate as string);
      if (endDate) options.endDate = new Date(endDate as string);
      if (limit) options.limit = parseInt(limit as string);
      if (offset) options.offset = parseInt(offset as string);

      const history = await driverService.getDeliveryHistory(req.user.userId, options);
      
      res.status(200).json({
        success: true,
        data: history.deliveries,
        meta: {
          total: history.total,
          pages: history.pages,
          limit: options.limit || 10,
          offset: options.offset || 0
        }
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to get delivery history'
        });
      }
    }
  }

  /**
   * Get performance metrics for the authenticated driver
   * @route GET /api/drivers/performance-metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { period } = req.query;
      
      // Validate period
      if (period && !['weekly', 'monthly', 'yearly'].includes(period as string)) {
        res.status(400).json({
          success: false,
          message: 'Period must be one of: weekly, monthly, yearly'
        });
        return;
      }

      const metrics = await driverService.getPerformanceMetrics(
        req.user.userId, 
        (period as 'weekly' | 'monthly' | 'yearly') || 'monthly'
      );
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to get performance metrics'
        });
      }
    }
  }
}

export default new DriverController();