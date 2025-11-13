import { CreateExpenseRequest, CreateExpenseRequestSchema, ExpenseId, SplitTypes, toExpenseId, toGroupId, toISOString, UpdateExpenseRequest, UpdateExpenseRequestSchema } from '@splitifyd/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { SplitStrategyFactory } from '../services/splits/SplitStrategyFactory';
import { validateAmountPrecision } from '../utils/amount-validation';
import { ApiError } from '../utils/errors';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

const createExpenseErrorMapper = createZodErrorMapper(
    {
        groupId: {
            code: 'MISSING_GROUP_ID',
            message: () => 'Group ID is required',
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
            code: 'INVALID_DATE',
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
            code: 'INVALID_INPUT',
            message: (issue) => issue.message,
        },
        receiptUrl: {
            code: 'INVALID_INPUT',
            message: (issue) => issue.message,
        },
    },
    {
        defaultCode: 'INVALID_INPUT',
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
            paidBy: value.paidBy.trim(),
            amount: value.amount,
            currency: value.currency,
            description: sanitizeInputString(value.description),
            label: sanitizeInputString(value.label),
            date: toISOString(value.date),
            splitType: value.splitType,
            participants: value.participants.map((participant) => participant.trim()),
            splits: value.splits.map((split) => ({
                uid: split.uid.trim(),
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
            code: 'INVALID_DATE',
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
        defaultCode: 'INVALID_INPUT',
        defaultMessage: (issue) => issue.message,
    },
);

const mapUpdateExpenseError = (error: z.ZodError): never => {
    if (error.issues.some((issue) => issue.message === 'No valid fields to update')) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'NO_UPDATE_FIELDS', 'No valid fields to update');
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
            update.paidBy = value.paidBy.trim();
        }

        if (value.splitType !== undefined) {
            update.splitType = value.splitType;
        }

        if (value.participants !== undefined) {
            update.participants = value.participants.map((participant) => participant.trim());
        }

        if (value.splits !== undefined) {
            update.splits = value.splits.map((split) => ({
                uid: split.uid.trim(),
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

export const validateExpenseId = (id: unknown): ExpenseId => {
    if (typeof id !== 'string' || !id.trim()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Invalid expense ID');
    }

    return toExpenseId(id.trim());
};

export const validateCreateExpense = (body: unknown): CreateExpenseRequest => {
    const value = baseCreateExpenseValidator(body);

    if (!value.participants.includes(value.paidBy)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
    }

    try {
        validateAmountPrecision(value.amount, value.currency);
    } catch (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
    }

    for (const split of value.splits) {
        if (split.amount !== undefined) {
            try {
                validateAmountPrecision(split.amount, value.currency);
            } catch (error) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_AMOUNT_PRECISION', (error as Error).message);
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

    if (update.amount !== undefined && update.currency !== undefined) {
        try {
            validateAmountPrecision(update.amount, update.currency);
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
        }
    }

    const requiresSplitValidation = update.amount !== undefined
        || update.splitType !== undefined
        || update.participants !== undefined
        || update.splits !== undefined;

    if (requiresSplitValidation) {
        if (!update.participants) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'MISSING_PARTICIPANTS',
                'Participants are required for split updates',
            );
        }

        if (!update.splits || update.splits.length !== update.participants.length) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'INVALID_SPLITS',
                'Splits must be provided for all participants',
            );
        }

        if (update.currency && update.splits) {
            for (const split of update.splits) {
                if (split.amount !== undefined) {
                    try {
                        validateAmountPrecision(split.amount, update.currency);
                    } catch (error) {
                        throw new ApiError(
                            HTTP_STATUS.BAD_REQUEST,
                            'INVALID_SPLIT_AMOUNT_PRECISION',
                            (error as Error).message,
                        );
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
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
    }

    return update;
};
