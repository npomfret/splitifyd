import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Errors, sendError } from '../utils/errors';
import { CONFIG } from '../config';
import { logger } from '../logger';
import { AUTH } from '../constants';

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
class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requests = new Map<string, number[]>();

  constructor(windowMs: number = CONFIG.rateLimiting.windowMs, maxRequests: number = CONFIG.rateLimiting.maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), CONFIG.rateLimiting.cleanupIntervalMs);
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const userRequests = this.requests.get(userId) || [];
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
}

// Initialize in-memory rate limiter
const rateLimiter = new InMemoryRateLimiter();

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
    return next();
  }

  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, Errors.UNAUTHORIZED(), correlationId);
  }

  const token = authHeader.substring(AUTH.BEARER_TOKEN_PREFIX_LENGTH); // Remove 'Bearer ' prefix

  try {
    // Verify ID token - no fallbacks or hacks
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Attach user information to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    // Check rate limit
    const isAllowed = rateLimiter.isAllowed(decodedToken.uid);
    if (!isAllowed) {
      return sendError(res, Errors.RATE_LIMIT_EXCEEDED(), correlationId);
    }

    next();
  } catch (error) {
    logger.errorWithContext('Token verification failed', error as Error, { correlationId });
    return sendError(res, Errors.INVALID_TOKEN(), correlationId);
  }
};

