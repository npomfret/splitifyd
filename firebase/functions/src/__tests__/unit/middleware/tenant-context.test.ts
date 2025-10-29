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
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { tenantContextMiddleware, type TenantContextConfig } from '../../../middleware/tenant-context';
import { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import type { TenantRequestContext } from '../../../types/tenant';
import { ApiError } from '../../../utils/errors';

describe('tenantContextMiddleware', () => {
    let mockTenantRegistry: TenantRegistryService;
    let mockConfig: TenantContextConfig;
    let mockRequest: Partial<express.Request>;
    let mockResponse: Partial<express.Response>;
    let nextFunction: ReturnType<typeof vi.fn>;

    const mockTenantContext: TenantRequestContext = {
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
                maxGroupsPerUser: toTenantMaxGroupsPerUser(10),
                maxUsersPerGroup: toTenantMaxUsersPerGroup(20),
            },
            createdAt: toISOString('2025-01-15T10:00:00.000Z'),
            updatedAt: toISOString('2025-01-20T14:30:00.000Z'),
        } as TenantConfig,
        primaryDomain: toTenantDomainName('app.example.com'),
        domains: [toTenantDomainName('app.example.com')],
        isDefault: toTenantDefaultFlag(false),
        source: 'domain',
    };

    beforeEach(() => {
        mockTenantRegistry = {
            resolveTenant: vi.fn(),
        } as unknown as TenantRegistryService;

        mockConfig = {
            allowOverrideHeader: vi.fn().mockReturnValue(true),
            allowDefaultFallback: vi.fn().mockReturnValue(true),
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

        it('should pass allowDefaultFallback from config', async () => {
            vi.mocked(mockTenantRegistry.resolveTenant).mockResolvedValue(mockTenantContext);
            vi.mocked(mockConfig.allowDefaultFallback).mockReturnValue(false);

            mockRequest.headers = { host: 'app.example.com' };

            const middleware = tenantContextMiddleware(mockTenantRegistry, mockConfig);
            await middleware(mockRequest as express.Request, mockResponse as express.Response, nextFunction);

            expect(mockTenantRegistry.resolveTenant).toHaveBeenCalledWith(
                expect.objectContaining({
                    allowDefaultFallback: false,
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
            const error = new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Tenant not found');
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
