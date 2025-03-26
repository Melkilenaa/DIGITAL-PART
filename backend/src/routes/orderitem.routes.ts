import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import orderItemController from '../controllers/orderitem.controller';

const router = Router();

// Place specific routes before parametrized routes
// Calculate order totals
router.get('/calculate/:orderId', authMiddleware, orderItemController.calculateOrderTotals);

// Get a specific order item
router.get('/item/:itemId', authMiddleware, orderItemController.getOrderItemById);

// Apply promotion to order
router.post('/:orderId/apply-promotion', authMiddleware, roleGuard([UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN]), orderItemController.applyPromotionToOrder);

// Get all items for an order
router.get('/:orderId', authMiddleware, orderItemController.getOrderItems);

// Add item to an order
router.post('/', authMiddleware, roleGuard([UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN]), orderItemController.addItemToOrder);

// Update item quantity
router.patch('/:orderItemId', authMiddleware, orderItemController.updateItemQuantity);

// Remove item from order
router.delete('/:orderItemId', authMiddleware, orderItemController.removeOrderItem);

export default router;