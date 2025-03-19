import express from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard'; // You'll need to implement this
import { UserRole } from '@prisma/client';

const router = express.Router();

// Registration endpoints
router.post('/register/customer', authController.registerCustomer.bind(authController));
router.post('/register/vendor', authController.registerVendor.bind(authController));
router.post('/register/driver', authController.registerDriver.bind(authController));

// Login and token management
router.post('/login', authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.post('/validate-token', authController.validateToken.bind(authController));

// Password management
router.post('/password/reset-request', authController.requestPasswordReset.bind(authController));
router.post('/password/reset', authController.resetPassword.bind(authController));

// Protected routes that require authentication
router.post('/logout', authMiddleware, authController.logout.bind(authController));

// Admin-only routes
router.post(
  '/register/admin', 
  authMiddleware, 
  roleGuard([UserRole.ADMIN]), 
  authController.registerAdmin.bind(authController)
);

export default router;