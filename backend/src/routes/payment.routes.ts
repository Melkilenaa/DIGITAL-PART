import express from 'express';
import paymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Webhook endpoint - no authentication required for external service calls
router.post('/webhook', paymentController.handlePaymentWebhook);

// All other routes require authentication
router.use(authMiddleware);

// Customer payment method management
router.post('/methods', paymentController.addPaymentMethod);
router.get('/methods/:customerId', paymentController.getPaymentMethods);
router.put('/methods/default', paymentController.setDefaultPaymentMethod);
router.delete('/methods/:customerId/:paymentMethodId', paymentController.deletePaymentMethod);

// Payment processing
router.post('/initialize', paymentController.initializePayment);
router.post('/verify', paymentController.verifyPayment);

// Transaction history
router.get('/transactions', paymentController.getTransactionHistory);

// Refund management
router.post('/refund/request', paymentController.requestRefund);

// Admin-only routes
router.use(roleGuard([UserRole.ADMIN]));
router.post('/refund/process/:refundId', paymentController.processRefund);

export default router;