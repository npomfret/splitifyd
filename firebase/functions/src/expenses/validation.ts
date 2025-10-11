import * as Joi from 'joi';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';

import { CreateExpenseRequest, SplitTypes, UpdateExpenseRequest } from '@splitifyd/shared';
import { SplitStrategyFactory } from '../services/splits/SplitStrategyFactory';
import { validateAmountPrecision } from '../utils/amount-validation';
import { isUTCFormat, validateUTCDate } from '../utils/dateHelpers';
import { sanitizeString } from '../utils/security';

const expenseSplitSchema = Joi.object({
    uid: Joi.string().required(),
    amount: Joi.number().positive().required(),
    percentage: Joi.number().min(0).max(100).optional(),
});

// Date validation schema with proper constraints
// Custom UTC-only date validation schema
const utcDateValidationSchema = Joi
    .string()
    .custom((value, helpers) => {
        // First check if it's a string
        if (typeof value !== 'string') {
            return helpers.error('date.format');
        }

        // Check if it's in UTC format
        if (!isUTCFormat(value)) {
            return helpers.error('date.utc');
        }

        // Validate the date range and format
        const validation = validateUTCDate(value, 10);
        if (!validation.valid) {
            if (validation.error?.includes('future')) {
                return helpers.error('date.max');
            } else if (validation.error?.includes('past')) {
                return helpers.error('date.min');
            } else if (validation.error?.includes('Invalid')) {
                return helpers.error('date.invalid');
            } else {
                return helpers.error('date.utc');
            }
        }

        return value;
    })
    .messages({
        'date.format': 'Date must be a string in ISO 8601 format',
        'date.utc': 'Date must be in UTC format (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ)',
        'date.invalid': 'Invalid date format',
        'date.max': 'Date cannot be in the future',
        'date.min': 'Date cannot be more than 10 years in the past',
    });

// Keep the old schema name for backward compatibility but use UTC validation
const dateValidationSchema = utcDateValidationSchema;

const createExpenseSchema = Joi.object({
    groupId: Joi.string().required(),
    paidBy: Joi.string().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).uppercase().required(),
    description: Joi.string().trim().min(1).max(200).required(),
    category: Joi.string().trim().min(1).max(50).required(),
    date: dateValidationSchema.required(),
    splitType: Joi.string().valid(SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE).required(),
    participants: Joi.array().items(Joi.string()).min(1).required(),
    splits: Joi.array().items(expenseSplitSchema).required(),
    receiptUrl: Joi.string().uri().optional().allow(''),
});

const updateExpenseSchema = Joi
    .object({
        amount: Joi.number().positive().optional(),
        currency: Joi.string().length(3).uppercase().optional(),
        description: Joi.string().trim().min(1).max(200).optional(),
        category: Joi.string().trim().min(1).max(50).optional(),
        date: dateValidationSchema.optional(),
        paidBy: Joi.string().optional(),
        splitType: Joi.string().valid(SplitTypes.EQUAL, SplitTypes.EXACT, SplitTypes.PERCENTAGE).optional(),
        participants: Joi.array().items(Joi.string()).min(1).optional(),
        splits: Joi.array().items(expenseSplitSchema).optional(),
        receiptUrl: Joi.string().uri().optional().allow(''),
    })
    .min(1);

const sanitizeExpenseData = <T extends CreateExpenseRequest | UpdateExpenseRequest>(data: T): T => {
    const sanitized = { ...data };

    if ('description' in sanitized && typeof sanitized.description === 'string') {
        sanitized.description = sanitizeString(sanitized.description);
    }

    if ('category' in sanitized && typeof sanitized.category === 'string') {
        sanitized.category = sanitizeString(sanitized.category);
    }

    if ('receiptUrl' in sanitized && typeof sanitized.receiptUrl === 'string') {
        sanitized.receiptUrl = sanitizeString(sanitized.receiptUrl);
    }

    return sanitized;
};

export const validateExpenseId = (id: any): string => {
    if (typeof id !== 'string' || !id.trim()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EXPENSE_ID', 'Invalid expense ID');
    }
    return id.trim();
};

export const validateCreateExpense = (body: any): CreateExpenseRequest => {
    const { error, value } = createExpenseSchema.validate(body, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_INPUT';
        let errorMessage = firstError.message;

        if (firstError.path.includes('groupId')) {
            errorCode = 'MISSING_GROUP_ID';
            errorMessage = 'Group ID is required';
        } else if (firstError.path.includes('paidBy')) {
            errorCode = 'MISSING_PAYER';
            errorMessage = 'Payer is required';
        } else if (firstError.path.includes('amount')) {
            errorCode = 'INVALID_AMOUNT';
            errorMessage = 'Amount must be a positive number';
        } else if (firstError.path.includes('description')) {
            errorCode = 'INVALID_DESCRIPTION';
            errorMessage = 'Description is required';
        } else if (firstError.path.includes('category')) {
            errorCode = 'INVALID_CATEGORY';
            errorMessage = 'Category must be between 1 and 50 characters';
        } else if (firstError.path.includes('date')) {
            errorCode = 'INVALID_DATE';
            errorMessage = firstError.message || 'Invalid date format';
        } else if (firstError.path.includes('splitType')) {
            errorCode = 'INVALID_SPLIT_TYPE';
            errorMessage = 'Split type must be equal, exact, or percentage';
        } else if (firstError.path.includes('participants')) {
            errorCode = 'INVALID_PARTICIPANTS';
            errorMessage = 'At least one participant is required';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    // Date validation is now handled by Joi schema
    if (!value.participants.includes(value.paidBy)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
    }

    // Validate main expense amount precision for currency
    try {
        validateAmountPrecision(value.amount, value.currency);
    } catch (error) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
    }

    // Validate split amounts precision if splits are provided
    if (value.splits && Array.isArray(value.splits)) {
        for (const split of value.splits) {
            if (split.amount !== undefined) {
                try {
                    validateAmountPrecision(split.amount, value.currency);
                } catch (error) {
                    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_AMOUNT_PRECISION', (error as Error).message);
                }
            }
        }
    }

    // Use strategy pattern to validate splits based on split type
    const splitStrategyFactory = SplitStrategyFactory.getInstance();
    const splitStrategy = splitStrategyFactory.getStrategy(value.splitType);
    splitStrategy.validateSplits(value.amount, value.participants, value.splits, value.currency);

    const expenseData = {
        groupId: value.groupId.trim(),
        paidBy: value.paidBy.trim(),
        amount: value.amount,
        currency: value.currency,
        description: value.description.trim(),
        category: value.category,
        date: value.date,
        splitType: value.splitType,
        participants: value.participants.map((p: string) => p.trim()),
        splits: value.splits,
        receiptUrl: value.receiptUrl?.trim(),
    };

    return sanitizeExpenseData(expenseData);
};

export const validateUpdateExpense = (body: any): UpdateExpenseRequest => {
    const { error, value } = updateExpenseSchema.validate(body, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_INPUT';
        let errorMessage = firstError.message;

        if (firstError.path.includes('amount')) {
            errorCode = 'INVALID_AMOUNT';
            errorMessage = 'Amount must be a positive number';
        } else if (firstError.path.includes('description')) {
            errorCode = 'INVALID_DESCRIPTION';
            errorMessage = 'Description cannot be empty';
        } else if (firstError.path.includes('category')) {
            errorCode = 'INVALID_CATEGORY';
            errorMessage = 'Category must be between 1 and 50 characters';
        } else if (firstError.path.includes('date')) {
            errorCode = 'INVALID_DATE';
            errorMessage = firstError.message || 'Invalid date format';
        } else if (firstError.path.includes('splitType')) {
            errorCode = 'INVALID_SPLIT_TYPE';
            errorMessage = 'Split type must be equal, exact, or percentage';
        } else if (firstError.path.includes('participants')) {
            errorCode = 'INVALID_PARTICIPANTS';
            errorMessage = 'At least one participant is required';
        } else if (firstError.message.includes('at least 1 key')) {
            errorCode = 'NO_UPDATE_FIELDS';
            errorMessage = 'No valid fields to update';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    const update: UpdateExpenseRequest = {};

    if ('amount' in value) {
        update.amount = value.amount;
    }

    if ('currency' in value) {
        update.currency = value.currency;
    }

    // Validate amount precision if both amount and currency are provided
    if ('amount' in update && 'currency' in update) {
        try {
            validateAmountPrecision(update.amount!, update.currency!);
        } catch (error) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT_PRECISION', (error as Error).message);
        }
    }

    if ('description' in value) {
        update.description = value.description.trim();
    }

    if ('category' in value) {
        update.category = value.category;
    }

    if ('date' in value) {
        // Date validation is now handled by Joi schema
        update.date = value.date;
    }

    if ('paidBy' in value) {
        update.paidBy = value.paidBy;
    }

    // If amount, splitType, participants, or splits are being updated, require complete split information
    if ('amount' in value || 'splitType' in value || 'participants' in value || 'splits' in value) {
        const splitType = value.splitType || SplitTypes.EQUAL;
        if (!value.participants) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_PARTICIPANTS', 'Participants are required for split updates');
        }
        const participants = value.participants;
        const splits = value.splits;

        // Validate split amounts precision if currency is available and splits are provided
        const currency = value.currency;
        if (currency && splits && Array.isArray(splits)) {
            for (const split of splits) {
                if (split.amount !== undefined) {
                    try {
                        validateAmountPrecision(split.amount, currency);
                    } catch (error) {
                        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_AMOUNT_PRECISION', (error as Error).message);
                    }
                }
            }
        }

        // Splits are always required
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
        }

        // Use strategy pattern to validate splits for updates
        // Note: amount validation is not critical here - will be handled when expense is retrieved and updated
        const splitStrategyFactory = SplitStrategyFactory.getInstance();
        const splitStrategy = splitStrategyFactory.getStrategy(splitType);
        splitStrategy.validateSplits(value.amount ?? 0, participants, splits, currency);

        update.splitType = splitType;
        update.participants = participants.map((p: string) => p.trim());
        update.splits = splits;
    }

    if ('receiptUrl' in value) {
        update.receiptUrl = value.receiptUrl?.trim();
    }

    // If both paidBy and participants are being updated, ensure paidBy is in participants
    if ('paidBy' in update && 'participants' in update) {
        if (!update.participants!.includes(update.paidBy!)) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'PAYER_NOT_PARTICIPANT', 'Payer must be a participant');
        }
    }

    return sanitizeExpenseData(update);
};
