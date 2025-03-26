import express from 'express';
import payoutController from '../controllers/payout.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Webhook endpoint - no authentication required for external service calls
router.post('/webhook', payoutController.handleTransferWebhook);

// All other routes require authentication
router.use(authMiddleware);

// Only vendors and drivers can access these routes
router.use(roleGuard([UserRole.VENDOR, UserRole.DRIVER, UserRole.ADMIN]));

// Check payout eligibility
router.get('/eligibility', payoutController.checkPayoutEligibility);

// Get available balance
router.get('/balance', payoutController.getAvailableBalance);

// Request a payout
router.post('/request', payoutController.requestPayout);

// Get payout requests (already has role-based filtering in controller)
router.get('/requests', payoutController.getPayoutRequests);

// Admin-only routes
router.use(roleGuard([UserRole.ADMIN]));

// Process payout requests (approve/reject)
router.put('/requests/:payoutRequestId/process', payoutController.processPayoutRequest);

export default router;