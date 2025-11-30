import {
    CreateExpenseRequest,
    CreateExpenseRequestSchema,
    ListExpensesQuerySchema,
    SplitTypes,
    toGroupId,
    toISOString,
    UpdateExpenseRequest,
    UpdateExpenseRequestSchema,
} from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ErrorDetail, Errors } from '../errors';
import { SplitStrategyFactory } from '../services/splits/SplitStrategyFactory';
import { validateAmountPrecision } from '../utils/amount-validation';
import {
    createRequestValidator,
    createZodErrorMapper,
    sanitizeInputString,
    validateExpenseId,
    validateGroupIdParam,
} from '../validation/common';

// Re-export centralized ID validators for backward compatibility
export { validateExpenseId, validateGroupIdParam };

const createExpenseErrorMapper = createZodErrorMapper(
    {
        groupId: {
            code: 'INVALID_GROUP_ID',
            message: () => 'Invalid group ID',
        },
        paidBy: {
            code: 'MISSING_PAYER',
            message: () => 'Payer is required',
        },
        amount: {
            code: 'INVALID_AMOUNT',
            message: () => 'Amount must be a positive number',
        },
        description: {
            code: 'INVALID_DESCRIPTION',
            message: (issue) => {
                if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.message === 'Required') {
                    return 'Description is required';
                }
                return issue.message;
            },
        },
        label: {
            code: 'INVALID_LABEL',
            message: () => 'Label must be between 1 and 50 characters',
        },
        date: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        splitType: {
            code: 'INVALID_SPLIT_TYPE',
            message: () => 'Split type must be equal, exact, or percentage',
        },
        participants: {
            code: 'INVALID_PARTICIPANTS',
            message: (issue) => issue.message,
        },
        splits: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        receiptUrl: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const baseCreateExpenseValidator = createRequestValidator({
    schema: CreateExpenseRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const receiptUrl = value.receiptUrl !== undefined ? sanitizeInputString(value.receiptUrl) : undefined;

        return {
            groupId: toGroupId(value.groupId.trim()),
            paidBy: toUserId(value.paidBy),
            amount: value.amount,
            currency: value.currency,
            description: sanitizeInputString(value.description),
            label: sanitizeInputString(value.label),
            date: toISOString(value.date),
            splitType: value.splitType,
            participants: value.participants.map((participant) => toUserId(participant)),
            splits: value.splits.map((split) => ({
                uid: toUserId(split.uid),
                amount: split.amount,
                percentage: split.percentage,
            })),
            receiptUrl,
        } satisfies CreateExpenseRequest;
    },
    mapError: (error) => createExpenseErrorMapper(error),
}) as (body: unknown) => CreateExpenseRequest;

const updateExpenseErrorMapperBase = createZodErrorMapper(
    {
        amount: {
            code: 'INVALID_AMOUNT',
            message: () => 'Amount must be a positive number',
        },
        description: {
            code: 'INVALID_DESCRIPTION',
            message: (issue) => {
                if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.message === 'Required') {
                    return 'Description cannot be empty';
                }
                return issue.message;
            },
        },
        label: {
            code: 'INVALID_LABEL',
            message: () => 'Label must be between 1 and 50 characters',
        },
        date: {
            code: 'VALIDATION_ERROR',
            message: (issue) => issue.message,
        },
        splitType: {
            code: 'INVALID_SPLIT_TYPE',
            message: () => 'Split type must be equal, exact, or percentage',
        },
        participants: {
            code: 'INVALID_PARTICIPANTS',
            message: (issue) => issue.message,
        },
        splits: {
            code: 'INVALID_SPLITS',
            message: (issue) => issue.message,
        },
        receiptUrl: {
            code: 'INVALID_RECEIPT_URL',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const mapUpdateExpenseError = (error: z.ZodError): never => {
    if (error.issues.some((issue) => issue.message === 'No valid fields to update')) {
        throw Errors.invalidRequest(ErrorDetail.NO_UPDATE_FIELDS);
    }

    return updateExpenseErrorMapperBase(error);
};

const baseUpdateExpenseValidator = createRequestValidator({
    schema: UpdateExpenseRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => {
        const update: UpdateExpenseRequest = {};

        if (value.amount !== undefined) {
            update.amount = value.amount;
        }

        if (value.currency !== undefined) {
            update.currency = value.currency;
        }

        if (value.description !== undefined) {
            update.description = sanitizeInputString(value.description);
        }

        if (value.label !== undefined) {
            update.label = sanitizeInputString(value.label);
        }

        if (value.date !== undefined) {
            update.date = toISOString(value.date);
        }

        if (value.paidBy !== undefined) {
            update.paidBy = toUserId(value.paidBy);
        }

        if (value.splitType !== undefined) {
            update.splitType = value.splitType;
        }

        if (value.participants !== undefined) {
            update.participants = value.participants.map((participant) => toUserId(participant));
        }

        if (value.splits !== undefined) {
            update.splits = value.splits.map((split) => ({
                uid: toUserId(split.uid),
                amount: split.amount,
                percentage: split.percentage,
            }));
        }

        if (value.receiptUrl !== undefined) {
            update.receiptUrl = sanitizeInputString(value.receiptUrl);
        }

        return update;
    },
    mapError: (error) => mapUpdateExpenseError(error),
}) as (body: unknown) => UpdateExpenseRequest;

export const validateCreateExpense = (body: unknown): CreateExpenseRequest => {
    const value = baseCreateExpenseValidator(body);

    if (!value.participants.includes(value.paidBy)) {
        throw Errors.validationError('paidBy', ErrorDetail.PAYER_NOT_PARTICIPANT);
    }

    try {
        validateAmountPrecision(value.amount, value.currency);
    } catch (error) {
        throw Errors.validationError('amount', ErrorDetail.INVALID_AMOUNT_PRECISION);
    }

    for (const split of value.splits) {
        if (split.amount !== undefined) {
            try {
                validateAmountPrecision(split.amount, value.currency);
            } catch (error) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_AMOUNT_PRECISION);
            }
        }
    }

    const splitStrategyFactory = SplitStrategyFactory.getInstance();
    const splitStrategy = splitStrategyFactory.getStrategy(value.splitType);
    splitStrategy.validateSplits(value.amount, value.participants, value.splits, value.currency);

    return value;
};

export const validateUpdateExpense = (body: unknown): UpdateExpenseRequest => {
    const update = baseUpdateExpenseValidator(body);

    // Require currency when updating amount (breaking API change - allows precision validation)
    if (update.amount !== undefined && update.currency === undefined) {
        throw Errors.validationError('currency', ErrorDetail.MISSING_FIELD);
    }

    if (update.amount !== undefined && update.currency !== undefined) {
        try {
            validateAmountPrecision(update.amount, update.currency);
        } catch (error) {
            throw Errors.validationError('amount', ErrorDetail.INVALID_AMOUNT_PRECISION);
        }
    }

    const requiresSplitValidation = update.amount !== undefined
        || update.splitType !== undefined
        || update.participants !== undefined
        || update.splits !== undefined;

    if (requiresSplitValidation) {
        if (!update.participants) {
            throw Errors.validationError('participants', ErrorDetail.MISSING_FIELD);
        }

        if (!update.splits || update.splits.length !== update.participants.length) {
            throw Errors.validationError('splits', ErrorDetail.INVALID_PARTICIPANT);
        }

        if (update.currency && update.splits) {
            for (const split of update.splits) {
                if (split.amount !== undefined) {
                    try {
                        validateAmountPrecision(split.amount, update.currency);
                    } catch (error) {
                        throw Errors.validationError('splits', ErrorDetail.INVALID_AMOUNT_PRECISION);
                    }
                }
            }
        }

        const splitType = update.splitType ?? SplitTypes.EQUAL;
        const splitStrategyFactory = SplitStrategyFactory.getInstance();
        const splitStrategy = splitStrategyFactory.getStrategy(splitType);

        // amount and currency are required for split validation but may be undefined in updates
        // If they're not provided in the update, they should be fetched from the existing expense
        // For now, we'll pass undefined and let the split strategy handle it, or require both
        if (update.amount !== undefined && update.currency !== undefined) {
            splitStrategy.validateSplits(update.amount, update.participants, update.splits, update.currency);
        }

        update.splitType = splitType;
    }

    if (update.receiptUrl !== undefined && update.receiptUrl === '') {
        update.receiptUrl = '';
    }

    if (update.participants && update.paidBy && !update.participants.includes(update.paidBy)) {
        throw Errors.validationError('paidBy', ErrorDetail.PAYER_NOT_PARTICIPANT);
    }

    return update;
};

// ========================================================================
// List Query Validators
// ========================================================================

const listExpensesQueryErrorMapper = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

export interface ListExpensesQueryResult {
    limit: number;
    cursor?: string;
    includeDeleted: boolean;
}

/**
 * Validate list expenses query parameters.
 */
export const validateListExpensesQuery = createRequestValidator({
    schema: ListExpensesQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: listExpensesQueryErrorMapper,
}) as (query: unknown) => ListExpensesQueryResult;
