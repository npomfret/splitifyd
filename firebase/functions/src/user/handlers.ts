import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { getAppBuilder } from '../index';
import { Errors } from '../utils/errors';
import { LocalizedRequest } from '../utils/i18n';

/**
 * Update current user's profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const userService = getAppBuilder().buildUserService();
    const updatedProfile = await userService.updateProfile(userId, req.body, req.language);
    res.status(HTTP_STATUS.OK).json(updatedProfile);
};

/**
 * Change user password
 * Note: This requires the user to provide their current password for security
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const userService = getAppBuilder().buildUserService();
    const result = await userService.changePassword(userId, req.body);
    res.status(HTTP_STATUS.OK).json(result);
};
