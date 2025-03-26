import { PrismaClient } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class OrderItemService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add an item to an order
   */
  async addItemToOrder(orderId: string, partId: string, quantity: number, notes?: string) {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    
    // Check if part exists and has enough stock
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });
    
    if (!part) {
      throw new NotFoundException('Part not found');
    }
    
    if (part.stockQuantity < quantity) {
      throw new BadRequestException(`Only ${part.stockQuantity} items available in stock`);
    }
    
    // Check if order exists and is in a state that allows adding items
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    if (!['RECEIVED', 'PROCESSING'].includes(order.orderStatus)) {
      throw new BadRequestException('Cannot add items to this order');
    }
    
    // Calculate subtotal using current price or discounted price if available
    const unitPrice = part.discountedPrice || part.price;
    const subtotal = unitPrice * quantity;
    
    // Add item to order as transaction
    return this.prisma.$transaction(async (tx) => {
      // Create order item
      const orderItem = await tx.orderItem.create({
        data: {
          orderId,
          partId,
          quantity,
          unitPrice,
          subtotal,
          notes
        }
      });
      
      // Update part stock
      await tx.part.update({
        where: { id: partId },
        data: {
          stockQuantity: { decrement: quantity }
        }
      });
      
      // Recalculate order totals
      await this.recalculateOrderTotals(tx, orderId);
      
      return orderItem;
    });
  }

  /**
   * Update quantity of an item in an order
   */
  async updateItemQuantity(orderItemId: string, newQuantity: number) {
    if (newQuantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    
    // Get the order item
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { 
        part: true,
        order: true
      }
    });
    
    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }
    
    // Check if order is in a modifiable state
    if (!['RECEIVED', 'PROCESSING'].includes(orderItem.order.orderStatus)) {
      throw new BadRequestException('Cannot modify items in this order');
    }
    
    const quantityDifference = newQuantity - orderItem.quantity;
    
    // If increasing quantity, check stock
    if (quantityDifference > 0) {
      if (orderItem.part.stockQuantity < quantityDifference) {
        throw new BadRequestException(`Only ${orderItem.part.stockQuantity} additional items available in stock`);
      }
    }
    
    // Calculate new subtotal
    const subtotal = orderItem.unitPrice * newQuantity;
    
    // Update as transaction
    return this.prisma.$transaction(async (tx) => {
      // Update order item
      const updatedItem = await tx.orderItem.update({
        where: { id: orderItemId },
        data: {
          quantity: newQuantity,
          subtotal
        }
      });
      
      // Update part stock
      await tx.part.update({
        where: { id: orderItem.partId },
        data: {
          stockQuantity: { decrement: quantityDifference }
        }
      });
      
      // Recalculate order totals
      await this.recalculateOrderTotals(tx, orderItem.orderId);
      
      return updatedItem;
    });
  }

  /**
   * Remove an item from an order
   */
  async removeItemFromOrder(orderItemId: string) {
    // Get the order item
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true }
    });
    
    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }
    
    // Check if order is in a modifiable state
    if (!['RECEIVED', 'PROCESSING'].includes(orderItem.order.orderStatus)) {
      throw new BadRequestException('Cannot remove items from this order');
    }
    
    // Remove item as transaction
    return this.prisma.$transaction(async (tx) => {
      // Delete the order item
      await tx.orderItem.delete({
        where: { id: orderItemId }
      });
      
      // Return stock to inventory
      await tx.part.update({
        where: { id: orderItem.partId },
        data: {
          stockQuantity: { increment: orderItem.quantity }
        }
      });
      
      // Recalculate order totals
      await this.recalculateOrderTotals(tx, orderItem.orderId);
      
      return { message: 'Item removed successfully' };
    });
  }

  /**
   * Calculate total for items in an order
   */
  async calculateOrderTotals(orderId: string) {
    // Get all items for the order
    const items = await this.prisma.orderItem.findMany({
      where: { orderId }
    });
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    
    return {
      subtotal,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  /**
   * Recalculate and update order totals
   */
  async recalculateOrderTotals(tx: any, orderId: string) {
    // Get order with items
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        vendor: true
      }
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    // Calculate new subtotal
    const subtotal = order.items.reduce((sum: number, item: { subtotal: number }) => sum + item.subtotal, 0);
    
    // Recalculate tax and total
    const tax = subtotal * 0.075; // 7.5% VAT
    const total = subtotal + tax + order.deliveryFee - order.discount;
    
    // Calculate commission for vendor
    const commissionRate = order.vendor.commissionRate || 5.0;
    const commissionAmount = (subtotal * commissionRate) / 100;
    const vendorEarning = subtotal - commissionAmount;
    
    // Update order
    return tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        tax,
        total,
        commissionAmount,
        vendorEarning
      }
    });
  }

  /**
   * Apply a promotion to eligible items
   */
  async applyPromotionToItems(orderId: string, promotionCode: string) {
    // Find the promotion
    const promotion = await this.prisma.promotion.findUnique({
      where: { promotionCode },
      include: { parts: true }
    });
    
    if (!promotion || !promotion.isActive) {
      throw new BadRequestException('Invalid or inactive promotion code');
    }
    
    // Check if promotion is valid (date range)
    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) {
      throw new BadRequestException('Promotion is not active at this time');
    }
    
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    
    if (order.subtotal < (promotion.minimumOrderValue || 0)) {
      throw new BadRequestException(`Order minimum value is ₦${promotion.minimumOrderValue}`);
    }
    
    // Get eligible part IDs from the promotion
    const eligiblePartIds = promotion.parts.map(p => p.partId);
    
    // Get eligible order items
    const eligibleItems = order.items.filter(item => 
      eligiblePartIds.length === 0 || eligiblePartIds.includes(item.partId)
    );
    
    if (eligibleItems.length === 0) {
      throw new BadRequestException('No eligible items for this promotion');
    }
    
    // Calculate total discount
    let totalDiscount = 0;
    
    if (promotion.isPercentage) {
      // Percentage discount on eligible items
      const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.subtotal, 0);
      totalDiscount = eligibleSubtotal * (promotion.discountValue / 100);
    } else {
      // Fixed amount discount
      totalDiscount = promotion.discountValue;
    }
    
    // Apply discount to order (limit to subtotal)
    totalDiscount = Math.min(totalDiscount, order.subtotal);
    
    // Update order with discount
    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          discount: totalDiscount,
          total: order.subtotal + order.tax + order.deliveryFee - totalDiscount
        }
      });
      
      return {
        appliedItems: eligibleItems.length,
        totalDiscount,
        updatedOrder
      };
    });
  }
}

export default new OrderItemService(new PrismaClient());