import { AuthenticatedUser, SystemUserRoles, toDisplayName, toUserId } from '@billsplit-wl/shared';
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getConfig } from '../client-config';
import { getComponentBuilder } from '../ComponentBuilderSingleton';
import { AUTH } from '../constants';
import { logger } from '../logger';
import { LoggerContext } from '../logger';
import { getServiceConfig } from '../merge/ServiceConfig';
import { Errors, sendError } from '../utils/errors';

const applicationBuilder = getComponentBuilder();
const firestoreReader = applicationBuilder.buildFirestoreReader();
const authService = applicationBuilder.buildAuthService();

/**
 * Extended Express Request with user information.
 * Note: There is also an AuthenticatedRequest type in @billsplit-wl/shared used for test stubs.
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
        const userRecord = await authService.getUser(toUserId(decodedToken.uid));

        if (!userRecord) {
            throw new Error('User not found in Firebase Auth');
        }

        if (!userRecord.displayName) {
            throw new Error('User missing required field: displayName is mandatory');
        }

        // Fetch user role from Firestore using centralized reader
        const userId = toUserId(userRecord.uid);
        const userDocument = await firestoreReader.getUser(userId);

        const userRole = userDocument!.role;

        // Attach user information to request
        req.user = {
            uid: userId,
            displayName: toDisplayName(userRecord.displayName),
            role: userRole, // todo: what is this?
        };

        // Add user context to logging context
        LoggerContext.setUser(userId, userRecord.displayName, userRole);

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

/**
 * Middleware for Cloud Tasks endpoints - verifies OIDC token from GCP service account
 *
 * Cloud Tasks sends an OIDC token in the Authorization header when configured with
 * oidcToken in the task request. This middleware verifies that token to ensure
 * only Cloud Tasks can invoke the endpoint.
 *
 * In emulator mode, this check is skipped since the StubCloudTasksClient doesn't
 * send real OIDC tokens.
 */
export const authenticateCloudTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.headers['x-correlation-id'] as string;
    const config = getConfig();

    // Skip authentication in emulator mode - Cloud Tasks stub doesn't send OIDC tokens
    if (config.isEmulator) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Cloud Task request missing authorization header', { correlationId });
        sendError(res, Errors.UNAUTHORIZED(), correlationId);
        return;
    }

    const token = authHeader.substring(AUTH.BEARER_TOKEN_PREFIX_LENGTH);

    try {
        const serviceConfig = getServiceConfig();
        const client = new OAuth2Client();

        // Verify the OIDC token - Cloud Tasks sends tokens signed by Google
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: serviceConfig.functionsUrl,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error('OIDC token payload is empty');
        }

        // Verify the token is from a GCP service account
        // Cloud Tasks uses the project's default service account or a custom one
        if (!payload.email || !payload.email.endsWith('gserviceaccount.com')) {
            logger.warn('Cloud Task token not from service account', {
                correlationId,
                email: payload.email,
            });
            sendError(res, Errors.FORBIDDEN(), correlationId);
            return;
        }

        // Token is valid and from a service account
        logger.info('Cloud Task authenticated', {
            correlationId,
            serviceAccount: payload.email,
        });

        next();
    } catch (error) {
        logger.error('Cloud Task OIDC token verification failed', error, { correlationId });
        sendError(res, Errors.INVALID_TOKEN(), correlationId);
    }
};
