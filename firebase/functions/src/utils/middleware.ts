import express from 'express';
import { getConfig } from '../config';
import { randomUUID } from 'crypto';
import { validateRequestStructure, validateContentType, rateLimitByIP } from '../middleware/validation';
import { applySecurityHeaders } from '../middleware/security-headers';
import { applyCacheControl } from '../middleware/cache-control';
import { LoggerContext } from '../logger';
import { i18nMiddleware } from './i18n';

export interface MiddlewareOptions {
    functionName?: string;
}

/**
 * Apply standard middleware stack to Express app
 */
export const applyStandardMiddleware = (app: express.Application, options: MiddlewareOptions = {}) => {

    // Apply security headers first
    app.use(applySecurityHeaders);

    // Apply cache control headers to prevent stale data issues
    app.use(applyCacheControl);

    // Add correlation ID and initialize logging context for all requests
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
        req.headers['x-correlation-id'] = correlationId;
        res.setHeader('x-correlation-id', correlationId);
        
        // Initialize logging context for this request
        LoggerContext.run({
            correlationId,
            requestPath: req.path,
            requestMethod: req.method,
        }, () => {
            next();
        });
    });

    // Apply IP-based rate limiting for all requests
    app.use(rateLimitByIP);

    // Validate content type for non-GET requests
    app.use(validateContentType);

    // Parse JSON with size limit
    app.use(express.json({ limit: getConfig().requestBodyLimit }));

    // Add i18n middleware to detect language and add translation function to requests
    app.use(i18nMiddleware());

    // Validate request structure and prevent malicious payloads
    app.use(validateRequestStructure);

    // Request logging is minimal - only log when something changes
    // Errors are logged by error handlers
};
