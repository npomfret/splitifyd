import { Response } from 'express';
import { logger } from './logger';
import { HTTP_STATUS } from '../constants';

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId?: string;
  };
}

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: Record<string, {
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }>;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Send standardized error response
 */
export const sendError = (res: Response, error: ApiError | Error, correlationId?: string): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        ...(correlationId && { correlationId }),
      },
    } as ErrorResponse);
  } else {
    logger.error('Unexpected error:', error);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        ...(correlationId && { correlationId }),
      },
    } as ErrorResponse);
  }
};

/**
 * Send standardized health check response
 */
export const sendHealthCheckResponse = (res: Response, checks: Record<string, { status: 'healthy' | 'unhealthy'; responseTime?: number; error?: string; }>): void => {
  const overallStatus = Object.values(checks).every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };
  
  const statusCode = overallStatus === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
  res.status(statusCode).json(response);
};

/**
 * Common API errors
 */
export const Errors = {
  // Authentication errors
  UNAUTHORIZED: () => new ApiError(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required'),
  INVALID_TOKEN: () => new ApiError(HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN', 'Invalid authentication token'),
  
  // Validation errors
  INVALID_INPUT: (details?: any) => new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'Invalid input data', details),
  MISSING_FIELD: (field: string) => new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_FIELD', `Missing required field: ${field}`),
  DOCUMENT_TOO_LARGE: () => new ApiError(HTTP_STATUS.BAD_REQUEST, 'DOCUMENT_TOO_LARGE', 'Document exceeds maximum size of 1MB'),
  
  // Resource errors
  NOT_FOUND: (resource: string) => new ApiError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', `${resource} not found`),
  ALREADY_EXISTS: (resource: string) => new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_EXISTS', `${resource} already exists`),
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: () => new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'),
  
  // Server errors
  INTERNAL_ERROR: () => new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'An internal error occurred'),
  DATABASE_ERROR: () => new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'DATABASE_ERROR', 'Database operation failed'),
};