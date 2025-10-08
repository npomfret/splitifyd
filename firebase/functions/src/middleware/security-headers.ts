import { NextFunction, Request, Response } from 'express';
import { getConfig } from '../client-config';

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    res.setHeader('X-Frame-Options', 'DENY'); // Prevent clickjacking attacks
    res.setHeader('X-XSS-Protection', '1; mode=block'); // Enable browser XSS filter
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer information leakage
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // Disable unnecessary browser features
    res.setHeader('X-DNS-Prefetch-Control', 'off'); // Prevent DNS prefetching for privacy
    res.setHeader('X-Download-Options', 'noopen'); // Prevent IE from opening downloads in site context
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none'); // Restrict Flash/PDF cross-domain policies

    const config = getConfig();
    if (config.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'); // Force HTTPS for 1 year
        res.setHeader(
            'Content-Security-Policy',
            'default-src \'self\'; '
                + 'script-src \'self\' https://apis.google.com https://www.gstatic.com; '
                + 'style-src \'self\' https://fonts.googleapis.com; '
                + 'font-src \'self\' https://fonts.gstatic.com; '
                + 'img-src \'self\' data: https:; '
                + 'connect-src \'self\' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com; '
                + 'frame-ancestors \'none\'; '
                + 'report-uri /csp-violation-report;',
        );
    }

    next();
}
