import { ValidationError } from 'joi';
import { translate } from './i18n';

/**
 * Map common Joi validation error types to translation keys
 */
const errorTypeToTranslationKey: Record<string, string> = {
    'string.empty': 'validation.common.required',
    'string.min': 'validation.common.tooShort',
    'string.max': 'validation.common.tooLong',
    'any.required': 'validation.common.required',
    'string.email': 'validation.email.invalid',
    'number.base': 'validation.common.invalid',
    'number.positive': 'validation.common.invalid',
    'number.min': 'validation.common.tooSmall',
    'number.max': 'validation.common.tooLarge',
    'date.base': 'validation.common.invalid',
    'any.only': 'validation.common.invalid',
};

/**
 * Map specific field paths to translation key prefixes
 */
const fieldPathToTranslationPrefix: Record<string, string> = {
    'name': 'validation.group.name',
    'description': 'validation.group.description',
    'currency': 'validation.group.currency',
    'email': 'validation.email',
    'displayName': 'validation.user.displayName',
    'amount': 'validation.expense.amount',
    'date': 'validation.expense.date',
    'category': 'validation.expense.category',
    'participants': 'validation.expense.participants',
    'splits': 'validation.expense.splits',
    'paidBy': 'validation.expense.paidBy',
    'payerId': 'validation.settlement.fromUser',
    'payeeId': 'validation.settlement.toUser',
    'note': 'validation.settlement.description',
};

/**
 * Create specific translation key based on field and error type
 */
function getSpecificTranslationKey(fieldPath: string, errorType: string): string | null {
    const fieldPrefix = fieldPathToTranslationPrefix[fieldPath];
    
    if (!fieldPrefix) return null;
    
    // Map specific error types to field-specific keys
    switch (errorType) {
        case 'string.empty':
        case 'any.required':
            return `${fieldPrefix}Required`;
        case 'string.min':
            return `${fieldPrefix}TooShort`;
        case 'string.max':
            return `${fieldPrefix}TooLong`;
        case 'string.email':
            return `${fieldPrefix}Invalid`;
        case 'number.positive':
        case 'number.min':
            return `${fieldPrefix}TooSmall`;
        case 'number.max':
            return `${fieldPrefix}TooLarge`;
        case 'number.base':
            return `${fieldPrefix}Invalid`;
        case 'date.base':
            return `${fieldPrefix}Invalid`;
        case 'any.only':
            return `${fieldPrefix}Invalid`;
        default:
            return null;
    }
}

/**
 * Translate a single Joi validation error
 */
function translateValidationError(error: ValidationError['details'][0], language: string): string {
    const fieldPath = error.path.join('.');
    const errorType = error.type;
    
    // Try to get field-specific translation key first
    const specificKey = getSpecificTranslationKey(fieldPath, errorType);
    if (specificKey) {
        const translated = translate(specificKey, language);
        // If translation exists (not the key itself), use it
        if (translated !== specificKey) {
            return translated;
        }
    }
    
    // Fall back to generic error type translation
    const genericKey = errorTypeToTranslationKey[errorType];
    if (genericKey) {
        const translated = translate(genericKey, language);
        if (translated !== genericKey) {
            return translated;
        }
    }
    
    // Last resort: use the original message
    return error.message;
}

/**
 * Translate Joi validation error and return localized message
 */
export function translateJoiError(error: ValidationError, language: string = 'en'): string {
    if (!error.details || error.details.length === 0) {
        return translate('errors.server.internalError', language);
    }
    
    // Return the first error, translated
    return translateValidationError(error.details[0], language);
}

/**
 * Create a localized validation error from Joi ValidationError
 */
export function createLocalizedValidationError(
    error: ValidationError, 
    language: string = 'en'
): { message: string; details: string[] } {
    const translatedMessage = translateJoiError(error, language);
    
    // Translate all error details for comprehensive error reporting
    const translatedDetails = error.details.map(detail => 
        translateValidationError(detail, language)
    );
    
    return {
        message: translatedMessage,
        details: translatedDetails
    };
}