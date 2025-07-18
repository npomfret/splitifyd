import { Request, Response, NextFunction } from 'express';
import { Errors, sendError } from '../utils/errors';
import { getConfig } from '../config';
import { checkForDangerousPatterns } from '../utils/security';

/**
 * Validate request size and structure depth
 */
export const validateRequestStructure = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.body) {
    return next();
  }

  const config = getConfig();
  const { maxObjectDepth, maxPropertyCount, maxStringLength, maxPropertyNameLength } = config.validation;

  // Single recursive validation function
  const validateObject = (obj: unknown, depth = 0): void => {
    if (depth > maxObjectDepth) {
      throw Errors.INVALID_INPUT(`Request structure too deep (max ${maxObjectDepth} levels)`);
    }

    if (typeof obj === 'string') {
      if (obj.length > maxStringLength) {
        throw Errors.INVALID_INPUT(`String too long (max ${maxStringLength} characters)`);
      }
      return;
    }

    if (Array.isArray(obj)) {
      if (obj.length > maxPropertyCount) {
        throw Errors.INVALID_INPUT(`Array too large (max ${maxPropertyCount} items)`);
      }
      obj.forEach(item => validateObject(item, depth + 1));
      return;
    }

    if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length > maxPropertyCount) {
        throw Errors.INVALID_INPUT(`Too many properties in object (max ${maxPropertyCount})`);
      }

      for (const key of keys) {
        if (key.length > maxPropertyNameLength) {
          throw Errors.INVALID_INPUT(`Property name too long (max ${maxPropertyNameLength} characters)`);
        }
        const value = (obj as Record<string, unknown>)[key];
        validateObject(value, depth + 1);
      }
    }
  };

  validateObject(req.body);

  // JSON.stringify handles circular references naturally by throwing an error
  let requestString: string;
  try {
    requestString = JSON.stringify(req.body);
  } catch {
    throw Errors.INVALID_INPUT('Circular reference detected in request');
  }

  if (checkForDangerousPatterns(requestString)) {
    throw Errors.INVALID_INPUT('Request contains potentially dangerous content');
  }

  next();
};

/**
 * Validate content type for JSON endpoints
 */
export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip for GET requests, DELETE requests without body, and OPTIONS (CORS preflight)
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'DELETE') {
    return next();
  }

  const contentType = req.headers['content-type'];
  
  // If no content-type but also no content-length, allow it (empty body)
  const contentLength = req.headers['content-length'];
  if ((!contentType || contentType === '') && (!contentLength || contentLength === '0')) {
    return next();
  }
  
  if (!contentType || !contentType.includes('application/json')) {
    return sendError(res, Errors.INVALID_INPUT('Content-Type must be application/json'), req.headers['x-correlation-id'] as string);
  }

  next();
};

// In-memory rate limiting store (for production, consider Redis)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit by IP address with configurable limits
 */
export const rateLimitByIP = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const config = getConfig();
  const windowMs = config.rateLimiting.windowMs;
  const maxRequests = config.rateLimiting.maxRequests;
  
  // Initialize cleanup on first request
  initializeCleanup();
  
  // Store the IP for logging purposes
  req.headers['x-client-ip'] = ip;
  
  // Get or create rate limit entry for this IP
  let entry = rateLimitStore.get(ip);
  
  // Reset if window has expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(ip, entry);
    return next();
  }
  
  // Increment request count
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > maxRequests) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000);
    
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests from this IP. Try again in ${remainingTime} seconds.`,
        retryAfter: remainingTime
      }
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
  
  next();
};

// Lazy-initialize cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function initializeCleanup(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
          rateLimitStore.delete(ip);
        }
      }
    }, getConfig().rateLimiting.cleanupIntervalMs);
  }
}