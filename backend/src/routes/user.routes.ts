import express from 'express';
import userController from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Profile management routes
router.get('/profile', userController.getUserProfile.bind(userController));
router.put('/profile', userController.updateProfile.bind(userController));

// Account settings routes
router.put('/account/settings', userController.updateAccountSettings.bind(userController));

// Device token management
router.get('/device-tokens', userController.getUserDeviceTokens.bind(userController));
router.post('/device-tokens', userController.registerDeviceToken.bind(userController));
router.delete('/device-tokens', userController.removeDeviceToken.bind(userController));

// Verification document submission (for vendors and drivers)
router.post('/verification/documents', userController.submitVerificationDocuments.bind(userController));

// Admin routes - require admin role
const adminRouter = express.Router();
adminRouter.use(roleGuard([UserRole.ADMIN]));

// User management (admin only)
adminRouter.get('/users/:userId', userController.getUserProfile.bind(userController));
adminRouter.put('/users/:userId/permissions', userController.updateUserPermissions.bind(userController));
adminRouter.put('/users/:userId/status', userController.updateUserActiveStatus.bind(userController));
adminRouter.get('/users/:userId/device-tokens', userController.getUserDeviceTokens.bind(userController));
adminRouter.get('/users/by-role/:role', userController.getUsersByRole.bind(userController));

// Verification management (admin only)
adminRouter.post('/verification/decision', userController.processVerificationDecision.bind(userController));
adminRouter.get('/verification/pending', userController.getPendingVerifications.bind(userController));

// Add admin routes under /admin prefix
router.use('/admin', adminRouter);

export default router;