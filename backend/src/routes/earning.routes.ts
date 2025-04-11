import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import earningController from '../controllers/earning.controller';

const router = express.Router();

// All earnings routes require authentication
router.use(authMiddleware);

// Driver earnings routes
router.get('/driver', roleGuard([UserRole.DRIVER, UserRole.ADMIN]), earningController.getDriverEarnings);
router.post('/driver/payout', roleGuard([UserRole.DRIVER]), earningController.requestDriverPayout);
router.get('/driver/tax-report/:year', roleGuard([UserRole.DRIVER, UserRole.ADMIN]), earningController.generateDriverTaxReport);
router.get('/driver/transactions', roleGuard([UserRole.DRIVER, UserRole.ADMIN]), earningController.getDriverTransactionHistory);

// Vendor earnings routes
router.get('/vendor', roleGuard([UserRole.VENDOR, UserRole.ADMIN]), earningController.getVendorEarnings);
router.post('/vendor/payout', roleGuard([UserRole.VENDOR]), earningController.requestVendorPayout);
router.get('/vendor/tax-report/:year', roleGuard([UserRole.VENDOR, UserRole.ADMIN]), earningController.generateVendorTaxReport);
router.get('/vendor/transactions', roleGuard([UserRole.VENDOR, UserRole.ADMIN]), earningController.getVendorTransactionHistory);

// Admin-only routes
router.post('/calculate/:deliveryId', roleGuard([UserRole.ADMIN]), earningController.calculateDeliveryEarnings);
router.get('/payout-requests', roleGuard([UserRole.ADMIN]), earningController.getAllPayoutRequests);
router.patch('/payout-requests/:payoutRequestId', roleGuard([UserRole.ADMIN]), earningController.processPayoutRequest);

export default router;