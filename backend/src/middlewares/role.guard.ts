import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

export const roleGuard = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
       res.status(403).json({ message: 'Access forbidden: insufficient permissions' });
    }
    
    next();
  };
};