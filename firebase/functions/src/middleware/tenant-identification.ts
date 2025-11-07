import express from 'express';
import type { TenantResolutionOptions } from '../services/tenant/TenantRegistryService';
import { TenantRegistryService } from '../services/tenant/TenantRegistryService';
import { logger } from '../logger';

export interface TenantIdentificationConfig {
    allowOverrideHeader: () => boolean;
    allowDefaultFallback: () => boolean;
}

const EXEMPT_ROUTES = [
    '/',
    '/health',
    '/metrics',
    '/env',
    '/csp-violation-report',
];

const EXEMPT_PATTERNS = [
    /^\/policies\/[^/]+\/current$/,
    /^\/register$/,
    /^\/test-pool\//,
    /^\/test\/user\//,
];

class TenantIdentification {
    constructor(
        private readonly tenantRegistry: TenantRegistryService,
        private readonly config: TenantIdentificationConfig,
    ) {}

    public readonly handle = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        if (req.method === 'OPTIONS' || this.shouldSkip(req)) {
            next();
            return;
        }

        try {
            const resolution = await this.tenantRegistry.resolveTenant(this.buildResolutionOptions(req));
            req.tenant = resolution;

            logger.debug('tenant-identification:resolved', {
                tenantId: resolution.tenantId,
                source: resolution.source,
                path: req.path,
            });

            next();
        } catch (error) {
            next(error);
        }
    };

    private shouldSkip(req: express.Request): boolean {
        if (EXEMPT_ROUTES.includes(req.path)) {
            logger.debug('tenant-identification:skipped', { path: req.path, reason: 'route-exempt' });
            return true;
        }

        const exempt = EXEMPT_PATTERNS.some((pattern) => pattern.test(req.path));
        if (exempt) {
            logger.debug('tenant-identification:skipped', { path: req.path, reason: 'pattern-exempt' });
        }
        return exempt;
    }

    private buildResolutionOptions(req: express.Request): TenantResolutionOptions {
        const overrideTenantId = req.get('x-tenant-id');

        return {
            host: this.extractHost(req),
            overrideTenantId,
            allowOverride: this.config.allowOverrideHeader(),
            allowDefaultFallback: this.config.allowDefaultFallback(),
        };
    }

    private extractHost(req: express.Request): string | null {
        const forwarded = req.headers['x-forwarded-host'];
        if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
            return forwarded;
        }

        const host = req.headers.host;
        if (typeof host === 'string' && host.trim().length > 0) {
            return host;
        }

        if (req.hostname && req.hostname.trim().length > 0) {
            return req.hostname;
        }

        return null;
    }
}

export const createTenantIdentificationMiddleware = (tenantRegistry: TenantRegistryService, config: TenantIdentificationConfig) => {
    const identification = new TenantIdentification(tenantRegistry, config);
    return identification.handle;
};

export { TenantIdentification };
