import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import inventoryService from '../services/inventory.service';
import vendorService from '../services/vendor.service';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class InventoryController {
  /**
   * Create a new part in inventory
   */
  async createPart(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.user?.role === 'VENDOR' ? req.user.userId : req.body.vendorId;
      
      // Combine request data with vendorId
      const partData = {
        ...req.body,
        vendorId,
      };
      
      const part = await inventoryService.createPart(partData);
      
      res.status(201).json({
        success: true,
        message: 'Part created successfully',
        data: part,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create part',
      });
    }
  }

  /**
   * Update an existing part
   */
  async updatePart(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const updatedPart = await inventoryService.updatePart(partId, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Part updated successfully',
        data: updatedPart,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update part',
      });
    }
  }

  /**
   * Delete a part from inventory
   */
  async deletePart(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const result = await inventoryService.deletePart(partId);
      
      res.status(200).json({
        success: true,
        message: 'Part deleted or deactivated successfully',
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete part',
      });
    }
  }

  /**
   * Update stock quantity
   */
  async updateStock(req: Request, res: Response): Promise<void> {
    try {
      const { partId } = req.params;
      const { quantity, operation, reason } = req.body;
      
      if (!partId || !quantity || !operation) {
        res.status(400).json({
          success: false,
          message: 'Part ID, quantity, and operation are required',
        });
        return;
      }
      
      const updatedPart = await inventoryService.updateStock(partId, {
        quantity: parseInt(quantity),
        operation,
        reason,
      });
      
      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: updatedPart,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update stock',
      });
    }
  }

  /**
   * Get all low stock items
   */
  async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId || req.user?.userId;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      const lowStockItems = await inventoryService.getLowStockAlerts(vendorId);
      
      res.status(200).json({
        success: true,
        data: lowStockItems,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get low stock alerts',
      });
    }
  }

  /**
   * Bulk import parts from CSV
   */
  async bulkImportFromCsv(req: Request, res: Response): Promise<void> {
    try {
      const { file } = req;
      const vendorId = req.user?.role === 'VENDOR' ? req.user.userId : req.body.vendorId;
      
      if (!file || !vendorId) {
        res.status(400).json({
          success: false,
          message: 'CSV file and vendor ID are required',
        });
        return;
      }
      
      // Extract import options from request
      const options = {
        vendorId,
        categoryId: req.body.categoryId,
        updateExisting: req.body.updateExisting === 'true',
        matchBy: req.body.matchBy || 'partNumber',
      };
      
      // Process the uploaded file
      const result = await inventoryService.bulkImportFromCsv(file.path, options);
      
      // Clean up the temporary file
      fs.unlink(file.path, (err) => {
        if (err) console.error('Failed to delete temporary file:', err);
      });
      
      res.status(200).json({
        success: true,
        message: 'Bulk import completed',
        data: result,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 
                         error instanceof BadRequestException ? 400 : 500;
                         
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to import parts',
      });
    }
  }

  /**
   * Export parts inventory to CSV
   */
  async exportToCsv(req: Request, res: Response): Promise<void> {
    try {
      // Instead of using req.params.vendorId or req.user?.userId directly,
      // lookup the vendor record to get the correct vendor id.
      const tokenUserId = req.params.vendorId || req.user?.userId;
      if (!tokenUserId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      // Get vendor using the token's user id; vendorService ensures the right lookup.
      const vendor = await vendorService.getVendorProfile(tokenUserId);
      const vendorId = vendor.id;
      
      // Extract criteria from query parameters.
      const criteria = {
        categoryId: req.query.categoryId as string,
        isActive: req.query.isActive === 'true'
                  ? true
                  : req.query.isActive === 'false'
                    ? false
                    : undefined,
        condition: req.query.condition as string,
      };

      // Generate export stream with the proper vendor id.
      const stream = await inventoryService.exportToCsv(vendorId, criteria);

      // Set response headers for CSV download.
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="inventory-export-${Date.now()}.csv"`
      );

      // Pipe the export stream to the response.
      stream.pipe(res);
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      if (!res.headersSent) {
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Failed to export inventory',
        });
      } else {
        res.end();
      }
    }
  }

  /**
   * Get inventory valuation
   */
  async getInventoryValuation(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId || req.user?.userId;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
        return;
      }
      
      const valuation = await inventoryService.getInventoryValuation(vendorId);
      
      res.status(200).json({
        success: true,
        data: valuation,
      });
    } catch (error: any) {
      const statusCode = error instanceof NotFoundException ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get inventory valuation',
      });
    }
  }
}

export default new InventoryController();