import express from 'express';
import { UserRole } from '@prisma/client';
import vehicleController from '../controllers/vehicle.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';

const router = express.Router();

// All vehicle routes require authentication and customer role
router.use(authMiddleware);
router.use(roleGuard([UserRole.CUSTOMER]));

// Get all vehicles and create new vehicle
router.get('/', vehicleController.getAllVehicles.bind(vehicleController));
router.post('/', vehicleController.createVehicle.bind(vehicleController));

// Default vehicle operations
router.get('/default', vehicleController.getDefaultVehicle.bind(vehicleController));
router.put('/:vehicleId/default', vehicleController.setDefaultVehicle.bind(vehicleController));

// Vehicle-specific operations
router.get('/:vehicleId', vehicleController.getVehicleById.bind(vehicleController));
router.put('/:vehicleId', vehicleController.updateVehicle.bind(vehicleController));
router.delete('/:vehicleId', vehicleController.deleteVehicle.bind(vehicleController));

// Advanced vehicle features
router.get('/:vehicleId/compatible-parts', vehicleController.findCompatibleParts.bind(vehicleController));
router.get('/:vehicleId/maintenance', vehicleController.getMaintenanceRecommendations.bind(vehicleController));

export default router;