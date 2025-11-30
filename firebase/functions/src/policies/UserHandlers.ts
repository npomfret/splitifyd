import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { UserPolicyService } from '../services/UserPolicyService';
import { validateAcceptMultiplePolicies } from './validation';

export class UserHandlers {
    constructor(private readonly userPolicyService: UserPolicyService) {
    }

    acceptMultiplePolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        // Validate request body using shared Zod schema
        const { acceptances } = validateAcceptMultiplePolicies(req.body);

        const result = await this.userPolicyService.acceptMultiplePolicies(userId, acceptances);

        res.status(HTTP_STATUS.OK).json({
            acceptedPolicies: result,
        });
    };

    getUserPolicyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.authRequired();
        }

        const response = await this.userPolicyService.getUserPolicyStatus(userId);

        res.status(HTTP_STATUS.OK).json(response);
    };
}
