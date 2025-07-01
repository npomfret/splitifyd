import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Errors, sendError } from '../utils/errors';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Filter out requests outside the window
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [userId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < this.windowMs);
      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, recentRequests);
      }
    }
  }
}

// Initialize rate limiter (10 requests per minute)
const rateLimiter = new RateLimiter(60000, 10);

/**
 * Verify Firebase Auth token and attach user to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, Errors.UNAUTHORIZED());
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the token
      console.log('🔐 Verifying token with Firebase Auth...');
      console.log('🔐 Auth emulator host:', process.env.FIREBASE_AUTH_EMULATOR_HOST || 'production');
      
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      console.log('✅ Token verified successfully for user:', decodedToken.uid);
      
      // Attach user information to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };

      // Check rate limit
      if (!rateLimiter.isAllowed(decodedToken.uid)) {
        return sendError(res, Errors.RATE_LIMIT_EXCEEDED());
      }

      next();
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      console.error('❌ Token length:', token.length);
      console.error('❌ Token preview:', token.substring(0, 50) + '...');
      return sendError(res, Errors.INVALID_TOKEN());
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return sendError(res, Errors.INTERNAL_ERROR());
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
        };
      } catch (error) {
        // Token is invalid, but we don't fail the request
        console.warn('Invalid token in optional auth:', error);
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};