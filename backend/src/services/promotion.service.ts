import { PrismaClient, Promotion, PromotionType, PartPromotion } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

// Define interfaces for input data
interface CreatePromotionDto {
  vendorId: string;
  name: string;
  description?: string;
  type: PromotionType;
  discountValue: number;
  isPercentage: boolean;
  minimumOrderValue?: number;
  startDate: Date;
  endDate: Date;
  promotionCode?: string;
  partIds?: string[];
}

interface UpdatePromotionDto {
  name?: string;
  description?: string;
  type?: PromotionType;
  discountValue?: number;
  isPercentage?: boolean;
  minimumOrderValue?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  promotionCode?: string;
  partIds?: string[];
}

interface ValidatePromotionDto {
  code: string;
  vendorId?: string;
  cartValue?: number;
  partIds?: string[];
}

interface CalculateDiscountDto {
  promotionId: string;
  cartValue: number;
  cartItems: Array<{
    partId: string;
    quantity: number;
    price: number;
  }>;
}

export class PromotionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a new promotion
   */
  async createPromotion(data: CreatePromotionDto): Promise<Promotion> {
    try {
      // Validate the vendor by looking it up with the user id instead of vendor id
      const vendor = await this.prisma.vendor.findUnique({
        where: { userId: data.vendorId },
      });
      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }
      
      // Validate dates, discount value etc.
      if (new Date(data.startDate) > new Date(data.endDate)) {
        throw new BadRequestException('Start date must be before end date');
      }
      if (data.discountValue <= 0) {
        throw new BadRequestException('Discount value must be greater than zero');
      }
      if (data.isPercentage && data.discountValue > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100%');
      }
      if (data.promotionCode) {
        const existingPromoCode = await this.prisma.promotion.findUnique({
          where: { promotionCode: data.promotionCode },
        });
        if (existingPromoCode) {
          throw new BadRequestException('Promotion code already exists');
        }
      }
      
      // Create promotion transaction; use vendor.id, not data.vendorId
      const result = await this.prisma.$transaction(async (tx) => {
        const promotion = await tx.promotion.create({
          data: {
            vendorId: vendor.id,
            name: data.name,
            description: data.description,
            type: data.type,
            discountValue: data.discountValue,
            isPercentage: data.isPercentage,
            minimumOrderValue: data.minimumOrderValue,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            promotionCode: data.promotionCode,
          },
        });
        
        if (data.partIds && data.partIds.length > 0) {
          const parts = await tx.part.findMany({
            where: {
              id: { in: data.partIds },
              vendorId: vendor.id,
            },
          });
          if (parts.length !== data.partIds.length) {
            throw new BadRequestException('One or more parts do not exist or do not belong to this vendor');
          }
          await Promise.all(
            data.partIds.map(partId =>
              tx.partPromotion.create({
                data: {
                  promotionId: promotion.id,
                  partId,
                },
              })
            )
          );
        }
        
        return promotion;
      });
      
      await this.prisma.systemLog.create({
        data: {
          action: 'PROMOTION_CREATED',
          entityType: 'Promotion',
          entityId: result.id,
          performedById: vendor.id,
          details: {
            name: data.name,
            type: data.type,
            discountValue: data.discountValue,
            isPercentage: data.isPercentage,
          },
        },
      });
      
      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create promotion: ${error.message}`);
    }
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(promotionId: string, data: UpdatePromotionDto): Promise<Promotion> {
    try {
      // Validate promotion exists
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId },
      });

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      // Validate dates if both are provided
      if (data.startDate && data.endDate) {
        if (new Date(data.startDate) > new Date(data.endDate)) {
          throw new BadRequestException('Start date must be before end date');
        }
      } else if (data.startDate && new Date(data.startDate) > new Date(promotion.endDate)) {
        throw new BadRequestException('Start date must be before current end date');
      } else if (data.endDate && new Date(promotion.startDate) > new Date(data.endDate)) {
        throw new BadRequestException('Current start date must be before end date');
      }

      // Validate discount value
      if (data.discountValue !== undefined && data.discountValue <= 0) {
        throw new BadRequestException('Discount value must be greater than zero');
      }

      // Validate percentage discount (can't be > 100%)
      if (
        (data.isPercentage || (data.isPercentage === undefined && promotion.isPercentage)) &&
        data.discountValue !== undefined &&
        data.discountValue > 100
      ) {
        throw new BadRequestException('Percentage discount cannot exceed 100%');
      }

      // Check if promotion code exists (if provided and changed)
      if (data.promotionCode && data.promotionCode !== promotion.promotionCode) {
        const existingPromoCode = await this.prisma.promotion.findUnique({
          where: { promotionCode: data.promotionCode },
        });

        if (existingPromoCode) {
          throw new BadRequestException('Promotion code already exists');
        }
      }

      // Handle part IDs update if provided
      if (data.partIds !== undefined) {
        await this.updatePromotionParts(promotionId, promotion.vendorId, data.partIds);
      }

      // Create update object (excluding partIds which is handled separately)
      const { partIds, ...updateData } = data;

      // Update the promotion
      const updatedPromotion = await this.prisma.promotion.update({
        where: { id: promotionId },
        data: updateData,
      });

      // Log promotion update
      await this.prisma.systemLog.create({
        data: {
          action: 'PROMOTION_UPDATED',
          entityType: 'Promotion',
          entityId: promotionId,
          performedById: promotion.vendorId,
          details: {
            name: updatedPromotion.name,
            type: updatedPromotion.type,
            changes: Object.keys(data),
          },
        },
      });

      return updatedPromotion;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update promotion: ${error.message}`);
    }
  }

  /**
   * Update parts linked to a promotion
   */
  private async updatePromotionParts(promotionId: string, vendorId: string, partIds: string[]): Promise<void> {
    try {
      // If partIds is empty, remove all part links
      if (partIds.length === 0) {
        await this.prisma.partPromotion.deleteMany({
          where: { promotionId },
        });
        return;
      }

      // Verify all parts exist and belong to the vendor
      const parts = await this.prisma.part.findMany({
        where: {
          id: {
            in: partIds,
          },
          vendorId,
        },
        select: {
          id: true,
        },
      });

      if (parts.length !== partIds.length) {
        throw new BadRequestException('One or more parts do not exist or do not belong to this vendor');
      }

      // Get current part links
      const currentParts = await this.prisma.partPromotion.findMany({
        where: { promotionId },
        select: {
          partId: true,
        },
      });

      const currentPartIds = currentParts.map(p => p.partId);

      // Identify parts to add and remove
      const partsToAdd = partIds.filter(id => !currentPartIds.includes(id));
      const partsToRemove = currentPartIds.filter(id => !partIds.includes(id));

      // Execute updates in a transaction
      await this.prisma.$transaction([
        // Remove parts no longer in the list
        this.prisma.partPromotion.deleteMany({
          where: {
            promotionId,
            partId: {
              in: partsToRemove,
            },
          },
        }),
        // Add new parts
        ...partsToAdd.map(partId =>
          this.prisma.partPromotion.create({
            data: {
              promotionId,
              partId,
            },
          })
        ),
      ]);
    } catch (error: any) {
      throw new BadRequestException(`Failed to update promotion parts: ${error.message}`);
    }
  }

  /**
   * Delete a promotion
   */
  async deletePromotion(promotionId: string): Promise<{ success: boolean }> {
    try {
      // Validate promotion exists
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId },
      });

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      // Delete the promotion (cascades to PartPromotion)
      await this.prisma.promotion.delete({
        where: { id: promotionId },
      });

      // Log promotion deletion
      await this.prisma.systemLog.create({
        data: {
          action: 'PROMOTION_DELETED',
          entityType: 'Promotion',
          entityId: promotionId,
          performedById: promotion.vendorId,
          details: {
            name: promotion.name,
            type: promotion.type,
          },
        },
      });

      return { success: true };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete promotion: ${error.message}`);
    }
  }

  /**
   * Get promotions for a vendor
   */
  async getVendorPromotions(vendorId: string, options?: {
    isActive?: boolean;
    type?: PromotionType;
    limit?: number;
    offset?: number;
  }): Promise<{
    promotions: Promotion[];
    total: number;
  }> {
    try {
      // Build where clause
      const where: any = {
        vendorId,
      };

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options?.type) {
        where.type = options.type;
      }

      // Get promotions with pagination
      const [promotions, total] = await Promise.all([
        this.prisma.promotion.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip: options?.offset || 0,
          take: options?.limit || 50,
        }),
        this.prisma.promotion.count({
          where,
        }),
      ]);

      return {
        promotions,
        total,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to get vendor promotions: ${error.message}`);
    }
  }

  /**
   * Get a promotion by ID
   */
  async getPromotionById(promotionId: string): Promise<Promotion & { parts: any[] }> {
    try {
      // Get promotion with associated parts
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId },
        include: {
          parts: {
            include: {
              part: {
                select: {
                  id: true,
                  name: true,
                  partNumber: true,
                  price: true,
                  discountedPrice: true,
                  images: true,
                  stockQuantity: true,
                },
              },
            },
          },
        },
      });

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      // Format the response
      const formattedPromotion = {
        ...promotion,
        parts: promotion.parts.map(pp => pp.part),
      };

      return formattedPromotion;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get promotion: ${error.message}`);
    }
  }

  /**
   * Validate a promotion
   */
  async validatePromotion(data: ValidatePromotionDto): Promise<{
    valid: boolean;
    promotion?: Promotion;
    message?: string;
  }> {
    try {
      // Find promotion by code
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionCode: data.code },
        include: {
          parts: {
            select: {
              partId: true,
            },
          },
        },
      });

      if (!promotion) {
        return {
          valid: false,
          message: 'Invalid promotion code',
        };
      }

      // Check if promotion is active
      if (!promotion.isActive) {
        return {
          valid: false,
          message: 'Promotion is not active',
        };
      }

      // Check if promotion has started
      const now = new Date();
      if (now < promotion.startDate) {
        return {
          valid: false,
          message: 'Promotion has not started yet',
        };
      }

      // Check if promotion has expired
      if (now > promotion.endDate) {
        return {
          valid: false,
          message: 'Promotion has expired',
        };
      }

      // Check vendor restriction (if specified)
      if (data.vendorId && promotion.vendorId !== data.vendorId) {
        return {
          valid: false,
          message: 'Promotion not valid for this vendor',
        };
      }

      // Check minimum order value
      if (promotion.minimumOrderValue && data.cartValue && data.cartValue < promotion.minimumOrderValue) {
        return {
          valid: false,
          message: `Order must be at least ${promotion.minimumOrderValue} to use this promotion`,
        };
      }

      // Check if promotion is for specific parts
      if (promotion.parts.length > 0 && data.partIds && data.partIds.length > 0) {
        const promotionPartIds = promotion.parts.map(p => p.partId);
        const hasPromotionPart = data.partIds.some(id => promotionPartIds.includes(id));
        
        if (!hasPromotionPart) {
          return {
            valid: false,
            message: 'Promotion does not apply to selected items',
          };
        }
      }

      // Promotion is valid
      return {
        valid: true,
        promotion,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to validate promotion: ${error.message}`);
    }
  }

  /**
   * Calculate discount for a cart
   */
  async calculateDiscount(data: CalculateDiscountDto): Promise<{
    originalTotal: number;
    discountAmount: number;
    finalTotal: number;
    appliedItems: Array<{
      partId: string;
      originalPrice: number;
      discountedPrice: number;
      quantity: number;
    }>;
  }> {
    try {
      // Get promotion with parts
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: data.promotionId },
        include: {
          parts: {
            select: {
              partId: true,
            },
          },
        },
      });

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      // Check if promotion is valid
      const now = new Date();
      if (!promotion.isActive || now < promotion.startDate || now > promotion.endDate) {
        throw new BadRequestException('Promotion is not active');
      }

      // Check if cart meets minimum value
      if (promotion.minimumOrderValue && data.cartValue < promotion.minimumOrderValue) {
        throw new BadRequestException(`Order must be at least ${promotion.minimumOrderValue} to use this promotion`);
      }

      let originalTotal = 0;
      let discountAmount = 0;
      const appliedItems = [];
      const promotionPartIds = promotion.parts.map(p => p.partId);
      const hasSpecificParts = promotionPartIds.length > 0;

      // Calculate discount based on promotion type
      for (const item of data.cartItems) {
        const itemTotal = item.price * item.quantity;
        originalTotal += itemTotal;

        // Check if this item should have the promotion applied
        const shouldApplyPromotion = !hasSpecificParts || promotionPartIds.includes(item.partId);

        if (shouldApplyPromotion) {
          let itemDiscount = 0;

          if (promotion.type === PromotionType.DISCOUNT) {
            // Standard discount
            if (promotion.isPercentage) {
              itemDiscount = itemTotal * (promotion.discountValue / 100);
            } else {
              // Fixed amount discount, apply proportionally to each eligible item
              const eligibleItems = data.cartItems.filter(i => 
                !hasSpecificParts || promotionPartIds.includes(i.partId)
              );
              const eligibleTotal = eligibleItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
              const itemProportion = itemTotal / eligibleTotal;
              itemDiscount = promotion.discountValue * itemProportion;
            }
          } else if (promotion.type === PromotionType.BUNDLE) {
            // For bundle deals (e.g., buy 2 get 1 free), would need additional logic
            // This is a simplified example
            if (item.quantity >= 3) {
              // Example: Buy 2 Get 1 Free
              const freeItems = Math.floor(item.quantity / 3);
              itemDiscount = freeItems * item.price;
            }
          } else if (promotion.type === PromotionType.CLEARANCE) {
            // Clearance discounts are usually deeper
            if (promotion.isPercentage) {
              itemDiscount = itemTotal * (promotion.discountValue / 100);
            } else {
              itemDiscount = Math.min(itemTotal, promotion.discountValue);
            }
          }

          // Cap discount at the item total (no negative prices)
          itemDiscount = Math.min(itemDiscount, itemTotal);
          discountAmount += itemDiscount;

          appliedItems.push({
            partId: item.partId,
            originalPrice: item.price,
            discountedPrice: item.price - (itemDiscount / item.quantity),
            quantity: item.quantity,
          });
        } else {
          // Item not eligible for discount
          appliedItems.push({
            partId: item.partId,
            originalPrice: item.price,
            discountedPrice: item.price,
            quantity: item.quantity,
          });
        }
      }

      return {
        originalTotal,
        discountAmount,
        finalTotal: originalTotal - discountAmount,
        appliedItems,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to calculate discount: ${error.message}`);
    }
  }

  /**
   * Get active promotions for a part
   */
  async getPartPromotions(partId: string): Promise<Promotion[]> {
    try {
      const now = new Date();

      const partPromotions = await this.prisma.partPromotion.findMany({
        where: {
          partId,
        },
        include: {
          promotion: true,
        },
      });

      // Filter active promotions
      const activePromotions = partPromotions
        .filter(pp => 
          pp.promotion.isActive && 
          pp.promotion.startDate <= now && 
          pp.promotion.endDate >= now
        )
        .map(pp => pp.promotion);

      return activePromotions;
    } catch (error: any) {
      throw new BadRequestException(`Failed to get part promotions: ${error.message}`);
    }
  }

  /**
   * Get analytics for a promotion
   */
  async getPromotionAnalytics(promotionId: string): Promise<any> {
    try {
      // Validate promotion exists
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: promotionId },
      });

      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }

      // In a real implementation, you would query orders table
      // to find orders that used this promotion and calculate metrics
      // This is a simplified placeholder that could be expanded

      return {
        usageCount: 0, // placeholder
        totalRevenue: 0, // placeholder
        totalDiscount: 0, // placeholder
        averageOrderValue: 0, // placeholder
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        status: getPromotionStatus(promotion),
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get promotion analytics: ${error.message}`);
    }
  }
}

/**
 * Helper function to determine promotion status
 */
function getPromotionStatus(promotion: Promotion): string {
  const now = new Date();
  
  if (!promotion.isActive) {
    return 'Inactive';
  }
  
  if (now < promotion.startDate) {
    return 'Scheduled';
  }
  
  if (now > promotion.endDate) {
    return 'Expired';
  }
  
  return 'Active';
}

export default new PromotionService();