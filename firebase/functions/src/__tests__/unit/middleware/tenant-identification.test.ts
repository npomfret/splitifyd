import {
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toISOString,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
    type TenantConfig,
} from '@splitifyd/shared';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantRequestContext } from '../../../types/tenant';
import { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import { TenantIdentification, type TenantIdentificationConfig } from '../../../middleware/tenant-identification';

describe('TenantIdentification middleware', () => {
    let registry: TenantRegistryService;
    let config: TenantIdentificationConfig;
    let request: Partial<express.Request>;
    let response: Partial<express.Response>;
    let next: ReturnType<typeof vi.fn>;

    const tenantContext: TenantRequestContext = {
        tenantId: toTenantId('test-tenant'),
        config: {
            tenantId: toTenantId('test-tenant'),
            branding: {
                appName: toTenantAppName('Test App'),
                logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#0066CC'),
                secondaryColor: toTenantSecondaryColor('#FF6600'),
            },
            features: {
                enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
                enableMultiCurrency: toFeatureToggleMultiCurrency(true),
                enableCustomFields: toFeatureToggleCustomFields(false),
                maxGroupsPerUser: toTenantMaxGroupsPerUser(25),
                maxUsersPerGroup: toTenantMaxUsersPerGroup(50),
            },
            createdAt: toISOString('2025-01-01T00:00:00.000Z'),
            updatedAt: toISOString('2025-01-02T12:00:00.000Z'),
        } as TenantConfig,
        primaryDomain: toTenantDomainName('app.example.com'),
        domains: [toTenantDomainName('app.example.com')],
        isDefault: toTenantDefaultFlag(false),
        source: 'domain',
    };

    beforeEach(() => {
        registry = {
            resolveTenant: vi.fn(),
        } as unknown as TenantRegistryService;

        config = {
            allowOverrideHeader: vi.fn().mockReturnValue(true),
            allowDefaultFallback: vi.fn().mockReturnValue(true),
        };

        request = {
            method: 'GET',
            path: '/secure-route',
            headers: { host: 'app.example.com' },
            get: vi.fn(),
            hostname: 'app.example.com',
        };

        response = {};
        next = vi.fn();

        vi.mocked(registry.resolveTenant).mockResolvedValue(tenantContext);
    });

    const runMiddleware = async () => {
        const identification = new TenantIdentification(registry, config);
        await identification.handle(request as express.Request, response as express.Response, next);
    };

    describe('resolution', () => {
        it('resolves tenant and attaches context to request', async () => {
            await runMiddleware();

            expect(request.tenant).toEqual(tenantContext);
            expect(next).toHaveBeenCalledOnce();
            expect(next).toHaveBeenCalledWith();
        });

        it('extracts host from x-forwarded-host before host header', async () => {
        request = {
            ...request,
            headers: {
                'x-forwarded-host': 'proxy.example.com',
                host: 'internal.example.com',
            },
        };

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ host: 'proxy.example.com' }),
            );
        });

        it('falls back to hostname when headers missing', async () => {
        request = {
            ...request,
            headers: {},
            hostname: 'fallback.example.com',
        };

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ host: 'fallback.example.com' }),
            );
        });

        it('passes null host when no host available', async () => {
        request = {
            ...request,
            headers: {},
            hostname: '',
        };

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ host: null }),
            );
        });

        it('passes override header when present', async () => {
            (request.get as ReturnType<typeof vi.fn>).mockReturnValue('override-tenant');

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ overrideTenantId: 'override-tenant' }),
            );
        });
    });

    describe('config policy', () => {
        it('honours allowOverrideHeader flag', async () => {
            vi.mocked(config.allowOverrideHeader).mockReturnValue(false);

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ allowOverride: false }),
            );
        });

        it('honours allowDefaultFallback flag', async () => {
            vi.mocked(config.allowDefaultFallback).mockReturnValue(false);

            await runMiddleware();

            expect(registry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({ allowDefaultFallback: false }),
            );
        });
    });

    describe('route exemptions', () => {
        const exemptPaths = [
            '/',
            '/health',
            '/metrics',
            '/env',
            '/csp-violation-report',
            '/policies/terms/current',
            '/register',
            '/test-pool/borrow',
            '/test/user/promote',
        ];

        it.each(exemptPaths)('skips tenant resolution for %s', async (path) => {
            request = {
                ...request,
                path,
            };

            await runMiddleware();

            expect(registry.resolveTenant).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledOnce();
        });

        it('skips OPTIONS requests', async () => {
            request = {
                ...request,
                method: 'OPTIONS',
            };

            await runMiddleware();

            expect(registry.resolveTenant).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledOnce();
        });
    });

    describe('error handling', () => {
        it('propagates errors from tenant resolution', async () => {
            const failure = new Error('boom');
            vi.mocked(registry.resolveTenant).mockRejectedValue(failure);

            const identification = new TenantIdentification(registry, config);
            await identification.handle(request as express.Request, response as express.Response, next);

            expect(next).toHaveBeenCalledWith(failure);
        });
    });
});
