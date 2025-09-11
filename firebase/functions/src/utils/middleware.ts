import express from 'express';
import { getConfig } from '../client-config';
import { randomUUID } from 'crypto';
import { validateRequestStructure, validateContentType } from '../middleware/validation';
import { applySecurityHeaders } from '../middleware/security-headers';
import { applyCacheControl } from '../middleware/cache-control';
import { LoggerContext } from '../logger';
import { detectLanguageFromHeader, getTranslationFunction, initializeI18n, LocalizedRequest } from './i18n';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { getFirestore } from '../firebase';

export interface MiddlewareOptions {
    functionName?: string;
}

// Initialize services
const applicationBuilder = new ApplicationBuilder(getFirestore());
const firestoreReader = applicationBuilder.buildFirestoreReader();

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

    // Add i18n middleware to detect language and add translation function to requests
    app.use(i18nMiddleware());

    // Validate request structure and prevent malicious payloads
    app.use(validateRequestStructure);

    // Request logging is minimal - only log when something changes
    // Errors are logged by error handlers
};

/**
 * Middleware to add translation capabilities to requests
 */
export function i18nMiddleware() {
    return async (req: LocalizedRequest, res: any, next: any) => {
        try {
            // Ensure i18n is initialized
            await initializeI18n();

            // Detect language from various sources (in order of preference):
            // 1. User profile preference (if authenticated)
            // 2. Accept-Language header
            // 3. Default to English

            let selectedLanguage = 'en';

            // Try to get user's preferred language if authenticated
            const userId = (req as any).user?.uid;
            if (userId) {
                const userLanguage = await firestoreReader.getUserLanguagePreference(userId);
                if (userLanguage) {
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
            console.error('i18n middleware error:', error);
            // Continue with English as fallback
            req.language = 'en';
            req.t = getTranslationFunction('en');
            next();
        }
    };
}
