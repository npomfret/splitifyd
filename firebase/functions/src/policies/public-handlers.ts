import { Request, Response } from 'express';
import { logger } from '../logger';
import { getPolicyService } from '../services/serviceRegistration';

/**
 * GET /policies/current - List all current policy versions (public endpoint)
 */
export const getCurrentPolicies = async (req: Request, res: Response): Promise<void> => {
    try {
        const policyService = getPolicyService();
        const result = await policyService.getCurrentPolicies();
        res.json(result);
    } catch (error) {
        logger.error('Failed to get current policies', error as Error);
        throw error;
    }
};

/**
 * GET /policies/:id/current - Get current version of a specific policy (public endpoint)
 */
export const getCurrentPolicy = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const policyService = getPolicyService();
        const result = await policyService.getCurrentPolicy(id);
        res.json(result);
    } catch (error) {
        logger.error('Failed to get current policy', error as Error, { policyId: id });
        throw error;
    }
};
