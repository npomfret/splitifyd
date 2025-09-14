import { Request, Response } from 'express';
import { logger } from '../logger';
import { getFirestore, getAuth } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { getConfig } from '../client-config';
import { FirestoreCollections } from '@splitifyd/shared';

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const policyService = applicationBuilder.buildPolicyService();

/**
 * API endpoint to update policies
 * POST /test/policies/:id/update
 */
export const testUpdatePolicy = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { text, publish = true } = req.body;

    if (!id || !text) {
        res.status(400).json({
            error: {
                code: 'MISSING_FIELDS',
                message: 'Both id and text are required',
            },
        });
        return;
    }

    try {
        const result = await policyService.updatePolicy(id, text, publish);

        logger.info('Policy updated', {
            policyId: id,
            versionHash: result.versionHash,
            published: publish,
        });

        res.json({
            success: true,
            versionHash: result.versionHash,
            published: publish,
            currentVersionHash: result.currentVersionHash,
            message: publish ? 'Policy updated and published' : 'Draft version saved',
        });
    } catch (error) {
        logger.error('Failed to update policy', error as Error, {
            policyId: id,
        });
        throw error;
    }
};


/**
 * Test endpoint to clear a user's policy acceptances in dev environment
 * POST /test/user/clear-policy-acceptances
 */
export const testClearPolicyAcceptances = async (req: Request, res: Response): Promise<void> => {
    const config = getConfig();

    // Only allow in non-production environments
    if (config.isProduction) {
        res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Test endpoints not available in production',
            },
        });
        return;
    }

    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authorization token required',
            },
        });
        return;
    }

    const token = authHeader.substring(7);
    let decodedToken;

    try {
        const auth = getAuth();
        decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
        res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            },
        });
        return;
    }

    try {
        // Clear the user's acceptedPolicies field
        await firestore.collection(FirestoreCollections.USERS).doc(decodedToken.uid).update({
            acceptedPolicies: {},
        });

        logger.info('Test policy acceptances cleared', {
            userId: decodedToken.uid,
        });

        res.json({
            success: true,
            message: 'Policy acceptances cleared',
        });
    } catch (error) {
        logger.error('Failed to clear policy acceptances via test endpoint', error as Error, {
            userId: decodedToken.uid,
        });
        throw error;
    }
};