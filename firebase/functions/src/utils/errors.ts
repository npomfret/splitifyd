import { Response } from 'express';

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
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
export const sendError = (res: Response, error: ApiError | Error): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    } as ErrorResponse);
  } else {
    // Generic error handling
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ErrorResponse);
  }
};

/**
 * Common API errors
 */
export const Errors = {
  // Authentication errors
  UNAUTHORIZED: () => new ApiError(401, 'UNAUTHORIZED', 'Authentication required'),
  INVALID_TOKEN: () => new ApiError(401, 'INVALID_TOKEN', 'Invalid authentication token'),
  
  // Validation errors
  INVALID_INPUT: (details?: any) => new ApiError(400, 'INVALID_INPUT', 'Invalid input data', details),
  MISSING_FIELD: (field: string) => new ApiError(400, 'MISSING_FIELD', `Missing required field: ${field}`),
  DOCUMENT_TOO_LARGE: () => new ApiError(400, 'DOCUMENT_TOO_LARGE', 'Document exceeds maximum size of 1MB'),
  
  // Resource errors
  NOT_FOUND: (resource: string) => new ApiError(404, 'NOT_FOUND', `${resource} not found`),
  ALREADY_EXISTS: (resource: string) => new ApiError(409, 'ALREADY_EXISTS', `${resource} already exists`),
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: () => new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later'),
  
  // Server errors
  INTERNAL_ERROR: () => new ApiError(500, 'INTERNAL_ERROR', 'An internal error occurred'),
  DATABASE_ERROR: () => new ApiError(500, 'DATABASE_ERROR', 'Database operation failed'),
};