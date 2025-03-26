import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import locationController from '../controllers/location.controller';

const router = Router();

// Calculate distance between two points (public endpoint)
router.post('/calculate-distance', locationController.calculateDistance);

// Calculate delivery fee (public endpoint)
router.post('/calculate-fee', locationController.calculateDeliveryFee);

// Estimate delivery time (public endpoint)
router.post('/estimate-delivery-time', locationController.estimateDeliveryTime);

// Check if a location is within service area (public endpoint)
router.post('/check-service-area', locationController.checkServiceArea);

// Find nearest drivers
router.get('/nearest-drivers', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), locationController.findNearestDrivers);

// Get all service areas (public endpoint)
router.get('/service-areas', locationController.getServiceAreas);

// Get map rendering data (public endpoint)
router.post('/map-data', locationController.getMapRenderingData);

// Update driver's current location
router.patch('/driver-location', authMiddleware, roleGuard([UserRole.DRIVER]), locationController.updateDriverLocation);

export default router;