import express from 'express';
import cors from 'cors';
import { CONFIG } from '../config';
import { addCorrelationId, logger } from '../logger';
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

  // CORS configuration with safety fallback for local development
  const corsOptions = {
    ...CONFIG.corsOptions,
    // Safety fallback: if in local emulator and localhost/127.0.0.1 origins aren't working,
    // allow all origins temporarily to prevent lockouts during development
    ...(process.env.FUNCTIONS_EMULATOR === 'true' && {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        const allowedOrigins = CONFIG.corsOptions.origin as string[];
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Safety fallback for local development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          console.warn(`CORS: Allowing ${origin} via development fallback`);
          return callback(null, true);
        }
        
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    })
  };
  
  app.use(cors(corsOptions));

  // Add correlation ID to all requests for tracing
  app.use(addCorrelationId);

  // Apply IP-based rate limiting for all requests
  app.use(rateLimitByIP);

  // Validate content type for non-GET requests
  app.use(validateContentType);

  // Parse JSON with size limit
  app.use(express.json({ limit: CONFIG.requestBodyLimit }));

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