import { PrismaClient, Part, PartCondition } from '@prisma/client';

interface PartDto {
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
  specifications?: any;
  compatibleVehicles?: any;
  weight?: number;
  dimensions?: string;
  categoryId: string;
  vendorId: string;
  tags?: string[];
  isActive?: boolean;
}

interface PartFilterOptions {
  search?: string;
  categoryId?: string;
  vendorId?: string;
  condition?: PartCondition;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  tags?: string[];
  inStock?: boolean;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface VehicleFilterInput {
  make: string;
  model: string;
  year: number;
}

export class PartService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all parts with filters
   */
  async getAllParts(
    options: PartFilterOptions = {}
  ): Promise<{ parts: Part[]; total: number }> {
    // Build filter conditions
    const filterConditions: any = {};

    // Apply text search on name, description, part number, etc.
    if (options.search) {
      filterConditions.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { partNumber: { contains: options.search, mode: 'insensitive' } },
        { brand: { contains: options.search, mode: 'insensitive' } },
        { tags: { has: options.search } }
      ];
    }

    // Apply category filter
    if (options.categoryId) {
      filterConditions.categoryId = options.categoryId;
    }

    // Apply vendor filter
    if (options.vendorId) {
      filterConditions.vendorId = options.vendorId;
    }

    // Apply condition filter
    if (options.condition) {
      filterConditions.condition = options.condition;
    }

    // Apply price range filter
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filterConditions.OR = [
        { 
          price: {
            ...(options.minPrice !== undefined && { gte: options.minPrice }),
            ...(options.maxPrice !== undefined && { lte: options.maxPrice })
          }
        },
        { 
          discountedPrice: {
            ...(options.minPrice !== undefined && { gte: options.minPrice }),
            ...(options.maxPrice !== undefined && { lte: options.maxPrice })
          }
        }
      ];
    }

    // Apply brand filter
    if (options.brand) {
      filterConditions.brand = { equals: options.brand, mode: 'insensitive' };
    }

    // Apply tags filter
    if (options.tags && options.tags.length > 0) {
      filterConditions.tags = { hasSome: options.tags };
    }

    // Apply stock filter
    if (options.inStock !== undefined) {
      filterConditions.stockQuantity = options.inStock ? { gt: 0 } : { equals: 0 };
    }

    // Apply active filter
    if (options.isActive !== undefined) {
      filterConditions.isActive = options.isActive;
    }

    // Count total items matching the filter
    const total = await this.prisma.part.count({
      where: filterConditions
    });

    // Set default pagination and sorting
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    // Get parts with pagination and sorting
    const parts = await this.prisma.part.findMany({
      where: filterConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            rating: true,
            totalRatings: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    return { parts, total };
  }

  /**
   * Get part by ID
   */
  async getPartById(partId: string): Promise<Part | null> {
    return this.prisma.part.findUnique({
      where: { id: partId },
      include: {
        category: true,
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            businessDescription: true,
            rating: true,
            totalRatings: true,
            address: true,
            city: true,
            state: true
          }
        },
        promotions: {
          include: {
            promotion: true
          }
        }
      }
    });
  }

  /**
   * Create a new part
   */
  async createPart(data: PartDto): Promise<Part> {
    // Verify the category exists
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Verify the vendor exists
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: data.vendorId }
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Ensure part data is properly formatted
    const partData = {
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
      isActive: data.isActive !== undefined ? data.isActive : true
    };

    return this.prisma.part.create({
      data: partData
    });
  }

  /**
   * Update an existing part
   */
  async updatePart(partId: string, data: Partial<PartDto>): Promise<Part> {
    // Verify the part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // If updating category, verify it exists
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId }
      });

      if (!category) {
        throw new Error('Category not found');
      }
    }

    // If updating vendor, verify it exists
    if (data.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: data.vendorId }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }
    }

    // Update the part
    return this.prisma.part.update({
      where: { id: partId },
      data
    });
  }

  /**
   * Delete a part
   */
  async deletePart(partId: string): Promise<void> {
    // Check if part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      include: {
        orderItems: { take: 1 }
      }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // If part has order history, we should soft delete instead
    if (part.orderItems.length > 0) {
      await this.prisma.part.update({
        where: { id: partId },
        data: { isActive: false }
      });
    } else {
      // Hard delete if no order history
      await this.prisma.part.delete({
        where: { id: partId }
      });
    }
  }

  /**
   * Update part stock quantity
   */
  async updateStock(partId: string, quantity: number): Promise<Part> {
    // Verify the part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Validate quantity
    if (quantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    // Update stock quantity
    return this.prisma.part.update({
      where: { id: partId },
      data: { stockQuantity: quantity }
    });
  }

  /**
   * Apply discount to a part
   */
  async applyDiscount(partId: string, discountedPrice: number): Promise<Part> {
    // Verify the part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Validate discount
    if (discountedPrice >= part.price) {
      throw new Error('Discounted price must be less than original price');
    }

    if (discountedPrice < 0) {
      throw new Error('Discounted price cannot be negative');
    }

    // Apply discount
    return this.prisma.part.update({
      where: { id: partId },
      data: { discountedPrice }
    });
  }

  /**
   * Remove discount from a part
   */
  async removeDiscount(partId: string): Promise<Part> {
    // Verify the part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Remove discount
    return this.prisma.part.update({
      where: { id: partId },
      data: { discountedPrice: null }
    });
  }

  /**
   * Find parts compatible with a specific vehicle
   */
  async findCompatibleParts(
    vehicle: VehicleFilterInput,
    options: PartFilterOptions = {}
  ): Promise<{ parts: Part[]; total: number }> {
    // Build the vehicle compatibility filter
    const makeModel = `${vehicle.make}|${vehicle.model}`;
    const makeModelYear = `${vehicle.make}|${vehicle.model}|${vehicle.year}`;

    // Build the filters
    const filterConditions: any = {
      OR: [
        {
          compatibleVehicles: {
            path: '$[*].make',
            array_contains: vehicle.make,
            mode: 'insensitive'
          }
        },
        {
          compatibleVehicles: {
            path: '$[*].makeModel',
            array_contains: makeModel,
            mode: 'insensitive'
          }
        },
        {
          compatibleVehicles: {
            path: '$[*].makeModelYear',
            array_contains: makeModelYear,
            mode: 'insensitive'
          }
        }
      ]
    };

    // Apply additional filters from options
    if (options.categoryId) {
      filterConditions.categoryId = options.categoryId;
    }

    if (options.vendorId) {
      filterConditions.vendorId = options.vendorId;
    }

    if (options.condition) {
      filterConditions.condition = options.condition;
    }

    if (options.brand) {
      filterConditions.brand = { equals: options.brand, mode: 'insensitive' };
    }

    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filterConditions.OR = [
        { 
          price: {
            ...(options.minPrice !== undefined && { gte: options.minPrice }),
            ...(options.maxPrice !== undefined && { lte: options.maxPrice })
          }
        },
        { 
          discountedPrice: {
            ...(options.minPrice !== undefined && { gte: options.minPrice }),
            ...(options.maxPrice !== undefined && { lte: options.maxPrice })
          }
        }
      ];
    }

    // Usually we want in-stock items for compatibility searches
    if (options.inStock !== false) {
      filterConditions.stockQuantity = { gt: 0 };
    }

    // Active parts only by default
    if (options.isActive !== false) {
      filterConditions.isActive = true;
    }

    // Count total items matching the filter
    const total = await this.prisma.part.count({
      where: filterConditions
    });

    // Set default pagination and sorting
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const sortBy = options.sortBy || 'price';
    const sortOrder = options.sortOrder || 'asc';

    // Get parts with pagination and sorting
    const parts = await this.prisma.part.findMany({
      where: filterConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            rating: true,
            totalRatings: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    return { parts, total };
  }

  /**
   * Track a part as recently viewed by a customer
   */
  async trackRecentlyViewed(customerId: string, partId: string): Promise<void> {
    // Verify the part exists
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Verify the customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Check if this part was already viewed by this customer
    const existingView = await this.prisma.recentlyViewed.findFirst({
      where: {
        customerId,
        partId
      }
    });

    if (existingView) {
      // Update the timestamp for the existing view
      await this.prisma.recentlyViewed.update({
        where: { id: existingView.id },
        data: { viewedAt: new Date() }
      });
    } else {
      // Create a new recently viewed record
      await this.prisma.recentlyViewed.create({
        data: {
          customerId,
          partId
        }
      });
    }

    // Cleanup old views if needed (keep only the latest 50)
    const viewCount = await this.prisma.recentlyViewed.count({
      where: { customerId }
    });

    if (viewCount > 50) {
      const oldViews = await this.prisma.recentlyViewed.findMany({
        where: { customerId },
        orderBy: { viewedAt: 'asc' },
        take: viewCount - 50
      });

      if (oldViews.length > 0) {
        await this.prisma.recentlyViewed.deleteMany({
          where: {
            id: {
              in: oldViews.map(view => view.id)
            }
          }
        });
      }
    }
  }

  /**
   * Get recently viewed parts for a customer
   */
  async getRecentlyViewedParts(
    customerId: string,
    limit: number = 10
  ): Promise<Part[]> {
    const recentlyViewed = await this.prisma.recentlyViewed.findMany({
      where: { customerId },
      orderBy: { viewedAt: 'desc' },
      take: limit,
      include: {
        part: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            },
            vendor: {
              select: {
                id: true,
                businessName: true,
                businessLogo: true,
                rating: true
              }
            }
          }
        }
      }
    });

    return recentlyViewed.map(rv => rv.part);
  }

  /**
   * Get popular parts (most ordered)
   */
  async getPopularParts(limit: number = 10): Promise<Part[]> {
    // We need to join with order items and count the occurrences
    const popularPartsIds = await this.prisma.orderItem.groupBy({
      by: ['partId'],
      _count: { _all: true },
      orderBy: { _count: { partId: 'desc' } },
      take: limit
    });

    if (popularPartsIds.length === 0) {
      return [];
    }

    // Fetch the actual part details
    return this.prisma.part.findMany({
      where: {
        id: { in: popularPartsIds.map(item => item.partId) },
        isActive: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            rating: true
          }
        }
      },
      orderBy: {
        orderItems: {
          _count: 'desc'
        }
      },
      take: limit
    });
  }

  /**
   * Get related parts based on category and tags
   */
  async getRelatedParts(partId: string, limit: number = 5): Promise<Part[]> {
    // Get the reference part
    const part = await this.prisma.part.findUnique({
      where: { id: partId }
    });

    if (!part) {
      throw new Error('Part not found');
    }

    // Find related parts by category and tags
    return this.prisma.part.findMany({
      where: {
        id: { not: partId },
        isActive: true,
        OR: [
          { categoryId: part.categoryId },
          { tags: { hasSome: part.tags } }
        ]
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Search parts by keyword
   */
  async searchParts(
    keyword: string,
    options: PartFilterOptions = {}
  ): Promise<{ parts: Part[]; total: number }> {
    // Build search conditions
    const searchConditions: any = {
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { partNumber: { contains: keyword, mode: 'insensitive' } },
        { brand: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } }
      ]
    };

    // Apply additional filters
    if (options.categoryId) {
      searchConditions.categoryId = options.categoryId;
    }

    if (options.vendorId) {
      searchConditions.vendorId = options.vendorId;
    }

    if (options.condition) {
      searchConditions.condition = options.condition;
    }

    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      searchConditions.AND = searchConditions.AND || [];
      searchConditions.AND.push({
        OR: [
          { 
            price: {
              ...(options.minPrice !== undefined && { gte: options.minPrice }),
              ...(options.maxPrice !== undefined && { lte: options.maxPrice })
            }
          },
          { 
            discountedPrice: {
              ...(options.minPrice !== undefined && { gte: options.minPrice }),
              ...(options.maxPrice !== undefined && { lte: options.maxPrice })
            }
          }
        ]
      });
    }

    // Usually we want in-stock items for searches
    if (options.inStock !== false) {
      searchConditions.stockQuantity = { gt: 0 };
    }

    // Active parts only by default
    if (options.isActive !== false) {
      searchConditions.isActive = true;
    }

    // Count total items matching the search
    const total = await this.prisma.part.count({
      where: searchConditions
    });

    // Set default pagination and sorting
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const sortBy = options.sortBy || 'relevance';
    const sortOrder = options.sortOrder || 'desc';

    // Special handling for relevance sorting
    let orderBy: any;
    if (sortBy === 'relevance') {
      // For relevance, we prioritize exact matches in name, then part number, then brand
      orderBy = [
        { name: 'asc' }, // Sort alphabetically by name
        { partNumber: 'asc' }, // Then by part number
        { createdAt: 'desc' } // Then by newest first
      ];
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    // Get parts with pagination and sorting
    const parts = await this.prisma.part.findMany({
      where: searchConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            businessLogo: true,
            rating: true
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    });

    return { parts, total };
  }

  /**
   * Get top brands with part counts
   */
  async getTopBrands(limit: number = 10): Promise<any[]> {
    const brands = await this.prisma.part.groupBy({
      by: ['brand'],
      _count: { _all: true },
      where: {
        brand: { not: null },
        isActive: true
      },
      orderBy: { _count: { id: 'desc' } },
      take: limit
    });

    return brands.map(brand => ({
      brand: brand.brand,
      count: brand._count?._all || 0
    }));
  }
}

export default new PartService();