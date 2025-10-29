import { ZodError, ZodIssue } from 'zod';
import { translate } from './i18n';

/**
 * Map common Zod validation error types to translation keys
 */
const errorTypeToTranslationKey: Record<string, string> = {
    'invalid_string': 'validation.common.invalid',
    'too_small': 'validation.common.tooShort',
    'too_big': 'validation.common.tooLong',
    'invalid_type': 'validation.common.invalid',
    'invalid_email_format': 'validation.email.invalid',
    'custom': 'validation.common.invalid',
};

/**
 * Map specific field paths to translation key prefixes
 */
const fieldPathToTranslationPrefix: Record<string, string> = {
    name: 'validation.group.name',
    description: 'validation.group.description',
    currency: 'validation.group.currency',
    email: 'validation.email',
    displayName: 'validation.user.displayName',
    amount: 'validation.expense.amount',
    date: 'validation.expense.date',
    category: 'validation.expense.category',
    participants: 'validation.expense.participants',
    splits: 'validation.expense.splits',
    paidBy: 'validation.expense.paidBy',
    payerId: 'validation.settlement.fromUser',
    payeeId: 'validation.settlement.toUser',
    note: 'validation.settlement.description',
};

/**
 * Create specific translation key based on field and error type
 */
function getSpecificTranslationKey(fieldPath: string, errorCode: string): string | null {
    const fieldPrefix = fieldPathToTranslationPrefix[fieldPath];

    if (!fieldPrefix) return null;

    // Map specific error types to field-specific keys
    switch (errorCode) {
        case 'too_small':
            return `${fieldPrefix}TooShort`;
        case 'too_big':
            return `${fieldPrefix}TooLong`;
        case 'invalid_email_format':
        case 'invalid_string':
        case 'invalid_type':
            return `${fieldPrefix}Invalid`;
        case 'custom':
            return `${fieldPrefix}Invalid`;
        default:
            return null;
    }
}

/**
 * Translate a single Zod validation issue
 */
function translateValidationIssue(issue: ZodIssue, language: string): string {
    const fieldPath = issue.path.join('.');
    const errorCode = issue.code;

    // Try to get field-specific translation key first
    const specificKey = getSpecificTranslationKey(fieldPath, errorCode);
    if (specificKey) {
        const translated = translate(specificKey, language);
        // If translation exists (not the key itself), use it
        if (translated !== specificKey) {
            return translated;
        }
    }

    // Fall back to generic error type translation
    const genericKey = errorTypeToTranslationKey[errorCode];
    if (genericKey) {
        const translated = translate(genericKey, language);
        if (translated !== genericKey) {
            return translated;
        }
    }

    // Last resort: use the original message
    return issue.message;
}

/**
 * Translate Zod validation error and return localized message
 */
function translateZodError(error: ZodError, language: string = 'en'): string {
    if (!error.issues || error.issues.length === 0) {
        return translate('errors.server.internalError', language);
    }

    // Return the first error, translated
    return translateValidationIssue(error.issues[0], language);
}

export function translateValidationError(error: unknown, language: string = 'en'): string {
    if (error instanceof ZodError) {
        return translateZodError(error, language);
    }

    // For any other error type, return a generic message
    return translate('errors.server.internalError', language);
}

export { translateZodError };
