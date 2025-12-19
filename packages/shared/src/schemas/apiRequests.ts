/**
 * Shared Zod schemas for API request payloads.
 *
 * These schemas are intentionally free of server-only dependencies so they can be
 * consumed by both the Firebase Functions runtime and the web application.
 * Server code can compose these schemas with request validators to add
 * sanitisation, transformation, and error mapping while the web client can use
 * them for form validation.
 */

import { z } from 'zod';
import { getCurrency } from '../currencies';
import { type Amount, CurrencyISOCode, SplitTypes, toCurrencyISOCode, toDisplayName, toExpenseLabel, toGroupName } from '../shared-types';
import { parseMonetaryAmount } from '../split-utils';
import { createDisplayNameSchema, DisplayNameSchema, type DisplayNameSchemaOptions } from './primitives';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_REGEX = new RegExp(`^.{${PASSWORD_MIN_LENGTH},}$`);

export const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Re-export display name schema utilities for backwards compatibility
export { createDisplayNameSchema, DisplayNameSchema, type DisplayNameSchemaOptions };

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

export const CurrencyCodeSchema = z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase())
    .transform(toCurrencyISOCode);

/**
 * Schema for group currency settings - restricts which currencies can be used in a group.
 */
export const GroupCurrencySettingsSchema = z
    .object({
        permitted: z.array(CurrencyCodeSchema).nonempty('At least one currency is required'),
        default: CurrencyCodeSchema,
    })
    .refine((data) => data.permitted.includes(data.default), {
        message: 'Default currency must be in the permitted list',
        path: ['default'],
    });

const UTC_FORMAT_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]00:00)$/;

const isUTCFormat = (isoString: string): boolean => UTC_FORMAT_REGEX.test(isoString);

const isDateInValidRange = (date: Date, maxYearsAgo: number = 10): boolean => {
    const now = Date.now();
    const dateTime = date.getTime();
    const minTime = now - maxYearsAgo * 365.25 * 24 * 60 * 60 * 1000;
    const maxTime = now + 24 * 60 * 60 * 1000;

    return dateTime >= minTime && dateTime <= maxTime;
};

const validateUTCDate = (isoString: string, maxYearsAgo: number = 10): { valid: boolean; error?: string; } => {
    if (!isUTCFormat(isoString)) {
        return {
            valid: false,
            error: 'Date must be in UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        };
    }

    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        return {
            valid: false,
            error: 'Invalid date format',
        };
    }

    if (!isDateInValidRange(date, maxYearsAgo)) {
        const now = new Date();
        if (date > now) {
            return {
                valid: false,
                error: 'Date cannot be in the future',
            };
        }

        return {
            valid: false,
            error: `Date cannot be more than ${maxYearsAgo} years in the past`,
        };
    }

    return { valid: true };
};

export interface UtcDateSchemaOptions {
    maxYearsAgo?: number;
}

export const createUtcDateSchema = (options?: UtcDateSchemaOptions) => {
    const maxYearsAgo = options?.maxYearsAgo ?? 10;

    return z
        .string()
        .superRefine((value, ctx) => {
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

export const createPaginationSchema = (options?: PaginationSchemaOptions) => {
    const minLimit = options?.minLimit ?? 1;
    const maxLimit = options?.maxLimit ?? 100;
    const defaultLimit = options?.defaultLimit ?? 8;

    const limitSchema = z
        .preprocess(
            toNumber,
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

const validateAmountPrecision = (amount: Amount, currencyCode: CurrencyISOCode): void => {
    const currency = getCurrency(currencyCode);
    const decimalIndex = amount.indexOf('.');
    const decimals = decimalIndex === -1 ? 0 : amount.length - decimalIndex - 1;

    if (decimals > currency.decimal_digits) {
        if (currency.decimal_digits === 0) {
            throw new Error(
                `Amount must be a whole number for ${currencyCode} (${currency.name}). Received ${decimals} decimal place(s).`,
            );
        }

        throw new Error(
            `Amount must have at most ${currency.decimal_digits} decimal place(s) for ${currencyCode} (${currency.name}). Received ${decimals} decimal place(s).`,
        );
    }
};

// ---------------------------------------------------------------------------
// Auth requests
// ---------------------------------------------------------------------------

export const RegisterRequestSchema = z.object({
    email: EmailSchema,
    password: createPasswordSchema(),
    displayName: DisplayNameSchema,
    termsAccepted: AcceptanceBooleanSchema({
        required: 'Terms acceptance is required',
        invalidType: 'Terms acceptance must be a boolean value',
        notAccepted: 'You must accept the Terms of Service',
    }),
    cookiePolicyAccepted: AcceptanceBooleanSchema({
        required: 'Cookie policy acceptance is required',
        invalidType: 'Cookie policy acceptance must be a boolean value',
        notAccepted: 'You must accept the Cookie Policy',
    }),
    privacyPolicyAccepted: AcceptanceBooleanSchema({
        required: 'Privacy policy acceptance is required',
        invalidType: 'Privacy policy acceptance must be a boolean value',
        notAccepted: 'You must accept the Privacy Policy',
    }),
    signupHostname: z.string().min(1, 'Signup hostname is required'),
    adminEmailsAccepted: AcceptanceBooleanSchema({
        required: 'Account notifications acceptance is required',
        invalidType: 'Account notifications acceptance must be a boolean value',
        notAccepted: 'You must accept account notifications to create an account',
    }),
    marketingEmailsAccepted: z.boolean().default(false),
});

export const LoginRequestSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const PasswordResetRequestSchema = z.object({
    email: EmailSchema,
});

export const EmailVerificationRequestSchema = z.object({
    email: EmailSchema,
});

// ---------------------------------------------------------------------------
// Expense requests
// ---------------------------------------------------------------------------

const splitPercentageSchema = z
    .number()
    .min(0, 'Split percentage cannot be negative')
    .max(100, 'Split percentage cannot exceed 100')
    .optional();

export const ExpenseSplitRequestSchema = z.object({
    uid: z.string().trim().min(1, 'Split participant is required'),
    amount: createAmountSchema({
        max: Number.POSITIVE_INFINITY,
    }),
    percentage: splitPercentageSchema,
});

const ExpenseLocationSchema = z.object({
    name: z.string().trim().max(200, 'Location name cannot exceed 200 characters'),
    url: z.string().url('Location URL must be a valid URL').optional(),
});

export const CreateExpenseRequestSchema = z.object({
    groupId: z.string().trim().min(1, 'Group ID is required'),
    paidBy: z.string().trim().min(1, 'Payer is required'),
    amount: createAmountSchema({
        max: Number.POSITIVE_INFINITY,
    }),
    currency: CurrencyCodeSchema,
    description: z
        .string()
        .trim()
        .min(1, 'Description is required')
        .max(200, 'Description cannot exceed 200 characters'),
    labels: z
        .array(
            z.string().trim().min(1, 'Label cannot be empty').max(50, 'Label must be 50 characters or less').transform(toExpenseLabel),
        )
        .max(3, 'Maximum 3 labels allowed')
        .default([]),
    date: createUtcDateSchema(),
    splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]),
    participants: z
        .array(z.string().trim().min(1, 'Participant ID is required'))
        .min(1, 'At least one participant is required'),
    splits: z
        .array(ExpenseSplitRequestSchema)
        .min(1, 'Splits must be provided for all participants'),
    receiptUrl: z
        .union([
            z.string().url('Receipt URL must be a valid URL'),
            z.string().startsWith('/api/', 'Receipt URL must be a valid path'), // Relative API paths
            z.literal(''),
        ])
        .optional(),
    location: ExpenseLocationSchema.optional(),
});

export const UpdateExpenseRequestSchema = z
    .object({
        amount: createAmountSchema({
            max: Number.POSITIVE_INFINITY,
        })
            .optional(),
        currency: CurrencyCodeSchema.optional(),
        description: z
            .string()
            .trim()
            .min(1, 'Description cannot be empty')
            .max(200, 'Description cannot exceed 200 characters')
            .optional(),
        labels: z
            .array(
                z.string().trim().min(1, 'Label cannot be empty').max(50, 'Label must be 50 characters or less').transform(toExpenseLabel),
            )
            .max(3, 'Maximum 3 labels allowed')
            .optional(),
        date: createUtcDateSchema().optional(),
        paidBy: z.string().trim().min(1, 'Payer is required').optional(),
        splitType: z.enum([SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE]).optional(),
        participants: z
            .array(z.string().trim().min(1, 'Participant ID is required'))
            .min(1, 'At least one participant is required')
            .optional(),
        splits: z.array(ExpenseSplitRequestSchema).optional(),
        receiptUrl: z
            .union([
                z.string().url('Receipt URL must be a valid URL'),
                z.string().startsWith('/api/', 'Receipt URL must be a valid path'), // Relative API paths
                z.literal(''),
            ])
            .optional(),
        location: ExpenseLocationSchema.optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.amount === undefined
            && value.currency === undefined
            && value.description === undefined
            && value.labels === undefined
            && value.date === undefined
            && value.paidBy === undefined
            && value.splitType === undefined
            && value.participants === undefined
            && value.splits === undefined
            && value.receiptUrl === undefined
            && value.location === undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'No valid fields to update',
            });
        }
    });

// ---------------------------------------------------------------------------
// Settlement requests
// ---------------------------------------------------------------------------

const noteSchema = z
    .union([
        z
            .string()
            .trim()
            .max(500, 'Note cannot exceed 500 characters'),
        z.literal(''),
    ])
    .optional();

const settlementDateSchema = z
    .union([
        createUtcDateSchema(),
        z.null(),
    ])
    .optional();

export const CreateSettlementRequestSchema = z
    .object({
        groupId: z.string().trim().min(1, 'Group ID is required'),
        payerId: z.string().trim().min(1, 'Payer ID is required'),
        payeeId: z.string().trim().min(1, 'Payee ID is required'),
        amount: createAmountSchema(),
        currency: CurrencyCodeSchema,
        date: settlementDateSchema,
        note: noteSchema,
    })
    .superRefine((value, ctx) => {
        if (value.payerId && value.payeeId && value.payerId === value.payeeId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['payeeId'],
                message: 'Payer and payee cannot be the same person',
            });
        }

        if (value.amount && value.currency) {
            try {
                validateAmountPrecision(value.amount, value.currency);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['amount'],
                    message: (error as Error).message,
                });
            }
        }
    });

export const UpdateSettlementRequestSchema = z
    .object({
        amount: createAmountSchema().optional(),
        currency: CurrencyCodeSchema.optional(),
        date: settlementDateSchema,
        note: noteSchema,
    })
    .superRefine((value, ctx) => {
        if (
            value.amount === undefined
            && value.currency === undefined
            && value.date === undefined
            && value.note === undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one field must be provided for update',
            });
        }

        if (value.amount !== undefined && value.currency !== undefined) {
            try {
                validateAmountPrecision(value.amount, value.currency);
            } catch (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['amount'],
                    message: (error as Error).message,
                });
            }
        }
    });

// ---------------------------------------------------------------------------
// Comment requests
// ---------------------------------------------------------------------------

export const CommentTextSchema = z
    .string()
    .trim()
    .min(1, 'Comment text is required')
    .max(500, 'Comment cannot exceed 500 characters');

export const CommentBodySchema = z.object({
    text: CommentTextSchema,
    attachmentIds: z.array(z.string()).max(3, 'Maximum 3 attachments per comment').optional(),
});

export const ListCommentsQuerySchema = createPaginationSchema({
    defaultLimit: 8,
    minLimit: 1,
    maxLimit: 100,
});

// ---------------------------------------------------------------------------
// Activity feed requests
// ---------------------------------------------------------------------------

export const ActivityFeedQuerySchema = createPaginationSchema({
    defaultLimit: 10,
    minLimit: 1,
    maxLimit: 100,
});

// ---------------------------------------------------------------------------
// Policy requests
// ---------------------------------------------------------------------------

export const PolicyIdSchema = z
    .string()
    .trim()
    .min(1, 'Policy ID is required');

export const VersionHashSchema = z
    .string()
    .trim()
    .min(1, 'Version hash is required');

export const PolicyAcceptanceItemSchema = z.object({
    policyId: PolicyIdSchema,
    versionHash: VersionHashSchema,
});

export const AcceptMultiplePoliciesRequestSchema = z.object({
    acceptances: z
        .array(PolicyAcceptanceItemSchema)
        .min(1, 'At least one policy acceptance is required'),
});

const policyNameSchema = z
    .string()
    .trim()
    .min(1, 'Policy name is required')
    .max(100, 'Policy name must be 100 characters or less');

const policyTextSchema = z
    .string()
    .min(1, 'Policy text is required');

export const CreatePolicyRequestSchema = z.object({
    policyName: policyNameSchema,
    text: policyTextSchema,
    publish: z.boolean().optional().default(false),
});

export const UpdatePolicyRequestSchema = z.object({
    text: policyTextSchema,
    publish: z.boolean().optional().default(false),
});

export const PublishPolicyRequestSchema = z.object({
    versionHash: VersionHashSchema,
});

// ---------------------------------------------------------------------------
// User profile requests
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = ['en', 'uk', 'ar', 'de', 'es', 'it', 'ja', 'ko', 'lv', 'nl-BE', 'no', 'ph', 'sv'];
export const UpdateUserProfileRequestSchema = z
    .object({
        displayName: createDisplayNameSchema({
            min: 1,
            max: 100,
            minMessage: 'Display name cannot be empty',
            maxMessage: 'Display name must be 100 characters or less',
            pattern: null,
        })
            .optional(),
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
            .refine((value) => SUPPORTED_LANGUAGES.includes(value), {
                message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
            })
            .optional(),
        marketingEmailsAccepted: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.displayName === undefined
            && value.photoURL === undefined
            && value.preferredLanguage === undefined
            && value.marketingEmailsAccepted === undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'At least one field (displayName, photoURL, preferredLanguage, or marketingEmailsAccepted) must be provided',
            });
        }
    });

export const ChangePasswordRequestSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Current password cannot be empty'),
    newPassword: createPasswordSchema({
        required: 'New password cannot be empty',
        weak: 'Password must be at least 12 characters long',
    }),
});

export const ChangeEmailRequestSchema = z.object({
    currentPassword: z
        .string()
        .min(1, 'Current password cannot be empty'),
    newEmail: EmailSchema,
});

// ---------------------------------------------------------------------------
// Group request schemas
// ---------------------------------------------------------------------------

export const CreateGroupRequestSchema = z.object({
    name: z.string().trim().min(1, 'Group name is required').max(100, 'Group name must be less than 100 characters').transform(toGroupName),
    groupDisplayName: createDisplayNameSchema({
        minMessage: 'Enter a display name.',
        maxMessage: 'Display name must be 50 characters or fewer.',
        patternMessage: 'Display name can only use letters, numbers, spaces, hyphens, underscores, and periods.',
    })
        .transform(toDisplayName),
    description: z.string().trim().max(500).optional(),
    currencySettings: GroupCurrencySettingsSchema.optional(),
});

export const UpdateGroupRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(100).transform(toGroupName).optional(),
        description: z.string().trim().max(500).optional(),
        currencySettings: GroupCurrencySettingsSchema.nullable().optional(), // null to clear
        locked: z.boolean().optional(), // Only admins can set this
    })
    .refine(
        (data) => data.name !== undefined || data.description !== undefined || data.currencySettings !== undefined || data.locked !== undefined,
        {
            message: 'At least one field (name, description, currencySettings, or locked) must be provided',
        },
    );

export const UpdateDisplayNameRequestSchema = z.object({
    displayName: z
        .string()
        .min(1, 'Display name is required')
        .max(50, 'Display name must be 50 characters or less')
        .trim()
        .transform(toDisplayName),
});

// ---------------------------------------------------------------------------
// List query schemas
// ---------------------------------------------------------------------------

/**
 * Query schema for listing groups with pagination and filtering.
 * statusFilter is a comma-separated string of member statuses (e.g., "active,invited").
 */
export const ListGroupsQuerySchema = z
    .object({
        limit: z
            .preprocess(
                toNumber,
                z.number().int().min(1).max(100),
            )
            .optional()
            .default(100),
        cursor: z
            .preprocess(
                (value) => (typeof value === 'string' ? value.trim() : value),
                z.string().min(1),
            )
            .optional(),
        order: z.enum(['asc', 'desc']).optional().default('desc'),
        statusFilter: z.string().optional(),
    })
    .passthrough()
    .transform((value) => ({
        limit: value.limit,
        cursor: value.cursor,
        order: value.order,
        statusFilter: value.statusFilter,
    }));

/**
 * Helper to create a pagination limit schema with number preprocessing.
 */
const createLimitSchema = (defaultValue: number, maxValue: number) =>
    z
        .preprocess(
            toNumber,
            z
                .number()
                .int('Limit must be an integer')
                .min(1, 'Limit must be at least 1')
                .max(maxValue, `Limit cannot exceed ${maxValue}`),
        )
        .optional()
        .default(defaultValue);

/**
 * Query schema for group full details endpoint with multiple pagination cursors.
 */
export const GroupFullDetailsQuerySchema = z.object({
    expenseLimit: createLimitSchema(8, 100),
    expenseCursor: z.string().optional(),
    settlementLimit: createLimitSchema(8, 100),
    settlementCursor: z.string().optional(),
    commentLimit: createLimitSchema(8, 100),
    commentCursor: z.string().optional(),
    includeDeletedExpenses: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
    includeDeletedSettlements: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
});

/**
 * Query schema for listing expenses in a group.
 */
export const ListExpensesQuerySchema = z
    .object({
        limit: z
            .preprocess(
                toNumber,
                z.number().int().min(1).max(100),
            )
            .optional()
            .default(20),
        cursor: z
            .preprocess(
                (value) => (typeof value === 'string' ? value.trim() : value),
                z.string().min(1),
            )
            .optional(),
        includeDeleted: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
    })
    .passthrough()
    .transform((value) => ({
        limit: value.limit,
        cursor: value.cursor,
        includeDeleted: value.includeDeleted,
    }));

/**
 * Query schema for listing settlements in a group.
 */
export const ListSettlementsQuerySchema = z
    .object({
        limit: z
            .preprocess(
                toNumber,
                z.number().int().min(1).max(100),
            )
            .optional()
            .default(20),
        cursor: z
            .preprocess(
                (value) => (typeof value === 'string' ? value.trim() : value),
                z.string().min(1),
            )
            .optional(),
        includeDeleted: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
    })
    .passthrough()
    .transform((value) => ({
        limit: value.limit,
        cursor: value.cursor,
        includeDeleted: value.includeDeleted,
    }));

/**
 * Query schema for listing Firebase Auth users (admin endpoint).
 * Uses pageToken for Firebase Auth pagination (not cursor-based).
 */
export const ListAuthUsersQuerySchema = z.object({
    limit: createLimitSchema(50, 1000),
    pageToken: z.string().optional(),
    email: EmailSchema.optional(),
    uid: z.string().min(1, 'UID cannot be empty').optional(),
});

/**
 * Query schema for listing Firestore users (admin endpoint).
 */
export const ListFirestoreUsersQuerySchema = z
    .object({
        limit: z
            .preprocess(
                toNumber,
                z.number().int().min(1).max(200),
            )
            .optional()
            .default(50),
        cursor: z
            .preprocess(
                (value) => (typeof value === 'string' ? value.trim() : value),
                z.string().min(1),
            )
            .optional(),
        email: EmailSchema.optional(),
        uid: z.string().min(1, 'UID cannot be empty').optional(),
        displayName: z.string().optional(),
    })
    .passthrough()
    .transform((value) => ({
        limit: value.limit,
        cursor: value.cursor,
        email: value.email,
        uid: value.uid,
        displayName: value.displayName,
    }));
