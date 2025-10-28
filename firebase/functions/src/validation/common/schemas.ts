import { type Amount, parseMonetaryAmount } from '@splitifyd/shared';
import { z } from 'zod';
import { VALIDATION_LIMITS } from '../../constants';
import { validateAmountPrecision } from '../../utils/amount-validation';
import { isUTCFormat, validateUTCDate } from '../../utils/dateHelpers';
import { EMAIL_REGEX, PASSWORD_REGEX, PHONE_E164_REGEX } from './regex';

const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9\s\-_.]+$/;

export interface DisplayNameSchemaOptions {
    min?: number;
    max?: number;
    minMessage?: string;
    maxMessage?: string;
    patternMessage?: string;
    pattern?: RegExp | null;
}

export const createDisplayNameSchema = (options?: DisplayNameSchemaOptions) => {
    const min = options?.min ?? 2;
    const max = options?.max ?? VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH;
    const minMessage = options?.minMessage ?? `Display name must be at least ${min} characters`;
    const maxMessage = options?.maxMessage ?? `Display name cannot exceed ${max} characters`;
    const patternMessage = options?.patternMessage ?? 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods';
    const pattern = options?.pattern === undefined ? DISPLAY_NAME_PATTERN : options.pattern;

    let schema = z
        .string()
        .trim()
        .min(min, minMessage)
        .max(max, maxMessage);

    if (pattern) {
        schema = schema.regex(pattern, patternMessage);
    }

    return schema;
};

export const DisplayNameSchema = createDisplayNameSchema();

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

const MAX_ALLOWED_AMOUNT = 999_999.99;

export interface AmountSchemaOptions {
    allowZero?: boolean;
    max?: number;
}

export const createAmountSchema = (options?: AmountSchemaOptions) => {
    const allowZero = options?.allowZero ?? false;
    const maxAmount = options?.max ?? MAX_ALLOWED_AMOUNT;

    return z
        .string()
        .trim()
        .regex(/^\d+(\.\d+)?$/, 'Amount must be a valid decimal number')
        .superRefine((value, ctx) => {
            let numericAmount: number;
            try {
                numericAmount = parseMonetaryAmount(value);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Invalid amount format',
                });
                return;
            }

            if (!allowZero && numericAmount <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Amount must be greater than zero',
                });
                return;
            }

            if (numericAmount > maxAmount) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Amount cannot exceed ${
                        maxAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })
                    }`,
                });
            }
        });
};

export interface CurrencyPrecisionParams {
    amount: string;
    currency?: string | null;
    path?: (string | number)[];
    ctx: z.RefinementCtx;
}

export const ensureCurrencyPrecision = ({ amount, currency, path, ctx }: CurrencyPrecisionParams) => {
    if (!currency) {
        return;
    }

    try {
        validateAmountPrecision(amount as Amount, currency);
    } catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: (error as Error).message,
            path: path ?? ['amount'],
        });
    }
};

export const CurrencyCodeSchema = z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase());

export interface UtcDateSchemaOptions {
    maxYearsAgo?: number;
}

export const createUtcDateSchema = (options?: UtcDateSchemaOptions) => {
    const maxYearsAgo = options?.maxYearsAgo ?? 10;

    return z
        .string()
        .superRefine((value, ctx) => {
            if (!isUTCFormat(value)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Date must be in UTC format (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ)',
                });
                return;
            }

            const validation = validateUTCDate(value, maxYearsAgo);
            if (!validation.valid) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: validation.error ?? 'Invalid date format',
                });
            }
        });
};

const toNumber = (value: unknown): number | undefined | null => {
    if (value === undefined || value === null) {
        return value as undefined | null;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }

    return Number.NaN;
};

export interface PaginationSchemaOptions {
    defaultLimit?: number;
    maxLimit?: number;
    minLimit?: number;
}

const paginationLimitPreprocessor = (value: unknown) => toNumber(value);

export const createPaginationSchema = (options?: PaginationSchemaOptions) => {
    const minLimit = options?.minLimit ?? 1;
    const maxLimit = options?.maxLimit ?? 100;
    const defaultLimit = options?.defaultLimit ?? 8;

    const limitSchema = z
        .preprocess(
            paginationLimitPreprocessor,
            z
                .number()
                .int('Limit must be an integer')
                .min(minLimit, `Limit must be at least ${minLimit}`)
                .max(maxLimit, `Limit cannot exceed ${maxLimit}`),
        )
        .optional()
        .default(defaultLimit);

    const cursorSchema = z
        .preprocess(
            (value) => (typeof value === 'string' ? value.trim() : value),
            z
                .string()
                .min(1, 'Cursor cannot be empty'),
        )
        .optional();

    return z
        .object({
            cursor: cursorSchema,
            limit: limitSchema,
        })
        .passthrough()
        .transform((value) => ({
            cursor: value.cursor,
            limit: value.limit,
        }));
};
