import { Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { AuthenticatedRequest } from '../auth/middleware';
import { LocalizedRequest } from '../utils/i18n';
import { Errors } from '../utils/errors';
import { userService } from '../services/UserService2';

/**
 * Get current user's profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const userProfile = await userService.getUser(userId);
    res.status(HTTP_STATUS.OK).json(userProfile);
};

/**
 * Update current user's profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

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

    const result = await userService.changePassword(userId, req.body);
    res.status(HTTP_STATUS.OK).json(result);
};

/**
 * Delete user account
 * This is a destructive operation that requires re-authentication
 */
export const deleteUserAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw Errors.UNAUTHORIZED();
    }

    const result = await userService.deleteAccount(userId, req.body);
    res.status(HTTP_STATUS.OK).json(result);
};
