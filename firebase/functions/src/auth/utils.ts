import { Errors } from '../utils/errors';
import { AuthenticatedRequest } from './middleware';
import {toUserId, UserId} from "@billsplit-wl/shared";

export const validateUserAuth = (req: AuthenticatedRequest): UserId => {
    if (!req.user) {
        throw Errors.UNAUTHORIZED();
    }
    return toUserId(req.user.uid);
};
