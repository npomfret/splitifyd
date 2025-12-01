import { ApiSerializer, responseSchemas } from '@billsplit-wl/shared';
import { randomUUID } from 'crypto';
import express from 'express';
import type { ZodSchema } from 'zod';
import { getAppConfig } from '../app-config';
import { logger, LoggerContext } from '../logger';
import { applyCacheControl } from '../middleware/cache-control';
import { applySecurityHeaders } from '../middleware/security-headers';
import { createTenantIdentificationMiddleware } from '../middleware/tenant-identification';
import { validateContentType, validateRequestStructure } from '../middleware/validation';
import '../types/tenant';
import { getComponentBuilder } from '../ComponentBuilderSingleton';
import { Errors } from '../errors';

const applicationBuilder = getComponentBuilder();
const tenantRegistryService = applicationBuilder.buildTenantRegistryService();

/**
 * Normalize an Express path to match the responseSchemas keys
 * Converts:
 *   - /groups/abc123 -> /groups/:groupId
 *   - /expenses/xyz789 -> /expenses/:expenseId
 *   - /settlements/xyz789 -> /settlements/:settlementId
 *   - /groups/abc123/comments -> /groups/:groupId/comments
 */
function normalizePath(path: string): string {
    // Remove /api prefix if present
    let normalized = path.replace(/^\/api/, '');

    // Normalize known parameter patterns
    // Order matters - more specific patterns first
    // Use $ anchors where appropriate to prevent over-matching
    // IMPORTANT: Static paths like /groups/share, /groups/join, /groups/preview must NOT be normalized
    normalized = normalized
        // Group-related parameters (most specific first)
        .replace(/\/groups\/[^/:]+\/members\/[^/:]+$/, '/groups/:groupId/members/:memberId')
        .replace(/\/groups\/[^/:]+\/comments$/, '/groups/:groupId/comments')
        .replace(/\/groups\/[^/:]+\/full-details$/, '/groups/:groupId/full-details')
        .replace(/\/groups\/[^/:]+\/members\/display-name$/, '/groups/:groupId/members/display-name')
        .replace(/\/groups\/[^/:]+\/members\/pending$/, '/groups/:groupId/members/pending')
        .replace(/\/groups\/[^/:]+\/members$/, '/groups/:groupId/members')
        .replace(/\/groups\/[^/:]+\/leave$/, '/groups/:groupId/leave')
        .replace(/\/groups\/[^/:]+\/archive$/, '/groups/:groupId/archive')
        .replace(/\/groups\/[^/:]+\/unarchive$/, '/groups/:groupId/unarchive')
        .replace(/\/groups\/[^/:]+\/security\/permissions$/, '/groups/:groupId/security/permissions')
        // Only normalize /groups/:groupId if it's NOT a static endpoint (share, join, preview, balances)
        .replace(/\/groups\/(?!share$|join$|preview$|balances$)[^/:]+$/, '/groups/:groupId')
        // Expense-related parameters
        .replace(/\/expenses\/[^/:]+\/comments$/, '/expenses/:expenseId/comments')
        .replace(/\/expenses\/[^/:]+\/full-details$/, '/expenses/:expenseId/full-details')
        .replace(/\/expenses\/[^/:]+$/, '/expenses/:expenseId')
        // Settlement-related parameters
        .replace(/\/settlements\/[^/:]+$/, '/settlements/:settlementId')
        // Merge-related parameters
        .replace(/\/merge\/[^/:]+$/, '/merge/:jobId')
        // Policy-related parameters
        .replace(/\/policies\/[^/:]+\/current$/, '/policies/:policyId/current')
        .replace(/\/admin\/policies\/[^/:]+\/publish$/, '/admin/policies/:policyId/publish')
        .replace(/\/admin\/policies\/[^/:]+$/, '/admin/policies/:policyId')
        // Admin user parameters
        .replace(/\/admin\/users\/[^/:]+\/role$/, '/admin/users/:userId/role')
        .replace(/\/admin\/users\/[^/:]+$/, '/admin/users/:userId')
        // Admin tenant asset parameters
        .replace(/\/admin\/tenants\/[^/:]+\/assets\/[^/:]+$/, '/admin/tenants/:tenantId/assets/:assetType');

    return normalized;
}

/**
 * Get the response schema for a given method and path
 */
function getResponseSchema(method: string, path: string): ZodSchema | undefined {
    const normalizedPath = normalizePath(path);

    // Try method-specific key first (e.g., "GET /groups")
    const methodKey = `${method} ${normalizedPath}` as keyof typeof responseSchemas;
    if (methodKey in responseSchemas) {
        return responseSchemas[methodKey] as ZodSchema;
    }

    // Fall back to path-only key (e.g., "/groups/:id")
    const pathKey = normalizedPath as keyof typeof responseSchemas;
    if (pathKey in responseSchemas) {
        return responseSchemas[pathKey] as ZodSchema;
    }

    return undefined;
}

/**
 * Apply standard middleware stack to Express app
 */
export const applyStandardMiddleware = (app: express.Application) => {
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
        LoggerContext.run(
            {
                correlationId,
                requestPath: req.path,
                requestMethod: req.method,
            },
            () => {
                next();
            },
        );
    });

    // Validate content type for non-GET requests
    app.use(validateContentType);

    // Parse JSON with size limit (skip for binary upload routes)
    const jsonParser = express.json({ limit: getAppConfig().requestBodyLimit });
    const rawParser = express.raw({ type: ['image/*', 'application/octet-stream'], limit: '2mb' });
    app.use((req, res, next) => {
        // Use raw body parsing for binary upload routes
        if (req.path.match(/^\/admin\/tenants\/[^/]+\/assets\/[^/]+$/)) {
            return rawParser(req, res, next);
        }
        return jsonParser(req, res, next);
    });

    // Resolve tenant context for all subsequent middleware and handlers
    app.use(createTenantIdentificationMiddleware(tenantRegistryService));

    // Serialize all JSON responses through the API serializer with validation
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.json = (body?: unknown): express.Response => {
            if (res.headersSent) {
                throw new Error('Cannot send JSON response: headers already sent. This is a programming error - responses must go through the serializer.');
            }

            const payload = body === undefined ? null : body;

            // Only validate successful responses (2xx status codes)
            // Error responses have a different structure and shouldn't be validated against success schemas
            const isSuccessResponse = res.statusCode >= 200 && res.statusCode < 300;

            if (isSuccessResponse) {
                // Validate response against schema (strict mode: throw on validation failure)
                const schema = getResponseSchema(req.method, req.path);
                if (schema) {
                    const result = schema.safeParse(payload);
                    if (!result.success) {
                        logger.error('response-validation-failed', {
                            path: req.path,
                            method: req.method,
                            errors: result.error.issues.map((issue) => ({
                                path: issue.path.join('.'),
                                message: issue.message,
                                code: issue.code,
                            })),
                            payload: JSON.stringify(payload).substring(0, 500),
                            correlationId: req.headers['x-correlation-id'],
                        });
                        throw Errors.serviceError('RESPONSE_VALIDATION_FAILED');
                    }
                }
            }

            const serialized = ApiSerializer.serialize(payload);

            res.setHeader('Content-Type', 'application/x-serialized-json; charset=utf-8');
            return res.send(serialized);
        };

        next();
    });

    // Validate request structure and prevent malicious payloads
    app.use(validateRequestStructure);

    // Log slow requests (>1s) to help identify performance bottlenecks
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            if (duration > 1000) {
                logger.warn('slow-request', {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration,
                    correlationId: req.headers['x-correlation-id'],
                });
            }
        });

        next();
    });

    // Request logging is minimal - only log when something changes
    // Errors are logged by error handlers
};
