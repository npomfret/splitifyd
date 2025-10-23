import { Response } from 'express';
import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { AuthenticatedRequest } from '../auth/middleware';
import { getIdentityToolkitConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { UserPolicyService } from '../services/UserPolicyService';
import { ApiError } from '../utils/errors';
import { validateAcceptMultiplePolicies } from './validation';

export class UserHandlers {
    constructor(private readonly userPolicyService: UserPolicyService) {
    }

    static createUserHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const userPolicyService = applicationBuilder.buildUserPolicyService();
        return new UserHandlers(userPolicyService);
    }

    acceptMultiplePolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
        }

        // Validate request body using Joi
        const { acceptances } = validateAcceptMultiplePolicies(req.body);

        const result = await this.userPolicyService.acceptMultiplePolicies(userId, acceptances);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'All policies accepted successfully',
            acceptedPolicies: result,
        });
    };

    getUserPolicyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
        }

        const response = await this.userPolicyService.getUserPolicyStatus(userId);

        res.status(HTTP_STATUS.OK).json(response);
    };
}

const userHandlers = UserHandlers.createUserHandlers(getAppBuilder());
