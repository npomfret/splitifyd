import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { Errors, sendError } from '../utils/errors';
import { getConfig } from '../config';
import { logger } from '../logger';
import { AUTH } from '../constants';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    displayName: string;
  };
}

/**
 * Simple in-memory rate limiter
 */
class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requests = new Map<string, number[]>();

  constructor(windowMs?: number, maxRequests?: number) {
    const config = getConfig();
    this.windowMs = windowMs ?? config.rateLimiting.windowMs;
    this.maxRequests = maxRequests ?? config.rateLimiting.maxRequests;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), config.rateLimiting.cleanupIntervalMs);
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
    
    // Attach user information to request
    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
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

