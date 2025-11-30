import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { UserService } from '../services/UserService2';

export class UserHandlers {
    constructor(private readonly userService: UserService) {
    }

    /**
     * Update current user's profile
     */
    getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        const profile = await this.userService.getProfile(userId);
        res.status(HTTP_STATUS.OK).json(profile);
    };

    /**
     * Update current user's profile
     */
    updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        await this.userService.updateProfile(userId, req.body);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Change user password
     * Note: This requires the user to provide their current password for security
     */
    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        await this.userService.changePassword(userId, req.body);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };

    /**
     * Change user email
     * Requires current password verification
     */
    changeEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        await this.userService.changeEmail(userId, req.body);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    };
}
