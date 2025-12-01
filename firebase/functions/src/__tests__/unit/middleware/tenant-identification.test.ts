import { TenantConfigBuilder } from '@billsplit-wl/test-support';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantIdentification } from '../../../middleware/tenant-identification';
import { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import type { TenantRequestContext } from '../../../types/tenant';
import { TenantRequestContextBuilder } from '../TenantRequestContextBuilder';

describe('TenantIdentification middleware', () => {
    let registry: TenantRegistryService;
    let request: Partial<express.Request>;
    let response: Partial<express.Response>;
    let next: ReturnType<typeof vi.fn>;

    const tenantContext: TenantRequestContext = new TenantRequestContextBuilder()
        .withTenantId('test-tenant')
        .withConfig(
            new TenantConfigBuilder()
                .withTenantId('test-tenant')
                .withAppName('Test App')
                .withLogoUrl('https://example.com/logo.svg')
                .withFaviconUrl('https://example.com/favicon.ico')
                .withPrimaryColor('#0066CC')
                .withSecondaryColor('#FF6600')
                .withCreatedAt('2025-01-01T00:00:00.000Z')
                .withUpdatedAt('2025-01-02T12:00:00.000Z'),
        )
        .withDomains(['app.example.com'])
        .asDefault()
        .withSource('domain')
        .build();

    beforeEach(() => {
        registry = {
            resolveTenant: vi.fn(),
        } as unknown as TenantRegistryService;

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
        const identification = new TenantIdentification(registry);
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

            const identification = new TenantIdentification(registry);
            await identification.handle(request as express.Request, response as express.Response, next);

            expect(next).toHaveBeenCalledWith(failure);
        });
    });
});
