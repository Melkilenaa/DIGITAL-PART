import { Request, Response } from 'express';
import categoryService from '../services/category.service';

export class CategoryController {
  /**
   * Get all categories
   */
  async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await categoryService.getAllCategories(includeInactive);
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve categories'
      });
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      const category = await categoryService.getCategoryById(categoryId);
      
      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve category'
      });
    }
  }

  /**
   * Create a new category
   */
  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const categoryData = req.body;
      
      // Validate required fields
      if (!categoryData.name) {
        res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
        return;
      }

      // Handle image upload if file is present
      if (req.file) {
        categoryData.image = req.file.path;
      }
      
      // Parse numeric fields
      if (categoryData.commissionRate) {
        categoryData.commissionRate = parseFloat(categoryData.commissionRate);
      }
      
      // Handle empty parentId
      if (categoryData.parentId === '') {
        categoryData.parentId = null;
      }

      const newCategory = await categoryService.createCategory(categoryData);
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: newCategory
      });
    } catch (error: any) {
      console.error('Category creation error:', error);
      const statusCode = 
        error.message === 'Category name already exists' || 
        error.message === 'Parent category not found' ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create category'
      });
    }
  }

  /**
   * Update a category
   */
  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const categoryData = req.body;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      // Handle image upload if file is present
      if (req.file) {
        categoryData.image = req.file.path;
      }
      
      // Parse numeric fields
      if (categoryData.commissionRate) {
        categoryData.commissionRate = parseFloat(categoryData.commissionRate);
      }
      
      // Handle empty parentId
      if (categoryData.parentId === '') {
        categoryData.parentId = null;
      }

      const updatedCategory = await categoryService.updateCategory(categoryId, categoryData);
      
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Category not found') {
        statusCode = 404;
      } else if (
        error.message === 'Category name already exists' || 
        error.message === 'A category cannot be its own parent' ||
        error.message === 'Cannot set a descendant as parent (circular reference)'
      ) {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update category'
      });
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      await categoryService.deleteCategory(categoryId);
      
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Category not found') {
        statusCode = 404;
      } else if (error.message === 'Cannot delete category with associated parts') {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to delete category'
      });
    }
  }

  /**
   * Get category hierarchy tree
   */
  async getCategoryTree(req: Request, res: Response): Promise<void> {
    try {
      const categoryTree = await categoryService.getCategoryTree();
      
      res.status(200).json({
        success: true,
        data: categoryTree
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve category tree'
      });
    }
  }

  /**
   * Get categories with their immediate children
   */
  async getCategoriesWithChildren(req: Request, res: Response): Promise<void> {
    try {
      const categories = await categoryService.getCategoriesWithChildren();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve categories with children'
      });
    }
  }

  /**
   * Get subcategories for a specific category
   */
  async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      const subcategories = await categoryService.getSubcategories(categoryId);
      
      res.status(200).json({
        success: true,
        data: subcategories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve subcategories'
      });
    }
  }

  /**
   * Update commission rate for a category
   */
  async updateCommissionRate(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const { commissionRate } = req.body;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      if (commissionRate === undefined || commissionRate === null) {
        res.status(400).json({
          success: false,
          message: 'Commission rate is required'
        });
        return;
      }

      const parsedCommissionRate = parseFloat(commissionRate);
      if (isNaN(parsedCommissionRate)) {
        res.status(400).json({
          success: false,
          message: 'Commission rate must be a number'
        });
        return;
      }

      const updatedCategory = await categoryService.updateCommissionRate(categoryId, parsedCommissionRate);
      
      res.status(200).json({
        success: true,
        message: 'Commission rate updated successfully',
        data: updatedCategory
      });
    } catch (error: any) {
      let statusCode = 500;
      
      if (error.message === 'Category not found') {
        statusCode = 404;
      } else if (error.message === 'Commission rate must be between 0 and 100') {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update commission rate'
      });
    }
  }

  /**
   * Get categories for navigation
   */
  async getNavigationCategories(req: Request, res: Response): Promise<void> {
    try {
      const navigationCategories = await categoryService.getNavigationCategories();
      
      res.status(200).json({
        success: true,
        data: navigationCategories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve navigation categories'
      });
    }
  }

  /**
   * Get popular categories based on part count
   */
  async getPopularCategories(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          message: 'Limit must be a positive number'
        });
        return;
      }

      const popularCategories = await categoryService.getPopularCategories(limit);
      
      res.status(200).json({
        success: true,
        data: popularCategories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve popular categories'
      });
    }
  }

  /**
   * Get the full ancestry path of a category (breadcrumb)
   */
  async getCategoryBreadcrumb(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      if (!categoryId) {
        res.status(400).json({
          success: false,
          message: 'Category ID is required'
        });
        return;
      }

      const breadcrumb = await categoryService.getCategoryBreadcrumb(categoryId);
      
      res.status(200).json({
        success: true,
        data: breadcrumb
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve category breadcrumb'
      });
    }
  }
}

export default new CategoryController();