import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { UserRole } from '@prisma/client';
import orderController from '../controllers/order.controller';

const router = Router();

// Place specific routes first to avoid conflicts with parametrized routes
// Get orders for current customer
router.get('/my-orders', authMiddleware, roleGuard([UserRole.CUSTOMER]), orderController.getMyOrders);

// Get orders for current vendor
router.get('/my-vendor-orders', authMiddleware, roleGuard([UserRole.VENDOR]), orderController.getMyVendorOrders);

// Generate order report for vendor
router.get('/reports/:vendorId', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), orderController.generateOrderReport);

// Get customer orders - requires admin or the specific customer
router.get('/customer/:customerId', authMiddleware, orderController.getCustomerOrders);

// Get vendor orders - requires admin or the specific vendor
router.get('/vendor/:vendorId', authMiddleware, orderController.getVendorOrders);

// Create a new order - customer only
router.post('/', authMiddleware, roleGuard([UserRole.CUSTOMER]), orderController.createOrder);

// Get order tracking information
router.get('/:orderId/tracking', authMiddleware, orderController.getOrderTracking);

// Cancel order
router.post('/:orderId/cancel', authMiddleware, orderController.cancelOrder);

// Update order status
router.patch('/:orderId/status', authMiddleware, roleGuard([UserRole.ADMIN, UserRole.VENDOR]), orderController.updateOrderStatus);

// Get order by ID
router.get('/:orderId', authMiddleware, orderController.getOrderById);

export default router;