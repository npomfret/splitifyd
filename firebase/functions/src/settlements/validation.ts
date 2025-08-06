import * as Joi from 'joi';
import { CreateSettlementRequest, UpdateSettlementRequest } from '../types/webapp-shared-types';

const amountSchema = Joi.number()
  .positive()
  .precision(2)
  .max(999999.99)
  .required()
  .messages({
    'number.base': 'Amount must be a number',
    'number.positive': 'Amount must be greater than 0',
    'number.max': 'Amount cannot exceed 999,999.99',
    'any.required': 'Amount is required'
  });

const currencySchema = Joi.string()
  .uppercase()
  .length(3)
  .pattern(/^[A-Z]{3}$/)
  .required()
  .messages({
    'string.length': 'Currency must be a 3-letter code',
    'string.pattern.base': 'Currency must be a valid 3-letter ISO code (e.g., USD, EUR)',
    'any.required': 'Currency is required'
  });

const noteSchema = Joi.string()
  .max(500)
  .optional()
  .allow('')
  .messages({
    'string.max': 'Note cannot exceed 500 characters'
  });

const dateSchema = Joi.date()
  .iso()
  .max('now')
  .optional()
  .messages({
    'date.format': 'Date must be in ISO format',
    'date.max': 'Date cannot be in the future'
  });

export const createSettlementSchema = Joi.object<CreateSettlementRequest>({
  groupId: Joi.string().required().messages({
    'any.required': 'Group ID is required'
  }),
  payerId: Joi.string().required().messages({
    'any.required': 'Payer ID is required'
  }),
  payeeId: Joi.string().required().messages({
    'any.required': 'Payee ID is required'
  }),
  amount: amountSchema,
  currency: currencySchema,
  date: dateSchema,
  note: noteSchema
}).custom((value, helpers) => {
  if (value.payerId === value.payeeId) {
    return helpers.error('any.invalid', {
      message: 'Payer and payee cannot be the same person'
    });
  }
  return value;
});

export const updateSettlementSchema = Joi.object<UpdateSettlementRequest>({
  amount: Joi.number()
    .positive()
    .precision(2)
    .max(999999.99)
    .optional()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be greater than 0',
      'number.max': 'Amount cannot exceed 999,999.99'
    }),
  currency: Joi.string()
    .uppercase()
    .length(3)
    .pattern(/^[A-Z]{3}$/)
    .optional()
    .messages({
      'string.length': 'Currency must be a 3-letter code',
      'string.pattern.base': 'Currency must be a valid 3-letter ISO code (e.g., USD, EUR)'
    }),
  date: dateSchema,
  note: noteSchema
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const settlementIdSchema = Joi.string()
  .required()
  .messages({
    'any.required': 'Settlement ID is required',
    'string.empty': 'Settlement ID cannot be empty'
  });

export const listSettlementsQuerySchema = Joi.object({
  groupId: Joi.string().required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().optional(),
  userId: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.error('any.invalid', {
      message: 'Start date must be before or equal to end date'
    });
  }
  return value;
});