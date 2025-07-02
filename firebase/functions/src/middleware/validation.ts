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
    // Check if request has a body
    if (!req.body) {
      return next();
    }

    // Validate JSON depth to prevent stack overflow attacks
    const validateDepth = (obj: any, depth = 0, maxDepth = CONFIG.security.validation.maxObjectDepth): void => {
      if (depth > maxDepth) {
        throw Errors.INVALID_INPUT(`Request structure too deep (max ${maxDepth} levels)`);
      }
      
      if (obj && typeof obj === 'object') {
        // Check for circular references
        if (obj.__visited) {
          throw Errors.INVALID_INPUT('Circular reference detected in request');
        }
        
        // Temporarily mark as visited
        obj.__visited = true;
        
        try {
          for (const key in obj) {
            if (key !== '__visited' && typeof obj[key] === 'object' && obj[key] !== null) {
              validateDepth(obj[key], depth + 1, maxDepth);
            }
          }
        } finally {
          // Clean up the visited marker
          delete obj.__visited;
        }
      }
    };

    // Validate object property count to prevent memory exhaustion
    const validatePropertyCount = (obj: any, maxProps = CONFIG.security.validation.maxPropertyCount): void => {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const keys = Object.keys(obj);
        if (keys.length > maxProps) {
          throw Errors.INVALID_INPUT(`Too many properties in object (max ${maxProps})`);
        }
        
        // Recursively check nested objects
        for (const key of keys) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            validatePropertyCount(obj[key], maxProps);
          }
        }
      } else if (Array.isArray(obj)) {
        if (obj.length > maxProps) {
          throw Errors.INVALID_INPUT(`Array too large (max ${maxProps} items)`);
        }
        
        // Check each array item
        for (const item of obj) {
          if (typeof item === 'object' && item !== null) {
            validatePropertyCount(item, maxProps);
          }
        }
      }
    };

    // Validate string length to prevent memory exhaustion
    const validateStringLengths = (obj: any, maxLength = CONFIG.security.validation.maxStringLength): void => {
      if (typeof obj === 'string') {
        if (obj.length > maxLength) {
          throw Errors.INVALID_INPUT(`String too long (max ${maxLength} characters)`);
        }
      } else if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(item => validateStringLengths(item, maxLength));
        } else {
          for (const key in obj) {
            if (typeof key === 'string' && key.length > CONFIG.security.validation.maxPropertyNameLength) {
              throw Errors.INVALID_INPUT(`Property name too long (max ${CONFIG.security.validation.maxPropertyNameLength} characters)`);
            }
            validateStringLengths(obj[key], maxLength);
          }
        }
      }
    };

    // Run all validations
    validateDepth(req.body);
    validatePropertyCount(req.body);
    validateStringLengths(req.body);

    // Check for potentially dangerous patterns
    const requestString = JSON.stringify(req.body);
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