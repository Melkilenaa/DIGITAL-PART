import express from 'express';
import { UserRole } from '@prisma/client';
import categoryController from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { upload } from '../utils/cloudinary.util';

const router = express.Router();

// Public routes (no authentication required)
router.get('/', categoryController.getAllCategories.bind(categoryController));
router.get('/tree', categoryController.getCategoryTree.bind(categoryController));
router.get('/with-children', categoryController.getCategoriesWithChildren.bind(categoryController));
router.get('/navigation', categoryController.getNavigationCategories.bind(categoryController));
router.get('/popular', categoryController.getPopularCategories.bind(categoryController));
router.get('/:categoryId', categoryController.getCategoryById.bind(categoryController));
router.get('/:categoryId/subcategories', categoryController.getSubcategories.bind(categoryController));
router.get('/:categoryId/breadcrumb', categoryController.getCategoryBreadcrumb.bind(categoryController));

// Admin-only routes
router.use(authMiddleware);
router.use(roleGuard([UserRole.ADMIN]));

// Add file upload middleware to routes that handle images
router.post('/', upload.single('image'), categoryController.createCategory.bind(categoryController));
router.put('/:categoryId', upload.single('image'), categoryController.updateCategory.bind(categoryController));
router.delete('/:categoryId', categoryController.deleteCategory.bind(categoryController));
router.put('/:categoryId/commission', categoryController.updateCommissionRate.bind(categoryController));

export default router;