import { Request } from 'express';
import { randomUUID } from 'crypto';
import * as functions from 'firebase-functions';

interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    functions.logger.debug(message, context);
  },
  
  info: (message: string, context?: LogContext) => {
    functions.logger.info(message, context);
  },
  
  warn: (message: string, context?: LogContext) => {
    functions.logger.warn(message, context);
  },
  
  error: (message: string, context?: LogContext) => {
    functions.logger.error(message, context);
  },
  
  // Request logging helper
  request: (req: Request, message: string, additionalContext?: LogContext) => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const context: LogContext = {
      correlationId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      ...additionalContext,
    };
    
    functions.logger.info(message, context);
    return correlationId;
  },
  
  // Error logging with context
  errorWithContext: (message: string, error: Error, context?: LogContext) => {
    functions.logger.error(message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  },
};

// Middleware to add correlation ID to requests
export const addCorrelationId = (req: Request, res: any, next: any) => {
  const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};