import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import deliveryController from '../controllers/delivery.controller';

const router = Router();

// Create a new delivery
router.post('/', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), deliveryController.createDelivery);

// Get delivery details by ID
router.get('/:deliveryId', authMiddleware, deliveryController.getDeliveryDetails);

// Find available drivers for a delivery
router.get('/:deliveryId/available-drivers', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), deliveryController.findAvailableDrivers);

// Assign a driver to a delivery
router.post('/:deliveryId/assign-driver', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), deliveryController.assignDriver);

// Update delivery status
router.patch('/:deliveryId/status', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.DRIVER]), deliveryController.updateDeliveryStatus);

// Submit proof of delivery
router.post('/:deliveryId/proof', authMiddleware, roleGuard([UserRole.DRIVER]), deliveryController.submitDeliveryProof);

// Rate a delivery
router.post('/:deliveryId/rate', authMiddleware, roleGuard([UserRole.CUSTOMER]), deliveryController.rateDelivery);

// Get all deliveries for a driver (admin access)
router.get('/driver/:driverId', authMiddleware, roleGuard([UserRole.ADMIN]), deliveryController.getDriverDeliveries);

// Get deliveries for current driver
router.get('/my-deliveries', authMiddleware, roleGuard([UserRole.DRIVER]), deliveryController.getMyDeliveries);

// Get delivery for an order
router.get('/order/:orderId', authMiddleware, deliveryController.getOrderDelivery);

export default router;