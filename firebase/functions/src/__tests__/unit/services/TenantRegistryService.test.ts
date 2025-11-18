import {
    type TenantConfig,
    toISOString,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@splitifyd/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import type { TenantRegistryRecord } from '../../../services/firestore';
import type { IFirestoreReader } from '../../../services/firestore';
import { TenantRegistryService, type TenantResolutionOptions } from '../../../services/tenant/TenantRegistryService';
import { ApiError } from '../../../utils/errors';

describe('TenantRegistryService', () => {
    let mockFirestoreReader: IFirestoreReader;
    let service: TenantRegistryService;

    const mockTenantConfig: TenantConfig = {
        tenantId: toTenantId('test-tenant'),
        branding: {
            appName: toTenantAppName('Test App'),
            logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
            faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor('#0066CC'),
            secondaryColor: toTenantSecondaryColor('#FF6600'),
        },
        createdAt: toISOString('2025-01-15T10:00:00.000Z'),
        updatedAt: toISOString('2025-01-20T14:30:00.000Z'),
    };

    const mockTenantRecord: TenantRegistryRecord = {
        tenant: mockTenantConfig,
        primaryDomain: toTenantDomainName('app.example.com'),
        domains: [toTenantDomainName('app.example.com'), toTenantDomainName('example.com')],
        isDefault: toTenantDefaultFlag(false),
    };

    const defaultTenantConfig: TenantConfig = {
        tenantId: toTenantId('default-tenant'),
        branding: {
            appName: toTenantAppName('Splitifyd'),
            logoUrl: toTenantLogoUrl('/logo.svg'),
            faviconUrl: toTenantFaviconUrl('/favicon.ico'),
            primaryColor: toTenantPrimaryColor('#1a73e8'),
            secondaryColor: toTenantSecondaryColor('#34a853'),
        },
        createdAt: toISOString('2025-01-01T00:00:00.000Z'),
        updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
    };

    const defaultTenantRecord: TenantRegistryRecord = {
        tenant: defaultTenantConfig,
        primaryDomain: toTenantDomainName('app.splitifyd.com'),
        domains: [toTenantDomainName('app.splitifyd.com')],
        isDefault: toTenantDefaultFlag(true),
    };

    beforeEach(() => {
        mockFirestoreReader = {
            getTenantById: vi.fn(),
            getTenantByDomain: vi.fn(),
            getDefaultTenant: vi.fn(),
        } as unknown as IFirestoreReader;

        service = new TenantRegistryService(mockFirestoreReader, 5000); // 5s cache for testing
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('resolveTenant - override mode', () => {
        it('should resolve tenant by override header when allowed', async () => {
            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'localhost:3000',
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('override');
            expect(result.config).toEqual(mockTenantConfig);
            expect(mockFirestoreReader.getTenantById).toHaveBeenCalledWith(toTenantId('test-tenant'));
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
            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(null);

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
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'app.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
            expect(result.config).toEqual(mockTenantConfig);
            expect(mockFirestoreReader.getTenantByDomain).toHaveBeenCalledWith(toTenantDomainName('app.example.com'));
        });

        it('should normalize host before lookup', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'APP.EXAMPLE.COM:8080',
                overrideTenantId: null,
                allowOverride: false,
            };

            await service.resolveTenant(options);

            expect(mockFirestoreReader.getTenantByDomain).toHaveBeenCalledWith(toTenantDomainName('app.example.com'));
        });

        it('should handle x-forwarded-host with multiple values', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'app.example.com, proxy.internal',
                overrideTenantId: null,
                allowOverride: false,
            };

            await service.resolveTenant(options);

            expect(mockFirestoreReader.getTenantByDomain).toHaveBeenCalledWith(toTenantDomainName('app.example.com'));
        });
    });

    describe('resolveTenant - default tenant', () => {
        it('falls back to Firestore default tenant when domain not found', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(null);
            vi.mocked(mockFirestoreReader.getDefaultTenant).mockResolvedValue(defaultTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'unknown.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('default-tenant');
            expect(result.source).toBe('default');
            expect(result.config).toEqual(defaultTenantConfig);
            expect(mockFirestoreReader.getDefaultTenant).toHaveBeenCalled();
        });

        it('throws when no tenant can be resolved and no default exists', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(null);
            vi.mocked(mockFirestoreReader.getDefaultTenant).mockResolvedValue(null);

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

    describe('caching behavior', () => {
        it('should cache tenant lookups by ID', async () => {
            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: null,
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            await service.resolveTenant(options);
            await service.resolveTenant(options);
            await service.resolveTenant(options);

            expect(mockFirestoreReader.getTenantById).toHaveBeenCalledTimes(1);
        });

        it('should cache tenant lookups by domain', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'app.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            await service.resolveTenant(options);
            await service.resolveTenant(options);
            await service.resolveTenant(options);

            expect(mockFirestoreReader.getTenantByDomain).toHaveBeenCalledTimes(1);
        });

        it('should cache default tenant lookups', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(null);
            vi.mocked(mockFirestoreReader.getDefaultTenant).mockResolvedValue(defaultTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'unknown1.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            await service.resolveTenant(options);

            const options2: TenantResolutionOptions = {
                host: 'unknown2.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            await service.resolveTenant(options2);

            expect(mockFirestoreReader.getDefaultTenant).toHaveBeenCalledTimes(1);
        });

        it('should expire cache entries after TTL', async () => {
            const shortCacheService = new TenantRegistryService(mockFirestoreReader, 50); // 50ms cache

            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: null,
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            await shortCacheService.resolveTenant(options);

            // Wait for cache to expire
            await new Promise((resolve) => setTimeout(resolve, 100));

            await shortCacheService.resolveTenant(options);

            expect(mockFirestoreReader.getTenantById).toHaveBeenCalledTimes(2);
        });

        it('should clear all cache when clearCache is called', async () => {
            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(mockTenantRecord);

            const options: TenantResolutionOptions = {
                host: null,
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            await service.resolveTenant(options);

            service.clearCache();

            await service.resolveTenant(options);

            expect(mockFirestoreReader.getTenantById).toHaveBeenCalledTimes(2);
        });
    });

    describe('resolution priority', () => {
        it('should prioritize override over domain', async () => {
            vi.mocked(mockFirestoreReader.getTenantById).mockResolvedValue(mockTenantRecord);
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(defaultTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'app.splitifyd.com',
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('override');
            expect(mockFirestoreReader.getTenantById).toHaveBeenCalled();
            expect(mockFirestoreReader.getTenantByDomain).not.toHaveBeenCalled();
        });

        it('should prioritize domain over default fallback', async () => {
            vi.mocked(mockFirestoreReader.getTenantByDomain).mockResolvedValue(mockTenantRecord);
            vi.mocked(mockFirestoreReader.getDefaultTenant).mockResolvedValue(defaultTenantRecord);

            const options: TenantResolutionOptions = {
                host: 'app.example.com',
                overrideTenantId: null,
                allowOverride: false,
            };

            const result = await service.resolveTenant(options);

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
            expect(mockFirestoreReader.getTenantByDomain).toHaveBeenCalled();
            expect(mockFirestoreReader.getDefaultTenant).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should propagate Firestore errors', async () => {
            const firestoreError = new Error('Firestore connection failed');
            vi.mocked(mockFirestoreReader.getTenantById).mockRejectedValue(firestoreError);

            const options: TenantResolutionOptions = {
                host: null,
                overrideTenantId: 'test-tenant',
                allowOverride: true,
            };

            await expect(service.resolveTenant(options)).rejects.toThrow('Firestore connection failed');
        });
    });
});
