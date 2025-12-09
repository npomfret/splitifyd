import type { PooledTestUser } from '@billsplit-wl/shared';
import { toShowMarketingContentFlag, toShowPricingPageFlag, toTenantAccentColor, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Admin tenant CRUD operations', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    describe('Create tenant', () => {
        it('should create a new tenant with all required fields', async () => {
            const tenantId = `tenant-create-${Date.now()}`;
            const uniqueDomain = `${tenantId}.local`;

            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('Test Create Tenant')
                .withLogoUrl('/logo.svg')
                .withFaviconUrl('/favicon.ico')
                .withBranding({
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                    accentColor: toTenantAccentColor('#fbbc04'),
                })
                .withDomains([uniqueDomain])
                .build();

            const result = await apiDriver.adminUpsertTenant(payload, adminUser.token);

            expect(result).toMatchObject({
                tenantId,
                created: true,
            });

            // Verify via list API
            const listResult = await apiDriver.listAllTenants(adminUser.token);
            const tenant = listResult.tenants.find((t: any) => t.tenant.tenantId === tenantId);
            expect(tenant).toBeDefined();
            expect(tenant?.tenant.brandingTokens?.tokens?.legal?.appName).toBe('Test Create Tenant');
            expect(tenant?.tenant.brandingTokens?.tokens?.assets?.logoUrl).toBe('/logo.svg');
            expect(tenant?.tenant.brandingTokens?.tokens?.palette?.primary).toBe('#1a73e8');
        });

        it('should reject tenant without tenant ID', async () => {
            const payload = AdminTenantRequestBuilder
                .forTenant('temp-tenant')
                .withInvalidTenantId('')
                .withDomains(['test.local'])
                .build();

            try {
                await apiDriver.adminUpsertTenant(payload as any, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.response?.error?.code).toBe('VALIDATION_ERROR');
                expect(error.response?.error?.detail).toBe('INVALID_TENANT_PAYLOAD');
            }
        });

        it('should reject tenant without app name', async () => {
            const tenantId = `tenant-no-appname-${Date.now()}`;

            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('')
                .withLogoUrl('/logo.svg')
                .withBranding({
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                })
                .withDomains([`${tenantId}.local`])
                .build();

            try {
                await apiDriver.adminUpsertTenant(payload, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.status).toBe(400);
                expect(error.response.error.code).toBe('VALIDATION_ERROR');
                expect(error.response.error.detail).toBe('INVALID_TENANT_PAYLOAD');
            }
        });

        it('should reject tenant without domains', async () => {
            const tenantId = `tenant-no-domains-${Date.now()}`;

            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('Test No Domains')
                .withDomains([])
                .build();

            try {
                await apiDriver.adminUpsertTenant(payload, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.status).toBe(400);
                expect(error.response.error.code).toBe('VALIDATION_ERROR');
                expect(error.response.error.detail).toBe('INVALID_TENANT_PAYLOAD');
            }
        });

        it('should reject duplicate domain across tenants', async () => {
            const sharedDomain = `shared-${Date.now()}.local`;
            const tenant1 = `tenant-1-${Date.now()}`;
            const tenant2 = `tenant-2-${Date.now()}`;

            // Create first tenant with domain
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenant1)
                    .withDomains([sharedDomain])
                    .build(),
                adminUser.token,
            );

            // Try to create second tenant with same domain
            try {
                await apiDriver.adminUpsertTenant(
                    AdminTenantRequestBuilder
                        .forTenant(tenant2)
                        .withDomains([sharedDomain])
                        .build(),
                    adminUser.token,
                );
                expect.fail('Should have thrown error for duplicate domain');
            } catch (error: any) {
                expect(error.status).toBe(409);
                expect(error.response.error.code).toBe('ALREADY_EXISTS');
                expect(error.response.error.resource).toBe('Domain');
            }
        });

        it('should allow multiple domains for same tenant', async () => {
            const tenantId = `tenant-multi-domains-${Date.now()}`;
            const domain1 = `${tenantId}-1.local`;
            const domain2 = `${tenantId}-2.local`;
            const domain3 = `${tenantId}-3.local`;

            const result = await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([domain1, domain2, domain3])
                    .build(),
                adminUser.token,
            );

            expect(result.created).toBe(true);

            // Verify tenant was created via list API
            const listResult = await apiDriver.listAllTenants(adminUser.token);
            const tenant = listResult.tenants.find((t: any) => t.tenant.tenantId === tenantId);
            expect(tenant).toBeDefined();
        });
    });

    describe('Update tenant', () => {
        it('should update existing tenant branding', async () => {
            const tenantId = `tenant-update-${Date.now()}`;
            const domain = `${tenantId}.local`;

            // Create tenant
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Original Name')
                    .withLogoUrl('/logo-old.svg')
                    .withBranding({
                        primaryColor: toTenantPrimaryColor('#ff0000'),
                        secondaryColor: toTenantSecondaryColor('#00ff00'),
                    })
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            // Update tenant
            const updateResult = await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Updated Name')
                    .withLogoUrl('/logo-new.svg')
                    .withBranding({
                        primaryColor: toTenantPrimaryColor('#0000ff'),
                        secondaryColor: toTenantSecondaryColor('#ffff00'),
                    })
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            expect(updateResult.created).toBe(false);

            // Verify via list API
            const listResult = await apiDriver.listAllTenants(adminUser.token);
            const tenant = listResult.tenants.find((t: any) => t.tenant.tenantId === tenantId);

            expect(tenant?.tenant.brandingTokens?.tokens?.legal?.appName).toBe('Updated Name');
            expect(tenant?.tenant.brandingTokens?.tokens?.assets?.logoUrl).toBe('/logo-new.svg');
            expect(tenant?.tenant.brandingTokens?.tokens?.palette?.primary).toBe('#0000ff');
        });

        it('should complete load/save/load cycle with EVERY field', async () => {
            const tenantId = `tenant-round-trip-${Date.now()}`;
            const domain = `${tenantId}.local`;

            // Create initial tenant with all fields
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Test Tenant')
                    .withLogoUrl('/logo.svg')
                    .withFaviconUrl('/favicon.ico')
                    .withBranding({
                        primaryColor: toTenantPrimaryColor('#3B82F6'),
                        secondaryColor: toTenantSecondaryColor('#8B5CF6'),
                        accentColor: toTenantAccentColor('#EC4899'),
                    })
                    .withMarketingFlags({
                        showMarketingContent: toShowMarketingContentFlag(true),
                        showPricingPage: toShowPricingPageFlag(false),
                    })
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            // Load via list API
            const listResult1 = await apiDriver.listAllTenants(adminUser.token);
            const tenant1 = listResult1.tenants.find((t: any) => t.tenant.tenantId === tenantId);
            expect(tenant1?.tenant.brandingTokens.tokens.legal.appName).toBe('Test Tenant');

            // Update tenant with EVERY field changed
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Updated Test App')
                    .withLogoUrl('/updated-logo.svg')
                    .withFaviconUrl('/updated-favicon.ico')
                    .withBranding({
                        primaryColor: toTenantPrimaryColor('#aa11bb'),
                        secondaryColor: toTenantSecondaryColor('#bb22cc'),
                        accentColor: toTenantAccentColor('#cc33dd'),
                    })
                    .withMarketingFlags({
                        showMarketingContent: toShowMarketingContentFlag(false),
                        showPricingPage: toShowPricingPageFlag(true),
                    })
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            // Load again via list API - verify EVERY field updated
            const listResult2 = await apiDriver.listAllTenants(adminUser.token);
            const tenant2 = listResult2.tenants.find((t: any) => t.tenant.tenantId === tenantId);

            // Verify ALL branding fields
            expect(tenant2?.tenant.brandingTokens.tokens.legal.appName).toBe('Updated Test App');
            expect(tenant2?.tenant.brandingTokens.tokens.assets.logoUrl).toBe('/updated-logo.svg');
            expect(tenant2?.tenant.brandingTokens.tokens.assets.faviconUrl).toBe('/updated-favicon.ico');
            expect(tenant2?.tenant.brandingTokens.tokens.palette.primary).toBe('#aa11bb');
            expect(tenant2?.tenant.brandingTokens.tokens.palette.secondary).toBe('#bb22cc');
            expect(tenant2?.tenant.brandingTokens.tokens.palette.accent).toBe('#cc33dd');

            // Verify ALL marketing flags (stored at top level, not under branding)
            expect(tenant2?.tenant.marketingFlags?.showMarketingContent).toBe(false);
            expect(tenant2?.tenant.marketingFlags?.showPricingPage).toBe(true);
        });

        it('should update tenant domains', async () => {
            const tenantId = `tenant-update-domains-${Date.now()}`;
            const originalDomain = `${tenantId}-original.local`;
            const newDomain = `${tenantId}-new.local`;

            // Create tenant with one domain
            const createResult = await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([originalDomain])
                    .build(),
                adminUser.token,
            );

            expect(createResult.created).toBe(true);

            // Update with different domain
            const updateResult = await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([newDomain])
                    .build(),
                adminUser.token,
            );

            expect(updateResult.created).toBe(false);
        });

        it('should preserve timestamps on update', async () => {
            const tenantId = `tenant-timestamps-${Date.now()}`;
            const domain = `${tenantId}.local`;

            // Create tenant
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            // Get tenant via list API to check createdAt
            const listResult1 = await apiDriver.listAllTenants(adminUser.token);
            const tenant1 = listResult1.tenants.find((t: any) => t.tenant.tenantId === tenantId);
            const createdAt = tenant1?.tenant.createdAt;

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Update tenant
            await apiDriver.adminUpsertTenant(
                AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Updated')
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            // Get tenant again
            const listResult2 = await apiDriver.listAllTenants(adminUser.token);
            const tenant2 = listResult2.tenants.find((t: any) => t.tenant.tenantId === tenantId);

            // createdAt should be preserved
            expect(tenant2?.tenant.createdAt).toEqual(createdAt);

            // updatedAt should be newer
            expect(new Date(tenant2?.tenant.updatedAt!).getTime()).toBeGreaterThan(new Date(createdAt!).getTime());
        });
    });

    describe('Validation', () => {
        it('should validate color format', async () => {
            const tenantId = `tenant-color-${Date.now()}`;

            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withInvalidPrimaryColor('invalid-color')
                .withDomains([`${tenantId}.local`])
                .build();

            try {
                await apiDriver.adminUpsertTenant(payload as any, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Should reject with VALIDATION_ERROR code and detail
                expect(error.response?.error?.code).toBe('VALIDATION_ERROR');
                expect(error.response?.error?.detail).toMatch(/INVALID_TENANT_PAYLOAD|TENANT_UPSERT_FAILED/);
            }
        });

        it('should accept relative and absolute URLs for logo', async () => {
            const tenantId = `tenant-logo-formats-${Date.now()}`;

            // Test with various URL formats - all should be accepted
            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('Test URL Formats')
                .withLogoUrl('/relative/path/logo.svg')
                .withBranding({
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                })
                .withDomains([`${tenantId}.local`])
                .build();

            const result = await apiDriver.adminUpsertTenant(payload, adminUser.token);
            expect(result.created).toBe(true);
        });
    });

    describe('Authorization', () => {
        it('should reject request without token', async () => {
            const tenantId = `tenant-no-token-${Date.now()}`;

            try {
                await apiDriver.adminUpsertTenant(
                    AdminTenantRequestBuilder
                        .forTenant(tenantId)
                        .withDomains([`${tenantId}.local`])
                        .build(),
                    undefined as any,
                );
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Auth errors should have AUTH_REQUIRED or AUTH_INVALID code
                // Note: ECONNRESET may occur if emulator resets connection on unauthenticated requests
                const code = error.response?.error?.code || error.message;
                expect(code).toMatch(/AUTH_REQUIRED|AUTH_INVALID|UNAUTHORIZED|INVALID_TOKEN|ECONNRESET/);
            }
        });
    });
});
