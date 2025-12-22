// Endpoint inventory: see docs/firebase-api-surface.md for route descriptions.
import type { RequestHandler } from 'express';
import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { authenticate, authenticateAdmin, authenticateCloudTask, authenticateSystemUser, authenticateTenantAdmin } from './auth/middleware';
import { getComponentBuilder } from './ComponentBuilderSingleton';
import { HTTP_STATUS } from './constants';
import { ApiError } from './errors';
import { logger } from './logger';
import { disableETags } from './middleware/cache-control';
import { POSTMARK_API_KEYS_JSON } from './params';
import { createRouteDefinitions } from './routes/route-config';
import { logMetrics } from './scheduled/metrics-logger';
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

/**
 * Wraps async handlers to ensure errors are caught and passed to Express error middleware
 */
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

function setupRoutes(app: express.Application): void {
    const appBuilder = getComponentBuilder();
    const routeDefinitions = createRouteDefinitions(appBuilder);

    const middlewareRegistry = {
        authenticate,
        authenticateAdmin,
        authenticateCloudTask,
        authenticateSystemUser,
        authenticateTenantAdmin,
    };

    // Setup routes from configuration
    for (const route of routeDefinitions) {
        // Get the handler from the route definition (already populated)
        // Skip routes without handlers (e.g., test-only routes not registered in production)
        const handler = route.handler;
        if (!handler) {
            continue;
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

    // 404 handler for unmatched routes
    app.use((req: express.Request, res: express.Response) => {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: {
                code: 'NOT_FOUND',
                resource: 'Endpoint',
            },
        });
    });

    // Global error handler
    app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

        // Handle ApiError format
        if (err instanceof ApiError) {
            logger.error('API error occurred', err, {
                correlationId,
                method: req.method,
                path: req.path,
                statusCode: err.statusCode,
                errorCode: err.code,
                errorDetail: err.data?.detail,
            });

            res.status(err.statusCode).json({
                error: {
                    ...err.toJSON(),
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
                code: 'SERVICE_ERROR',
                correlationId,
            },
        });
    });
}

export const api = onRequest(
    {
        invoker: 'public',
        maxInstances: 1,
        concurrency: 5,
        timeoutSeconds: 15,
        region: 'us-central1',
        memory: '512MiB',
        secrets: [POSTMARK_API_KEYS_JSON],
    },
    (req, res) => {
        const app = getApp();
        app(req, res);
    },
);

export { logMetrics };
export { health } from './endpoints/health';

// Exposed for integration testing to allow direct access to the Express app
export function getApiAppForTesting(): express.Application {
    return getApp();
}
