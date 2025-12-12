import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 1. Export this interface so we can use it in Controllers
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret'; // Make sure this matches your .env default

export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    // Explicitly return to satisfy void return type
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Attach decoded user to the request object
    (req as AuthRequest).user = decoded;
    
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid token' });
    return;
  }
};