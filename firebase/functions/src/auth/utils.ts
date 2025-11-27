import { UserId } from '@billsplit-wl/shared';
import { Errors } from '../utils/errors';
import { validateUserId } from '../validation/common';
import { AuthenticatedRequest } from './middleware';

export const validateUserAuth = (req: AuthenticatedRequest): UserId => {
    if (!req.user) {
        throw Errors.UNAUTHORIZED();
    }
    return validateUserId(req.user.uid);
};
