import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS, VALIDATION_LIMITS } from '../constants';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registerSchema = Joi.object({
  email: Joi.string()
    .pattern(EMAIL_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Invalid email format',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .pattern(PASSWORD_REGEX)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    }),
  displayName: Joi.string()
    .min(2)
    .max(VALIDATION_LIMITS.MAX_DISPLAY_NAME_LENGTH)
    .pattern(/^[a-zA-Z0-9\s\-_.]+$/)
    .required()
    .messages({
      'string.min': 'Display name must be at least 2 characters',
      'string.max': 'Display name cannot exceed 50 characters',
      'string.pattern.base': 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
      'string.empty': 'Display name is required',
      'any.required': 'Display name is required'
    })
});

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export const validateRegisterRequest = (body: any): RegisterRequest => {
  const { error, value } = registerSchema.validate(body, { abortEarly: false });
  
  if (error) {
    const firstError = error.details[0];
    let errorCode = 'INVALID_INPUT';
    
    if (firstError.path.includes('email')) {
      errorCode = firstError.message.includes('format') ? 'INVALID_EMAIL_FORMAT' : 'MISSING_EMAIL';
    } else if (firstError.path.includes('password')) {
      errorCode = firstError.message.includes('8 characters') ? 'WEAK_PASSWORD' : 'MISSING_PASSWORD';
    } else if (firstError.path.includes('displayName')) {
      if (firstError.message.includes('2 characters')) {
        errorCode = 'DISPLAY_NAME_TOO_SHORT';
      } else if (firstError.message.includes('50 characters')) {
        errorCode = 'DISPLAY_NAME_TOO_LONG';
      } else if (firstError.message.includes('only contain')) {
        errorCode = 'INVALID_DISPLAY_NAME_CHARS';
      } else {
        errorCode = 'MISSING_DISPLAY_NAME';
      }
    }
    
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, firstError.message);
  }
  
  return {
    email: value.email.trim().toLowerCase(),
    password: value.password,
    displayName: value.displayName.trim()
  };
};