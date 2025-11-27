import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { ApiError } from './errors';

/**
 * Error mapping interface for custom error codes and messages
 * Internal use only - used by parseWithApiError
 */
export interface ValidationErrorMapping {
    [path: string]: {
        code: string;
        message: string;
        details?: string;
    };
}

/**
 * Parse data with a Zod schema and convert validation errors to ApiError
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param errorMapping - Optional mapping of field paths to custom error codes/messages
 * @returns Parsed and validated data
 * @throws ApiError with appropriate error code and message
 */
export function parseWithApiError<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    errorMapping?: ValidationErrorMapping,
): T {
    try {
        return schema.parse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Get the first error for consistency with the previous validation behaviour
            const firstError = error.issues[0];
            const fieldPath = firstError.path.join('.');

            // Check if we have a custom mapping for this field
            const customMapping = errorMapping?.[fieldPath];
            if (customMapping) {
                // Determine appropriate message based on error type
                let message = customMapping.message;

                // If no custom message provided, use Zod message
                if (!message) {
                    message = firstError.message;
                }

                // Special handling for different error types
                if (!customMapping.message || customMapping.message === '') {
                    // For missing fields (invalid_type with received "undefined")
                    if (firstError.code === 'invalid_type' && (firstError as any).received === undefined) {
                        const fieldName = fieldPath || 'field';
                        if (fieldName === 'text') {
                            message = 'Comment text is required';
                        } else if (fieldName === 'name') {
                            message = 'Group name is required';
                        } else {
                            message = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
                        }
                    } else {
                        // For validation errors (length, format, etc.), use the Zod message
                        message = firstError.message;
                    }
                }

                // Smart details handling for group name field
                let details = customMapping.details;
                if (fieldPath === 'name' && (!details || details === '')) {
                    if (firstError.code === 'invalid_type' && (firstError as any).received === undefined) {
                        details = 'Group name is required';
                    } else if (firstError.code === 'too_big') {
                        details = 'Group name must be less than 100 characters';
                    }
                }

                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    customMapping.code,
                    message,
                    details,
                );
            }

            // Default error mapping based on field name and error type
            const errorCode = getDefaultErrorCode(fieldPath, firstError.code);
            const errorMessage = firstError.message;

            throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage, firstError.message);
        }

        // Re-throw non-Zod errors
        throw error;
    }
}

/**
 * Get default error code based on field path and Zod error code
 */
function getDefaultErrorCode(fieldPath: string, zodCode: string): string {
    // Field-specific error codes
    if (fieldPath.includes('email')) return 'INVALID_EMAIL';
    if (fieldPath.includes('password')) return 'INVALID_PASSWORD';
    if (fieldPath.includes('amount')) return 'INVALID_AMOUNT';
    if (fieldPath.includes('date')) return 'INVALID_DATE';
    if (fieldPath.includes('groupId')) return 'INVALID_GROUP_ID';
    if (fieldPath.includes('paidBy')) return 'MISSING_PAYER';
    if (fieldPath.includes('description')) return 'INVALID_DESCRIPTION';
    if (fieldPath.includes('label')) return 'INVALID_LABEL';
    if (fieldPath.includes('splitType')) return 'INVALID_SPLIT_TYPE';
    if (fieldPath.includes('participants')) return 'INVALID_PARTICIPANTS';
    if (fieldPath.includes('splits')) return 'INVALID_SPLITS';

    // Zod error type based codes
    switch (zodCode) {
        case 'invalid_type':
        case 'invalid_string':
        case 'invalid_number':
            return 'INVALID_INPUT';
        case 'too_small':
        case 'too_big':
            return 'INVALID_INPUT';
        default:
            return 'INVALID_INPUT';
    }
}
