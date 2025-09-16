import { Request, Response } from 'express';
import { logger } from '../logger';
import { getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { getConfig } from '../client-config';
import { FirestoreCollections, SystemUserRoles } from '@splitifyd/shared';

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const policyService = applicationBuilder.buildPolicyService();
const authService = applicationBuilder.buildAuthService();

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
        decodedToken = await authService.verifyIdToken(token);
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

/**
 * Test endpoint to promote a user to admin role in dev environment
 * POST /test/user/promote-to-admin
 */
export const testPromoteToAdmin = async (req: Request, res: Response): Promise<void> => {
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
        decodedToken = await authService.verifyIdToken(token);
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
        // Promote the user to admin role
        await firestore.collection(FirestoreCollections.USERS).doc(decodedToken.uid).update({
            role: SystemUserRoles.SYSTEM_ADMIN,
        });

        logger.info('Test user promoted to admin', {
            userId: decodedToken.uid,
        });

        res.json({
            success: true,
            message: 'User promoted to admin role',
            userId: decodedToken.uid,
        });
    } catch (error) {
        logger.error('Failed to promote user to admin via test endpoint', error as Error, {
            userId: decodedToken.uid,
        });
        throw error;
    }
};
