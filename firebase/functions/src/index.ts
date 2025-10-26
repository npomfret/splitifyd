// Endpoint inventory: see docs/firebase-api-surface.md for route descriptions.
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { getActivityFeed } from './activity/handlers';
import { register } from './auth/handlers';
import { authenticate, authenticateAdmin } from './auth/middleware';
import { getConfig } from './client-config';
import { createComment, listExpenseComments, listGroupComments } from './comments/handlers';
import { FirestoreCollections, HTTP_STATUS } from './constants';
import { buildEnvPayload, buildHealthPayload, buildStatusPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { createExpense, deleteExpense, getExpenseFullDetails, updateExpense } from './expenses/handlers';
import { createGroup, deleteGroup, getGroupFullDetails, listGroups, updateGroup, updateGroupMemberDisplayName } from './groups/handlers';
import { archiveGroupForUser, leaveGroup, removeGroupMember, unarchiveGroupForUser } from './groups/memberHandlers';
import { approveMember, getPendingMembers, rejectMember, updateGroupPermissions, updateMemberRole } from './groups/security';
import { generateShareableLink, joinGroupByLink, previewGroupByLink } from './groups/shareHandlers';
import { logger } from './logger';
import { disableETags } from './middleware/cache-control';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import { createPolicy, deletePolicyVersion, getPolicy, getPolicyVersion, listPolicies, publishPolicy, updatePolicy } from './policies/handlers';
import { getCurrentPolicy } from './policies/public-handlers';
import { acceptMultiplePolicies, getUserPolicyStatus } from './policies/user-handlers';
import { logMetrics } from './scheduled/metrics-logger';
import { createSettlement, deleteSettlement, updateSettlement } from './settlements/handlers';
import { borrowTestUser, returnTestUser } from './test-pool/handlers';
import { testClearPolicyAcceptances, testPromoteToAdmin } from './test/policy-handlers';
import { changePassword, getUserProfile, updateUserProfile } from './user/handlers';
import { getEnhancedConfigResponse } from './utils/config-response';
import { ApiError } from './utils/errors';
import { applyStandardMiddleware } from './utils/middleware';

let app: express.Application | null = null;

function getApp(): express.Application {
    if (!app) {
        app = express();

        disableETags(app);

        app.use((req, res, next) => {
            if (req.url.startsWith('/api/')) {
                req.url = req.url.substring(4);
            }
            next();
        });

        applyStandardMiddleware(app);

        setupRoutes(app);
    }
    return app;
}

function setupRoutes(app: express.Application): void {
    app.get('/metrics', (req: express.Request, res: express.Response) => {
        const snapshot = metrics.getSnapshot();
        res.json(toAggregatedReport(snapshot));
    });

    const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

    // Health check endpoint
    app.get(
        '/health',
        asyncHandler(async (req: express.Request, res: express.Response) => {
            const checks = await runHealthChecks();
            const payload = buildHealthPayload(checks);
            const statusCode = resolveHealthStatusCode(checks);
            res.status(statusCode).json(payload);
        }),
    );

    app.head(
        '/health',
        asyncHandler(async (req: express.Request, res: express.Response) => {
            const checks = await runHealthChecks();
            const statusCode = resolveHealthStatusCode(checks);
            res.status(statusCode).end();
        }),
    );

    // Status endpoint
    app.get('/status', (req: express.Request, res: express.Response) => {
        res.json(buildStatusPayload());
    });

    // Environment endpoint (non-production only)
    app.get('/env', (req: express.Request, res: express.Response) => {
        if (getConfig().isProduction) {
            res.status(HTTP_STATUS.NOT_FOUND).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Endpoint not found',
                },
            });
            return;
        }
        res.json(buildEnvPayload());
    });

    app.get(
        '/config',
        asyncHandler((req: express.Request, res: express.Response) => {
            const config = getEnhancedConfigResponse();

            res.json(config);
        }),
    );

    app.post('/csp-violation-report', (req: express.Request, res: express.Response) => {
        try {
            res.status(204).send();
        } catch (error) {
            logger.error('Error processing CSP violation report', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/policies/:id/current', asyncHandler(getCurrentPolicy));

    if (getConfig().isProduction) {
        app.all(/^\/test-pool.*/, (req, res) => {
            logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
            res.status(404).json({ error: 'Not found' });
        });
        app.all(/^\/test\/user.*/, (req, res) => {
            logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
            res.status(404).json({ error: 'Not found' });
        });
    } else {
        app.post('/test-pool/borrow', asyncHandler(borrowTestUser));
        app.post('/test-pool/return', asyncHandler(returnTestUser));

        app.post('/test/user/clear-policy-acceptances', asyncHandler(testClearPolicyAcceptances));
        app.post('/test/user/promote-to-admin', asyncHandler(testPromoteToAdmin));
    }

    app.post('/user/policies/accept-multiple', authenticate, asyncHandler(acceptMultiplePolicies));
    app.get('/user/policies/status', authenticate, asyncHandler(getUserPolicyStatus));

    app.get('/user/profile', authenticate, asyncHandler(getUserProfile));
    app.put('/user/profile', authenticate, asyncHandler(updateUserProfile));
    app.post('/user/change-password', authenticate, asyncHandler(changePassword));

    app.post('/register', asyncHandler(register));

    app.post(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(createExpense));
    app.put(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(updateExpense));
    app.delete(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(deleteExpense));
    app.get(`/${FirestoreCollections.EXPENSES}/:id/full-details`, authenticate, asyncHandler(getExpenseFullDetails));

    app.post(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(createGroup));
    app.get(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(listGroups));

    app.post(`/${FirestoreCollections.GROUPS}/share`, authenticate, asyncHandler(generateShareableLink));
    app.post(`/${FirestoreCollections.GROUPS}/preview`, authenticate, asyncHandler(previewGroupByLink));
    app.post(`/${FirestoreCollections.GROUPS}/join`, authenticate, asyncHandler(joinGroupByLink));

    app.get(`/${FirestoreCollections.GROUPS}/:id/full-details`, authenticate, asyncHandler(getGroupFullDetails));
    app.get('/activity-feed', authenticate, asyncHandler(getActivityFeed));
    app.put(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(updateGroup));
    app.delete(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(deleteGroup));
    app.patch(`/${FirestoreCollections.GROUPS}/:id/security/permissions`, authenticate, asyncHandler(updateGroupPermissions));
    app.post(`/${FirestoreCollections.GROUPS}/:id/leave`, authenticate, asyncHandler(leaveGroup));
    app.post(`/${FirestoreCollections.GROUPS}/:id/archive`, authenticate, asyncHandler(archiveGroupForUser));
    app.post(`/${FirestoreCollections.GROUPS}/:id/unarchive`, authenticate, asyncHandler(unarchiveGroupForUser));
    app.put(`/${FirestoreCollections.GROUPS}/:id/members/display-name`, authenticate, asyncHandler(updateGroupMemberDisplayName));
    app.get(`/${FirestoreCollections.GROUPS}/:id/members/pending`, authenticate, asyncHandler(getPendingMembers));
    app.patch(`/${FirestoreCollections.GROUPS}/:id/members/:memberId/role`, authenticate, asyncHandler(updateMemberRole));
    app.post(`/${FirestoreCollections.GROUPS}/:id/members/:memberId/approve`, authenticate, asyncHandler(approveMember));
    app.post(`/${FirestoreCollections.GROUPS}/:id/members/:memberId/reject`, authenticate, asyncHandler(rejectMember));
    app.delete(`/${FirestoreCollections.GROUPS}/:id/members/:memberId`, authenticate, asyncHandler(removeGroupMember));

    app.post(`/${FirestoreCollections.SETTLEMENTS}`, authenticate, asyncHandler(createSettlement));
    app.put(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(updateSettlement));
    app.delete(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(deleteSettlement));

    app.get(`/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(listGroupComments));
    app.post(`/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(createComment));
    app.get(`/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(listExpenseComments));
    app.post(`/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(createComment));

    app.post(`/admin/${FirestoreCollections.POLICIES}`, authenticateAdmin, asyncHandler(createPolicy));
    app.get(`/admin/${FirestoreCollections.POLICIES}`, authenticateAdmin, asyncHandler(listPolicies));
    app.get(`/admin/${FirestoreCollections.POLICIES}/:id`, authenticateAdmin, asyncHandler(getPolicy));
    app.get(`/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`, authenticateAdmin, asyncHandler(getPolicyVersion));
    app.put(`/admin/${FirestoreCollections.POLICIES}/:id`, authenticateAdmin, asyncHandler(updatePolicy));
    app.post(`/admin/${FirestoreCollections.POLICIES}/:id/publish`, authenticateAdmin, asyncHandler(publishPolicy));
    app.delete(`/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`, authenticateAdmin, asyncHandler(deletePolicyVersion));
    app.use((req: express.Request, res: express.Response) => {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Endpoint not found',
            },
        });
    });

    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        const correlationId = req.headers['x-correlation-id'] as string;

        if (res.headersSent) {
            logger.error('Error occurred after headers were sent - client may have received partial/corrupted data', err, {
                correlationId,
                method: req.method,
                path: req.path,
                errorType: err.constructor.name,
            });
            return;
        }

        if (err instanceof ApiError) {
            logger.error('API error occurred', err, {
                correlationId,
                method: req.method,
                path: req.path,
                statusCode: err.statusCode,
                errorCode: err.code,
            });

            res.status(err.statusCode).json({
                error: {
                    code: err.code,
                    message: err.message,
                    details: err.details,
                    correlationId,
                },
            });
            return;
        }

        logger.error('Unhandled error occurred', err, {
            correlationId,
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.connection.remoteAddress,
        });

        res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                correlationId,
            },
        });
    });
}

export const api = onRequest(
    {
        invoker: 'public',
        maxInstances: 1,
        timeoutSeconds: 20,
        region: 'us-central1',
        memory: '512MiB',
    },
    (req, res) => {
        const app = getApp();
        app(req, res);
    },
);

export { logMetrics };
export { env } from './endpoints/env';
export { health } from './endpoints/health';
export { status } from './endpoints/status';

// Exposed for integration testing to allow direct access to the Express app
export function getApiAppForTesting(): express.Application {
    return getApp();
}
