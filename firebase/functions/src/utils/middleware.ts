import { ApiSerializer } from '@billsplit-wl/shared';
import { randomUUID } from 'crypto';
import express from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { getConfig } from '../client-config';
import { logger, LoggerContext } from '../logger';
import { applyCacheControl } from '../middleware/cache-control';
import { applySecurityHeaders } from '../middleware/security-headers';
import { createTenantIdentificationMiddleware, type TenantIdentificationConfig } from '../middleware/tenant-identification';
import { validateContentType, validateRequestStructure } from '../middleware/validation';
import { detectLanguageFromHeader, getTranslationFunction, initializeI18n, LocalizedRequest } from './i18n';
import '../types/tenant';
import {getComponentBuilder} from "../ComponentBuilderSingleton";

const applicationBuilder = getComponentBuilder()
const firestoreReader = applicationBuilder.buildFirestoreReader();
const tenantRegistryService = applicationBuilder.buildTenantRegistryService();

const tenantIdentificationConfig: TenantIdentificationConfig = {
    allowOverrideHeader: () => !getConfig().isProduction,
};

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

    // Parse JSON with size limit
    app.use(express.json({ limit: getConfig().requestBodyLimit }));

    // Resolve tenant context for all subsequent middleware and handlers
    app.use(createTenantIdentificationMiddleware(tenantRegistryService, tenantIdentificationConfig));

    // Serialize all JSON responses through the API serializer
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.json = (body?: unknown): express.Response => {
            if (res.headersSent) {
                throw new Error('Cannot send JSON response: headers already sent. This is a programming error - responses must go through the serializer.');
            }

            const payload = body === undefined ? null : body;
            const serialized = ApiSerializer.serialize(payload);

            res.setHeader('Content-Type', 'application/x-serialized-json; charset=utf-8');
            return res.send(serialized);
        };

        next();
    });

    // Add i18n middleware to detect language and add translation function to requests
    app.use(i18nMiddleware());

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

/**
 * Middleware to add translation capabilities to requests
 */
function i18nMiddleware() {
    return async (req: LocalizedRequest & Partial<AuthenticatedRequest>, _res: express.Response, next: express.NextFunction) => {
        try {
            // Ensure i18n is initialized
            await initializeI18n();

            // Detect language from various sources (in order of preference):
            // 1. User profile preference (if authenticated)
            // 2. Accept-Language header
            // 3. Default to English

            let selectedLanguage = 'en';

            // Try to get user's preferred language if authenticated
            const userId = req.user?.uid;
            if (userId) {
                const user = await firestoreReader.getUser(userId);
                const userLanguage = user?.preferredLanguage;
                if (userLanguage && typeof userLanguage === 'string') {
                    selectedLanguage = userLanguage;
                } else {
                    // Fall back to Accept-Language header
                    selectedLanguage = detectLanguageFromHeader(req.get('Accept-Language'));
                }
            } else {
                // For non-authenticated requests, use Accept-Language header
                selectedLanguage = detectLanguageFromHeader(req.get('Accept-Language'));
            }

            req.language = selectedLanguage;

            // Add translation function to request
            req.t = getTranslationFunction(req.language);

            next();
        } catch (error) {
            logger.error('i18n-middleware-error', error, { path: req.path, acceptLanguage: req.get('Accept-Language') });
            // Continue with English as fallback
            req.language = 'en';
            req.t = getTranslationFunction('en');
            next();
        }
    };
}
