import { Errors } from '../utils/errors';
import { AuthenticatedRequest } from './middleware';

export const validateUserAuth = (req: AuthenticatedRequest): string => {
    if (!req.user) {
        throw Errors.UNAUTHORIZED();
    }
    return req.user.uid;
};
