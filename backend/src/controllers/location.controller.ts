import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import locationService from '../services/location.service';

const prisma = new PrismaClient();

export class LocationController {
  /**
   * Calculate distance between two points
   * @route POST /api/locations/calculate-distance
   */
  async calculateDistance(req: Request, res: Response): Promise<void> {
    try {
      const { lat1, lon1, lat2, lon2 } = req.body;
      
      // Validate all coordinates are provided
      if (!lat1 || !lon1 || !lat2 || !lon2) {
        res.status(400).json({
          success: false,
          message: 'All coordinates are required (lat1, lon1, lat2, lon2)'
        });
        return;
      }
      
      const distance = locationService.calculateDistance(
        parseFloat(lat1),
        parseFloat(lon1),
        parseFloat(lat2),
        parseFloat(lon2)
      );
      
      res.status(200).json({
        success: true,
        data: {
          distance,
          unit: 'km'
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while calculating distance'
      });
    }
  }

  /**
   * Calculate delivery fee
   * @route POST /api/locations/calculate-fee
   */
  async calculateDeliveryFee(req: Request, res: Response): Promise<void> {
    try {
      const { distance, orderValue, isRush } = req.body;
      
      if (distance === undefined || orderValue === undefined) {
        res.status(400).json({
          success: false,
          message: 'Distance and orderValue are required'
        });
        return;
      }
      
      const fee = locationService.calculateDeliveryFee(
        parseFloat(distance),
        parseFloat(orderValue),
        isRush === 'true' || isRush === true
      );
      
      res.status(200).json({
        success: true,
        data: {
          fee,
          currency: 'NGN'
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while calculating delivery fee'
      });
    }
  }

  /**
   * Estimate delivery time
   * @route POST /api/locations/estimate-delivery-time
   */
  async estimateDeliveryTime(req: Request, res: Response): Promise<void> {
    try {
      const { distance, trafficFactor } = req.body;
      
      if (distance === undefined) {
        res.status(400).json({
          success: false,
          message: 'Distance is required'
        });
        return;
      }
      
      const time = locationService.estimateDeliveryTime(
        parseFloat(distance),
        trafficFactor ? parseFloat(trafficFactor) : 1.0
      );
      
      res.status(200).json({
        success: true,
        data: {
          time,
          unit: 'minutes'
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while estimating delivery time'
      });
    }
  }

  /**
   * Check if a location is within service area
   * @route POST /api/locations/check-service-area
   */
  async checkServiceArea(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.body;
      
      if (!lat || !lon) {
        res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
        return;
      }
      
      const serviceAreas = await locationService.getServiceAreas();
      
      // Check against all service areas
      for (const area of serviceAreas) {
        if (locationService.isWithinServiceArea(parseFloat(lat), parseFloat(lon), area)) {
          res.status(200).json({
            success: true,
            data: {
              isWithinServiceArea: true,
              serviceArea: area
            }
          });
          return;
        }
      }
      
      res.status(200).json({
        success: true,
        data: {
          isWithinServiceArea: false,
          message: 'Location is not within any service area'
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while checking service area'
      });
    }
  }

  /**
   * Find nearest drivers
   * @route GET /api/locations/nearest-drivers
   */
  async findNearestDrivers(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon, radius } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
        return;
      }
      
      const drivers = await locationService.findNearestDrivers(
        parseFloat(lat as string),
        parseFloat(lon as string),
        radius ? parseFloat(radius as string) : 10
      );
      
      res.status(200).json({
        success: true,
        data: drivers
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while finding nearest drivers'
      });
    }
  }

  /**
   * Get all service areas
   * @route GET /api/locations/service-areas
   */
  async getServiceAreas(req: Request, res: Response): Promise<void> {
    try {
      const areas = await locationService.getServiceAreas();
      
      res.status(200).json({
        success: true,
        data: areas
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while retrieving service areas'
      });
    }
  }

  /**
   * Get map rendering data
   * @route POST /api/locations/map-data
   */
  async getMapRenderingData(req: Request, res: Response): Promise<void> {
    try {
      const { originLat, originLon, destLat, destLon } = req.body;
      
      if (!originLat || !originLon || !destLat || !destLon) {
        res.status(400).json({
          success: false,
          message: 'Origin and destination coordinates are required'
        });
        return;
      }
      
      const mapData = locationService.getMapRenderingData(
        parseFloat(originLat),
        parseFloat(originLon),
        parseFloat(destLat),
        parseFloat(destLon)
      );
      
      res.status(200).json({
        success: true,
        data: mapData
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while generating map data'
      });
    }
  }

  /**
   * Update driver's current location
   * @route PATCH /api/locations/driver-location
   */
  async updateDriverLocation(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude } = req.body;
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }
      
      if (latitude === undefined || longitude === undefined) {
        res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
        return;
      }
      
      // Find driver associated with this user
      const driver = await prisma.driver.findUnique({
        where: { userId }
      });
      
      if (!driver) {
        res.status(400).json({
          success: false,
          message: 'Driver profile not found for this user'
        });
        return;
      }
      
      // Update driver's location
      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        }
      });
      
      res.status(200).json({
        success: true,
        data: {
          latitude: updatedDriver.latitude,
          longitude: updatedDriver.longitude,
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'An error occurred while updating location'
      });
    }
  }
}

export default new LocationController();