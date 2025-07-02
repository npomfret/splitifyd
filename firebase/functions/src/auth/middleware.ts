import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Errors, sendError } from '../utils/errors';
import { FLAT_CONFIG as CONFIG } from '../config/config';
import { logger } from '../utils/logger';

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
 * Firestore-based distributed rate limiter
 */
class FirestoreRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly collectionName = 'rate_limits';

  constructor(windowMs: number = CONFIG.RATE_LIMIT.WINDOW_MS, maxRequests: number = CONFIG.RATE_LIMIT.MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async isAllowed(userId: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const db = admin.firestore();
    const userRateLimitRef = db.collection(this.collectionName).doc(userId);
    
    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRateLimitRef);
        
        let requests: number[] = [];
        if (doc.exists) {
          const data = doc.data();
          requests = data?.requests || [];
        }
        
        // Filter out requests outside the window
        const recentRequests = requests.filter(time => time > windowStart);
        
        if (recentRequests.length >= this.maxRequests) {
          return false;
        }
        
        // Add current request and update document
        recentRequests.push(now);
        
        transaction.set(userRateLimitRef, {
          requests: recentRequests,
          lastUpdated: now,
        }, { merge: true });
        
        return true;
      });
      
      return result;
    } catch (error) {
      logger.errorWithContext('Rate limiter error', error as Error, { userId });
      // Fail closed - deny request if rate limiter fails to ensure security
      return false;
    }
  }

  // Cleanup old rate limit documents (should be called periodically)
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - (this.windowMs * 2); // Keep documents for 2x window period
    const db = admin.firestore();
    
    try {
      const query = db.collection(this.collectionName)
        .where('lastUpdated', '<', cutoff)
        .limit(100);
      
      const snapshot = await query.get();
      
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        logger.debug(`Cleaned up ${snapshot.size} old rate limit documents`);
      }
    } catch (error) {
      logger.errorWithContext('Rate limiter cleanup error', error as Error);
    }
  }
}

// Initialize Firestore-based rate limiter
const rateLimiter = new FirestoreRateLimiter();

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

    const correlationId = req.headers['x-correlation-id'] as string;
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, Errors.UNAUTHORIZED(), correlationId);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify the token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Attach user information to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };

      // Check rate limit
      const isAllowed = await rateLimiter.isAllowed(decodedToken.uid);
      if (!isAllowed) {
        return sendError(res, Errors.RATE_LIMIT_EXCEEDED(), correlationId);
      }

      next();
    } catch (error) {
      logger.errorWithContext('Token verification failed', error as Error, {
        correlationId,
      });
      return sendError(res, Errors.INVALID_TOKEN(), correlationId);
    }
  } catch (error) {
    logger.errorWithContext('Authentication middleware error', error as Error, {
      correlationId: req.headers['x-correlation-id'] as string,
    });
    return sendError(res, Errors.INTERNAL_ERROR(), req.headers['x-correlation-id'] as string);
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
        logger.warn('Optional auth token verification failed - proceeding without authentication', {
          correlationId: req.headers['x-correlation-id'] as string,
          tokenPrefix: token.substring(0, 10) + '...',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    
    next();
  } catch (error) {
    logger.errorWithContext('Optional auth middleware error', error as Error, {
      correlationId: req.headers['x-correlation-id'] as string,
    });
    next();
  }
};