import {UserService} from "../services/UserService2";
import {getAuth, getFirestore} from "../firebase";
import {ApplicationBuilder} from "../services/ApplicationBuilder";
import {AuthenticatedRequest} from "../auth/middleware";
import {Response} from "express";
import {HTTP_STATUS} from "../constants";
import {Errors} from "../utils/errors";
import {LocalizedRequest} from "../utils/i18n";

export class UserHandlers {
    constructor(private readonly userService: UserService) {
    }

    static createUserHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth())) {
        const userService = applicationBuilder.buildUserService();
        return new UserHandlers(userService)
    }

    /**
     * Update current user's profile
     */
    updateUserProfile = async (req: AuthenticatedRequest & LocalizedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const updatedProfile = await this.userService.updateProfile(userId, req.body, req.language);
        res.status(HTTP_STATUS.OK).json(updatedProfile);
    }

    /**
     * Change user password
     * Note: This requires the user to provide their current password for security
     */
    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const result = await this.userService.changePassword(userId, req.body);
        res.status(HTTP_STATUS.OK).json(result);
    }
}
