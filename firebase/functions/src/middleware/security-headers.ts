import { NextFunction, Request, Response } from 'express';
import { getClientConfig } from '../app-config';

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
    // CORS headers
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    res.setHeader('X-Frame-Options', 'DENY'); // Prevent clickjacking attacks
    res.setHeader('X-XSS-Protection', '1; mode=block'); // Enable browser XSS filter
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer information leakage
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // Disable unnecessary browser features
    res.setHeader('X-DNS-Prefetch-Control', 'off'); // Prevent DNS prefetching for privacy
    res.setHeader('X-Download-Options', 'noopen'); // Prevent IE from opening downloads in site context
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none'); // Restrict Flash/PDF cross-domain policies

    const config = getClientConfig();
    if (config.securityHeaders.hstsEnabled) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    res.setHeader('Content-Security-Policy', config.securityHeaders.cspPolicy);

    next();
}
