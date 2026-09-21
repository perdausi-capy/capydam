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

const JWT_SECRET = process.env.JWT_SECRET || 'secret'; 

export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  // ✅ NEW: Allow MCP Server to bypass JWT if it provides the correct API Key
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.MCP_API_KEY) {
    // Mock an MCP admin user for the request
    (req as AuthRequest).user = { id: 'mcp-server', email: 'mcp@capydam.com', role: 'admin' };
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid token' });
    return;
  }
};

// ✅ ADD THIS FUNCTION
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Cast to AuthRequest to access .user
  const authReq = req as AuthRequest;
  
  if (!authReq.user || authReq.user.role !== 'admin') {
     res.status(403).json({ message: 'Admin access required' });
     return;
  }
  
  next();
};