import { NextFunction, Request, Response } from 'express';
import { getClientConfig } from '../app-config';

/**
 * Middleware to control caching behavior for all responses
 *
 * Strategy:
 * - API endpoints (/api/*): No caching allowed
 * - Static pages: Minimal caching (configured in ClientConfig)
 * - All responses: Disable ETags to prevent 304 responses
 */
export function applyCacheControl(req: Request, res: Response, next: NextFunction): void {
    // Skip cache control for theme.css - it has its own versioning-based caching strategy
    if (req.path === '/theme.css') {
        next();
        return;
    }

    const config = getClientConfig();
    const maxAge = config.staticPageCacheSeconds[req.path];

    if (maxAge !== undefined) {
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
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
