import { Request, Response, NextFunction } from 'express';
import { Errors, sendError } from '../utils/errors';
import {getAuth, getFirestore} from '../firebase';
import { logger } from '../logger';
import { AUTH } from '../constants';
import { SystemUserRoles } from '@splitifyd/shared';
import { LoggerContext } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const firestoreReader = applicationBuilder.buildFirestoreReader();
const authService = applicationBuilder.buildAuthService();

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string;
        displayName: string;
        role?: typeof SystemUserRoles.SYSTEM_ADMIN | typeof SystemUserRoles.SYSTEM_USER;
    };
}

/**
 * Verify Firebase Auth token and attach user to request
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    const correlationId = req.headers['x-correlation-id'] as string;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendError(res, Errors.UNAUTHORIZED(), correlationId);
        return;
    }

    const token = authHeader.substring(AUTH.BEARER_TOKEN_PREFIX_LENGTH); // Remove 'Bearer ' prefix

    try {
        // Verify ID token - no fallbacks or hacks
        const decodedToken = await authService.verifyIdToken(token);

        // Fetch full user profile from Firebase Auth
        const userRecord = await authService.getUser(decodedToken.uid);

        if (!userRecord) {
            throw new Error('User not found in Firebase Auth');
        }

        if (!userRecord.email || !userRecord.displayName) {
            throw new Error('User missing required fields: email and displayName are mandatory');
        }

        // Fetch user role from Firestore using centralized reader
        const userDocument = await firestoreReader.getUser(userRecord.uid);

        const userRole = userDocument!.role;

        // Attach user information to request
        req.user = {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            role: userRole,
        };

        // Add user context to logging context
        LoggerContext.setUser(userRecord.uid, userRecord.email, userRole);

        next();
    } catch (error) {
        logger.error('Token verification failed', error, { correlationId });
        sendError(res, Errors.INVALID_TOKEN(), correlationId);
    }
};

/**
 * Admin middleware - requires user to be authenticated and have admin role
 * Must be used after authenticate middleware
 */
export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    const correlationId = req.headers['x-correlation-id'] as string;

    // Check if user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
        // Admin access attempted without authentication
        sendError(res, Errors.UNAUTHORIZED(), correlationId);
        return;
    }

    // Check if user has admin role
    if (req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        // Admin access denied - insufficient permissions
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }

    logger.info('Admin access granted', {
        userId: req.user.uid,
        email: req.user.email,
        correlationId,
    });

    next();
};

/**
 * Combined middleware for admin endpoints - authenticates and checks admin role
 */
export const authenticateAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    await authenticate(req, res, async (error?: any) => {
        if (error) {
            next(error);
            return;
        }
        await requireAdmin(req, res, next);
    });
};
