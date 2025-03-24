import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleGuard } from '../middlewares/role.guard';
import inventoryController from '../controllers/inventory.controller';
import { upload } from '../utils/cloudinary.util';
import multer from 'multer';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Configure CSV file upload middleware
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'inventory-' + uniqueSuffix + '.csv');
  }
});

const csvUpload = multer({ 
  storage: csvStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// All inventory routes require authentication
router.use(authMiddleware);

// Public routes for customers/drivers to view parts (no role guard)
// These would typically be in a separate parts.routes.ts file
// For completeness, I'm adding them here with comments

// Inventory management routes (require VENDOR role)
router.use(roleGuard([UserRole.VENDOR, UserRole.ADMIN]));

// CRUD operations for parts
router.post('/parts', upload.array('images', 5), inventoryController.createPart);
router.put('/parts/:partId', upload.array('images', 5), inventoryController.updatePart);
router.delete('/parts/:partId', inventoryController.deletePart);

// Stock management
router.put('/parts/:partId/stock', inventoryController.updateStock);
router.get('/low-stock', inventoryController.getLowStockAlerts);

// Bulk operations
router.post('/bulk-import', csvUpload.single('csvFile'), inventoryController.bulkImportFromCsv);
router.get('/export', inventoryController.exportToCsv);

// Inventory reporting
router.get('/valuation', inventoryController.getInventoryValuation);

export default router;