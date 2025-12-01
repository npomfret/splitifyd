import { toTenantAppName, toTenantDomainName, toTenantFaviconUrl, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ErrorCode } from '../../../errors';
import { TenantRegistryService } from '../../../services/tenant/TenantRegistryService';
import { ApiError } from '../../../errors';
import { AppDriver } from '../AppDriver';

describe('TenantRegistryService', () => {
    let app: AppDriver;
    let service: TenantRegistryService;
    let adminUserId: string;

    beforeEach(async () => {
        app = new AppDriver();
        service = app.componentBuilder.buildTenantRegistryService();

        // Create an admin user for tenant management
        const adminReg = new UserRegistrationBuilder()
            .withEmail('admin@example.com')
            .withPassword('password123456')
            .withDisplayName('Admin User')
            .build();
        const adminResult = await app.registerUser(adminReg);
        adminUserId = adminResult.user.uid;

        // Promote to admin
        app.seedAdminUser(adminUserId);
    });

    afterEach(() => {
        app.dispose();
    });

    describe('resolveTenant - domain resolution', () => {
        it('should resolve tenant by domain', async () => {
            // Create tenant via API with domain
            const tenantData = AdminTenantRequestBuilder
                .forTenant('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test App'),
                    logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                })
                .withDomains([toTenantDomainName('app.example.com'), toTenantDomainName('example.com')])
                .build();

            await app.adminUpsertTenant(tenantData, adminUserId);

            const result = await service.resolveTenant({ host: 'app.example.com' });

            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
            expect(result.config.tenantId).toBe('test-tenant');
            expect(result.config.branding.appName).toBe('Test App');
        });

        it('should normalize host before lookup', async () => {
            // Create tenant via API with lowercase domain
            const tenantData = AdminTenantRequestBuilder
                .forTenant('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test App'),
                    logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                })
                .withDomains([toTenantDomainName('app.example.com')])
                .build();

            await app.adminUpsertTenant(tenantData, adminUserId);

            const result = await service.resolveTenant({ host: 'APP.EXAMPLE.COM:8080' });

            expect(result.tenantId).toBe('test-tenant');
        });

        it('should handle x-forwarded-host with multiple values', async () => {
            // Create tenant via API
            const tenantData = AdminTenantRequestBuilder
                .forTenant('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test App'),
                    logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                })
                .withDomains([toTenantDomainName('app.example.com')])
                .build();

            await app.adminUpsertTenant(tenantData, adminUserId);

            const result = await service.resolveTenant({ host: 'app.example.com, proxy.internal' });

            expect(result.tenantId).toBe('test-tenant');
        });
    });

    describe('resolveTenant - default tenant', () => {
        it('falls back to Firestore default tenant when domain not found', async () => {
            // Create a default tenant via API
            const tenantData = AdminTenantRequestBuilder
                .forTenant('default-tenant')
                .withBranding({
                    appName: toTenantAppName('Splitifyd'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                })
                .withDomains([toTenantDomainName('app.foo.com')])
                .asDefaultTenant()
                .build();

            await app.adminUpsertTenant(tenantData, adminUserId);

            const result = await service.resolveTenant({ host: 'unknown.example.com' });

            expect(result.tenantId).toBe('default-tenant');
            expect(result.source).toBe('default');
            expect(result.config.tenantId).toBe('default-tenant');
            expect(result.config.branding.appName).toBe('Splitifyd');
        });

        it('throws when no tenant can be resolved and no default exists', async () => {
            // No tenants created at all

            await expect(service.resolveTenant({ host: null })).rejects.toThrow(ApiError);
            await expect(service.resolveTenant({ host: null })).rejects.toMatchObject({
                statusCode: HTTP_STATUS.NOT_FOUND,
                code: ErrorCode.NOT_FOUND,
            });
        });
    });

    describe('resolution priority', () => {
        it('should prioritize domain over default fallback', async () => {
            // Create domain tenant and default tenant via API
            const testTenantData = AdminTenantRequestBuilder
                .forTenant('test-tenant')
                .withBranding({
                    appName: toTenantAppName('Test App'),
                    logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                })
                .withDomains([toTenantDomainName('app.example.com')])
                .build();

            const defaultTenantData = AdminTenantRequestBuilder
                .forTenant('default-tenant')
                .withBranding({
                    appName: toTenantAppName('Default App'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                })
                .withDomains([toTenantDomainName('default.com')])
                .asDefaultTenant()
                .build();

            await app.adminUpsertTenant(testTenantData, adminUserId);
            await app.adminUpsertTenant(defaultTenantData, adminUserId);

            const result = await service.resolveTenant({ host: 'app.example.com' });

            // Domain match should win over default
            expect(result.tenantId).toBe('test-tenant');
            expect(result.source).toBe('domain');
        });
    });
});
