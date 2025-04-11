import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import driverController from '../controllers/driver.controller';
import { upload } from '../utils/cloudinary.util';

const router = express.Router();

// All driver routes require authentication
router.use(authMiddleware);

// Driver profile
router.get('/profile', roleGuard([UserRole.DRIVER]), driverController.getMyProfile);
router.patch('/profile', roleGuard([UserRole.DRIVER]), upload.single('profileImage'), driverController.updateMyProfile);

// Driver vehicle information
router.patch('/vehicle', roleGuard([UserRole.DRIVER]), driverController.updateVehicleInfo);

// Driver documents
router.patch(
    '/documents',
    roleGuard([UserRole.DRIVER]),
    upload.fields([
      { name: 'drivingLicense', maxCount: 1 },
      { name: 'insuranceDocument', maxCount: 1 },
      { name: 'identificationDoc', maxCount: 1 }
    ]),
    driverController.updateDocuments
  );

// Driver availability
router.patch('/availability', roleGuard([UserRole.DRIVER]), driverController.updateAvailability);

// Driver location
router.patch('/location', roleGuard([UserRole.DRIVER]), driverController.updateLocation);

// Driver service areas
router.patch('/service-areas', roleGuard([UserRole.DRIVER]), driverController.updateServiceAreas);

// Driver working hours
router.patch('/working-hours', roleGuard([UserRole.DRIVER]), driverController.updateWorkingHours);

// Driver history and metrics
router.get('/delivery-history', roleGuard([UserRole.DRIVER]), driverController.getDeliveryHistory);
router.get('/performance-metrics', roleGuard([UserRole.DRIVER]), driverController.getPerformanceMetrics);

// Admin/Vendor routes to get driver information
router.get('/:driverId', roleGuard([UserRole.ADMIN, UserRole.VENDOR]), driverController.getDriverById);

export default router;