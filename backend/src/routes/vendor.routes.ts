import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import vendorController from '../controllers/vendor.controller';
import { upload } from '../utils/cloudinary.util';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All vendor routes require authentication

// Public routes (accessible to authenticated users of any role)
router.get('/public/:vendorId', vendorController.getVendorById);
router.get('/public/:vendorId/reviews', vendorController.getVendorReviews);
router.get('/public/:vendorId/rating', vendorController.getVendorRatingSummary);

router.use(authMiddleware);

// Vendor profile routes (require VENDOR role)
router.use(roleGuard([UserRole.VENDOR, UserRole.ADMIN]));

// Profile management
router.get('/profile', vendorController.getVendorProfile);
router.put('/profile', upload.single('businessLogo'), vendorController.updateVendorProfile);

// Banking details management
router.get('/banking-details', vendorController.getVendorBankingDetails);
router.put('/banking-details', vendorController.updateVendorBankingDetails);

// Operating hours and special holidays
router.put('/operating-hours', vendorController.updateOperatingHours);
router.put('/special-holidays', vendorController.updateSpecialHolidays);

// Verification documents
router.post('/verification/documents', upload.array('documents', 5), vendorController.submitVerificationDocuments);

// Performance metrics
router.get('/metrics', vendorController.getVendorMetrics);

export default router;