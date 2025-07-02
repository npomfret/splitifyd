import { Request, Response, NextFunction } from 'express';
import { Errors, sendError } from '../utils/errors';
import { CONFIG } from '../config/config';
import { checkForDangerousPatterns } from '../utils/security';

/**
 * Validate request size and structure depth
 */
export const validateRequestStructure = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.body) {
      return next();
    }

    const { maxObjectDepth, maxPropertyCount, maxStringLength, maxPropertyNameLength } = CONFIG.security.validation;

    // Single recursive validation function
    const validateObject = (obj: any, depth = 0): void => {
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
          validateObject(obj[key], depth + 1);
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
  } catch (error) {
    const correlationId = req.headers['x-correlation-id'] as string;
    if (error && typeof error === 'object' && 'code' in error && 
        typeof (error as any).code === 'string' && 
        (error as any).code.startsWith('SPLITIFY_')) {
      return sendError(res, error as unknown as Error, correlationId);
    }
    
    return sendError(res, Errors.INVALID_INPUT('Invalid request structure'), correlationId);
  }
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

/**
 * Rate limit by IP address for unauthenticated endpoints
 */
export const rateLimitByIP = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Simple IP-based rate limiting for health checks and other public endpoints
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // For now, just log the IP - in production, implement proper IP rate limiting
  req.headers['x-client-ip'] = ip;
  
  next();
};