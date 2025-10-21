import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { translateJoiError } from '../utils/i18n-validation';
import { sanitizeString } from '../utils/security';

// Password requirements regex - allow any content with a minimum length of 12 characters
const PASSWORD_REGEX = /^.{12,}$/;

/**
 * Schema for update user profile request
 */
const updateUserProfileSchema = Joi
    .object({
        displayName: Joi.string().trim().min(1).max(100).optional().messages({
            'string.empty': 'Display name cannot be empty',
            'string.max': 'Display name must be 100 characters or less',
        }),
        photoURL: Joi.string().uri().allow(null, '').optional().messages({
            'string.uri': 'Invalid photo URL format',
        }),
        preferredLanguage: Joi
            .string()
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
interface UpdateUserProfileRequest {
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
        'string.pattern.base': 'Password must be at least 12 characters long',
    }),
});

/**
 * Change password request interface
 */
interface ChangePasswordRequest {
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
