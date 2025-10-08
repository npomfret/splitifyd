import { SystemUserRoles, TestErrorResponse, TestPromoteToAdminResponse, TestSuccessResponse } from '@splitifyd/shared';
import { Request, Response } from 'express';
import { getConfig } from '../client-config';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const authService = applicationBuilder.buildAuthService();
const firestoreWriter = applicationBuilder.buildFirestoreWriter();

/**
 * Test endpoint to clear a user's policy acceptances in dev environment
 * POST /test/user/clear-policy-acceptances
 */
export const testClearPolicyAcceptances = async (req: Request, res: Response): Promise<void> => {
    const config = getConfig();

    // Only allow in non-production environments
    if (config.isProduction) {
        const response: TestErrorResponse = {
            error: {
                code: 'FORBIDDEN',
                message: 'Test endpoints not available in production',
            },
        };
        res.status(403).json(response);
        return;
    }

    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: TestErrorResponse = {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authorization token required',
            },
        };
        res.status(401).json(response);
        return;
    }

    const token = authHeader.substring(7);
    let decodedToken;

    try {
        decodedToken = await authService.verifyIdToken(token);
    } catch (error) {
        const response: TestErrorResponse = {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            },
        };
        res.status(401).json(response);
        return;
    }

    try {
        // Clear the user's acceptedPolicies field using FirestoreWriter
        await firestoreWriter.updateUser(decodedToken.uid, {
            acceptedPolicies: {},
        });

        logger.info('Test policy acceptances cleared', {
            userId: decodedToken.uid,
        });

        const response: TestSuccessResponse = {
            success: true,
            message: 'Policy acceptances cleared',
        };
        res.json(response);
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
        const response: TestErrorResponse = {
            error: {
                code: 'FORBIDDEN',
                message: 'Test endpoints not available in production',
            },
        };
        res.status(403).json(response);
        return;
    }

    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: TestErrorResponse = {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authorization token required',
            },
        };
        res.status(401).json(response);
        return;
    }

    const token = authHeader.substring(7);
    let decodedToken;

    try {
        decodedToken = await authService.verifyIdToken(token);
    } catch (error) {
        const response: TestErrorResponse = {
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            },
        };
        res.status(401).json(response);
        return;
    }

    try {
        // Promote the user to admin role using FirestoreWriter
        await firestoreWriter.updateUser(decodedToken.uid, {
            role: SystemUserRoles.SYSTEM_ADMIN,
        });

        logger.info('Test user promoted to admin', {
            userId: decodedToken.uid,
        });

        const response: TestPromoteToAdminResponse = {
            success: true,
            message: 'User promoted to admin role',
            userId: decodedToken.uid,
        };
        res.json(response);
    } catch (error) {
        logger.error('Failed to promote user to admin via test endpoint', error as Error, {
            userId: decodedToken.uid,
        });
        throw error;
    }
};
