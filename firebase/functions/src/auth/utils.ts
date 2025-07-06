import { AuthenticatedRequest } from './middleware';
import { Errors } from '../utils/errors';

export const validateUserAuth = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw Errors.UNAUTHORIZED();
  }
  return req.user.uid;
};