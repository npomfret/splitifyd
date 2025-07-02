import express from 'express';
import cors from 'cors';
import { CONFIG } from '../config/config';
import { addCorrelationId, logger } from './logger';
import { validateRequestStructure, validateContentType, rateLimitByIP } from '../middleware/validation';

export interface MiddlewareOptions {
  functionName?: string;
  logMessage?: string;
}

/**
 * Apply standard middleware stack to Express app
 */
export const applyStandardMiddleware = (app: express.Application, options: MiddlewareOptions = {}) => {
  const { functionName, logMessage = 'Request' } = options;

  // CORS configuration
  app.use(cors({
    ...CONFIG.corsOptions,
    origin: true // Allow all origins in development for debugging
  }));

  // Add correlation ID to all requests for tracing
  app.use(addCorrelationId);

  // Apply IP-based rate limiting for all requests
  app.use(rateLimitByIP);

  // Validate content type for non-GET requests
  app.use(validateContentType);

  // Parse JSON with size limit
  app.use(express.json({ limit: CONFIG.request.bodyLimit }));

  // Validate request structure and prevent malicious payloads
  app.use(validateRequestStructure);

  // Request logging middleware with structured logging
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    
    // Log incoming request
    logger.request(req, logMessage, {
      ...(functionName && { functionName }),
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    });
    
    // Log response when request finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        correlationId: req.headers['x-correlation-id'] as string,
        ...(functionName && { functionName }),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      });
    });
    
    next();
  });
};