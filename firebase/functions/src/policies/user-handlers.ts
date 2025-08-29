import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { UserPolicyService } from '../services/UserPolicyService';
import { validateAcceptPolicy, validateAcceptMultiplePolicies } from './validation';

/**
 * Accept a single policy version for the authenticated user
 */
export const acceptPolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Validate request body using Joi
    const { policyId, versionHash } = validateAcceptPolicy(req.body);

    const userPolicyService = new UserPolicyService();
    const result = await userPolicyService.acceptPolicy(userId, policyId, versionHash);

    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Policy accepted successfully',
        acceptedPolicy: result,
    });
};

/**
 * Accept multiple policy versions for the authenticated user
 */
export const acceptMultiplePolicies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
    }

    // Validate request body using Joi
    const { acceptances } = validateAcceptMultiplePolicies(req.body);

    const userPolicyService = new UserPolicyService();
    const result = await userPolicyService.acceptMultiplePolicies(userId, acceptances);

    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'All policies accepted successfully',
        acceptedPolicies: result,
    });
};

/**
 * Get the user's policy acceptance status
 */
export const getUserPolicyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'AUTH_REQUIRED', 'Authentication required');
    }

    const userPolicyService = new UserPolicyService();
    const response = await userPolicyService.getUserPolicyStatus(userId);

    res.status(HTTP_STATUS.OK).json(response);
};