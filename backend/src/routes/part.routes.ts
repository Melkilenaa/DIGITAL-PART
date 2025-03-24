import express from 'express';
import { UserRole } from '@prisma/client';
import partController from '../controllers/part.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { upload } from '../utils/cloudinary.util';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', partController.getAllParts.bind(partController));
router.get('/search', partController.searchParts.bind(partController));
router.get('/compatible', partController.findCompatibleParts.bind(partController));
router.get('/popular', partController.getPopularParts.bind(partController));
router.get('/brands', partController.getTopBrands.bind(partController));
router.get('/:partId', partController.getPartById.bind(partController));
router.get('/:partId/related', partController.getRelatedParts.bind(partController));

// Customer-only routes
router.use('/recently-viewed', authMiddleware);
router.use('/recently-viewed', roleGuard([UserRole.CUSTOMER]));
router.get('/recently-viewed', partController.getRecentlyViewedParts.bind(partController));
router.post('/recently-viewed', partController.trackRecentlyViewed.bind(partController));

// Admin and vendor routes
router.use(['/inventory', '/pricing'], authMiddleware);
router.use(['/inventory', '/pricing'], roleGuard([UserRole.ADMIN, UserRole.VENDOR]));

// Inventory management with file uploads
router.post('/', upload.array('images', 10), partController.createPart.bind(partController));
router.put('/:partId', upload.array('images', 10), partController.updatePart.bind(partController));
router.delete('/:partId', partController.deletePart.bind(partController));
router.put('/:partId/stock', partController.updateStock.bind(partController));

// Pricing management
router.put('/:partId/discount', partController.applyDiscount.bind(partController));
router.delete('/:partId/discount', partController.removeDiscount.bind(partController));

export default router;