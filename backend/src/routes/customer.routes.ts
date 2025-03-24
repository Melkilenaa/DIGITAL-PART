import express from 'express';
import { UserRole } from '@prisma/client';
import customerController from '../controllers/customer.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import { upload } from '../utils/cloudinary.util';

const router = express.Router();

// All customer routes require authentication and customer role
router.use(authMiddleware);
router.use(roleGuard([UserRole.CUSTOMER]));

// Profile management
router.get('/profile', customerController.getCustomerProfile.bind(customerController));
// Add upload middleware for profile update to handle profile image uploads
router.put('/profile', upload.single('profileImage'), customerController.updateCustomerProfile.bind(customerController));

// Order management
router.get('/orders', customerController.getOrderHistory.bind(customerController));
router.get('/orders/:orderId', customerController.getOrderDetails.bind(customerController));
router.get('/orders/:orderId/track', customerController.trackOrderDelivery.bind(customerController));
router.post('/orders/:orderId/cancel', customerController.cancelOrder.bind(customerController));

// Wishlist management
router.get('/wishlist', customerController.getWishlist.bind(customerController));
router.post('/wishlist', customerController.addToWishlist.bind(customerController));
router.delete('/wishlist/:wishlistItemId', customerController.removeFromWishlist.bind(customerController));
router.delete('/wishlist', customerController.clearWishlist.bind(customerController));
router.get('/wishlist/check/:partId', customerController.isInWishlist.bind(customerController));

// Recently viewed items
router.get('/recently-viewed', customerController.getRecentlyViewed.bind(customerController));
router.post('/recently-viewed', customerController.trackRecentlyViewed.bind(customerController));

export default router;