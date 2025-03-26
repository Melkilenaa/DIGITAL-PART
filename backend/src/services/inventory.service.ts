import { PrismaClient, Part, PartCondition } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';
import * as csv from 'fast-csv';
import * as fs from 'fs';
import { Readable, PassThrough } from 'stream';

// Define interfaces for input data
interface PartCreateDto {
  name: string;
  description?: string;
  partNumber?: string;
  barcode?: string;
  price: number;
  discountedPrice?: number;
  condition?: PartCondition;
  brand?: string;
  images?: string[];
  stockQuantity: number;
  lowStockAlert?: number;
  specifications?: Record<string, any>;
  compatibleVehicles?: Array<{
    make: string;
    model: string;
    year: number;
    makeModel?: string;
    makeModelYear?: string;
  }>;
  weight?: number;
  dimensions?: string;
  categoryId: string;
  vendorId: string;
  tags?: string[];
}

interface PartUpdateDto extends Partial<PartCreateDto> {
  isActive?: boolean;
}

interface StockUpdateDto {
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
  reason?: string;
}

interface BulkImportOptions {
  vendorId: string;
  categoryId?: string;
  updateExisting?: boolean;
  matchBy?: 'partNumber' | 'barcode';
}

interface LowStockAlert {
  partId: string;
  name: string;
  partNumber?: string;
  currentStock: number;
  lowStockThreshold: number;
  vendorId: string;
}

export class InventoryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a new part in inventory
   */
  async createPart(data: PartCreateDto): Promise<Part> {
    try {
      // Validate the category exists
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      // Validate the vendor exists
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: data.vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Create the part
      const part = await this.prisma.part.create({
        data: {
          name: data.name,
          description: data.description,
          partNumber: data.partNumber,
          barcode: data.barcode,
          price: data.price,
          discountedPrice: data.discountedPrice,
          condition: data.condition || PartCondition.NEW,
          brand: data.brand,
          images: data.images || [],
          stockQuantity: data.stockQuantity,
          lowStockAlert: data.lowStockAlert || 5,
          specifications: data.specifications,
          compatibleVehicles: data.compatibleVehicles,
          weight: data.weight,
          dimensions: data.dimensions,
          categoryId: data.categoryId,
          vendorId: data.vendorId,
          tags: data.tags || [],
        },
      });

      // Log inventory activity
      await this.prisma.systemLog.create({
        data: {
          action: 'PART_CREATED',
          entityType: 'Part',
          entityId: part.id,
          performedById: data.vendorId, // Vendor ID as the performer
          details: {
            name: part.name,
            partNumber: part.partNumber,
            stockQuantity: part.stockQuantity,
          },
        },
      });

      return part;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create part: ${error.message}`);
    }
  }

  /**
   * Update an existing part
   */
  async updatePart(partId: string, data: PartUpdateDto): Promise<Part> {
    try {
      // Validate the part exists
      const part = await this.prisma.part.findUnique({
        where: { id: partId },
      });

      if (!part) {
        throw new NotFoundException('Part not found');
      }

      // Validate the category if provided
      if (data.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: data.categoryId },
        });

        if (!category) {
          throw new NotFoundException('Category not found');
        }
      }

      // Update the part
      const updatedPart = await this.prisma.part.update({
        where: { id: partId },
        data,
      });

      // Log inventory activity
      await this.prisma.systemLog.create({
        data: {
          action: 'PART_UPDATED',
          entityType: 'Part',
          entityId: updatedPart.id,
          performedById: part.vendorId, // Vendor ID as the performer
          details: {
            name: updatedPart.name,
            partNumber: updatedPart.partNumber,
            stockQuantity: updatedPart.stockQuantity,
          },
        },
      });

      return updatedPart;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update part: ${error.message}`);
    }
  }

  /**
   * Delete a part from inventory
   */
  async deletePart(partId: string): Promise<{ success: boolean }> {
    try {
      // Validate the part exists
      const part = await this.prisma.part.findUnique({
        where: { id: partId },
      });

      if (!part) {
        throw new NotFoundException('Part not found');
      }

      // Check if part has any order items
      const hasOrderItems = await this.prisma.orderItem.findFirst({
        where: { partId },
      });

      if (hasOrderItems) {
        // Instead of deleting, mark as inactive
        await this.prisma.part.update({
          where: { id: partId },
          data: { isActive: false },
        });

        // Log inventory activity
        await this.prisma.systemLog.create({
          data: {
            action: 'PART_DEACTIVATED',
            entityType: 'Part',
            entityId: part.id,
            performedById: part.vendorId,
            details: {
              name: part.name,
              partNumber: part.partNumber,
              reason: 'Part has order history and cannot be deleted',
            },
          },
        });

        return { success: true };
      }

      // Delete the part if no order history
      await this.prisma.part.delete({
        where: { id: partId },
      });

      // Log inventory activity
      await this.prisma.systemLog.create({
        data: {
          action: 'PART_DELETED',
          entityType: 'Part',
          entityId: partId,
          performedById: part.vendorId,
          details: {
            name: part.name,
            partNumber: part.partNumber,
          },
        },
      });

      return { success: true };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete part: ${error.message}`);
    }
  }

  /**
   * Update stock quantity
   */
  async updateStock(partId: string, data: StockUpdateDto): Promise<Part> {
    try {
      // Validate the part exists
      const part = await this.prisma.part.findUnique({
        where: { id: partId },
      });

      if (!part) {
        throw new NotFoundException('Part not found');
      }

      // Calculate the new stock quantity
      let newStockQuantity = part.stockQuantity;
      
      if (data.operation === 'add') {
        newStockQuantity += data.quantity;
      } else if (data.operation === 'subtract') {
        newStockQuantity -= data.quantity;
        
        // Prevent negative stock
        if (newStockQuantity < 0) {
          throw new BadRequestException('Cannot reduce stock below zero');
        }
      } else if (data.operation === 'set') {
        newStockQuantity = data.quantity;
        
        // Prevent negative stock
        if (newStockQuantity < 0) {
          throw new BadRequestException('Cannot set negative stock quantity');
        }
      }

      // Update the part
      const updatedPart = await this.prisma.part.update({
        where: { id: partId },
        data: { stockQuantity: newStockQuantity },
      });

      // Log inventory activity
      await this.prisma.systemLog.create({
        data: {
          action: 'STOCK_UPDATED',
          entityType: 'Part',
          entityId: part.id,
          performedById: part.vendorId,
          details: {
            name: part.name,
            partNumber: part.partNumber,
            previousStock: part.stockQuantity,
            newStock: newStockQuantity,
            operation: data.operation,
            quantity: data.quantity,
            reason: data.reason || 'Manual stock adjustment',
          },
        },
      });

      // Check if low stock notification needed
      if (newStockQuantity <= part.lowStockAlert) {
        // In a real implementation, you would send notifications here
        console.log(`Low stock alert: ${part.name} (${part.partNumber}) - ${newStockQuantity} items remaining`);
      }

      return updatedPart;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update stock: ${error.message}`);
    }
  }

  /**
   * Get all low stock items
   */
  async getLowStockAlerts(vendorId: string): Promise<LowStockAlert[]> {
    try {
      const lowStockParts = await this.prisma.part.findMany({
        where: {
          vendorId,
          isActive: true,
          stockQuantity: {
            lte: this.prisma.part.fields.lowStockAlert,
          },
        },
        select: {
          id: true,
          name: true,
          partNumber: true,
          stockQuantity: true,
          lowStockAlert: true,
          vendorId: true,
        },
      });

      return lowStockParts.map(part => ({
        partId: part.id,
        name: part.name,
        partNumber: part.partNumber || undefined,
        currentStock: part.stockQuantity,
        lowStockThreshold: part.lowStockAlert,
        vendorId: part.vendorId,
      }));
    } catch (error: any) {
      throw new BadRequestException(`Failed to get low stock alerts: ${error.message}`);
    }
  }

  /**
   * Bulk import parts from CSV
   */
  async bulkImportFromCsv(filePath: string, options: BulkImportOptions): Promise<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    errors: any[];
  }> {
    const result: {
      total: number;
      created: number;
      updated: number;
      failed: number;
      errors: any[];
    } = {
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Validate vendor
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: options.vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Validate default category if provided
    if (options.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: options.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Default category not found');
      }
    }

    return new Promise((resolve, reject) => {
      const parts: any[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true, trim: true }))
        .on('error', error => reject(new BadRequestException(`Error parsing CSV: ${error.message}`)))
        .on('data', async row => {
          result.total++;
          
          try {
            // Basic validation
            if (!row.name || !row.price) {
              throw new Error('Name and price are required');
            }

            // Format data
            const part = {
              name: row.name,
              description: row.description || null,
              partNumber: row.partNumber || null,
              barcode: row.barcode || null,
              price: parseFloat(row.price),
              condition: row.condition || 'NEW',
              brand: row.brand || null,
              stockQuantity: parseInt(row.stockQuantity || '0', 10),
              lowStockAlert: parseInt(row.lowStockAlert || '5', 10),
              categoryId: row.categoryId || options.categoryId,
              vendorId: options.vendorId,
              specifications: row.specifications ? JSON.parse(row.specifications) : null,
              compatibleVehicles: row.compatibleVehicles ? JSON.parse(row.compatibleVehicles) : null,
              weight: row.weight ? parseFloat(row.weight) : null,
              dimensions: row.dimensions || null,
              tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
            };

            parts.push(part);
          } catch (error: any) {
            result.failed++;
            result.errors.push({
              row: result.total,
              error: error.message,
              data: row,
            });
          }
        })
        .on('end', async () => {
          try {
            // Process parts in batches
            for (const part of parts) {
              try {
                // Check if part exists for updating
                if (options.updateExisting && (part.partNumber || part.barcode)) {
                  const whereClause: any = {};
                  
                  if (options.matchBy === 'partNumber' && part.partNumber) {
                    whereClause.partNumber = part.partNumber;
                  } else if (options.matchBy === 'barcode' && part.barcode) {
                    whereClause.barcode = part.barcode;
                  } else if (part.partNumber) {
                    whereClause.partNumber = part.partNumber;
                  } else if (part.barcode) {
                    whereClause.barcode = part.barcode;
                  }
                  
                  whereClause.vendorId = options.vendorId;
                  
                  const existingPart = await this.prisma.part.findFirst({
                    where: whereClause,
                  });

                  if (existingPart) {
                    await this.prisma.part.update({
                      where: { id: existingPart.id },
                      data: part,
                    });
                    result.updated++;
                    continue;
                  }
                }

                // Create new part
                await this.prisma.part.create({
                  data: part,
                });
                result.created++;
              } catch (error: any) {
                result.failed++;
                result.errors.push({
                  part: part.name,
                  error: error.message,
                });
              }
            }

            // Log bulk import
            await this.prisma.systemLog.create({
              data: {
                action: 'BULK_IMPORT_PARTS',
                entityType: 'Vendor',
                entityId: options.vendorId,
                performedById: options.vendorId,
                details: {
                  total: result.total,
                  created: result.created,
                  updated: result.updated,
                  failed: result.failed,
                },
              },
            });

            resolve(result);
          } catch (error: any) {
            reject(new BadRequestException(`Failed to process import: ${error.message}`));
          }
        });
    });
  }

  /**
   * Export parts inventory to CSV
   */
  async exportToCsv(vendorId: string, criteria?: any): Promise<Readable> {
    try {
      // Validate vendor
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Build where clause
      const whereClause: any = {
        vendorId,
      };

      // Add additional criteria if provided
      if (criteria) {
        if (criteria.categoryId) {
          whereClause.categoryId = criteria.categoryId;
        }
        
        if (criteria.isActive !== undefined) {
          whereClause.isActive = criteria.isActive;
        }
        
        if (criteria.condition) {
          whereClause.condition = criteria.condition;
        }
      }

      // Get parts
      const parts = await this.prisma.part.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      // Format parts for CSV
      const csvData = parts.map(part => ({
        id: part.id,
        name: part.name,
        description: part.description || '',
        partNumber: part.partNumber || '',
        barcode: part.barcode || '',
        price: part.price,
        discountedPrice: part.discountedPrice || '',
        condition: part.condition,
        brand: part.brand || '',
        stockQuantity: part.stockQuantity,
        lowStockAlert: part.lowStockAlert,
        weight: part.weight || '',
        dimensions: part.dimensions || '',
        category: part.category.name,
        categoryId: part.categoryId,
        specifications: part.specifications ? JSON.stringify(part.specifications) : '',
        compatibleVehicles: part.compatibleVehicles ? JSON.stringify(part.compatibleVehicles) : '',
        tags: part.tags.join(','),
        isActive: part.isActive,
        createdAt: part.createdAt.toISOString(),
        updatedAt: part.updatedAt.toISOString(),
      }));

      // Create CSV stream using a PassThrough stream
      const stream = new PassThrough();

      // Create CSV formatter
      const csvStream = csv.format({ headers: true });

      // Pipe the CSV formatter to the readable stream
      csvStream.pipe(stream);

      // Write data to CSV
      csvData.forEach(part => {
        csvStream.write(part);
      });

      // End the CSV stream
      csvStream.end();

      // Log export
      await this.prisma.systemLog.create({
        data: {
          action: 'EXPORT_INVENTORY',
          entityType: 'Vendor',
          entityId: vendorId,
          performedById: vendorId,
          details: {
            recordCount: parts.length,
            criteria: criteria || 'all',
          },
        },
      });

      return stream;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to export inventory: ${error.message}`);
    }
  }

  /**
   * Check if a part's stock is low and notify vendor if needed
   * @param partId The ID of the part to check
   */
  async checkAndNotifyLowStock(partId: string): Promise<void> {
    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      include: {
        vendor: true
      }
    });

    if (!part) return;

    // Use the existing lowStockAlert property which is already the threshold
    const lowStockThreshold = part.lowStockAlert;
    
    // if (part.stockQuantity <= lowStockThreshold) {
    //   // Notify vendor about low stock
    //   await notificationService.sendLowStockNotification(part);
    // }
  }

  /**
   * Get inventory valuation
   */
  async getInventoryValuation(vendorId: string): Promise<any> {
    try {
      // Validate vendor
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Get active parts
      const parts = await this.prisma.part.findMany({
        where: {
          vendorId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          partNumber: true,
          stockQuantity: true,
          price: true,
          discountedPrice: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      // Calculate valuations
      let totalValue = 0;
      let totalDiscountedValue = 0;
      let totalItems = 0;

      const items = parts.map(part => {
        const effectivePrice = part.discountedPrice || part.price;
        const value = part.stockQuantity * part.price;
        const discountedValue = part.stockQuantity * effectivePrice;
        
        totalValue += value;
        totalDiscountedValue += discountedValue;
        totalItems += part.stockQuantity;

        return {
          id: part.id,
          name: part.name,
          partNumber: part.partNumber,
          category: part.category.name,
          stockQuantity: part.stockQuantity,
          price: part.price,
          discountedPrice: part.discountedPrice,
          value,
          discountedValue,
        };
      });

      // Group by category
      const categoryValuation: Record<string, { value: number; items: number }> = {};
      for (const part of parts) {
        const categoryName = part.category.name;
        const effectivePrice = part.discountedPrice || part.price;
        const value = part.stockQuantity * effectivePrice;
        
        if (!categoryValuation[categoryName]) {
          categoryValuation[categoryName] = {
            value: 0,
            items: 0,
          };
        }
        
        categoryValuation[categoryName].value += value;
        categoryValuation[categoryName].items += part.stockQuantity;
      }

      return {
        summary: {
          totalItems,
          totalValue,
          totalDiscountedValue,
          potentialLoss: totalValue - totalDiscountedValue,
          itemCount: parts.length,
        },
        categoryBreakdown: categoryValuation,
        items,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get inventory valuation: ${error.message}`);
    }
  }
}

export default new InventoryService();