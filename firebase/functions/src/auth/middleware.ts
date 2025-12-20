import { AuthenticatedUser, SystemUserRoles, toDisplayName, toUserId } from '@billsplit-wl/shared';
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getAppConfig } from '../app-config';
import { getComponentBuilder } from '../ComponentBuilderSingleton';
import { AUTH } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import { LoggerContext } from '../logger';
import { getServiceConfig } from '../merge/ServiceConfig';
import type { IAuthService } from '../services/auth';
import type { IFirestoreReader } from '../services/firestore';

// Lazy-initialized services to avoid module-level Firebase initialization
let _firestoreReader: IFirestoreReader | undefined;
let _authService: IAuthService | undefined;

function getFirestoreReader(): IFirestoreReader {
    if (!_firestoreReader) {
        _firestoreReader = getComponentBuilder().buildFirestoreReader();
    }
    return _firestoreReader;
}

function getAuthService(): IAuthService {
    if (!_authService) {
        _authService = getComponentBuilder().buildAuthService();
    }
    return _authService;
}

/**
 * Extended Express Request with user information.
 * Note: There is also an AuthenticatedRequest type in @billsplit-wl/shared used for test stubs.
 */
export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

/**
 * Paths that are allowed for unverified users (write operations).
 * Read operations (GET/HEAD/OPTIONS) are always allowed.
 */
const EMAIL_VERIFICATION_ALLOWLIST = [
    '/email-verification',     // Resend verification email
    '/auth/login',             // Login
    '/auth/register',          // Registration
    '/auth/password-reset',    // Password reset
    '/user/profile',           // Allow profile updates (language, display name)
    '/user/email',             // Email change (needs verification)
    '/user/email-preferences', // Email preferences
    '/user/change-password',   // Password change (user must know current password)
    '/groups/join',            // Join group via share link (share link provides authorization)
    '/groups/preview',         // Preview group before joining (part of join flow)
];

/**
 * Check if a path is allowed for unverified users
 */
function isEmailVerificationAllowlisted(path: string): boolean {
    return EMAIL_VERIFICATION_ALLOWLIST.some(allowed => path.startsWith(allowed));
}

/**
 * Check if the request is a write operation
 */
function isWriteOperation(method: string): boolean {
    return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
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

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw Errors.authRequired(ErrorDetail.TOKEN_MISSING);
    }

    const token = authHeader.substring(AUTH.BEARER_TOKEN_PREFIX_LENGTH); // Remove 'Bearer ' prefix

    try {
        // Verify ID token - no fallbacks or hacks
        const decodedToken = await getAuthService().verifyIdToken(token);

        // Fetch full user profile from Firebase Auth
        const userRecord = await getAuthService().getUser(toUserId(decodedToken.uid));

        if (!userRecord) {
            throw Errors.notFound('User', ErrorDetail.USER_NOT_FOUND);
        }

        if (!userRecord.displayName) {
            throw Errors.validationError('displayName', ErrorDetail.MISSING_FIELD);
        }

        // Fetch user role from Firestore using centralized reader
        const userId = toUserId(userRecord.uid);
        const userDocument = await getFirestoreReader().getUser(userId);

        const userRole = userDocument!.role;

        // Attach user information to request
        req.user = {
            uid: userId,
            displayName: toDisplayName(userRecord.displayName),
            role: userRole, // todo: what is this?
            emailVerified: userRecord.emailVerified,
        };

        // Add user context to logging context
        LoggerContext.setUser(userId, userRecord.displayName, userRole);

        // Enforce email verification for write operations (unless allowlisted)
        if (isWriteOperation(req.method) && !isEmailVerificationAllowlisted(req.path) && !userRecord.emailVerified) {
            throw Errors.forbidden(ErrorDetail.EMAIL_NOT_VERIFIED);
        }

        next();
    } catch (error) {
        // Re-throw ApiErrors (they're already properly formatted)
        if (error instanceof Error && error.name === 'ApiError') {
            throw error;
        }
        // Wrap other errors as auth invalid
        logger.error('Token verification failed', error, { correlationId: req.headers['x-correlation-id'] });
        throw Errors.authInvalid(ErrorDetail.TOKEN_INVALID);
    }
};

/**
 * Admin middleware - requires user to be authenticated and have admin role
 * Must be used after authenticate middleware
 */
const requireAdmin = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    // Skip for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    // Check if user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
        throw Errors.authRequired();
    }

    // Check if user has admin role
    if (req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
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
        try {
            await requireAdmin(req, res, next);
        } catch (adminError) {
            next(adminError);
        }
    });
};

const requireSystemRole = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    if (!req.user) {
        throw Errors.authRequired();
    }

    if (req.user.role !== SystemUserRoles.SYSTEM_USER && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
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
const requireTenantAdmin = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
        next();
        return;
    }

    if (!req.user) {
        throw Errors.authRequired();
    }

    // Allow both tenant-admin and system-admin roles
    if (req.user.role !== SystemUserRoles.TENANT_ADMIN && req.user.role !== SystemUserRoles.SYSTEM_ADMIN) {
        throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
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
export const authenticateCloudTask = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const config = getAppConfig();

    if (!config.cloudTasks.requireOidcAuth) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    const correlationId = req.headers['x-correlation-id'] as string;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Cloud Task request missing authorization header', { correlationId });
        throw Errors.authRequired(ErrorDetail.TOKEN_MISSING);
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
            throw Errors.authInvalid(ErrorDetail.TOKEN_INVALID);
        }

        // Verify the token is from a GCP service account
        // Cloud Tasks uses the project's default service account or a custom one
        if (!payload.email || !payload.email.endsWith('gserviceaccount.com')) {
            logger.warn('Cloud Task token not from service account', {
                correlationId,
                email: payload.email,
            });
            throw Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS);
        }

        // Token is valid and from a service account
        logger.info('Cloud Task authenticated', {
            correlationId,
            serviceAccount: payload.email,
        });

        next();
    } catch (error) {
        // Re-throw ApiErrors
        if (error instanceof Error && error.name === 'ApiError') {
            throw error;
        }
        logger.error('Cloud Task OIDC token verification failed', error, { correlationId });
        throw Errors.authInvalid(ErrorDetail.TOKEN_INVALID);
    }
};
