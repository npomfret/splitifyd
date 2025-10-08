import { Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { timestampToISO } from './dateHelpers';

/**
 * Standard error response interface
 */
interface ErrorResponse {
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
interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    checks: Record<
        string,
        {
            status: 'healthy' | 'unhealthy';
            responseTime?: number;
            error?: string;
        }
    >;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: any,
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
        // Log the full error and propagate it
        logger.error('Unexpected error', error);
        throw error;
    }
};

/**
 * Send standardized health check response
 */
export const sendHealthCheckResponse = (res: Response, checks: Record<string, { status: 'healthy' | 'unhealthy'; responseTime?: number; error?: string; }>): void => {
    const overallStatus = Object.values(checks).every((check) => check.status === 'healthy') ? 'healthy' : 'unhealthy';
    const response: HealthCheckResponse = {
        status: overallStatus,
        timestamp: timestampToISO(new Date()),
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
    FORBIDDEN: () => new ApiError(HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', 'Access denied'),

    // Validation errors
    INVALID_INPUT: (details?: any) => new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'Invalid input data', details),
    MISSING_FIELD: (field: string) => new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_FIELD', `Missing required field: ${field}`),
    DOCUMENT_TOO_LARGE: () => new ApiError(HTTP_STATUS.BAD_REQUEST, 'DOCUMENT_TOO_LARGE', 'Document exceeds maximum size of 1MB'),

    // Resource errors
    NOT_FOUND: (resource: string) => new ApiError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', `${resource} not found`),
    ALREADY_EXISTS: (resource: string) => new ApiError(HTTP_STATUS.CONFLICT, 'ALREADY_EXISTS', `${resource} already exists`),
    CONCURRENT_UPDATE: () => new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Document was modified by another user. Please retry with fresh data.'),

    // Server errors
    INTERNAL_ERROR: () => new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'An internal error occurred'),
    DATABASE_ERROR: () => new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'DATABASE_ERROR', 'Database operation failed'),
};
