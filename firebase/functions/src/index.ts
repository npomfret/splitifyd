// Endpoint inventory: see docs/firebase-api-surface.md for route descriptions.
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { authenticate, authenticateAdmin, authenticateSystemUser } from './auth/middleware';
import { getConfig as getClientConfig } from './client-config';
import { FirestoreCollections, HTTP_STATUS } from './constants';
import { buildEnvPayload, buildHealthPayload, resolveHealthStatusCode, runHealthChecks } from './endpoints/diagnostics';
import { logger } from './logger';
import { disableETags } from './middleware/cache-control';
import { metrics, toAggregatedReport } from './monitoring/lightweight-metrics';
import { logMetrics } from './scheduled/metrics-logger';
import { borrowTestUser, returnTestUser } from './test-pool/handlers';
import { testClearPolicyAcceptances, testPromoteToAdmin } from './test/policy-handlers';
import { getEnhancedConfigResponse } from './utils/config-response';
import { ApiError } from './utils/errors';
import { applyStandardMiddleware } from './utils/middleware';
import { routeDefinitions, populateRouteHandlers } from './routes/route-config';
import type { RequestHandler } from 'express';
import { createHandlerRegistry } from './ApplicationFactory';
import { getComponentBuilder } from './ComponentBuilderSingleton';

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

/**
 * Wraps async handlers to ensure errors are caught and passed to Express error middleware
 */
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Handler registry that maps handler names from route configuration to actual handler functions.
 * Combines ApplicationFactory handlers with inline diagnostic and test handlers.
 */
function getHandlerRegistry(): Record<string, RequestHandler> {
    // Get application builder and create handler registry from factory
    const appBuilder = getComponentBuilder();
    const handlerRegistry = createHandlerRegistry(
        appBuilder.buildAuthService(),
        appBuilder.getDatabase()
    );

    // Inline handlers for diagnostic endpoints
    const getMetrics: RequestHandler = (req, res) => {
        const snapshot = metrics.getSnapshot();
        res.json(toAggregatedReport(snapshot));
    };

    const getHealth: RequestHandler = async (req, res) => {
        const checks = await runHealthChecks();
        const payload = buildHealthPayload(checks);
        const statusCode = resolveHealthStatusCode(checks);
        res.status(statusCode).json(payload);
    };

    const headHealth: RequestHandler = async (req, res) => {
        const checks = await runHealthChecks();
        const statusCode = resolveHealthStatusCode(checks);
        res.status(statusCode).end();
    };

    const getEnv: RequestHandler = (req, res) => {
        res.json(buildEnvPayload());
    };

    const getConfig: RequestHandler = (req, res) => {
        const config = getEnhancedConfigResponse();
        res.json(config);
    };

    const reportCspViolation: RequestHandler = (req, res) => {
        try {
            res.status(204).send();
        } catch (error) {
            logger.error('Error processing CSP violation report', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };

    // Merge factory handlers with inline handlers
    return {
        ...handlerRegistry,

        // Diagnostics (override/add)
        getMetrics,
        getHealth,
        headHealth,
        getEnv,
        getConfig,
        reportCspViolation,

        // Test endpoints (override/add)
        borrowTestUser,
        returnTestUser,
        testClearPolicyAcceptances,
        testPromoteToAdmin,
    };
}

/**
 * Middleware registry that maps middleware names to actual middleware functions
 */
function getMiddlewareRegistry(): Record<string, RequestHandler> {
    return {
        authenticate,
        authenticateAdmin,
        authenticateSystemUser,
    };
}

function setupRoutes(app: express.Application): void {
    const handlerRegistry = getHandlerRegistry();
    const middlewareRegistry = getMiddlewareRegistry();
    const config = getClientConfig();

    // Populate route definitions with handlers from the registry
    populateRouteHandlers(handlerRegistry);

    // Setup routes from configuration
    for (const route of routeDefinitions) {
        // Skip test-only routes in production
        if (route.testOnly && config.isProduction) {
            continue;
        }

        // Get the handler from the route definition (already populated)
        const handler = route.handler || handlerRegistry[route.handlerName];
        if (!handler) {
            throw new Error(`Handler not found for route: ${route.handlerName}`);
        }

        // Build middleware chain
        const middlewareChain: RequestHandler[] = [];
        if (route.middleware) {
            for (const middlewareName of route.middleware) {
                const middleware = middlewareRegistry[middlewareName];
                if (!middleware) {
                    throw new Error(`Middleware not found in registry: ${middlewareName}`);
                }
                middlewareChain.push(middleware);
            }
        }

        // Wrap handler in asyncHandler for error handling
        const wrappedHandler = asyncHandler(handler);

        // Register the route
        const method = route.method.toLowerCase() as keyof express.Application;
        (app[method] as Function)(route.path, ...middlewareChain, wrappedHandler);
    }

    // Add test endpoint protection for production
    if (config.isProduction) {
        app.all(/^\/test-pool.*/, (req, res) => {
            logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
            res.status(404).json({ error: 'Not found' });
        });
        app.all(/^\/test\/user.*/, (req, res) => {
            logger.warn('Test endpoint accessed in production', { path: req.path, ip: req.ip });
            res.status(404).json({ error: 'Not found' });
        });
    }

    // 404 handler for unmatched routes
    app.use((req: express.Request, res: express.Response) => {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Endpoint not found',
            },
        });
    });

    // Global error handler
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

export function getMiddlewareRegistryForTesting(): Record<string, RequestHandler> {
    return getMiddlewareRegistry();
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

// Exposed for integration testing to allow direct access to the Express app
export function getApiAppForTesting(): express.Application {
    return getApp();
}
