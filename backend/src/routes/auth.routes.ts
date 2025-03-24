import express from 'express';
import { upload } from '../utils/cloudinary.util';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Registration routes with file upload support
router.post(
  '/register/customer', 
  upload.single('profileImage'), 
  authController.registerCustomer.bind(authController)
);

router.post(
  '/register/vendor', 
  upload.single('businessLogo'), 
  authController.registerVendor.bind(authController)
);

router.post(
  '/register/driver', 
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'drivingLicense', maxCount: 1 },
    { name: 'insuranceDocument', maxCount: 1 },
    { name: 'identificationDoc', maxCount: 1 }
  ]), 
  authController.registerDriver.bind(authController)
);

router.post(
  '/register/admin',
  authMiddleware,
  roleGuard([UserRole.ADMIN]),
  // upload.single('profileImage'),
  authController.registerAdmin.bind(authController)
);

// Other auth routes remain unchanged
router.post('/login', authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.post('/password/reset-request', authController.requestPasswordReset.bind(authController));
router.post('/password/reset', authController.resetPassword.bind(authController));
router.post('/validate-token', authController.validateToken.bind(authController));

export default router;