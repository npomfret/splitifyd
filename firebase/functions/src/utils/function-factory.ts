import * as functions from 'firebase-functions';
import express from 'express';
import { authenticate } from '../auth/middleware';
import { applyStandardMiddleware } from './middleware';
import { sendError, Errors } from './errors';
import { logger } from './logger';

export const createAuthenticatedFunction = (
  handler: express.RequestHandler
): functions.HttpsFunction => {
  // Create a mini Express app for each function with all middleware
  const app = express();
  
  // Apply standard middleware stack
  applyStandardMiddleware(app, {
    functionName: handler.name || 'unknown',
    logMessage: 'Individual function request'
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
    
    sendError(res, Errors.INTERNAL_ERROR(), req.headers['x-correlation-id'] as string);
  });

  return functions.https.onRequest(app);
};