import { toUserId, UserId } from '@billsplit-wl/shared';
import { Errors } from '../utils/errors';
import { AuthenticatedRequest } from './middleware';

export const validateUserAuth = (req: AuthenticatedRequest): UserId => {
    if (!req.user) {
        throw Errors.UNAUTHORIZED();
    }
    return toUserId(req.user.uid);
};
