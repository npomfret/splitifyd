import { NextFunction, Request, Response } from 'express';
import { getConfig } from '../client-config';

/**
 * Middleware to control caching behavior for all responses
 *
 * Strategy:
 * - API endpoints (/api/*): No caching allowed
 * - Static pages: Minimal caching (5 minutes in dev, up to 1 hour in prod)
 * - All responses: Disable ETags to prevent 304 responses
 */
export function applyCacheControl(req: Request, res: Response, next: NextFunction): void {
    const config = getConfig();

    // Define static pages and config endpoints that can have minimal caching
    const staticPages: Record<string, { dev: number; prod: number; }> = {
        '/': { dev: 300, prod: 300 }, // 5 minutes
        '/login': { dev: 300, prod: 300 }, // 5 minutes
        '/terms': { dev: 300, prod: 3600 }, // 5 min dev, 1 hour prod
        '/privacy': { dev: 300, prod: 3600 }, // 5 min dev, 1 hour prod
        '/config': { dev: 300, prod: 3600 }, // Firebase config can be cached
    };

    // Check if this is a static page
    const staticPageConfig = staticPages[req.path];

    if (staticPageConfig) {
        // Static pages can have minimal caching
        const maxAge = config.isProduction ? staticPageConfig.prod : staticPageConfig.dev;
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`);

        // Applied caching for cacheable endpoint
    } else {
        // API endpoints and all other paths: NO caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        // Prevent IE from caching AJAX requests
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
        }
    }

    next();
}

/**
 * Disable ETags for the Express application
 * This must be called during app initialization
 */
export function disableETags(app: any): void {
    app.set('etag', false);
    // ETags disabled for Express application
}
