import { Request } from 'express';
import { randomUUID } from 'crypto';
import * as functions from 'firebase-functions';

const isVerbose = process.env.VERBOSE_LOGGING === 'true';
const isProduction = process.env.NODE_ENV === 'production';

// Log levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLogLevel = isProduction ? LogLevel.INFO : LogLevel.DEBUG;

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

const formatLog = (level: string, message: string, context?: LogContext) => {
  const timestamp = new Date().toISOString();
  
  if (isProduction) {
    // Structured JSON logging for production
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };
    
    // Remove sensitive data from logs
    if (logEntry.error && logEntry.error instanceof Error) {
      logEntry.error = {
        name: logEntry.error.name,
        message: logEntry.error.message,
        stack: isVerbose ? logEntry.error.stack : undefined,
      };
    }
    
    return JSON.stringify(logEntry);
  } else {
    // Human-readable format for development
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    }[level] || '📝';
    
    let logMessage = `${emoji} [${timestamp}] ${message}`;
    
    if (context?.correlationId) {
      logMessage += ` [${context.correlationId}]`;
    }
    
    if (context && Object.keys(context).length > 0) {
      const contextString = JSON.stringify(context, null, 2);
      logMessage += `\n${contextString}`;
    }
    
    return logMessage;
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      functions.logger.debug(formatLog('debug', message, context));
    }
  },
  
  info: (message: string, context?: LogContext) => {
    if (currentLogLevel <= LogLevel.INFO) {
      functions.logger.info(formatLog('info', message, context));
    }
  },
  
  warn: (message: string, context?: LogContext) => {
    if (currentLogLevel <= LogLevel.WARN) {
      functions.logger.warn(formatLog('warn', message, context));
    }
  },
  
  error: (message: string, context?: LogContext) => {
    if (currentLogLevel <= LogLevel.ERROR) {
      functions.logger.error(formatLog('error', message, context));
    }
  },
  
  success: (message: string, context?: LogContext) => {
    if (currentLogLevel <= LogLevel.INFO) {
      functions.logger.info(formatLog('success', message, context));
    }
  },
  
  // Request logging helper
  request: (req: Request, message: string, additionalContext?: LogContext) => {
    const context: LogContext = {
      correlationId: req.headers['x-correlation-id'] as string || randomUUID(),
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      ...additionalContext,
    };
    
    logger.info(message, context);
    return context.correlationId;
  },
  
  // Error logging with context
  errorWithContext: (message: string, error: Error, context?: LogContext) => {
    logger.error(message, {
      ...context,
      error,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: isVerbose ? error.stack : undefined,
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