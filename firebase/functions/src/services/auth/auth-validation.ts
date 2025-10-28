/**
 * Auth Service Validation Schemas
 *
 * Zod validation schemas for auth service operations.
 * Mirrors the shared validation helpers used across the codebase.
 */

import { z } from 'zod';
import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
import { createPasswordSchema, createRequestValidator, DisplayNameSchema, EmailSchema, PhoneNumberSchema } from '../../validation/common';
import { AuthErrorCode } from './auth-types';

const PhotoUrlSchema = z.string().url('Photo URL must be a valid URI');

const createUserSchema = z.object({
    email: EmailSchema,
    password: createPasswordSchema(),
    displayName: DisplayNameSchema,
    emailVerified: z.boolean().optional().default(false),
    phoneNumber: PhoneNumberSchema.optional(),
    photoURL: PhotoUrlSchema.optional(),
    disabled: z.boolean().optional().default(false),
});

const updateUserSchema = z.object({
    displayName: DisplayNameSchema.optional(),
    email: EmailSchema.optional(),
    phoneNumber: PhoneNumberSchema.nullable().optional(),
    photoURL: PhotoUrlSchema.nullable().optional(),
    password: createPasswordSchema().optional(),
    emailVerified: z.boolean().optional(),
    disabled: z.boolean().optional(),
});

const userIdSchema = z
    .string()
    .min(1, 'User ID must not be empty')
    .max(128, 'User ID must be no more than 128 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'User ID must contain only alphanumeric characters, underscores, and hyphens');

const idTokenSchema = z.string().min(1, 'ID token must not be empty');

const customClaimsSchema = z.record(z.string(), z.any()).optional();

const batchUserIdsSchema = z
    .array(userIdSchema)
    .min(1, 'At least one user ID is required')
    .max(1000, 'At most 1000 user IDs are allowed');

const mapAuthValidationError = (error: z.ZodError, defaultCode: AuthErrorCode): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];
    let errorCode = defaultCode;
    let errorMessage = firstError.message;

    if (typeof field === 'string') {
        switch (field) {
            case 'password':
                errorCode = AuthErrorCode.WEAK_PASSWORD;
                if (errorMessage === 'Required') {
                    errorMessage = 'Password is required';
                } else if (errorMessage.includes('Expected string')) {
                    errorMessage = 'Password is required';
                } else if (!errorMessage.includes('12 characters')) {
                    errorMessage = 'Password must be at least 12 characters long';
                }
                break;
            case 'displayName':
                errorCode = AuthErrorCode.INVALID_DISPLAY_NAME;
                if (errorMessage === 'Required') {
                    errorMessage = 'Display name is required';
                }
                break;
            case 'photoURL':
                errorCode = AuthErrorCode.INVALID_PHOTO_URL;
                if (errorMessage === 'Required') {
                    errorMessage = 'Photo URL must be a valid URI';
                }
                break;
            case 'phoneNumber':
                errorCode = AuthErrorCode.INVALID_PHONE_NUMBER;
                if (errorMessage === 'Required' || errorMessage.includes('Expected string')) {
                    errorMessage = 'Phone number must be in E.164 format (e.g., +1234567890)';
                }
                break;
            case 'email':
                if (errorMessage === 'Required' || errorMessage.includes('Expected string')) {
                    errorMessage = 'Email is required';
                }
                break;
            default:
                errorCode = defaultCode;
        }
    } else if (errorMessage === 'Required' && defaultCode === AuthErrorCode.INVALID_EMAIL) {
        errorMessage = 'Email is required';
    }

    throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
};

type CreateUserData = z.infer<typeof createUserSchema>;
type UpdateUserData = z.infer<typeof updateUserSchema>;

/**
 * Validate create user request
 */
export const validateCreateUser = createRequestValidator({
    schema: createUserSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapAuthValidationError(error, AuthErrorCode.INVALID_EMAIL),
}) as (data: unknown) => CreateUserData;

/**
 * Validate update user request
 */
export const validateUpdateUser = createRequestValidator({
    schema: updateUserSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapAuthValidationError(error, AuthErrorCode.INVALID_EMAIL),
}) as (data: unknown) => UpdateUserData;

/**
 * Validate user ID
 */
export function validateUserId(uid: unknown): string {
    const result = userIdSchema.safeParse(uid);

    if (!result.success) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_UID, result.error.issues[0].message);
    }

    return result.data;
}

/**
 * Validate ID token
 */
export function validateIdToken(token: unknown): string {
    const result = idTokenSchema.safeParse(token);

    if (!result.success) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_TOKEN, result.error.issues[0].message);
    }

    return result.data;
}

/**
 * Validate custom claims
 */
export function validateCustomClaims(claims: unknown): Record<string, unknown> {
    const result = customClaimsSchema.safeParse(claims);

    if (!result.success) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_CUSTOM_CLAIMS', result.error.issues[0].message);
    }

    return result.data ?? {};
}

/**
 * Validate batch user IDs
 */
export function validateBatchUserIds(uids: unknown): string[] {
    const result = batchUserIdsSchema.safeParse(uids);

    if (!result.success) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, AuthErrorCode.INVALID_UID, result.error.issues[0].message);
    }

    return result.data;
}
