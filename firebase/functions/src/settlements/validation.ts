import * as Joi from 'joi';
import { CreateSettlementRequest, UpdateSettlementRequest } from '@splitifyd/shared';
import { isUTCFormat, validateUTCDate } from '../utils/dateHelpers';

const amountSchema = Joi.number().positive().precision(2).max(999999.99).required().messages({
    'number.base': 'Amount must be a number',
    'number.positive': 'Amount must be greater than 0',
    'number.max': 'Amount cannot exceed 999,999.99',
    'any.required': 'Amount is required',
});

const noteSchema = Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Note cannot exceed 500 characters',
});

// UTC-only date validation for settlements
const dateSchema = Joi.string()
    .custom((value, helpers) => {
        // Optional field - allow undefined
        if (value === undefined || value === null) {
            return value;
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
            }
        }

        return value;
    })
    .optional()
    .messages({
        'date.utc': 'Date must be in UTC format (YYYY-MM-DDTHH:mm:ss.sssZ)',
        'date.invalid': 'Invalid date format',
        'date.max': 'Date cannot be in the future',
        'date.min': 'Date cannot be more than 10 years in the past',
    });

export const createSettlementSchema = Joi.object<CreateSettlementRequest>({
    groupId: Joi.string().required().messages({
        'any.required': 'Group ID is required',
    }),
    payerId: Joi.string().required().messages({
        'any.required': 'Payer ID is required',
    }),
    payeeId: Joi.string().required().messages({
        'any.required': 'Payee ID is required',
    }),
    amount: amountSchema,
    currency: Joi.string().length(3).uppercase().required(),
    date: dateSchema,
    note: noteSchema,
}).custom((value, helpers) => {
    if (value.payerId === value.payeeId) {
        return helpers.error('any.invalid', {
            message: 'Payer and payee cannot be the same person',
        });
    }
    return value;
});

export const updateSettlementSchema = Joi.object<UpdateSettlementRequest>({
    amount: Joi.number().positive().precision(2).max(999999.99).optional().messages({
        'number.base': 'Amount must be a number',
        'number.positive': 'Amount must be greater than 0',
        'number.max': 'Amount cannot exceed 999,999.99',
    }),
    currency: Joi.string().length(3).uppercase().optional(),
    date: dateSchema,
    note: noteSchema,
})
    .min(1)
    .messages({
        'object.min': 'At least one field must be provided for update',
    });

export const settlementIdSchema = Joi.string().required().messages({
    'any.required': 'Settlement ID is required',
    'string.empty': 'Settlement ID cannot be empty',
});
