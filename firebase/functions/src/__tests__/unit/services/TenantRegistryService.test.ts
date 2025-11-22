import { TenantConfigBuilder, TenantFirestoreTestDatabase } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreReader } from '../../../services/firestore';
import { TenantRegistryService, type TenantResolutionOptions } from '../../../services/tenant/TenantRegistryService';
import { ApiError } from '../../../utils/errors';

describe('TenantRegistryService', () => {
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;
    let service: TenantRegistryService;

    const testTenantBuilder = new TenantConfigBuilder()
        .withTenantId('test-tenant')
        .withAppName('Test App')
        .withLogoUrl('https://example.com/logo.svg')
        .withFaviconUrl('https://example.com/favicon.ico')
        .withPrimaryColor('#0066CC')
        .withSecondaryColor('#FF6600')
        .withCreatedAt('2025-01-15T10:00:00.000Z')
        .withUpdatedAt('2025-01-20T14:30:00.000Z');

    const defaultTenantBuilder = new TenantConfigBuilder()
        .withTenantId('default-tenant')
        .withAppName('Splitifyd')
        .withLogoUrl('/logo.svg')
        .withFaviconUrl('/favicon.ico')
        .withPrimaryColor('#1a73e8')
        .withSecondaryColor('#34a853')
        .withCreatedAt('2025-01-01T00:00:00.000Z')
        .withUpdatedAt('2025-01-01T00:00:00.000Z');

    beforeEach(() => {
        db = new TenantFirestoreTestDatabase();
        firestoreReader = new FirestoreReader(db);
        service = new TenantRegistryService(firestoreReader, 5000); // 5s cache for testing
    });

    describe('resolveTenant - override mode', () => {
        it('should resolve tenant by override header when allowed', async () => {
            // Seed tenant in database
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['app.example.com', 'example.com'],
                defaultTenant: false,
                createdAt: '2025-01-15T10:00:00.000Z',
                updatedAt: '2025-01-20T14:30:00.000Z',
            });

            const options: TenantResolutionOptions = {
                host: 'localhost:3000',
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('override');
            expect(result.config.tenantId).toBe('test-tenant');
            expect(result.config.branding.appName).toBe('Test App');
        });

        it('should throw FORBIDDEN when override is not allowed', async () => {
            const options: TenantResolutionOptions = {
                host: 'localhost:3000',
                overrideTenantId: 'test-tenant',
                allowOverride: false,
            };

            await expect(service.resolveTenant(options)).rejects.toThrow(ApiError);
            await expect(service.resolveTenant(options)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                code: 'TENANT_OVERRIDE_NOT_ALLOWED',
            });
        });

        it('should throw NOT_FOUND when override tenant does not exist', async () => {
            // No tenant seeded - it doesn't exist

            const options: TenantResolutionOptions = {
                host: 'localhost:3000',
                overrideTenantId: 'nonexistent',
                allowOverride: true,
            };

            await expect(service.resolveTenant(options)).rejects.toThrow(ApiError);
            await expect(service.resolveTenant(options)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.NOT_FOUND,
                code: 'TENANT_OVERRIDE_NOT_FOUND',
            });
        });
    });

    describe('resolveTenant - domain resolution', () => {
        it('should resolve tenant by domain', async () => {
            // Seed tenant in database with domain
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['app.example.com', 'example.com'],
                defaultTenant: false,
            });

            const options: TenantResolutionOptions = {
                host: 'app.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
            expect(result.config.tenantId).toBe('test-tenant');
            expect(result.config.branding.appName).toBe('Test App');
        });

        it('should normalize host before lookup', async () => {
            // Seed tenant in database with lowercase domain
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['app.example.com'],
                defaultTenant: false,
            });

            const options: TenantResolutionOptions = {
                host: 'APP.EXAMPLE.COM:8080',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
        });

        it('should handle x-forwarded-host with multiple values', async () => {
            // Seed tenant in database
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['app.example.com'],
                defaultTenant: false,
            });

            const options: TenantResolutionOptions = {
                host: 'app.example.com, proxy.internal',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
        });
    });

    describe('resolveTenant - default tenant', () => {
        it('falls back to Firestore default tenant when domain not found', async () => {
            // Seed a default tenant
            db.seedTenantDocument('default-tenant', {
                branding: {
                    appName: 'Splitifyd',
                    logoUrl: '/logo.svg',
                    faviconUrl: '/favicon.ico',
                    primaryColor: '#1a73e8',
                    secondaryColor: '#34a853',
                },
                domains: ['app.foo.com'],
                defaultTenant: true,
            });

            const options: TenantResolutionOptions = {
                host: 'unknown.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('default-tenant');
            expect(result.source).toBe('default');
            expect(result.config.tenantId).toBe('default-tenant');
            expect(result.config.branding.appName).toBe('Splitifyd');
        });

        it('throws when no tenant can be resolved and no default exists', async () => {
            // No tenants seeded at all

            const options: TenantResolutionOptions = {
                host: null,
                overrideTenantId: null,
                allowOverride: false,
            };

            await expect(service.resolveTenant(options)).rejects.toThrow(ApiError);
            await expect(service.resolveTenant(options)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.NOT_FOUND,
                code: 'TENANT_NOT_FOUND',
            });
        });
    });

    describe('resolution priority', () => {
        it('should prioritize override over domain', async () => {
            // Seed both tenants
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['test.example.com'], // At least one domain required
                defaultTenant: false,
            });
            db.seedTenantDocument('domain-tenant', {
                branding: {
                    appName: 'Domain App',
                    logoUrl: 'https://foo.com/logo.svg',
                    faviconUrl: 'https://foo.com/favicon.ico',
                    primaryColor: '#1a73e8',
                    secondaryColor: '#34a853',
                },
                domains: ['app.foo.com'],
                defaultTenant: false,
            });

            const options: TenantResolutionOptions = {
                host: 'app.foo.com',
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            const result = await service.resolveTenant(options);

            // Override should win
            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('override');
        });

        it('should prioritize domain over default fallback', async () => {
            // Seed domain tenant and default tenant
            db.seedTenantDocument('test-tenant', {
                branding: {
                    appName: 'Test App',
                    logoUrl: 'https://example.com/logo.svg',
                    faviconUrl: 'https://example.com/favicon.ico',
                    primaryColor: '#0066CC',
                    secondaryColor: '#FF6600',
                },
                domains: ['app.example.com'],
                defaultTenant: false,
            });
            db.seedTenantDocument('default-tenant', {
                branding: {
                    appName: 'Default App',
                    logoUrl: '/logo.svg',
                    faviconUrl: '/favicon.ico',
                    primaryColor: '#1a73e8',
                    secondaryColor: '#34a853',
                },
                domains: ['default.com'],
                defaultTenant: true,
            });

            const options: TenantResolutionOptions = {
                host: 'app.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            // Domain match should win over default
            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
        });
    });
});
