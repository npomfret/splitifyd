import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { sanitizeString } from '../utils/security';

/**
 * Schema for update user profile request
 */
const updateUserProfileSchema = Joi.object({
    displayName: Joi.string()
        .trim()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.empty': 'Display name cannot be empty',
            'string.max': 'Display name must be 100 characters or less',
        }),
    photoURL: Joi.string()
        .uri()
        .allow(null, '')
        .optional()
        .messages({
            'string.uri': 'Invalid photo URL format',
        }),
})
    .min(1)
    .messages({
        'object.min': 'At least one field (displayName or photoURL) must be provided',
    });

/**
 * Update user profile request interface
 */
export interface UpdateUserProfileRequest {
    displayName?: string;
    photoURL?: string | null;
}

/**
 * Validate update user profile request
 */
export const validateUpdateUserProfile = (body: unknown): UpdateUserProfileRequest => {
    const { error, value } = updateUserProfileSchema.validate(body, { 
        abortEarly: false,
        stripUnknown: true 
    });

    if (error) {
        const firstError = error.details[0];
        throw Errors.INVALID_INPUT(firstError.message);
    }

    const result: UpdateUserProfileRequest = {};

    if (value.displayName !== undefined) {
        result.displayName = sanitizeString(value.displayName);
    }

    if (value.photoURL !== undefined) {
        // Convert empty string to null for Firebase Auth
        result.photoURL = value.photoURL === '' ? null : value.photoURL;
    }

    return result;
};

/**
 * Schema for delete user request
 */
const deleteUserSchema = Joi.object({
    confirmDelete: Joi.boolean()
        .valid(true)
        .required()
        .messages({
            'any.only': 'Account deletion must be explicitly confirmed',
            'any.required': 'Account deletion must be explicitly confirmed',
        }),
}).required();

/**
 * Delete user request interface
 */
export interface DeleteUserRequest {
    confirmDelete: true;
}

/**
 * Validate delete user request
 */
export const validateDeleteUser = (body: unknown): DeleteUserRequest => {
    const { error, value } = deleteUserSchema.validate(body, { 
        abortEarly: false,
        stripUnknown: true 
    });

    if (error) {
        const firstError = error.details[0];
        throw Errors.INVALID_INPUT(firstError.message);
    }

    return value as DeleteUserRequest;
};