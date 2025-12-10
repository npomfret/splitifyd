/**
 * Auth Service Validation Schemas
 *
 * Zod validation schemas for auth service operations.
 * Mirrors the shared validation helpers used across the codebase.
 */

import { z } from 'zod';
import { ErrorDetail, Errors } from '../../errors';
import { createPasswordSchema, createRequestValidator, DisplayNameSchema, EmailSchema, PhoneNumberSchema } from '../../validation/common';

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

const mapAuthValidationError = (error: z.ZodError, defaultDetail: ErrorDetail): never => {
    const firstError = error.issues[0];
    const field = firstError.path[0];
    let detail = defaultDetail;

    if (typeof field === 'string') {
        switch (field) {
            case 'password':
                throw Errors.validationError('password', ErrorDetail.INVALID_PASSWORD);
            case 'displayName':
                throw Errors.validationError('displayName');
            case 'photoURL':
                throw Errors.validationError('photoURL');
            case 'phoneNumber':
                throw Errors.validationError('phoneNumber');
            case 'email':
                throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
            default:
                throw Errors.validationError(String(field), detail);
        }
    }

    throw Errors.validation({ detail });
};

type CreateUserData = z.infer<typeof createUserSchema>;
type UpdateUserData = z.infer<typeof updateUserSchema>;

/**
 * Validate create user request
 */
export const validateCreateUser = createRequestValidator({
    schema: createUserSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapAuthValidationError(error, ErrorDetail.INVALID_EMAIL),
}) as (data: unknown) => CreateUserData;

/**
 * Validate update user request
 */
export const validateUpdateUser = createRequestValidator({
    schema: updateUserSchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapAuthValidationError(error, ErrorDetail.INVALID_EMAIL),
}) as (data: unknown) => UpdateUserData;

/**
 * Validate user ID
 */
export function validateUserId(uid: unknown): string {
    const result = userIdSchema.safeParse(uid);

    if (!result.success) {
        throw Errors.validationError('uid');
    }

    return result.data;
}

/**
 * Validate ID token
 */
export function validateIdToken(token: unknown): string {
    const result = idTokenSchema.safeParse(token);

    if (!result.success) {
        throw Errors.validationError('token', ErrorDetail.TOKEN_INVALID);
    }

    return result.data;
}

/**
 * Validate custom claims
 */
export function validateCustomClaims(claims: unknown): Record<string, unknown> {
    const result = customClaimsSchema.safeParse(claims);

    if (!result.success) {
        throw Errors.validationError('claims');
    }

    return result.data ?? {};
}

export function validateEmailAddress(email: unknown): string {
    const result = EmailSchema.safeParse(email);

    if (!result.success) {
        throw Errors.validationError('email', ErrorDetail.INVALID_EMAIL);
    }

    return result.data;
}
