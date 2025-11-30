import { toTenantDefaultFlag } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/test-support';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ApiError, ErrorCode } from '../../../errors';
import { type TenantContextConfig, tenantContextMiddleware } from '../../../middleware/tenant-context';
import { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import type { TenantRequestContext } from '../../../types/tenant';
import { TenantRequestContextBuilder } from '../TenantRequestContextBuilder';

describe('tenantContextMiddleware', () => {
    let mockTenantRegistry: TenantRegistryService;
    let mockConfig: TenantContextConfig;
    let mockRequest: Partial<express.Request>;
    let mockResponse: Partial<express.Response>;
    let nextFunction: ReturnType<typeof vi.fn>;

    const mockTenantContext: TenantRequestContext = new TenantRequestContextBuilder()
        .withTenantId('test-tenant')
        .withConfig(
            new TenantConfigBuilder()
                .withTenantId('test-tenant')
                .withAppName('Test App')
                .withLogoUrl('https://example.com/logo.svg')
                .withFaviconUrl('https://example.com/favicon.ico')
                .withPrimaryColor('#0066CC')
                .withSecondaryColor('#FF6600')
                .withCreatedAt('2025-01-15T10:00:00.000Z')
                .withUpdatedAt('2025-01-20T14:30:00.000Z'),
        )
        .withDomains(['app.example.com'])
        .asDefault()
        .withSource('domain')
        .build();

    beforeEach(() => {
        mockTenantRegistry = {
            resolveTenant: vi.fn(),
        } as unknown as TenantRegistryService;

        mockConfig = {
            allowOverrideHeader: vi.fn().mockReturnValue(true),
        };

        mockRequest = {
            method: 'GET',
            headers: {},
            get: vi.fn(),
            hostname: '',
        };

        mockResponse = {};

        nextFunction = vi.fn();
    });

    describe('request processing', () => {
        it('should resolve tenant and attach to request', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockRequest.tenant).toEqual(mockTenantContext);
            expect(nextFunction).toHaveBeenCalledWith();
            expect(nextFunction).toHaveBeenCalledTimes(1);
        });

        it('should extract host from Host header', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: 'app.example.com',
                }),
            );
        });

        it('should prefer x-forwarded-host over Host header', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest.headers = {
                'x-forwarded-host': 'proxy.example.com',
                host: 'internal.example.com',
            };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: 'proxy.example.com',
                }),
            );
        });

        it('should fallback to req.hostname when headers are missing', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest = {
                ...mockRequest,
                headers: {},
                hostname: 'fallback.example.com',
            };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: 'fallback.example.com',
                }),
            );
        });

        it('should use null host when no host information available', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest = {
                ...mockRequest,
                headers: {},
                hostname: '',
            };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: null,
                }),
            );
        });

        it('should extract x-tenant-id override header', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest.headers = { host: 'app.example.com' };
            (mockRequest.get as ReturnType<typeof vi.fn>).mockReturnValue('override-tenant');

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    overrideTenantId: 'override-tenant',
                }),
            );
        });
    });

    describe('config policy enforcement', () => {
        it('should pass allowOverride from config', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);
            vi.mocked(mockConfig.allowOverrideHeader).mockReturnValue(false);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    allowOverride: false,
                }),
            );
        });
    });

    describe('OPTIONS requests', () => {
        it('should skip tenant resolution for OPTIONS requests', async () => {
            mockRequest.method = 'OPTIONS';

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).not.toHaveBeenCalled();
            expect(nextFunction).toHaveBeenCalledWith();
        });
    });

    describe('exempt routes', () => {
        const exemptRoutes = ['/', '/health', '/metrics', '/env', '/config', '/csp-violation-report'];

        exemptRoutes.forEach((route) => {
            it(`should skip tenant resolution for ${route}`, async () => {
                mockRequest = {
                    ...mockRequest,
                    method: 'GET',
                    path: route,
                    headers: { host: 'app.example.com' },
                };

                const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
                await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

                expect(mockTenantRegistry.resolveTenant).not.toHaveBeenCalled();
                expect(nextFunction).toHaveBeenCalledWith();
                expect(mockRequest.tenant).toBeUndefined();
            });
        });

        // Test pattern-based exemptions
        const patternExemptRoutes = [
            '/policies/terms-of-service/current',
            '/policies/privacy-policy/current',
            '/register',
            '/test-pool/borrow',
            '/test-pool/return',
            '/test/user/promote-to-admin',
        ];

        patternExemptRoutes.forEach((route) => {
            it(`should skip tenant resolution for pattern-matched route ${route}`, async () => {
                mockRequest = {
                    ...mockRequest,
                    method: 'GET',
                    path: route,
                    headers: { host: 'app.example.com' },
                };

                const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
                await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

                expect(mockTenantRegistry.resolveTenant).not.toHaveBeenCalled();
                expect(nextFunction).toHaveBeenCalledWith();
                expect(mockRequest.tenant).toBeUndefined();
            });
        });

        it('should still resolve tenant for non-exempt routes', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);

            mockRequest = {
                ...mockRequest,
                method: 'GET',
                path: '/api/groups',
                headers: { host: 'app.example.com' },
            };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalled();
            expect(mockRequest.tenant).toEqual(mockTenantContext);
        });
    });

    describe('error handling', () => {
        it('should pass errors to next function', async () => {
            const error = new ApiError(HTTP_STATUS.NOT_FOUND, ErrorCode.NOT_FOUND, { resource: 'Tenant' });
            vi.mocked(mockTenantRegistry.resolveTenant).mockRejectedValue(error);

            mockRequest.headers = { host: 'unknown.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(nextFunction).toHaveBeenCalledWith(error);
            expect(mockRequest.tenant).toBeUndefined();
        });

        it('should handle generic errors from registry', async () => {
            const error = new Error('Database connection failed');
            vi.mocked(mockTenantRegistry.resolveTenant).mockRejectedValue(error);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(nextFunction).toHaveBeenCalledWith(error);
        });
    });

    describe('source tracking', () => {
        it('should preserve source from resolution', async () => {
            const overrideContext: TenantRequestContext = {
                ...mockTenantContext,
                source: 'override',
            };

            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(overrideContext);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockRequest.tenant?.source).toBe('override');
        });

        it('should preserve default source', async () => {
            const defaultContext: TenantRequestContext = {
                ...mockTenantContext,
                source: 'default',
                isDefault: toTenantDefaultFlag(true),
            };

            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(defaultContext);

            mockRequest.headers = { host: 'unknown.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockRequest.tenant?.source).toBe('default');
        });
    });
});
