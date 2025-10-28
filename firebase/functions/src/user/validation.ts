import { z } from 'zod';
import { Errors } from '../utils/errors';
import {
    createDisplayNameSchema,
    createPasswordSchema,
    createRequestValidator,
    createZodErrorMapper,
    EmailSchema,
    sanitizeInputString,
} from '../validation/common';

interface UpdateUserProfileRequest {
    displayName?: string;
    photoURL?: string | null;
    preferredLanguage?: string;
}

const updateUserProfileSchema = z
    .object({
        displayName: createDisplayNameSchema({
            min: 1,
            max: 100,
            minMessage: 'Display name cannot be empty',
            maxMessage: 'Display name must be 100 characters or less',
            pattern: null,
        }).optional(),
        photoURL: z
            .union([
                z.string().url('Invalid photo URL format'),
                z.literal(''),
                z.null(),
            ])
            .optional(),
        preferredLanguage: z
            .string()
            .trim()
            .refine((value) => value === 'en', {
                message: 'Language must be one of: en',
            })
            .optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.displayName === undefined &&
            value.photoURL === undefined &&
            value.preferredLanguage === undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one field (displayName, photoURL, or preferredLanguage) must be provided',
            });
        }
    });

const mapUpdateProfileError = createZodErrorMapper(
    {
        displayName: {
            code: 'INVALID_INPUT',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Display name cannot be empty';
                }
                return issue.message;
            },
        },
        photoURL: {
            code: 'INVALID_INPUT',
            details: () => 'Invalid photo URL format',
        },
        preferredLanguage: {
            code: 'INVALID_INPUT',
            details: () => 'Language must be one of: en',
        },
    },
    {
        defaultCode: 'INVALID_INPUT',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

const baseValidateUpdateUserProfile = createRequestValidator({
    schema: updateUserProfileSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const result: UpdateUserProfileRequest = {};

        if (value.displayName !== undefined) {
            result.displayName = sanitizeInputString(value.displayName);
        }

        if (value.photoURL !== undefined) {
            result.photoURL = value.photoURL === '' ? null : value.photoURL ?? null;
        }

        if (value.preferredLanguage !== undefined) {
            result.preferredLanguage = value.preferredLanguage;
        }

        return result;
    },
    mapError: (error) => mapUpdateProfileError(error),
}) as (body: unknown) => UpdateUserProfileRequest;

export const validateUpdateUserProfile = (body: unknown, _language: string = 'en'): UpdateUserProfileRequest => {
    return baseValidateUpdateUserProfile(body);
};

interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Current password cannot be empty'),
    newPassword: createPasswordSchema({
        required: 'New password cannot be empty',
        weak: 'Password must be at least 12 characters long',
    }),
});

const mapChangePasswordError = createZodErrorMapper(
    {
        currentPassword: {
            code: 'INVALID_INPUT',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Current password is required';
                }
                return issue.message;
            },
        },
        newPassword: {
            code: 'INVALID_INPUT',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'New password is required';
                }
                if (issue.message === 'Required') {
                    return 'New password is required';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_INPUT',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

export const validateChangePassword = createRequestValidator({
    schema: changePasswordSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        if (value.currentPassword === value.newPassword) {
            throw Errors.INVALID_INPUT('New password must be different from current password');
        }

        return value as ChangePasswordRequest;
    },
    mapError: (error) => mapChangePasswordError(error),
}) as (body: unknown) => ChangePasswordRequest;

interface ChangeEmailRequest {
    currentPassword: string;
    newEmail: string;
}

const changeEmailSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Current password cannot be empty'),
    newEmail: EmailSchema,
});

const mapChangeEmailError = createZodErrorMapper(
    {
        currentPassword: {
            code: 'INVALID_INPUT',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Current password is required';
                }
                return issue.message;
            },
        },
        newEmail: {
            code: 'INVALID_INPUT',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'New email is required';
                }
                if (issue.message === 'Required') {
                    return 'New email is required';
                }
                if (issue.message === 'Email is required') {
                    return 'New email cannot be empty';
                }
                if (issue.message === 'Invalid email format') {
                    return 'Please enter a valid email address';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_INPUT',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

export const validateChangeEmail = createRequestValidator({
    schema: changeEmailSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        currentPassword: value.currentPassword,
        newEmail: sanitizeInputString(value.newEmail).toLowerCase(),
    }),
    mapError: (error) => mapChangeEmailError(error),
}) as (body: unknown) => ChangeEmailRequest;
