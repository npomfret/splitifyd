import { Request, Response } from 'express';
import { logger } from '../logger';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const policyService = applicationBuilder.buildPolicyService();

/**
 * GET /policies/:id/current - Get current version of a specific policy (public endpoint)
 */
export const getCurrentPolicy = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const result = await policyService.getCurrentPolicy(id);
        res.json(result);
    } catch (error) {
        logger.error('Failed to get current policy', error as Error, { policyId: id });
        throw error;
    }
};
