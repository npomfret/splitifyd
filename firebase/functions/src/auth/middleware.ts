import { AuthenticatedUser, SystemUserRoles, toDisplayName } from '@splitifyd/shared';
import { NextFunction, Request, Response } from 'express';
import { getIdentityToolkitConfig } from '../client-config';
import { AUTH } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { LoggerContext } from '../logger';
import { ComponentBuilder } from '../services/ComponentBuilder';
import { Errors, sendError } from '../utils/errors';

const firestore = getFirestore();
const applicationBuilder = ComponentBuilder.createComponentBuilder(firestore, getAuth(), getIdentityToolkitConfig());
const firestoreReader = applicationBuilder.buildFirestoreReader();
const authService = applicationBuilder.buildAuthService();

/**
 * Extended Express Request with user information.
 * Note: There is also an AuthenticatedRequest type in @splitifyd/shared used for test stubs.
 */
export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
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

        if (!userRecord.displayName) {
            throw new Error('User missing required field: displayName is mandatory');
        }

        // Fetch user role from Firestore using centralized reader
        const userDocument = await firestoreReader.getUser(userRecord.uid);

        const userRole = userDocument!.role;

        // Attach user information to request
        req.user = {
            uid: userRecord.uid,
            displayName: toDisplayName(userRecord.displayName),
            role: userRole, // todo: what is this?
        };

        // Add user context to logging context
        LoggerContext.setUser(userRecord.uid, userRecord.displayName, userRole);

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
const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

const requireSystemRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    const correlationId = req.headers['x-correlation-id'] as string;

    if (!req.user) {
        sendError(res, Errors.UNAUTHORIZED(), correlationId);
        return;
    }

    if (req.user.role !== SystemUserRoles.SYSTEM_USER && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }

    next();
};

export const authenticateSystemUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    await authenticate(req, res, async (error?: any) => {
        if (error) {
            next(error);
            return;
        }
        await requireSystemRole(req, res, next);
    });
};

/**
 * Tenant admin middleware - requires user to be authenticated and have tenant-admin or system-admin role
 * Must be used after authenticate middleware
 */
const requireTenantAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    const correlationId = req.headers['x-correlation-id'] as string;

    if (!req.user) {
        sendError(res, Errors.UNAUTHORIZED(), correlationId);
        return;
    }

    // Allow both tenant-admin and system-admin roles
    if (req.user.role !== SystemUserRoles.TENANT_ADMIN && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        sendError(res, Errors.FORBIDDEN(), correlationId);
        return;
    }

    next();
};

/**
 * Combined middleware for tenant admin endpoints - authenticates and checks tenant-admin role
 */
export const authenticateTenantAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    await authenticate(req, res, async (error?: any) => {
        if (error) {
            next(error);
            return;
        }
        await requireTenantAdmin(req, res, next);
    });
};
