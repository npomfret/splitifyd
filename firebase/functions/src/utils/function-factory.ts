import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { authenticate } from '../auth/middleware';
import { CONFIG } from '../config/constants';
import { addCorrelationId, logger } from './logger';
import { validateRequestStructure, validateContentType, rateLimitByIP } from '../middleware/validation';

export const createAuthenticatedFunction = (
  handler: express.RequestHandler
): functions.HttpsFunction => {
  // Create a mini Express app for each function with all middleware
  const app = express();
  
  // Apply middleware in the same order as main app
  app.use(cors({
    ...CONFIG.CORS,
    origin: true // Allow all origins in development for debugging
  }));
  app.use(addCorrelationId);
  app.use(rateLimitByIP);
  app.use(validateContentType);
  app.use(express.json({ limit: CONFIG.REQUEST.BODY_LIMIT }));
  app.use(validateRequestStructure);
  
  // Request logging middleware
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();
    
    logger.request(req, 'Individual function request', {
      functionName: handler.name || 'unknown',
    });
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Individual function completed', {
        correlationId: req.headers['x-correlation-id'] as string,
        functionName: handler.name || 'unknown',
        method: req.method,
        statusCode: res.statusCode,
        duration,
      });
    });
    
    next();
  });

  // Authentication middleware
  app.use(authenticate);

  // Handle all HTTP methods
  app.all('*', handler);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.errorWithContext('Individual function error', err, {
      correlationId: req.headers['x-correlation-id'] as string,
      functionName: handler.name || 'unknown',
      method: req.method,
      path: req.path,
    });
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        correlationId: req.headers['x-correlation-id'],
      },
    });
  });

  return functions.https.onRequest(app);
};