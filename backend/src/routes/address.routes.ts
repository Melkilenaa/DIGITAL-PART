import express from 'express';
import { UserRole } from '@prisma/client';
import addressController from '../controllers/address.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';

const router = express.Router();

// All address routes require authentication and customer role
router.use(authMiddleware);
router.use(roleGuard([UserRole.CUSTOMER]));

// Get all addresses
router.get('/', addressController.getAllAddresses.bind(addressController));

// Get default address
router.get('/default', addressController.getDefaultAddress.bind(addressController));

// Set an address as default
router.put('/:addressId/default', addressController.setDefaultAddress.bind(addressController));

// Validate coordinates (utility endpoint)
router.post('/validate-coordinates', addressController.validateCoordinates.bind(addressController));

// CRUD operations
router.post('/', addressController.createAddress.bind(addressController));
router.get('/:addressId', addressController.getAddressById.bind(addressController));
router.put('/:addressId', addressController.updateAddress.bind(addressController));
router.delete('/:addressId', addressController.deleteAddress.bind(addressController));

export default router;