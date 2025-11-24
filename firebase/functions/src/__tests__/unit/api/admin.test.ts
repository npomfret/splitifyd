import { SystemUserRoles, toTenantAccentColor, toTenantAppName, toTenantDomainName, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor, toUserId } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Admin Tests', () => {
    let appDriver: AppDriver;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();
        const { admin } = await appDriver.createTestUsers({ count: 0, includeAdmin: true });
        adminUser = admin!;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('Admin Tenant Management', () => {
        let localAdminUser: string;

        beforeEach(async () => {
            const adminReg = new UserRegistrationBuilder()
                .withEmail('tenantadmin@example.com')
                .withDisplayName('Tenant Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            localAdminUser = adminResult.user.uid;
            appDriver.seedAdminUser(localAdminUser);
        });

        describe('POST /api/admin/tenants - adminUpsertTenant', () => {
            it('should reject invalid branding tokens schema', async () => {
                const invalidPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_invalid')
                    .withPaletteColor('primary', 'not-a-hex-color') // Invalid hex color
                    .build();

                await expect(appDriver.adminUpsertTenant(invalidPayload, localAdminUser)).rejects.toThrow();
            });

            it('should reject missing required fields', async () => {
                const invalidPayload = {
                    tenantId: 'tenant_missing_fields',
                    branding: {
                        appName: 'Test App',
                        // Missing required fields
                    },
                } as any;

                await expect(appDriver.adminUpsertTenant(invalidPayload, localAdminUser)).rejects.toThrow();
            });

            it('should reject duplicate domain across different tenants', async () => {
                // Create first tenant with a domain
                const firstTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_duplicate_test_1')
                    .withDomains([toTenantDomainName('duplicate-test.local')])
                    .build();

                const firstResult = await appDriver.adminUpsertTenant(firstTenant, localAdminUser);
                expect(firstResult.created).toBe(true);

                // Attempt to create second tenant with the same domain
                const secondTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_duplicate_test_2')
                    .withDomains([toTenantDomainName('duplicate-test.local')])
                    .build();

                // Should fail with appropriate error
                await expect(appDriver.adminUpsertTenant(secondTenant, localAdminUser))
                    .rejects
                    .toMatchObject({
                        code: 'DUPLICATE_DOMAIN',
                    });
            });

            it('should reject duplicate domain when one tenant has multiple domains', async () => {
                // Create first tenant with multiple domains
                const firstTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_multi_domain_1')
                    .withDomains([
                        toTenantDomainName('primary.test'),
                        toTenantDomainName('shared.test'),
                        toTenantDomainName('alias.test'),
                    ])
                    .build();

                const firstResult = await appDriver.adminUpsertTenant(firstTenant, localAdminUser);
                expect(firstResult.created).toBe(true);

                // Attempt to create second tenant with one of those domains
                const secondTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_multi_domain_2')
                    .withDomains([
                        toTenantDomainName('other.test'),
                        toTenantDomainName('shared.test'), // Conflicts with first tenant
                    ])
                    .build();

                // Should fail - 'shared.test' is already used by first tenant
                await expect(appDriver.adminUpsertTenant(secondTenant, localAdminUser))
                    .rejects
                    .toMatchObject({
                        code: 'DUPLICATE_DOMAIN',
                    });
            });

            it('should reject empty appName', async () => {
                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_empty_name')
                    .withAppName('')
                    .withDomains([toTenantDomainName('test.local')])
                    .build();

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'INVALID_TENANT_PAYLOAD' });
            });

            it('should reject tenant with no domains', async () => {
                const payload = {
                    tenantId: 'tenant_no_domains',
                    branding: {
                        appName: toTenantAppName('Test App'),
                        logoUrl: toTenantLogoUrl('https://example.com/logo.png'),
                        primaryColor: toTenantPrimaryColor('#ff0000'),
                        secondaryColor: toTenantSecondaryColor('#00ff00'),
                        accentColor: toTenantAccentColor('#0000ff'),
                    },
                    domains: [] as any,
                };

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'INVALID_TENANT_PAYLOAD' });
            });

            it('should create tenant with valid data and return created=true', async () => {
                const tenantId = `test-create-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Test Create App')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId,
                    created: true,
                });
            });

            it('should update existing tenant and return created=false', async () => {
                const tenantId = `test-update-${Date.now()}`;

                // Create tenant
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Original Name')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const createResult = await appDriver.adminUpsertTenant(createPayload, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update tenant
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Updated Name')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult).toMatchObject({
                    tenantId,
                    created: false,
                });
            });

            it('should allow updating tenant domains', async () => {
                const tenantId = `test-domain-update-${Date.now()}`;
                const originalDomain = `${tenantId}-original.test.local`;
                const newDomain = `${tenantId}-new.test.local`;

                // Create with original domain
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(originalDomain)])
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Update with new domain
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(newDomain)])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult.created).toBe(false);
            });

            it('should allow multiple domains for same tenant', async () => {
                const tenantId = `test-multi-domain-${Date.now()}`;
                const domains = [
                    toTenantDomainName(`${tenantId}-1.test.local`),
                    toTenantDomainName(`${tenantId}-2.test.local`),
                    toTenantDomainName(`${tenantId}-3.test.local`),
                ];

                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains(domains)
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);
            });

            it('should accept all valid branding colors', async () => {
                const tenantId = `test-colors-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withBranding({
                        appName: toTenantAppName('Color Test'),
                        logoUrl: toTenantLogoUrl('/logo.svg'),
                        primaryColor: toTenantPrimaryColor('#1a73e8'),
                        secondaryColor: toTenantSecondaryColor('#34a853'),
                        accentColor: toTenantAccentColor('#fbbc04'),
                    })
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);
            });

            it('should normalize and deduplicate domains', async () => {
                const tenantId = `test-normalize-${Date.now()}`;

                // Submit with port numbers and duplicates (should be normalized)
                const payload = {
                    tenantId,
                    branding: {
                        appName: toTenantAppName('Normalize Test'),
                        logoUrl: toTenantLogoUrl('/logo.svg'),
                        primaryColor: toTenantPrimaryColor('#ff0000'),
                        secondaryColor: toTenantSecondaryColor('#00ff00'),
                    },
                    domains: [
                        'example.com:8080',  // Should strip port
                        'EXAMPLE.COM',       // Should lowercase
                        'example.com',       // Duplicate after normalization
                    ] as any,
                };

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);
            });
        });

        describe('POST /api/admin/tenants/publish - publishTenantTheme', () => {
            it('should reject when tenant does not exist', async () => {
                await expect(appDriver.publishTenantTheme({ tenantId: 'unknown-tenant' }, adminUser))
                    .rejects
                    .toMatchObject({ code: 'TENANT_NOT_FOUND' });
            });
        });
    });

    describe('Admin User Management', () => {
        let regularUser: UserId;

        beforeEach(async () => {
            const regularUserReg = new UserRegistrationBuilder()
                .withEmail('regular@test.com')
                .withDisplayName('Regular User')
                .withPassword('password12345')
                .build();
            const regularUserResult = await appDriver.registerUser(regularUserReg);
            regularUser = toUserId(regularUserResult.user.uid);
        });

        describe('PUT /api/admin/users/:uid - updateUser (disable/enable)', () => {
            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.updateUser(toUserId(''), { disabled: true }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.updateUser(toUserId('nonexistent-user'), { disabled: true }, adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('PUT /api/admin/users/:uid/role - updateUserRole', () => {
            it('should reject invalid role value', async () => {
                await expect(
                    appDriver.updateUserRole(regularUser, { role: 'invalid_role' } as any, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.updateUserRole(toUserId(''), { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.updateUserRole(toUserId('nonexistent-user'), { role: SystemUserRoles.SYSTEM_ADMIN }, adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('GET /api/admin/users/:uid/auth - getUserAuth', () => {
            it('should return Firebase Auth user record with sensitive fields removed', async () => {
                const authData = await appDriver.getUserAuth(regularUser, adminUser);

                // Should contain expected Firebase Auth fields
                expect(authData).toHaveProperty('uid');
                expect(authData).toHaveProperty('email');
                expect(authData).toHaveProperty('displayName');
                expect(authData).toHaveProperty('emailVerified');
                expect(authData).toHaveProperty('disabled');
                expect(authData).toHaveProperty('metadata');

                // Should NOT contain sensitive fields
                expect(authData).not.toHaveProperty('passwordHash');
                expect(authData).not.toHaveProperty('passwordSalt');

                // Should have security note
                expect(authData).toHaveProperty('_note');
                expect(authData._note).toContain('passwordHash');
                expect(authData._note).toContain('passwordSalt');
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.getUserAuth(toUserId(''), adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.getUserAuth(toUserId('nonexistent-user'), adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });

        describe('GET /api/admin/users/:uid/firestore - getUserFirestore', () => {
            it('should return Firestore user document', async () => {
                const firestoreData = await appDriver.getUserFirestore(regularUser, adminUser);

                // Should contain expected Firestore fields (guaranteed to be present)
                expect(firestoreData).toHaveProperty('id');
                expect(firestoreData).toHaveProperty('role');
                expect(firestoreData).toHaveProperty('createdAt');
                expect(firestoreData).toHaveProperty('updatedAt');

                // Verify the id matches the requested user
                expect(firestoreData.id).toBe(regularUser);

                // Role should be valid
                expect(Object.values(SystemUserRoles)).toContain(firestoreData.role);

                // Should NOT contain Firebase Auth-only fields
                expect(firestoreData).not.toHaveProperty('disabled');
                expect(firestoreData).not.toHaveProperty('metadata');
                expect(firestoreData).not.toHaveProperty('passwordHash');
                expect(firestoreData).not.toHaveProperty('passwordSalt');
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.getUserFirestore(toUserId(''), adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.getUserFirestore(toUserId('nonexistent-user'), adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });
    });
});
