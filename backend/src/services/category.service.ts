import { PrismaClient, Category } from '@prisma/client';

interface CategoryDto {
  name: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  commissionRate?: number;
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export class CategoryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all categories
   */
  async getAllCategories(includeInactive: boolean = false): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        children: true,
        parts: {
          where: { isActive: true },
          take: 10,
          select: {
            id: true,
            name: true,
            price: true,
            discountedPrice: true,
            images: true
          }
        }
      }
    });
  }

  /**
   * Create a new category
   */
  async createCategory(data: CategoryDto): Promise<Category> {
    // Validate category name uniqueness
    const existingCategory = await this.prisma.category.findFirst({
      where: { name: data.name }
    });

    if (existingCategory) {
      throw new Error('Category name already exists');
    }

    // If parent ID is provided, verify it exists
    if (data.parentId) {
      const parentCategory = await this.prisma.category.findUnique({
        where: { id: data.parentId }
      });

      if (!parentCategory) {
        throw new Error('Parent category not found');
      }
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        image: data.image,
        parentId: data.parentId,
        commissionRate: data.commissionRate
      }
    });
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, data: Partial<CategoryDto>): Promise<Category> {
    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // If updating name, check for uniqueness
    if (data.name && data.name !== category.name) {
      const existingCategory = await this.prisma.category.findFirst({
        where: { name: data.name }
      });

      if (existingCategory) {
        throw new Error('Category name already exists');
      }
    }

    // Prevent circular references in hierarchy
    if (data.parentId && data.parentId !== category.parentId) {
      // Cannot set self as parent
      if (data.parentId === categoryId) {
        throw new Error('A category cannot be its own parent');
      }

      // Check if the new parent is not a descendant of this category
      if (await this.isDescendant(categoryId, data.parentId)) {
        throw new Error('Cannot set a descendant as parent (circular reference)');
      }
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data
    });
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: true,
        parts: { take: 1 }
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Check if it has associated parts
    if (category.parts.length > 0) {
      throw new Error('Cannot delete category with associated parts');
    }

    // If it has children, update their parentId to the deleted category's parent
    if (category.children.length > 0) {
      await this.prisma.category.updateMany({
        where: { parentId: categoryId },
        data: { parentId: category.parentId }
      });
    }

    // Delete the category
    await this.prisma.category.delete({
      where: { id: categoryId }
    });
  }

  /**
   * Get category hierarchy tree
   */
  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    // First, get all categories
    const allCategories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' }
    });

    // Build a tree structure
    const categoryMap = new Map<string, CategoryTreeNode>();
    const rootCategories: CategoryTreeNode[] = [];

    // Initialize with empty children arrays
    allCategories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Fill in the children
    allCategories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;

      if (category.parentId) {
        // This is a child category, add to parent's children
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // If parent not found, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        // This is a root category
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  /**
   * Get categories with their immediate children
   */
  async getCategoriesWithChildren(): Promise<Category[]> {
    return this.prisma.category.findMany({
      include: {
        children: {
          select: {
            id: true,
            name: true,
            image: true,
            _count: { select: { parts: true } }
          }
        },
        _count: { select: { parts: true } }
      },
      where: { parentId: null },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get subcategories for a specific category
   */
  async getSubcategories(categoryId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { parentId: categoryId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { parts: true } }
      }
    });
  }

  /**
   * Update commission rate for a category
   */
  async updateCommissionRate(categoryId: string, commissionRate: number): Promise<Category> {
    // Validate commission rate
    if (commissionRate < 0 || commissionRate > 100) {
      throw new Error('Commission rate must be between 0 and 100');
    }

    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { commissionRate }
    });
  }

  /**
   * Get categories for navigation
   */
  async getNavigationCategories(): Promise<any[]> {
    // Get root categories with their immediate children
    const rootCategories = await this.prisma.category.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        image: true,
        children: {
          select: {
            id: true,
            name: true,
            image: true,
            _count: { select: { parts: true } }
          },
          orderBy: { name: 'asc' }
        },
        _count: { select: { parts: true } }
      },
      orderBy: { name: 'asc' }
    });

    return rootCategories;
  }

  /**
   * Get popular categories based on part count
   */
  async getPopularCategories(limit: number = 10): Promise<any[]> {
    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        _count: { select: { parts: true } }
      },
      orderBy: {
        parts: { _count: 'desc' }
      },
      take: limit
    });

    return categories;
  }

  /**
   * Helper to check if a category is a descendant of another
   * Used to prevent circular references
   */
  private async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    const descendant = await this.prisma.category.findUnique({
      where: { id: descendantId }
    });

    if (!descendant || !descendant.parentId) {
      return false;
    }

    if (descendant.parentId === ancestorId) {
      return true;
    }

    return this.isDescendant(ancestorId, descendant.parentId);
  }

  /**
   * Get the full ancestry path of a category
   */
  async getCategoryBreadcrumb(categoryId: string): Promise<Category[]> {
    const breadcrumb: Category[] = [];
    let currentId = categoryId;
    
    // Loop until we reach a category with no parent
    while (currentId) {
      const category = await this.prisma.category.findUnique({
        where: { id: currentId }
      });
      
      if (!category) break;
      
      breadcrumb.unshift(category); // Add to the beginning of the array
      currentId = category.parentId || '';
    }
    
    return breadcrumb;
  }
}

export default new CategoryService();