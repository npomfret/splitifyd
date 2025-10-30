import express from 'express';
import { logger } from '../logger';
import type { TenantResolutionOptions } from '../services/tenant/TenantRegistryService';
import { TenantRegistryService } from '../services/tenant/TenantRegistryService';

export interface TenantContextConfig {
    allowOverrideHeader: () => boolean;
    allowDefaultFallback: () => boolean;
}

const extractHostHeader = (req: express.Request): string | null => {
    const forwarded = req.headers['x-forwarded-host'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
        return forwarded;
    }

    const headerHost = req.headers.host;
    if (typeof headerHost === 'string' && headerHost.trim().length > 0) {
        return headerHost;
    }

    if (req.hostname && req.hostname.trim().length > 0) {
        return req.hostname;
    }

    return null;
};

// Routes that should work without tenant context
const TENANT_OPTIONAL_ROUTES = [
    '/',
    '/health',
    '/metrics',
    '/env',
    '/csp-violation-report',
];

// Route patterns that should work without tenant context
const TENANT_OPTIONAL_PATTERNS = [
    /^\/policies\/[^/]+\/current$/, // /policies/:id/current
    /^\/register$/,                 // /register
    /^\/test-pool\//,               // /test-pool/* (dev only)
    /^\/test\/user\//,              // /test/user/* (dev only)
];

const isRouteExempt = (path: string): boolean => {
    // Check exact matches first
    if (TENANT_OPTIONAL_ROUTES.includes(path)) {
        return true;
    }

    // Check pattern matches
    return TENANT_OPTIONAL_PATTERNS.some(pattern => pattern.test(path));
};

export const tenantContextMiddleware =
    (tenantRegistry: TenantRegistryService, config: TenantContextConfig) =>
        async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
            if (req.method === 'OPTIONS') {
                next();
                return;
            }

            // Skip tenant resolution for diagnostic/public routes
            if (isRouteExempt(req.path)) {
                logger.debug('tenant-context-skipped', {
                    path: req.path,
                    reason: 'route-exempt',
                });
                next();
                return;
            }

            try {
                const host = extractHostHeader(req);
                const overrideTenantId = req.get('x-tenant-id');

                const options: TenantResolutionOptions = {
                    host,
                    overrideTenantId,
                    allowOverride: config.allowOverrideHeader(),
                    allowDefaultFallback: config.allowDefaultFallback(),
                };

                const resolution = await tenantRegistry.resolveTenant(options);
                req.tenant = resolution;

                logger.debug('tenant-context-resolved', {
                    tenantId: resolution.tenantId,
                    source: resolution.source,
                    host: host ?? 'unknown',
                });

                next();
            } catch (error) {
                next(error);
            }
        };
