import { UserId } from '@billsplit-wl/shared';
import { Errors } from '../errors';
import { validateUserId } from '../validation/common';
import { AuthenticatedRequest } from './middleware';

export const validateUserAuth = (req: AuthenticatedRequest): UserId => {
    if (!req.user) {
        throw Errors.authRequired();
    }
    return validateUserId(req.user.uid);
};
