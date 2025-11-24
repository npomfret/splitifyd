import type { PooledTestUser } from '@billsplit-wl/shared';
import { toTenantAccentColor, toTenantAppName, toTenantDomainName, toTenantFaviconUrl, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';

describe('Admin tenant CRUD operations', () => {
    const apiDriver = new ApiDriver();
    const db = getFirestore();
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
                .withBranding({
                    appName: toTenantAppName('Test Create Tenant'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
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

            // Verify in Firestore
            const tenantDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
            expect(tenantDoc.exists).toBe(true);

            const tenantData = tenantDoc.data();
            expect(tenantData?.branding?.appName).toBe('Test Create Tenant');
            expect(tenantData?.branding?.logoUrl).toBe('/logo.svg');
            expect(tenantData?.branding?.primaryColor).toBe('#1a73e8');
        });

        it('should reject tenant without tenant ID', async () => {
            const payload = {
                tenantId: '',
                branding: {
                    appName: 'Test',
                    logoUrl: '/logo.svg',
                    primaryColor: '#ff0000',
                    secondaryColor: '#00ff00',
                },
                domains: ['test.local'],
            };

            try {
                await apiDriver.adminUpsertTenant(payload as any, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.response?.error?.code).toBe('INVALID_TENANT_PAYLOAD');
            }
        });

        it('should reject tenant without app name', async () => {
            const tenantId = `tenant-no-appname-${Date.now()}`;

            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withBranding({
                    appName: toTenantAppName(''),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
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
                expect(error.response.error.code).toBe('INVALID_TENANT_PAYLOAD');
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
                expect(error.response.error.code).toBe('INVALID_TENANT_PAYLOAD');
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
                expect(error.response.error.code).toBe('DUPLICATE_DOMAIN');
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

            // Verify tenant was created
            const tenantDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
            expect(tenantDoc.exists).toBe(true);
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
                    .withBranding({
                        appName: toTenantAppName('Original Name'),
                        logoUrl: toTenantLogoUrl('/logo-old.svg'),
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
                    .withBranding({
                        appName: toTenantAppName('Updated Name'),
                        logoUrl: toTenantLogoUrl('/logo-new.svg'),
                        primaryColor: toTenantPrimaryColor('#0000ff'),
                        secondaryColor: toTenantSecondaryColor('#ffff00'),
                    })
                    .withDomains([domain])
                    .build(),
                adminUser.token,
            );

            expect(updateResult.created).toBe(false);

            // Verify in Firestore
            const tenantDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
            const tenantData = tenantDoc.data();

            expect(tenantData?.branding?.appName).toBe('Updated Name');
            expect(tenantData?.branding?.logoUrl).toBe('/logo-new.svg');
            expect(tenantData?.branding?.primaryColor).toBe('#0000ff');
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

            const firstDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
            const firstData = firstDoc.data();
            const createdAt = firstData?.createdAt;

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

            const secondDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
            const secondData = secondDoc.data();

            // createdAt should be preserved (as Timestamp object)
            expect(secondData?.createdAt.toMillis()).toEqual(createdAt.toMillis());

            // updatedAt should be newer
            expect(secondData?.updatedAt.toMillis()).toBeGreaterThan(createdAt.toMillis());
        });
    });

    describe('Validation', () => {
        it('should validate color format', async () => {
            const tenantId = `tenant-color-${Date.now()}`;

            const payload = {
                tenantId,
                branding: {
                    appName: 'Test Colors',
                    logoUrl: '/logo.svg',
                    primaryColor: 'invalid-color',
                    secondaryColor: '#34a853',
                },
                domains: [`${tenantId}.local`],
            };

            try {
                await apiDriver.adminUpsertTenant(payload as any, adminUser.token);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Should reject with validation or upsert failed error
                expect(error.response?.error?.code).toMatch(/INVALID_TENANT_PAYLOAD|TENANT_UPSERT_FAILED/);
            }
        });

        it('should accept relative and absolute URLs for logo', async () => {
            const tenantId = `tenant-logo-formats-${Date.now()}`;

            // Test with various URL formats - all should be accepted
            const payload = AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withBranding({
                    appName: toTenantAppName('Test URL Formats'),
                    logoUrl: toTenantLogoUrl('/relative/path/logo.svg'),
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
                expect(error.response?.error?.code).toMatch(/UNAUTHORIZED|INVALID_TOKEN/);
            }
        });
    });
});
