import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { displayNameSchema } from '../validation/validationSchemas';

const createUserSchema = Joi.object({
  displayName: displayNameSchema
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