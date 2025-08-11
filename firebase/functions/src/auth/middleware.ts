import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Errors, sendError } from '../utils/errors';
import { getConfig } from '../config';
import { logger } from '../logger';
import { AUTH } from '../constants';
import { FirestoreCollections, UserRoles } from '../shared/shared-types';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName: string;
    role?: typeof UserRoles.ADMIN | typeof UserRoles.USER;
  };
}
/**
 * Simple in-memory rate limiter
 */
class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requests = new Map<string, number[]>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(windowMs?: number, maxRequests?: number) {
    const config = getConfig();
    this.windowMs = windowMs ?? config.rateLimiting.windowMs;
    this.maxRequests = maxRequests ?? config.rateLimiting.maxRequests;
    
    // Periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), config.rateLimiting.cleanupIntervalMs);
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const userRequests = this.requests.get(userId) ?? [];
    const recentRequests = userRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);
    
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;
    
    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(time => time > windowStart);
      
      if (recentRequests.length === 0) {
        this.requests.delete(userId);
        cleaned++;
      } else if (recentRequests.length < timestamps.length) {
        this.requests.set(userId, recentRequests);
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} rate limit entries`);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.requests.clear();
  }
}

// Lazy-initialize rate limiter
let rateLimiter: InMemoryRateLimiter | null = null;

function getRateLimiter(): InMemoryRateLimiter {
  if (!rateLimiter) {
    rateLimiter = new InMemoryRateLimiter();
  }
  return rateLimiter;
}

/**
 * Clean up rate limiter resources (for testing)
 */
export function cleanupRateLimiter(): void {
  if (rateLimiter) {
    rateLimiter.destroy();
    rateLimiter = null;
  }
}

/**
 * Verify Firebase Auth token and attach user to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, Errors.UNAUTHORIZED(), correlationId);
    return;
  }

  const token = authHeader.substring(AUTH.BEARER_TOKEN_PREFIX_LENGTH); // Remove 'Bearer ' prefix

  try {
    // Verify ID token - no fallbacks or hacks
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Fetch full user profile from Firebase Auth
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    
    if (!userRecord.email || !userRecord.displayName) {
      throw new Error('User missing required fields: email and displayName are mandatory');
    }
    
    // Fetch user role from Firestore
    const userDocRef = admin.firestore().collection(FirestoreCollections.USERS).doc(userRecord.uid);
    const userDoc = await userDocRef.get();
    const userData = userDoc.data();
    
    // Default to "user" role for existing users without role field (backward compatibility)
    // New users should always have role field set during registration
    const userRole = userData?.role ?? UserRoles.USER;
    
    // Attach user information to request
    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: userRole,
    };
    // Check rate limit
    const isAllowed = getRateLimiter().isAllowed(decodedToken.uid);
    if (!isAllowed) {
      sendError(res, Errors.RATE_LIMIT_EXCEEDED(), correlationId);
      return;
    }

    next();
  } catch (error) {
    logger.errorWithContext('Token verification failed', error as Error, { correlationId });
    sendError(res, Errors.INVALID_TOKEN(), correlationId);
  }
};


/**
 * Admin middleware - requires user to be authenticated and have admin role
 * Must be used after authenticate middleware
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Check if user is authenticated (should be set by authenticate middleware)
  if (!req.user) {
    logger.warn('Admin access attempted without authentication', { correlationId });
    sendError(res, Errors.UNAUTHORIZED(), correlationId);
    return;
  }

  // Check if user has admin role
  if (req.user.role !== UserRoles.ADMIN) {
    logger.warn('Admin access denied - insufficient permissions', { 
      userId: req.user.uid,
      role: req.user.role,
      correlationId 
    });
    sendError(res, Errors.FORBIDDEN(), correlationId);
    return;
  }

  logger.info('Admin access granted', { 
    userId: req.user.uid,
    email: req.user.email,
    correlationId 
  });

  next();
};

/**
 * Combined middleware for admin endpoints - authenticates and checks admin role
 */
export const authenticateAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authenticate(req, res, async (error?: any) => {
      if (error) {
        next(error);
        return;
      }
      await requireAdmin(req, res, next);
    });
  } catch (error) {
    next(error);
  }
};
