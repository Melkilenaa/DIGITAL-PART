import express from 'express';
import { UserRole } from '@prisma/client';
import categoryController from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';

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

router.post('/', categoryController.createCategory.bind(categoryController));
router.put('/:categoryId', categoryController.updateCategory.bind(categoryController));
router.delete('/:categoryId', categoryController.deleteCategory.bind(categoryController));
router.put('/:categoryId/commission', categoryController.updateCommissionRate.bind(categoryController));

export default router;