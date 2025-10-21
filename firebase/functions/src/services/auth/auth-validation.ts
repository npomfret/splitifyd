/**
 * Auth Service Validation Schemas
 *
 * Joi validation schemas for auth service operations.
 * Follows the same patterns as established validation in the codebase.
 */

import * as Joi from 'joi';
import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
import { displayNameSchema } from '../../validation/validationSchemas';
import { AuthErrorCode } from './auth-types';

/**
 * Email validation regex (same as used in auth/validation.ts)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Password validation regex (same as used in auth/validation.ts)
 * Allows any content as long as the length is at least 12 characters.
 */
const PASSWORD_REGEX = /^.{12,}$/;

/**
 * Create user request validation schema
 */
const createUserSchema = Joi.object({
    email: Joi.string().pattern(EMAIL_REGEX).required().messages({
        'string.pattern.base': 'Invalid email format',
        'string.empty': 'Email is required',
        'any.required': 'Email is required',
    }),
    password: Joi.string().pattern(PASSWORD_REGEX).required().messages({
        'string.pattern.base': 'Password must be at least 12 characters long',
        'string.empty': 'Password is required',
        'any.required': 'Password is required',
    }),
    displayName: displayNameSchema,
    emailVerified: Joi.boolean().optional().default(false),
    phoneNumber: Joi
        .string()
        .pattern(/^\+[1-9]\d{1,14}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)',
        }),
    photoURL: Joi.string().uri().optional().messages({
        'string.uri': 'Photo URL must be a valid URI',
    }),
    disabled: Joi.boolean().optional().default(false),
});

/**
 * Update user request validation schema
 */
const updateUserSchema = Joi.object({
    displayName: displayNameSchema.optional(),
    email: Joi.string().pattern(EMAIL_REGEX).optional().messages({
        'string.pattern.base': 'Invalid email format',
    }),
    phoneNumber: Joi
        .string()
        .pattern(/^\+[1-9]\d{1,14}$/)
        .allow(null)
        .optional()
        .messages({
            'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)',
        }),
    photoURL: Joi.string().uri().allow(null).optional().messages({
        'string.uri': 'Photo URL must be a valid URI',
    }),
    password: Joi.string().pattern(PASSWORD_REGEX).optional().messages({
        'string.pattern.base': 'Password must be at least 12 characters long',
    }),
    emailVerified: Joi.boolean().optional(),
    disabled: Joi.boolean().optional(),
});

/**
 * User ID validation schema
 */
const userIdSchema = Joi
    .string()
    .min(1)
    .max(128)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
        'string.min': 'User ID must not be empty',
        'string.max': 'User ID must be no more than 128 characters',
        'string.pattern.base': 'User ID must contain only alphanumeric characters, underscores, and hyphens',
        'string.empty': 'User ID is required',
        'any.required': 'User ID is required',
    });

/**
 * ID token validation schema
 */
const idTokenSchema = Joi.string().min(1).required().messages({
    'string.min': 'ID token must not be empty',
    'string.empty': 'ID token is required',
    'any.required': 'ID token is required',
});

/**
 * Custom claims validation schema
 */
const customClaimsSchema = Joi.object().pattern(Joi.string(), Joi.any()).optional().messages({
    'object.base': 'Custom claims must be an object',
});

/**
 * Batch user IDs validation schema
 */
const batchUserIdsSchema = Joi.array().items(userIdSchema).min(1).max(1000).required().messages({
    'array.base': 'User IDs must be an array',
    'array.min': 'At least one user ID is required',
    'array.max': 'At most 1000 user IDs are allowed',
    'any.required': 'User IDs are required',
});

/**
 * Validate create user request
 */
export function validateCreateUser(data: unknown): any {
    const { error, value } = createUserSchema.validate(data, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        const errorMessage = firstError.message;

        // Map specific validation errors to auth error codes
        let errorCode = AuthErrorCode.INVALID_EMAIL;
        if (firstError.path.includes('password')) {
            errorCode = AuthErrorCode.WEAK_PASSWORD;
        } else if (firstError.path.includes('displayName')) {
            errorCode = AuthErrorCode.INVALID_DISPLAY_NAME;
        } else if (firstError.path.includes('photoURL')) {
            errorCode = AuthErrorCode.INVALID_PHOTO_URL;
        } else if (firstError.path.includes('phoneNumber')) {
            errorCode = AuthErrorCode.INVALID_PHONE_NUMBER;
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    return value;
}

/**
 * Validate update user request
 */
export function validateUpdateUser(data: unknown): any {
    const { error, value } = updateUserSchema.validate(data, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        const errorMessage = firstError.message;

        // Map specific validation errors to auth error codes
        let errorCode = AuthErrorCode.INVALID_EMAIL;
        if (firstError.path.includes('password')) {
            errorCode = AuthErrorCode.WEAK_PASSWORD;
        } else if (firstError.path.includes('displayName')) {
            errorCode = AuthErrorCode.INVALID_DISPLAY_NAME;
        } else if (firstError.path.includes('photoURL')) {
            errorCode = AuthErrorCode.INVALID_PHOTO_URL;
        } else if (firstError.path.includes('phoneNumber')) {
            errorCode = AuthErrorCode.INVALID_PHONE_NUMBER;
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    return value;
}

/**
 * Validate user ID
 */
export function validateUserId(uid: unknown): string {
    const { error, value } = userIdSchema.validate(uid);

    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_UID, error.message);
    }

    return value;
}

/**
 * Validate ID token
 */
export function validateIdToken(token: unknown): string {
    const { error, value } = idTokenSchema.validate(token);

    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_TOKEN, error.message);
    }

    return value;
}

/**
 * Validate custom claims
 */
export function validateCustomClaims(claims: unknown): object {
    const { error, value } = customClaimsSchema.validate(claims);

    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CUSTOM_CLAIMS', error.message);
    }

    return value || {};
}

/**
 * Validate batch user IDs
 */
export function validateBatchUserIds(uids: unknown): string[] {
    const { error, value } = batchUserIdsSchema.validate(uids);

    if (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_UID, error.message);
    }

    return value;
}
