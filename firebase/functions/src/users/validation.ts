import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';

const createUserSchema = Joi.object({
  displayName: Joi.string()
    .min(2)
    .max(50)
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

export interface CreateUserRequest {
  displayName: string;
}

export const validateCreateUserRequest = (body: any): CreateUserRequest => {
  const { error, value } = createUserSchema.validate(body, { abortEarly: false });
  
  if (error) {
    const firstError = error.details[0];
    let errorCode = 'INVALID_INPUT';
    
    if (firstError.path.includes('displayName')) {
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
    displayName: value.displayName.trim()
  };
};