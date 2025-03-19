import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import jwt from 'jsonwebtoken';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader!.split(' ')[1];
    
    // Validate token
    const authService = new AuthService();
    const payload = await authService.validateToken(token);
    
    // Set user in request object
    req.user = {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId
    };
    
    next();
  } catch (error) {
     res.status(401).json({ message: 'Invalid or expired token' });
  }
};