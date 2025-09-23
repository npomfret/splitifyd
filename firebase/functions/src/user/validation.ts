import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { sanitizeString } from '../utils/security';
import { translateJoiError } from '../utils/i18n-validation';

// Password requirements regex - must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Schema for update user profile request
 */
const updateUserProfileSchema = Joi.object({
    displayName: Joi.string().trim().min(1).max(100).optional().messages({
        'string.empty': 'Display name cannot be empty',
        'string.max': 'Display name must be 100 characters or less',
    }),
    photoURL: Joi.string().uri().allow(null, '').optional().messages({
        'string.uri': 'Invalid photo URL format',
    }),
    preferredLanguage: Joi.string()
        .trim()
        .valid('en') // Add more languages as they become available
        .optional()
        .messages({
            'any.only': 'Language must be one of: en',
        }),
})
    .min(1)
    .messages({
        'object.min': 'At least one field (displayName, photoURL, or preferredLanguage) must be provided',
    });

/**
 * Update user profile request interface
 */
export interface UpdateUserProfileRequest {
    displayName?: string;
    photoURL?: string | null;
    preferredLanguage?: string;
}

/**
 * Validate update user profile request
 */
export const validateUpdateUserProfile = (body: unknown, language: string = 'en'): UpdateUserProfileRequest => {
    const { error, value } = updateUserProfileSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const translatedMessage = translateJoiError(error, language);
        throw Errors.INVALID_INPUT(translatedMessage);
    }

    const result: UpdateUserProfileRequest = {};

    if (value.displayName !== undefined) {
        result.displayName = sanitizeString(value.displayName);
    }

    if (value.photoURL !== undefined) {
        // Convert empty string to null for Firebase Auth
        result.photoURL = value.photoURL === '' ? null : value.photoURL;
    }

    if (value.preferredLanguage !== undefined) {
        result.preferredLanguage = value.preferredLanguage;
    }

    return result;
};

/**
 * Schema for delete user request
 */
const deleteUserSchema = Joi.object({
    confirmDelete: Joi.boolean().valid(true).required().messages({
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
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        throw Errors.INVALID_INPUT(firstError.message);
    }

    return value as DeleteUserRequest;
};

/**
 * Schema for change password request
 */
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password cannot be empty',
    }),
    newPassword: Joi.string().pattern(PASSWORD_REGEX).required().messages({
        'any.required': 'New password is required',
        'string.empty': 'New password cannot be empty',
        'string.pattern.base': 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character',
    }),
});

/**
 * Change password request interface
 */
export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

/**
 * Validate change password request
 */
export const validateChangePassword = (body: unknown): ChangePasswordRequest => {
    const { error, value } = changePasswordSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        throw Errors.INVALID_INPUT(firstError.message);
    }

    // Check that passwords are different
    if (value.currentPassword === value.newPassword) {
        throw Errors.INVALID_INPUT('New password must be different from current password');
    }

    return value as ChangePasswordRequest;
};
