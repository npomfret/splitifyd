import { ErrorCode, ErrorDetail } from './ErrorCode';

/**
 * Error data passed to frontend for i18n interpolation.
 * Only include fields needed for translation - no sensitive data.
 */
export interface ApiErrorData {
    /** Specific error for logging/debugging (not translated) */
    detail?: ErrorDetail | string;

    /** Resource type for NOT_FOUND/ALREADY_EXISTS interpolation */
    resource?: string;

    /** Resource ID for logging */
    resourceId?: string;

    /** Field name for single-field VALIDATION_ERROR */
    field?: string;

    /** Multiple field errors for VALIDATION_ERROR */
    fields?: Record<string, string>;

    /** Allow additional interpolation data */
    [key: string]: unknown;
}

/**
 * API Error class with support for hierarchical error codes.
 *
 * @example
 * // Simple error
 * throw new ApiError(403, ErrorCode.FORBIDDEN);
 *
 * // With resource interpolation
 * throw new ApiError(404, ErrorCode.NOT_FOUND, { resource: 'Group', detail: ErrorDetail.GROUP_NOT_FOUND });
 *
 * // With field validation
 * throw new ApiError(400, ErrorCode.VALIDATION_ERROR, { field: 'email', detail: ErrorDetail.INVALID_EMAIL });
 */
export class ApiError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: ErrorCode,
        public readonly data?: ApiErrorData,
    ) {
        // Use code as message since we don't need human-readable messages on server
        super(code);
        this.name = 'ApiError';

        // Maintains proper stack trace for where error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    /**
     * Serialize to JSON for API response.
     * Only includes non-undefined fields.
     */
    toJSON(): { code: ErrorCode; } & ApiErrorData {
        const result: { code: ErrorCode; } & ApiErrorData = { code: this.code };

        if (this.data) {
            // Only include defined values
            for (const [key, value] of Object.entries(this.data)) {
                if (value !== undefined) {
                    result[key] = value;
                }
            }
        }

        return result;
    }
}
