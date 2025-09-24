import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { authenticate } from './auth/middleware';
import { authenticateAdmin } from './auth/middleware';
import { register } from './auth/handlers';
import { applyStandardMiddleware } from './utils/middleware';
import { logger } from './logger';
import { getEnhancedConfigResponse } from './utils/config-response';
import { sendHealthCheckResponse, ApiError } from './utils/errors';
import { APP_VERSION } from './utils/version';
import { HTTP_STATUS, SYSTEM } from './constants';
import { disableETags } from './middleware/cache-control';
import { createOptimisticTimestamp, timestampToISO } from './utils/dateHelpers';
import { createExpense, updateExpense, deleteExpense, getExpenseHistory, getExpenseFullDetails } from './expenses/handlers';
import { generateShareableLink, previewGroupByLink, joinGroupByLink } from './groups/shareHandlers';
import { leaveGroup, removeGroupMember } from './groups/memberHandlers';
import { getCurrentPolicy } from './policies/public-handlers';
import { createGroup, updateGroup, deleteGroup, listGroups, getGroupFullDetails } from './groups/handlers';
import { updateGroupPermissions } from './groups/permissionHandlers';
import { createSettlement, updateSettlement, deleteSettlement, listSettlements } from './settlements/handlers';
import { createComment } from './comments/handlers';
import { getFirestore, getAuth } from './firebase';
import { listPolicies, getPolicy, getPolicyVersion, updatePolicy, publishPolicy, createPolicy, deletePolicyVersion } from './policies/handlers';
import { acceptMultiplePolicies, getUserPolicyStatus } from './policies/user-handlers';
import { updateUserProfile, changePassword } from './user/handlers';
import { BUILD_INFO } from './utils/build-info';
import * as fs from 'fs';
import * as path from 'path';
import { FirestoreCollections } from '@splitifyd/shared';
import { borrowTestUser, returnTestUser } from './test-pool/handlers';
import {testClearPolicyAcceptances, testPromoteToAdmin} from './test/policy-handlers';
import { metrics } from './monitoring/lightweight-metrics';

// Initialize ApplicationBuilder
import { ApplicationBuilder } from './services/ApplicationBuilder';

// Lazy initialization
let appBuilder: ApplicationBuilder | null = null;

// Export function to get the initialized ApplicationBuilder
export function getAppBuilder(): ApplicationBuilder {
    if (!appBuilder) {
        appBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth());
    }
    return appBuilder;
}

// Firebase instances are now accessed through ApplicationBuilder for better encapsulation

// Import triggers and scheduled functions
import { trackGroupChanges, trackExpenseChanges, trackSettlementChanges } from './triggers/change-tracker';
import { logMetrics } from './scheduled/metrics-logger';

// Removed emulator connection test at module level to prevent connection creation
// The emulator connection will be tested lazily when first needed

// Lazy-initialize Express app
let app: express.Application | null = null;

function getApp(): express.Application {
    if (!app) {
        app = express();

        // No need to initialize services - ApplicationBuilder handles it lazily

        // Disable ETags to prevent 304 responses
        disableETags(app);

        // Strip /api prefix for hosting rewrites
        app.use((req, res, next) => {
            if (req.url.startsWith('/api/')) {
                req.url = req.url.substring(4);
            }
            next();
        });

        // Apply standard middleware stack (includes CORS and cache control)
        applyStandardMiddleware(app);

        setupRoutes(app);
    }
    return app;
}

function setupRoutes(app: express.Application): void {
    // Enhanced health check endpoint (no auth required)
    app.get('/health', async (req: express.Request, res: express.Response) => {
        const checks: Record<string, { status: 'healthy' | 'unhealthy'; responseTime?: number; error?: string }> = {};

        // Use encapsulated health check operation
        const appBuilder = getAppBuilder();
        const firestoreWriter = appBuilder.buildFirestoreWriter();

        const firestoreHealthCheck = await firestoreWriter.performHealthCheck();
        checks.firestore = {
            status: firestoreHealthCheck.success ? 'healthy' : 'unhealthy',
            responseTime: firestoreHealthCheck.responseTime,
        };

        // Lightweight auth health check - just verify auth service is accessible
        const authStart = Date.now();
        try {
            const auth = getAuth();
            // Just verify auth instance exists and is accessible (no operations needed)
            if (auth) {
                checks.auth = {
                    status: 'healthy',
                    responseTime: Date.now() - authStart,
                };
            } else {
                checks.auth = {
                    status: 'unhealthy',
                    responseTime: Date.now() - authStart,
                    error: 'Auth service not available'
                };
            }
        } catch (error) {
            checks.auth = {
                status: 'unhealthy',
                responseTime: Date.now() - authStart,
                error: error instanceof Error ? error.message : 'Unknown auth error'
            };
        }

        sendHealthCheckResponse(res, checks);
    });

    // Detailed status endpoint for monitoring systems
    app.get('/status', async (req: express.Request, res: express.Response) => {
        const memUsage = process.memoryUsage();

        res.json({
            timestamp: timestampToISO(createOptimisticTimestamp()),
            uptime: process.uptime(),
            memory: {
                rss: `${Math.round(memUsage.rss / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
                heapUsed: `${Math.round(memUsage.heapUsed / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
                heapTotal: `${Math.round(memUsage.heapTotal / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
                external: `${Math.round(memUsage.external / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
            },
            version: APP_VERSION,
            nodeVersion: process.version,
            environment: process.env.NODE_ENV!,
        });
    });

    // Performance metrics endpoint (for monitoring current stats)
    app.get('/metrics', (req: express.Request, res: express.Response) => {
        const snapshot = metrics.getSnapshot();

        // Calculate aggregated stats for each metric type
        const calculateStats = (metricsList: any[]) => {
            if (!metricsList.length) return null;

            const durations = metricsList.map((m) => m.duration).sort((a, b) => a - b);
            const successCount = metricsList.filter((m) => m.success).length;

            return {
                count: metricsList.length,
                successRate: successCount / metricsList.length,
                avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
                p50: durations[Math.floor(durations.length * 0.5)] || 0,
                p95: durations[Math.floor(durations.length * 0.95)] || 0,
                p99: durations[Math.floor(durations.length * 0.99)] || 0,
                minDuration: durations[0] || 0,
                maxDuration: durations[durations.length - 1] || 0,
            };
        };

        const report = {
            timestamp: new Date().toISOString(),
            samplingRate: '5%',
            bufferSize: 100,
            metrics: {
                api: calculateStats(snapshot.api),
                db: calculateStats(snapshot.db),
                trigger: calculateStats(snapshot.trigger),
            },
            rawCounts: {
                api: snapshot.api.length,
                db: snapshot.db.length,
                trigger: snapshot.trigger.length,
                total: snapshot.api.length + snapshot.db.length + snapshot.trigger.length,
            },
        };

        res.json(report);
    });

    // Environment variables endpoint (for debugging)
    app.get('/env', (req: express.Request, res: express.Response) => {
        const uptimeSeconds = process.uptime();
        const memUsage = process.memoryUsage();

        // Format uptime as human readable
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        let uptimeText = '';
        if (days > 0) uptimeText += `${days}d `;
        if (hours > 0) uptimeText += `${hours}h `;
        if (minutes > 0) uptimeText += `${minutes}m `;
        uptimeText += `${seconds}s`;

        // Format bytes to human readable
        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
        };

        // List files in current directory
        const currentDir = process.cwd();
        let files: any[];

        try {
            const entries = fs.readdirSync(currentDir);
            files = entries
                .map((name) => {
                    try {
                        const fullPath = path.join(currentDir, name);
                        const stats = fs.statSync(fullPath);
                        return {
                            name,
                            type: stats.isDirectory() ? 'dir' : 'file',
                            size: stats.isDirectory() ? null : formatBytes(stats.size),
                            modified: stats.mtime.toISOString(),
                            mode: stats.mode.toString(8),
                            isSymbolicLink: stats.isSymbolicLink(),
                        };
                    } catch (err) {
                        return {
                            name,
                            error: err instanceof Error ? err.message : 'Unable to stat',
                        };
                    }
                })
                .sort((a, b) => {
                    // Sort directories first, then by name
                    if (a.type === 'dir' && b.type !== 'dir') return -1;
                    if (a.type !== 'dir' && b.type === 'dir') return 1;
                    return a.name.localeCompare(b.name);
                });
        } catch (err) {
            files = [
                {
                    error: err instanceof Error ? err.message : 'Unable to read directory',
                },
            ];
        }

        res.json({
            env: process.env,
            build: {
                timestamp: BUILD_INFO.timestamp,
                date: BUILD_INFO.date,
                version: APP_VERSION,
            },
            runtime: {
                startTime: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
                uptime: uptimeSeconds,
                uptimeHuman: uptimeText.trim(),
            },
            memory: {
                rss: formatBytes(memUsage.rss),
                heapTotal: formatBytes(memUsage.heapTotal),
                heapUsed: formatBytes(memUsage.heapUsed),
                external: formatBytes(memUsage.external),
                arrayBuffers: formatBytes(memUsage.arrayBuffers),
                heapAvailable: formatBytes(memUsage.heapTotal - memUsage.heapUsed),
            },
            filesystem: {
                currentDirectory: currentDir,
                files,
            },
        });
    });

    // Async error wrapper to ensure proper error handling
    const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

    // Firebase configuration endpoint (public - for client initialization)
    app.get(
        '/config',
        asyncHandler((req: express.Request, res: express.Response) => {
            // Always use enhanced config now
            const config = getEnhancedConfigResponse();

            res.json(config);
        }),
    );

    // CSP violation reporting endpoint
    app.post('/csp-violation-report', (req: express.Request, res: express.Response) => {
        try {
            // CSP violations are logged but not acted upon
            res.status(204).send();
        } catch (error) {
            logger.error('Error processing CSP violation report', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/policies/:id/current', asyncHandler(getCurrentPolicy));

    // Test pool endpoints (emulator only, no auth required)
    // @deprecated - Endpoints not used by ApiClient, will be removed
    app.post('/test-pool/borrow', asyncHandler(borrowTestUser));
    app.post('/test-pool/return', asyncHandler(returnTestUser));

    // Test user endpoints (dev only, requires auth)
    // @deprecated - Endpoint not used by ApiClient, will be removed
    app.post('/test/user/clear-policy-acceptances', asyncHandler(testClearPolicyAcceptances));
    app.post('/test/user/promote-to-admin', asyncHandler(testPromoteToAdmin));

    // User policy endpoints (requires auth)
    app.post('/user/policies/accept-multiple', authenticate, asyncHandler(acceptMultiplePolicies));
    app.get('/user/policies/status', authenticate, asyncHandler(getUserPolicyStatus));

    app.put('/user/profile', authenticate, asyncHandler(updateUserProfile));
    app.post('/user/change-password', authenticate, asyncHandler(changePassword));

    // Auth endpoints (no auth required)
    app.post('/register', asyncHandler(register));

    // Expense endpoints (requires auth)
    app.post(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(createExpense));
    app.put(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(updateExpense));
    app.delete(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(deleteExpense));
    app.get(`/${FirestoreCollections.EXPENSES}/history`, authenticate, asyncHandler(getExpenseHistory));
    app.get(`/${FirestoreCollections.EXPENSES}/:id/full-details`, authenticate, asyncHandler(getExpenseFullDetails));

    // NEW Group endpoints (requires auth) - RESTful API
    app.post(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(createGroup));
    app.get(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(listGroups));

    // Specific group endpoints must come BEFORE :id routes
    app.post(`/${FirestoreCollections.GROUPS}/share`, authenticate, asyncHandler(generateShareableLink));
    app.post(`/${FirestoreCollections.GROUPS}/preview`, authenticate, asyncHandler(previewGroupByLink));
    app.post(`/${FirestoreCollections.GROUPS}/join`, authenticate, asyncHandler(joinGroupByLink));

    // Parameterized routes come last
    app.get(`/${FirestoreCollections.GROUPS}/:id/full-details`, authenticate, asyncHandler(getGroupFullDetails));
    app.put(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(updateGroup));
    app.delete(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(deleteGroup));
    app.post(`/${FirestoreCollections.GROUPS}/:id/leave`, authenticate, asyncHandler(leaveGroup));
    app.delete(`/${FirestoreCollections.GROUPS}/:id/members/:memberId`, authenticate, asyncHandler(removeGroupMember));

    // Permission management routes
    app.put(`/${FirestoreCollections.GROUPS}/:id/permissions`, authenticate, asyncHandler(updateGroupPermissions));

    // Settlement endpoints (requires auth)
    app.post(`/${FirestoreCollections.SETTLEMENTS}`, authenticate, asyncHandler(createSettlement));
    app.get(`/${FirestoreCollections.SETTLEMENTS}`, authenticate, asyncHandler(listSettlements));
    app.put(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(updateSettlement));
    app.delete(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(deleteSettlement));

    // Comment endpoints (requires auth)
    app.post(`/${FirestoreCollections.GROUPS}/:groupId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(createComment));
    app.post(`/${FirestoreCollections.EXPENSES}/:expenseId/${FirestoreCollections.COMMENTS}`, authenticate, asyncHandler(createComment));

    // Admin Policy endpoints (requires admin auth)
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
        // Check if response was already sent
        if (res.headersSent) {
            return next(err);
        }

        const correlationId = req.headers['x-correlation-id'] as string;

        // Handle ApiError objects properly
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

        // Handle unexpected errors
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

// Main API export - using Firebase Functions v2 for better performance
export const api = onRequest(
    {
        invoker: 'public', // Allow unauthenticated access for CORS and public endpoints
        maxInstances: 1, // Single instance required for test pool in-memory state
        timeoutSeconds: 20,
        region: 'us-central1',
        memory: '512MiB', // Optimized for API workload with authentication and database operations
    },
    (req, res) => {
        // Initialize app lazily on first request to avoid loading config at deploy time
        const app = getApp();
        app(req, res);
    },
);

// Export Firestore triggers for realtime change tracking
export { trackGroupChanges, trackExpenseChanges, trackSettlementChanges };

// Note: User notification lifecycle is now handled directly in UserService business logic
// - Notification document creation: UserService.createUserDirect()
// - Notification document deletion: UserService.deleteAccount()

// Export scheduled functions
export { logMetrics };
