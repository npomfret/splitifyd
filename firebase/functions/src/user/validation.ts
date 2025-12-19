import { ChangeEmailRequestSchema, ChangePasswordRequestSchema, UpdateUserProfileRequestSchema } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../errors';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

interface UpdateUserProfileRequest {
    displayName?: string;
    photoURL?: string | null;
    preferredLanguage?: string;
    marketingEmailsAccepted?: boolean;
}

const mapUpdateProfileError = createZodErrorMapper(
    {
        displayName: {
            code: 'VALIDATION_ERROR',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Display name cannot be empty';
                }
                return issue.message;
            },
        },
        photoURL: {
            code: 'VALIDATION_ERROR',
            details: () => 'Invalid photo URL format',
        },
        preferredLanguage: {
            code: 'VALIDATION_ERROR',
            details: () => 'Language must be one of: en, uk, ar, de, es, it, ja, ko, lv, nl-BE, no, ph, sv',
        },
        marketingEmailsAccepted: {
            code: 'VALIDATION_ERROR',
            details: () => 'Marketing emails preference must be a boolean',
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

const baseValidateUpdateUserProfile = createRequestValidator({
    schema: UpdateUserProfileRequestSchema,
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

        if (value.marketingEmailsAccepted !== undefined) {
            result.marketingEmailsAccepted = value.marketingEmailsAccepted;
        }

        return result;
    },
    mapError: (error) => mapUpdateProfileError(error),
}) as (body: unknown) => UpdateUserProfileRequest;

export const validateUpdateUserProfile = (body: unknown): UpdateUserProfileRequest => {
    return baseValidateUpdateUserProfile(body);
};

interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

const mapChangePasswordError = createZodErrorMapper(
    {
        currentPassword: {
            code: 'VALIDATION_ERROR',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Current password is required';
                }
                return issue.message;
            },
        },
        newPassword: {
            code: 'VALIDATION_ERROR',
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
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

export const validateChangePassword = createRequestValidator({
    schema: ChangePasswordRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        if (value.currentPassword === value.newPassword) {
            throw Errors.validationError('newPassword', ErrorDetail.INVALID_PASSWORD);
        }

        return value as ChangePasswordRequest;
    },
    mapError: (error) => mapChangePasswordError(error),
}) as (body: unknown) => ChangePasswordRequest;

interface ChangeEmailRequest {
    currentPassword: string;
    newEmail: string;
}

const mapChangeEmailError = createZodErrorMapper(
    {
        currentPassword: {
            code: 'VALIDATION_ERROR',
            details: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Current password is required';
                }
                return issue.message;
            },
        },
        newEmail: {
            code: 'VALIDATION_ERROR',
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
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: 'Invalid input data',
        defaultDetails: (issue) => issue.message,
    },
);

export const validateChangeEmail = createRequestValidator({
    schema: ChangeEmailRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        currentPassword: value.currentPassword,
        newEmail: sanitizeInputString(value.newEmail).toLowerCase(),
    }),
    mapError: (error) => mapChangeEmailError(error),
}) as (body: unknown) => ChangeEmailRequest;
