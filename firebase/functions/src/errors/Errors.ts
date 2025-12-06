import { HTTP_STATUS } from '../constants';
import { ApiError, ApiErrorData } from './ApiError';
import { ErrorCode, ErrorDetail } from './ErrorCode';

/**
 * Error factory for creating standardized API errors.
 *
 * Usage:
 * - Use category methods (notFound, forbidden, etc.) for user-facing errors
 * - Pass `detail` for debugging specificity
 * - Pass `resource` for interpolation in NOT_FOUND/ALREADY_EXISTS messages
 *
 * @example
 * throw Errors.notFound('Group');
 * throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
 * throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
 * throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
 */
export const Errors = {
    // ============================================
    // Authentication (401)
    // ============================================

    /** User is not authenticated */
    authRequired: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.UNAUTHORIZED, ErrorCode.AUTH_REQUIRED, detail ? { detail } : undefined),

    /** Authentication token is invalid or expired */
    authInvalid: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.UNAUTHORIZED, ErrorCode.AUTH_INVALID, detail ? { detail } : undefined),

    // ============================================
    // Authorization (403)
    // ============================================

    /** User is authenticated but not authorized for this action */
    forbidden: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.FORBIDDEN, ErrorCode.FORBIDDEN, detail ? { detail } : undefined),

    // ============================================
    // Resource Errors (404, 409)
    // ============================================

    /** Resource not found */
    notFound: (resource: string, detail?: ErrorDetail | string, resourceId?: string): ApiError =>
        new ApiError(HTTP_STATUS.NOT_FOUND, ErrorCode.NOT_FOUND, {
            resource,
            ...(detail && { detail }),
            ...(resourceId && { resourceId }),
        }),

    /** Resource already exists (duplicate) */
    alreadyExists: (resource: string, detail?: ErrorDetail | string): ApiError =>
        new ApiError(HTTP_STATUS.CONFLICT, ErrorCode.ALREADY_EXISTS, {
            resource,
            ...(detail && { detail }),
        }),

    /** Concurrent modification conflict */
    conflict: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.CONFLICT, ErrorCode.CONFLICT, detail ? { detail } : undefined),

    // ============================================
    // Validation Errors (400)
    // ============================================

    /** Single field validation error */
    validationError: (field: string, detail?: ErrorDetail | string): ApiError =>
        new ApiError(HTTP_STATUS.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, {
            field,
            ...(detail && { detail }),
        }),

    /** Multiple field validation errors */
    validationErrors: (fields: Record<string, string>): ApiError => new ApiError(HTTP_STATUS.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, { fields }),

    /** General validation error with custom data */
    validation: (data: ApiErrorData): ApiError => new ApiError(HTTP_STATUS.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, data),

    /** Malformed request (not field-specific) */
    invalidRequest: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.BAD_REQUEST, ErrorCode.INVALID_REQUEST, detail ? { detail } : undefined),

    // ============================================
    // Rate Limiting (429)
    // ============================================

    /** Too many requests */
    rateLimited: (): ApiError => new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED),

    // ============================================
    // Server Errors (500, 503)
    // ============================================

    /** Internal server error */
    serviceError: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.INTERNAL_ERROR, ErrorCode.SERVICE_ERROR, detail ? { detail } : undefined),

    /** Service temporarily unavailable */
    unavailable: (detail?: ErrorDetail | string): ApiError => new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, ErrorCode.UNAVAILABLE, detail ? { detail } : undefined),
};
