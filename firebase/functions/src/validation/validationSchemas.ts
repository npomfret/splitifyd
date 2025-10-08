import * as Joi from 'joi';
import { VALIDATION_LIMITS } from '../constants';

export const displayNameSchema = Joi
    .string()
    .min(2)
    .max(VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH)
    .pattern(/^[a-zA-Z0-9\s\-_.]+$/)
    .required()
    .messages({
        'string.min': 'Display name must be at least 2 characters',
        'string.max': 'Display name cannot exceed 50 characters',
        'string.pattern.base': 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
        'string.empty': 'Display name is required',
        'any.required': 'Display name is required',
    });
