import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import promotionController from '../controllers/promotion.controller';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All promotion routes require authentication
router.use(authMiddleware);

// Public routes (accessible to authenticated users of any role)
router.get('/part/:partId', promotionController.getPartPromotions);
router.post('/validate', promotionController.validatePromotion);
router.post('/calculate', promotionController.calculateDiscount);

// Vendor promotion management routes (require VENDOR role)
router.use(roleGuard([UserRole.VENDOR, UserRole.ADMIN]));

// CRUD operations for promotions
router.post('/', promotionController.createPromotion);
router.get('/vendor', promotionController.getVendorPromotions); // Gets current vendor's promotions
router.get('/:promotionId', promotionController.getPromotionById);
router.put('/:promotionId', promotionController.updatePromotion);
router.delete('/:promotionId', promotionController.deletePromotion);

// Analytics
router.get('/:promotionId/analytics', promotionController.getPromotionAnalytics);

export default router;