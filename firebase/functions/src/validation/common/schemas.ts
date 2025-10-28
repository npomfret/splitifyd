import { z } from 'zod';
import { VALIDATION_LIMITS } from '../../constants';
import { EMAIL_REGEX, PASSWORD_REGEX, PHONE_E164_REGEX } from './regex';

export const DisplayNameSchema = z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH, 'Display name cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods');

export const EmailSchema = z
    .string()
    .trim()
    .min(1, 'Email is required')
    .regex(EMAIL_REGEX, 'Invalid email format')
    .refine((value) => !value.includes('..'), 'Invalid email format');

export interface PasswordMessages {
    required?: string;
    weak?: string;
}

export const createPasswordSchema = (messages?: PasswordMessages) => {
    const requiredMessage = messages?.required ?? 'Password is required';
    const weakMessage = messages?.weak ?? 'Password must be at least 12 characters long';

    return z
        .string()
        .min(1, requiredMessage)
        .regex(PASSWORD_REGEX, weakMessage);
};

export interface AcceptanceMessages {
    required: string;
    invalidType: string;
    notAccepted: string;
}

export const AcceptanceBooleanSchema = (messages: AcceptanceMessages) =>
    z
        .boolean()
        .refine((value) => value === true, {
            message: messages.notAccepted,
        });

export const PhoneNumberSchema = z
    .string()
    .regex(PHONE_E164_REGEX, 'Phone number must be in E.164 format (e.g., +1234567890)');
