import { Request, Response } from 'express';
import userService from '../services/user.service';
import { UserRole, AdminPermission } from '@prisma/client';

export class UserController {
  /**
   * Get user profile
   */
  async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      // Use authenticated user's ID or admin-provided ID
      const userId = req.params.userId || req.user?.userId;

      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }

      // Check if user is requesting their own profile or if an admin is requesting another user's profile
      if (req.params.userId && req.params.userId !== req.user?.userId && req.user?.role !== UserRole.ADMIN) {
        res.status(403).json({ message: 'Unauthorized to access this profile' });
        return;
      }

      const profileData = await userService.getUserProfile(userId);
      res.status(200).json({
        message: 'Profile retrieved successfully',
        data: profileData
      });
    } catch (error: any) {
      res.status(error.message === 'User not found' ? 404 : 500).json({
        message: 'Failed to retrieve profile',
        error: error.message
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      // Combine userId with profile data from request body
      const profileData = {
        userId,
        ...req.body
      };

      const updatedProfile = await userService.updateProfile(profileData);
      res.status(200).json({
        message: 'Profile updated successfully',
        data: updatedProfile
      });
    } catch (error: any) {
      res.status(error.message.includes('not found') ? 404 : 400).json({
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }

  /**
   * Update account settings
   */
  async updateAccountSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      // Combine userId with settings data
      const settingsData = {
        userId,
        ...req.body
      };

      const result = await userService.updateAccountSettings(settingsData);
      res.status(200).json({
        message: 'Account settings updated successfully',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Failed to update account settings',
        error: error.message
      });
    }
  }

  /**
   * Update user permissions (admin only)
   */
  async updateUserPermissions(req: Request, res: Response): Promise<void> {
    try {
      const adminId = req.user?.userId;
      const { targetUserId, newRole, adminPermission } = req.body;
      
      if (!adminId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      if (!targetUserId) {
        res.status(400).json({ message: 'Target user ID is required' });
        return;
      }

      const result = await userService.updateUserPermissions(
        adminId,
        targetUserId,
        newRole,
        adminPermission
      );
      
      res.status(200).json({
        message: 'User permissions updated successfully',
        data: result
      });
    } catch (error: any) {
      // Determine appropriate status code based on error message
      let statusCode = 500;
      if (error.message.includes('Unauthorized')) {
        statusCode = 403;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      } else {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        message: 'Failed to update user permissions',
        error: error.message
      });
    }
  }

  /**
   * Update user active status (admin only)
   */
  async updateUserActiveStatus(req: Request, res: Response): Promise<void> {
    try {
      const adminId = req.user?.userId;
      const { targetUserId, isActive } = req.body;
      
      if (!adminId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      if (!targetUserId) {
        res.status(400).json({ message: 'Target user ID is required' });
        return;
      }

      if (isActive === undefined) {
        res.status(400).json({ message: 'Active status is required' });
        return;
      }

      const result = await userService.updateUserActiveStatus(
        adminId,
        targetUserId,
        isActive
      );
      
      res.status(200).json({
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: result
      });
    } catch (error: any) {
      // Determine appropriate status code based on error message
      let statusCode = 500;
      if (error.message.includes('Unauthorized')) {
        statusCode = 403;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      } else {
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        message: 'Failed to update user status',
        error: error.message
      });
    }
  }

  /**
   * Submit verification documents (for vendors and drivers)
   */
  async submitVerificationDocuments(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const { type, documents, additionalInfo } = req.body;
      
      if (!type || !documents || !Array.isArray(documents) || documents.length === 0) {
        res.status(400).json({ message: 'Valid type and documents are required' });
        return;
      }

      const result = await userService.submitVerificationDocuments({
        userId,
        type,
        documents,
        additionalInfo
      });
      
      res.status(200).json({
        message: result.message,
      });
    } catch (error: any) {
      let statusCode = 400;
      if (error.message.includes('not found')) {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        message: 'Failed to submit verification documents',
        error: error.message
      });
    }
  }

  /**
   * Process verification decision (admin only)
   */
  async processVerificationDecision(req: Request, res: Response): Promise<void> {
    try {
      const reviewedBy = req.user?.userId;
      
      if (!reviewedBy) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const { userId, type, isApproved, rejectionReason } = req.body;
      
      if (!userId || !type || isApproved === undefined) {
        res.status(400).json({ message: 'User ID, type, and approval decision are required' });
        return;
      }

      // Require rejection reason if not approved
      if (!isApproved && !rejectionReason) {
        res.status(400).json({ message: 'Rejection reason is required when denying verification' });
        return;
      }

      const result = await userService.processVerificationDecision({
        userId,
        type,
        isApproved,
        rejectionReason,
        reviewedBy
      });
      
      res.status(200).json({
        message: result.message,
        data: { isVerified: result.isVerified }
      });
    } catch (error: any) {
      let statusCode = 400;
      if (error.message.includes('Unauthorized')) {
        statusCode = 403;
      } else if (error.message.includes('not found')) {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        message: 'Failed to process verification decision',
        error: error.message
      });
    }
  }

  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const { token, device, platform } = req.body;
      
      if (!token) {
        res.status(400).json({ message: 'Device token is required' });
        return;
      }

      const result = await userService.registerDeviceToken({
        userId,
        token,
        device,
        platform
      });
      
      res.status(200).json({
        message: result.message
      });
    } catch (error: any) {
      res.status(400).json({
        message: 'Failed to register device token',
        error: error.message
      });
    }
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;
      
      if (!userId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      if (!token) {
        res.status(400).json({ message: 'Device token is required' });
        return;
      }

      const result = await userService.removeDeviceToken(userId, token);
      
      res.status(200).json({
        message: result.message
      });
    } catch (error: any) {
      let statusCode = 400;
      if (error.message.includes('not found')) {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        message: 'Failed to remove device token',
        error: error.message
      });
    }
  }

  /**
   * Get all device tokens for a user
   */
  async getUserDeviceTokens(req: Request, res: Response): Promise<void> {
    try {
      // Use authenticated user's ID or admin can request for any user
      const requestedUserId = req.params.userId;
      const authenticatedUserId = req.user?.userId;
      const isAdmin = req.user?.role === UserRole.ADMIN;
      
      if (!authenticatedUserId) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      // Only allow users to get their own tokens, unless they're an admin
      const userId = requestedUserId && isAdmin ? requestedUserId : authenticatedUserId;

      // If a non-admin is trying to access another user's tokens
      if (requestedUserId && requestedUserId !== authenticatedUserId && !isAdmin) {
        res.status(403).json({ message: 'Unauthorized to access this resource' });
        return;
      }

      const deviceTokens = await userService.getUserDeviceTokens(userId);
      
      res.status(200).json({
        message: 'Device tokens retrieved successfully',
        data: deviceTokens
      });
    } catch (error: any) {
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        message: 'Failed to retrieve device tokens',
        error: error.message
      });
    }
  }

  /**
   * Get users by role (admin only)
   */
  async getUsersByRole(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        res.status(403).json({ message: 'Unauthorized: Admin access required' });
        return;
      }

      const { role } = req.params;
      
      if (!role || !Object.values(UserRole).includes(role as UserRole)) {
        res.status(400).json({ message: 'Valid user role is required' });
        return;
      }

      // This functionality would need to be implemented in the UserService
      // For now, we'll respond with a not implemented message
      res.status(501).json({
        message: 'This endpoint is not implemented yet'
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to retrieve users',
        error: error.message
      });
    }
  }

  /**
   * Get pending verification requests (admin only)
   */
  async getPendingVerifications(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        res.status(403).json({ message: 'Unauthorized: Admin access required' });
        return;
      }

      const { type } = req.query;
      
      // Validate type if provided
      if (type && !['VENDOR', 'DRIVER', 'ALL'].includes(type as string)) {
        res.status(400).json({ message: 'Type must be VENDOR, DRIVER, or ALL' });
        return;
      }

      // This functionality would need to be implemented in the UserService
      // For now, we'll respond with a not implemented message
      res.status(501).json({
        message: 'This endpoint is not implemented yet'
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to retrieve pending verifications',
        error: error.message
      });
    }
  }
}

export default new UserController();