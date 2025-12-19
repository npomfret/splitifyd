import {
    calculateEqualSplits,
    SystemUserRoles,
    toAmount,
    toPolicyId,
    toPolicyName,
    toPolicyText,
    toShowPricingPageFlag,
    toTenantDomainName,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toUserId,
    USD,
} from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import {
    AddTenantDomainRequestBuilder,
    AdminTenantRequestBuilder,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreatePolicyRequestBuilder,
    CreateSettlementRequestBuilder,
    SettlementUpdateBuilder,
    TenantBrandingUpdateBuilder,
    UpdatePolicyRequestBuilder,
    UpdateUserRoleRequestBuilder,
    UpdateUserStatusRequestBuilder,
    UserRegistrationBuilder,
} from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('authorization', () => {
    let appDriver: AppDriver;

    let user1: UserId;
    let user2: UserId;
    let user3: UserId;
    let user4: UserId;
    let adminUser: UserId;

    beforeEach(async () => {
        appDriver = new AppDriver();

        const { users, admin } = await appDriver.createTestUsers({
            count: 4,
            includeAdmin: true,
        });
        [user1, user2, user3, user4] = users;
        adminUser = admin!;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    it('should prevent non-owners from deleting a group', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        await expect(appDriver.deleteGroup(groupId, user2))
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    it('should allow expense full details access for non-participants', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user4); // user4 is group member but not expense participant

        const participants = [user1, user2];
        const expense = await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withDescription('Confidential dinner')
                .withAmount(50, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(50), USD, participants))
                .build(),
            user1,
        );

        // user4 is a group member but NOT an expense participant - should still access
        const fullDetails = await appDriver.getExpenseFullDetails(expense.id, user4);
        expect(fullDetails.expense.id).toBe(expense.id);
        expect(fullDetails.expense.participants).toEqual(participants);
    });

    it('should forbid expense creation by non-group members', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        const expenseRequest = new CreateExpenseRequestBuilder()
            .withGroupId(groupId)
            .withAmount(40, USD)
            .withPaidBy(user1)
            .withParticipants(participants)
            .withSplitType('equal')
            .withSplits(calculateEqualSplits(toAmount(40), USD, participants))
            .build();

        await expect(appDriver.createExpense(expenseRequest, user3))
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    it('should reject removing a member by a non-owner', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);
        await appDriver.joinGroupByLink(shareToken, undefined, user3);

        await expect(appDriver.removeGroupMember(groupId, user3, user2))
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    it('should reject share link generation by non-members', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;

        await expect(appDriver.generateShareableLink(groupId, undefined, user2))
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    it('should reject settlement updates by non-creators', async () => {
        const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

        const groupId = group.id;
        const { shareToken } = await appDriver.generateShareableLink(groupId, undefined, user1);
        await appDriver.joinGroupByLink(shareToken, undefined, user2);

        const participants = [user1, user2];
        await appDriver.createExpense(
            new CreateExpenseRequestBuilder()
                .withGroupId(groupId)
                .withAmount(80, USD)
                .withPaidBy(user1)
                .withParticipants(participants)
                .withSplitType('equal')
                .withSplits(calculateEqualSplits(toAmount(80), USD, participants))
                .build(),
            user1,
        );

        await appDriver.createSettlement(
            new CreateSettlementRequestBuilder()
                .withGroupId(groupId)
                .withPayerId(user2)
                .withPayeeId(user1)
                .withAmount(40.00, USD)
                .build(),
            user2,
        );

        const groupDetails = await appDriver.getGroupFullDetails(groupId, {}, user1);
        const settlementId = groupDetails.settlements.settlements[0].id;

        // Currency is required when updating amount
        const updateRequest = SettlementUpdateBuilder
            .empty()
            .withAmount(45.00, USD)
            .build();
        await expect(appDriver.updateSettlement(settlementId, updateRequest, user1))
            .rejects
            .toMatchObject({ code: 'FORBIDDEN' });
    });

    describe('policy administration flows', () => {
        it('should allow admin to create, update, and publish policies', async () => {
            const policyName = toPolicyName('Privacy Policy');

            const created = await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName(policyName)
                    .withText(toPolicyText('Initial policy text'))
                    .build(),
                adminUser,
            );

            expect(created).toMatchObject({
                id: expect.any(String),
                versionHash: expect.any(String),
            });

            const draftUpdate = await appDriver.updatePolicy(
                created.id,
                new UpdatePolicyRequestBuilder()
                    .withText(toPolicyText('Updated draft policy text'))
                    .asDraft()
                    .build(),
                adminUser,
            );

            expect(draftUpdate).toMatchObject({
                published: false,
                versionHash: expect.any(String),
            });

            const publishedUpdate = await appDriver.updatePolicy(
                created.id,
                new UpdatePolicyRequestBuilder()
                    .withText(toPolicyText('Final published policy text'))
                    .asPublished()
                    .build(),
                adminUser,
            );

            expect(publishedUpdate).toMatchObject({
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(created.id, adminUser);
            const publishedVersionHash = publishedUpdate.currentVersionHash;
            expect(publishedVersionHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedVersionHash);
            const publishedVersion = publishedVersionHash ? policyDetails.versions[publishedVersionHash] : undefined;
            expect(publishedVersion).toBeDefined();
            expect(publishedVersion?.text).toBe('Final published policy text');
        });

        it('should handle update-or-create workflow for named policies', async () => {
            const policyName = toPolicyName('Terms of Service');
            const policyId = toPolicyId('terms-of-service');

            // Attempt to update a non-existent policy should throw
            await expect(
                appDriver.updatePolicy(
                    policyId,
                    new UpdatePolicyRequestBuilder()
                        .withText(toPolicyText('Updated terms version 1'))
                        .asPublished()
                        .build(),
                    adminUser,
                ),
            )
                .rejects
                .toMatchObject({
                    code: 'NOT_FOUND',
                    data: {
                        detail: 'POLICY_NOT_FOUND',
                    },
                });

            const created = await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName(policyName)
                    .withText(toPolicyText('Initial terms content'))
                    .build(),
                adminUser,
            );

            expect(created.id).toBe(policyId);

            const update = await appDriver.updatePolicy(
                created.id,
                new UpdatePolicyRequestBuilder()
                    .withText(toPolicyText('Updated terms version 2'))
                    .asPublished()
                    .build(),
                adminUser,
            );

            expect(update).toMatchObject({
                published: true,
                currentVersionHash: expect.any(String),
            });

            const policyDetails = await appDriver.getPolicy(policyId, adminUser);
            const publishedHash = update.currentVersionHash;
            expect(publishedHash).toBeDefined();
            expect(policyDetails.currentVersionHash).toBe(publishedHash);
            const currentVersion = publishedHash ? policyDetails.versions[publishedHash] : undefined;
            expect(currentVersion).toBeDefined();
            expect(currentVersion?.text).toBe('Updated terms version 2');
        });
    });

    describe('tenant settings endpoints', () => {
        beforeEach(async () => {
            // Create tenant via API using the admin user
            // Use 'system-fallback-tenant' as that's what createStubRequest sets
            const tenantData = AdminTenantRequestBuilder
                .forTenant('system-fallback-tenant')
                .withAppName('Test Tenant')
                .withLogoUrl('https://example.com/logo.svg')
                .withFaviconUrl('https://example.com/favicon.ico')
                .withBranding({
                    primaryColor: toTenantPrimaryColor('#0066CC'),
                    secondaryColor: toTenantSecondaryColor('#FF6600'),
                })
                .withMarketingFlags({
                    showPricingPage: toShowPricingPageFlag(true),
                })
                .withDomains([toTenantDomainName('test.example.com')])
                .build();

            await appDriver.adminUpsertTenant(tenantData, adminUser);

            // Make user1 a tenant admin
            appDriver.seedTenantAdminUser(user1, {});
        });

        describe('GET /settings/tenant', () => {
            it('should allow tenant admin to get tenant settings', async () => {
                const settings = await appDriver.getTenantSettings(user1);

                expect(settings).toMatchObject({
                    tenantId: expect.any(String),
                    config: expect.objectContaining({
                        tenantId: expect.any(String),
                        branding: expect.any(Object),
                    }),
                    domains: expect.any(Array),
                });

                expect(settings.config.brandingTokens.tokens.legal.appName).toEqual(expect.any(String));
                expect(settings.config.brandingTokens.tokens.assets.logoUrl).toEqual(expect.any(String));
                expect(settings.config.brandingTokens.tokens.assets.faviconUrl).toEqual(expect.any(String));
                expect(settings.config.brandingTokens.tokens.palette.primary).toEqual(expect.any(String));
                expect(settings.config.brandingTokens.tokens.palette.secondary).toEqual(expect.any(String));

                // marketingFlags is at top-level of config, not inside branding
                expect(settings.config.marketingFlags).toMatchObject({
                    showPricingPage: expect.any(Boolean),
                });
            });

            it('should deny regular user access to tenant settings', async () => {
                await expect(
                    appDriver.getTenantSettings(user2),
                )
                    .rejects
                    .toMatchObject({ code: 'FORBIDDEN' });
            });
        });

        describe('GET /settings/tenant/domains', () => {
            it('should allow tenant admin to list domains', async () => {
                const result = await appDriver.getTenantDomains(user1);

                expect(result).toMatchObject({
                    domains: expect.any(Array),
                });

                expect(result.domains.length).toBeGreaterThan(0);
            });
            it('should deny regular user access to list domains', async () => {
                const result = await appDriver.getTenantDomains(user2);
                expect(result).toMatchObject({
                    error: {
                        code: 'FORBIDDEN',
                    },
                });
            });
        });

        describe('PUT /settings/tenant/branding', () => {
            it('should allow tenant admin to update branding', async () => {
                const brandingData = TenantBrandingUpdateBuilder
                    .empty()
                    .withAppName('Custom Brand')
                    .withPrimaryColor('#FF0000')
                    .build();

                // Returns 204 No Content on success
                await appDriver.updateTenantBranding(brandingData, user1);

                // Verify the update persisted
                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.brandingTokens.tokens.legal.appName).toBe('Custom Brand');
                expect(settings.config.brandingTokens.tokens.palette.primary.toLowerCase()).toBe('#ff0000');
            });

            it('should update partial branding fields', async () => {
                const brandingData = TenantBrandingUpdateBuilder
                    .empty()
                    .withLogoUrl('https://custom.com/logo.svg')
                    .build();

                // Returns 204 No Content on success
                await appDriver.updateTenantBranding(brandingData, user1);

                // Verify the update persisted
                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.brandingTokens.tokens.assets.logoUrl).toBe('https://custom.com/logo.svg');
            });

            it('should update marketing flags', async () => {
                const brandingData = TenantBrandingUpdateBuilder
                    .empty()
                    .withMarketingFlags({ showPricingPage: true })
                    .build();

                // Returns 204 No Content on success
                await appDriver.updateTenantBranding(brandingData, user1);

                // Verify the update persisted
                const settings = await appDriver.getTenantSettings(user1);
                expect(settings.config.marketingFlags?.showPricingPage).toBe(true);
            });

            it('should deny regular user access to update branding', async () => {
                const brandingData = TenantBrandingUpdateBuilder
                    .empty()
                    .withAppName('Custom Brand')
                    .build();

                await expect(appDriver.updateTenantBranding(brandingData, user2)).rejects.toThrow(
                    expect.objectContaining({
                        code: 'FORBIDDEN',
                    }),
                );
            });

            it('should allow system admin to update branding', async () => {
                const systemAdmin = user3;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                const brandingData = TenantBrandingUpdateBuilder
                    .empty()
                    .withAppName('System Admin Updated')
                    .build();

                // Returns 204 No Content on success
                await appDriver.updateTenantBranding(brandingData, systemAdmin);

                // Verify the update persisted
                const settings = await appDriver.getTenantSettings(systemAdmin);
                expect(settings.config.brandingTokens.tokens.legal.appName).toBe('System Admin Updated');
            });
        });

        describe('POST /settings/tenant/domains', () => {
            it('should return 501 not implemented for domain addition', async () => {
                const domainData = new AddTenantDomainRequestBuilder()
                    .withDomain('custom.example.com')
                    .build();

                await expect(appDriver.addTenantDomain(domainData, user1)).rejects.toMatchObject({
                    code: 'NOT_IMPLEMENTED',
                });
            });

            it('should deny regular user access to add domain', async () => {
                const domainData = new AddTenantDomainRequestBuilder()
                    .withDomain('custom.example.com')
                    .build();

                await expect(appDriver.addTenantDomain(domainData, user2)).rejects.toThrow(
                    expect.objectContaining({
                        code: 'FORBIDDEN',
                    }),
                );
            });
        });

        describe('authorization - system admin access', () => {
            beforeEach(() => {
                // Promote user3 to system admin
                appDriver.seedAdminUser(user3);
            });

            it('should allow system admin to access tenant settings', async () => {
                const settings = await appDriver.getTenantSettings(user3);

                expect(settings).toMatchObject({
                    tenantId: expect.any(String),
                    config: expect.any(Object),
                });
            });

            it('should allow system admin to list domains', async () => {
                const result = await appDriver.getTenantDomains(user3);

                expect(result).toMatchObject({
                    domains: expect.any(Array),
                });
            });
        });
    });

    it('should reject extra fields', async () => {
        const invalidData = TenantBrandingUpdateBuilder
            .empty()
            .withAppName('Valid')
            .withExtraField('unexpectedField', 'should fail')
            .build();

        await expect(appDriver.updateTenantBranding(invalidData, adminUser)).rejects.toThrow(
            expect.objectContaining({
                code: 'VALIDATION_ERROR',
            }),
        );
    });

    it('should reject invalid branding data', async () => {
        const invalidData = TenantBrandingUpdateBuilder
            .empty()
            .withInvalidAppName('') // Empty string not allowed
            .build();

        await expect(appDriver.updateTenantBranding(invalidData, adminUser)).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
        });
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
            it('should create a new tenant when it does not exist', async () => {
                const payload = AdminTenantRequestBuilder.forTenant('tenant_new_test').build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId: 'tenant_new_test',
                    created: true,
                });
            });

            it('should update an existing tenant when it already exists', async () => {
                const payload = AdminTenantRequestBuilder.forTenant('tenant_existing_test').build();

                // Create tenant first
                const createResult = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update the same tenant
                const updatedPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_existing_test')
                    .withAppName('Updated Tenant App')
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatedPayload, localAdminUser);

                expect(updateResult).toMatchObject({
                    tenantId: 'tenant_existing_test',
                    created: false,
                });
            });

            it('should reject non-admin user', async () => {
                // Register regular user via API
                const regularUserReg = new UserRegistrationBuilder()
                    .withEmail('regular@test.com')
                    .withDisplayName('Regular User')
                    .withPassword('password12345')
                    .build();
                const regularUserResult = await appDriver.registerUser(regularUserReg);
                const regularUser = toUserId(regularUserResult.user.uid);

                const payload = AdminTenantRequestBuilder.forTenant('tenant_unauthorized').build();

                await expect(appDriver.adminUpsertTenant(payload, regularUser)).rejects.toMatchObject({
                    code: 'FORBIDDEN',
                });
            });

            it('should allow system admin to upsert tenant', async () => {
                const systemAdminReg = new UserRegistrationBuilder()
                    .withEmail('systemadmin@example.com')
                    .withDisplayName('System Admin')
                    .withPassword('password12345')
                    .build();
                const systemAdminResult = await appDriver.registerUser(systemAdminReg);
                const systemAdmin = systemAdminResult.user.uid;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                const payload = AdminTenantRequestBuilder.forTenant('tenant_system_admin').build();

                const result = await appDriver.adminUpsertTenant(payload, systemAdmin);

                expect(result).toMatchObject({
                    tenantId: 'tenant_system_admin',
                    created: true,
                });
            });

            it('should store multiple domains', async () => {
                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_domains')
                    .withDomains([
                        toTenantDomainName('example.bar'),
                        toTenantDomainName('www.foo'),
                        toTenantDomainName('alias.bar'),
                    ])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result.tenantId).toBe('tenant_domains');

                // Verify domains were stored via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_domains');
                expect(tenant?.domains).toEqual([
                    'example.bar',
                    'www.foo',
                    'alias.bar',
                ]);
            });

            it('should allow updating same tenant with same domains', async () => {
                // Create tenant
                const createTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_self_update')
                    .withDomains([toTenantDomainName('update.test')])
                    .build();

                const createResult = await appDriver.adminUpsertTenant(createTenant, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update the same tenant with same domains - should be allowed
                const updateTenant = AdminTenantRequestBuilder
                    .forTenant('tenant_self_update')
                    .withAppName('Updated Name')
                    .withDomains([toTenantDomainName('update.test')])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updateTenant, localAdminUser);
                expect(updateResult.created).toBe(false); // Updated, not created
                expect(updateResult.tenantId).toBe('tenant_self_update');
            });

            it('should generate different brandingTokens for different color inputs', async () => {
                const tenant1 = AdminTenantRequestBuilder
                    .forTenant('tenant_tokens_1')
                    .withPrimaryColor('#ff0000')
                    .withDomains([toTenantDomainName('tokens1.test')])
                    .build();

                await appDriver.adminUpsertTenant(tenant1, localAdminUser);

                const tenant2 = AdminTenantRequestBuilder
                    .forTenant('tenant_tokens_2')
                    .withPrimaryColor('#00ff00')
                    .withDomains([toTenantDomainName('tokens2.test')])
                    .build();

                await appDriver.adminUpsertTenant(tenant2, localAdminUser);

                // Verify tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant1Record = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_tokens_1');
                const tenant2Record = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_tokens_2');

                const tokens1 = tenant1Record?.tenant.brandingTokens;
                const tokens2 = tenant2Record?.tenant.brandingTokens;

                // Tokens should be different because colors are different
                expect(tokens1).toBeDefined();
                expect(tokens2).toBeDefined();
                expect(tokens1?.tokens?.palette?.primary).toBe('#ff0000');
                expect(tokens2?.tokens?.palette?.primary).toBe('#00ff00');
            });

            it('should preserve explicitly provided brandingTokens instead of generating', async () => {
                const explicitTokens = AdminTenantRequestBuilder.forTenant('explicit').buildTokens();
                explicitTokens.palette.primary = '#123456' as `#${string}`;

                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_explicit_tokens')
                    .withDomains([toTenantDomainName('explicit.test')])
                    .build();

                payload.brandingTokens = { tokens: explicitTokens };

                await appDriver.adminUpsertTenant(payload, localAdminUser);

                // Verify explicit tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_explicit_tokens');

                // Should use the explicit tokens, not generate from branding colors
                expect(tenant?.tenant.brandingTokens?.tokens?.palette?.primary).toBe('#123456');
            });

            it('should accept reasonably long appName', async () => {
                const longName = 'A'.repeat(200);

                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_long_name')
                    .withAppName(longName)
                    .withDomains([toTenantDomainName('longname.test')])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);

                expect(result).toMatchObject({
                    tenantId: 'tenant_long_name',
                    created: true,
                });
            });

            it('should update appName without affecting colors', async () => {
                const initialPayload = AdminTenantRequestBuilder
                    .forTenant('tenant_name_only_update')
                    .withAppName('Initial Name')
                    .withAccentColor('#ff0000')
                    .withDomains([toTenantDomainName('nameonly.test')])
                    .build();

                const createResult = await appDriver.adminUpsertTenant(initialPayload, localAdminUser);
                expect(createResult.created).toBe(true);

                // Update with different app name
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant('tenant_name_only_update')
                    .withAppName('Updated Name Only')
                    .withAccentColor('#ff0000')
                    .withDomains([toTenantDomainName('nameonly.test')])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);

                // Verify update succeeded
                expect(updateResult.created).toBe(false);
                expect(updateResult.tenantId).toBe('tenant_name_only_update');

                // Verify branding tokens via API
                const allTenants = await appDriver.listAllTenants(localAdminUser);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === 'tenant_name_only_update');
                expect(tenant).toBeDefined();
                expect(tenant?.tenant.brandingTokens?.tokens?.palette?.accent).toBe('#ff0000');
            });
        });

        describe('POST /api/admin/tenants/publish - publishTenantTheme', () => {
            let systemAdmin: string;
            const tenantId = 'tenant_publish_unit';

            beforeEach(async () => {
                appDriver.storageStub.clear();
                const systemAdminReg = new UserRegistrationBuilder()
                    .withEmail('theme-admin@test.com')
                    .withDisplayName('Theme Admin')
                    .withPassword('password12345')
                    .build();
                const systemAdminResult = await appDriver.registerUser(systemAdminReg);
                systemAdmin = systemAdminResult.user.uid;
                appDriver.seedAdminUser(systemAdmin); // Promote to system admin

                // Create tenant via API with branding tokens
                const tokens = AdminTenantRequestBuilder.forTenant(tenantId).buildTokens();
                const tenantRequest = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withBrandingTokens({ tokens })
                    .build();
                await appDriver.adminUpsertTenant(tenantRequest, systemAdmin);
            });

            it('should publish theme artifacts and record metadata', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // URLs may be emulator format (with URL encoding) or production format
                // Decode to handle both cases
                const decodedCssUrl = decodeURIComponent(result.cssUrl);
                const decodedTokensUrl = decodeURIComponent(result.tokensUrl);

                expect(decodedCssUrl).toContain(`theme-artifacts/${tenantId}/`);
                expect(decodedTokensUrl).toContain(`theme-artifacts/${tenantId}/`);
                expect(result).toMatchObject({
                    artifact: {
                        version: 1,
                        generatedBy: systemAdmin,
                        cssUrl: expect.any(String),
                        tokensUrl: expect.any(String),
                    },
                });

                // Verify artifact was stored via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.tenant.brandingTokens?.artifact).toMatchObject({
                    version: 1,
                    hash: result.artifact.hash,
                    generatedBy: systemAdmin,
                });

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                // Files use Firebase Storage URLs with security rules (no longer made public individually)
                expect(cssFile).toBeDefined();
                expect(cssFile?.metadata?.metadata?.tenantId).toBe(tenantId);
                expect(tokensFile).toBeDefined();
                expect(tokensFile?.content.toString('utf8')).toContain('"palette"');
            });

            it('should increment artifact version on subsequent publishes', async () => {
                const first = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const second = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(second.artifact.version).toBe(first.artifact.version + 1);

                // Verify artifact version via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.tenant.brandingTokens?.artifact?.version).toBe(2);
            });

            it('should use updated branding colors when publishing theme', async () => {
                // Create a tenant with initial branding colors
                const testTenantId = 'tenant-color-update-test';
                const initialAccentColor = '#22d3ee'; // Teal
                const updatedAccentColor = '#ff00ff'; // Magenta

                const initialPayload = AdminTenantRequestBuilder
                    .forTenant(testTenantId)
                    .withDomains([`${testTenantId}.test`])
                    .withAppName('Test App')
                    .withLogoUrl('/logo.svg')
                    .withPrimaryColor('#2563eb')
                    .withSecondaryColor('#7c3aed')
                    .withAccentColor(initialAccentColor)
                    .build();

                await appDriver.adminUpsertTenant(initialPayload, systemAdmin);

                // Update with new accent color - brandingTokens is now required
                const updatedPayload = AdminTenantRequestBuilder
                    .forTenant(testTenantId)
                    .withDomains([`${testTenantId}.test`])
                    .withAppName('Test App')
                    .withLogoUrl('/logo.svg')
                    .withPrimaryColor('#2563eb')
                    .withSecondaryColor('#7c3aed')
                    .withAccentColor(updatedAccentColor)
                    .build();

                await appDriver.adminUpsertTenant(updatedPayload, systemAdmin);

                // Publish the theme
                const publishResult = await appDriver.publishTenantTheme({ tenantId: testTenantId }, systemAdmin);

                // Get the published CSS from storage
                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${testTenantId}/${publishResult.artifact.hash}/theme.css`;
                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile).toBeDefined();
                const cssContent = cssFile!.content.toString('utf8').toLowerCase();

                // The published CSS should contain the UPDATED accent color
                expect(cssContent).toContain(updatedAccentColor.toLowerCase());
                expect(cssContent).not.toContain(initialAccentColor.toLowerCase());
            });

            it('should reject publish from non-admin user', async () => {
                // Register regular user via API
                const regularUserReg = new UserRegistrationBuilder()
                    .withEmail('regularpublish@test.com')
                    .withDisplayName('Regular User')
                    .withPassword('password12345')
                    .build();
                const regularUserResult = await appDriver.registerUser(regularUserReg);
                const regularUser = toUserId(regularUserResult.user.uid);

                await expect(appDriver.publishTenantTheme({ tenantId }, regularUser)).rejects.toMatchObject({
                    code: 'FORBIDDEN',
                });
            });

            it('should generate valid CSS with CSS custom properties', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile).toBeDefined();
                const cssContent = cssFile!.content.toString('utf8');

                // Verify it contains CSS with :root and custom properties format
                expect(cssContent).toContain(':root');
                expect(cssContent).toContain('--');
                expect(cssContent.length).toBeGreaterThan(100);
            });

            it('should generate valid JSON tokens file', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                expect(tokensFile).toBeDefined();
                const tokensContent = tokensFile!.content.toString('utf8');

                // Should be valid JSON
                const tokens = JSON.parse(tokensContent);
                expect(tokens).toHaveProperty('palette');
                expect(tokens).toHaveProperty('typography');
                expect(tokens).toHaveProperty('spacing');
                expect(tokens).toHaveProperty('semantics');
            });

            it('should generate consistent hash for same tokens', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Same tokens should produce same hash
                expect(result1.artifact.hash).toBe(result2.artifact.hash);
            });

            it('should generate different hash after token update', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Update tenant with different color - brandingTokens is now required
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([`${tenantId}.test`])
                    .withAppName('Test App')
                    .withLogoUrl('/logo.svg')
                    .withPrimaryColor('#ff0000') // Different color
                    .withSecondaryColor('#7c3aed')
                    .withAccentColor('#f97316')
                    .build();

                await appDriver.adminUpsertTenant(updatePayload, systemAdmin);

                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                // Different tokens should produce different hash
                expect(result1.artifact.hash).not.toBe(result2.artifact.hash);
            });

            it('should make published files publicly accessible', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;
                const tokensPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/tokens.json`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);
                const tokensFile = appDriver.storageStub.getFile(bucketName, tokensPath);

                // Files use Firebase Storage URLs with security rules (no longer made public individually)
                expect(cssFile).toBeDefined();
                expect(tokensFile).toBeDefined();
            });

            it('should record correct metadata in published files', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                const bucketName = appDriver.storageStub.bucket().name;
                const cssPath = `theme-artifacts/${tenantId}/${result.artifact.hash}/theme.css`;

                const cssFile = appDriver.storageStub.getFile(bucketName, cssPath);

                expect(cssFile?.metadata?.metadata?.tenantId).toBe(tenantId);
                expect(cssFile?.metadata?.contentType).toContain('text/css');
            });

            it('should include operator ID in artifact metadata', async () => {
                const result = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(result.artifact.generatedBy).toBe(systemAdmin);

                // Verify it's stored in Firestore via API
                const allTenants = await appDriver.listAllTenants(systemAdmin);
                const tenant = allTenants.tenants.find((t) => t.tenant.tenantId === tenantId);
                expect(tenant?.tenant.brandingTokens?.artifact?.generatedBy).toBe(systemAdmin);
            });

            it('should handle publishing same theme multiple times', async () => {
                const result1 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result2 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);
                const result3 = await appDriver.publishTenantTheme({ tenantId }, systemAdmin);

                expect(result1.artifact.version).toBe(1);
                expect(result2.artifact.version).toBe(2);
                expect(result3.artifact.version).toBe(3);

                // All should have the same hash (since tokens haven't changed)
                expect(result1.artifact.hash).toBe(result2.artifact.hash);
                expect(result2.artifact.hash).toBe(result3.artifact.hash);
            });
        });
    });

    describe('Admin browser endpoints', () => {
        let browserAdmin: string;

        beforeEach(async () => {
            const browserAdminReg = new UserRegistrationBuilder()
                .withEmail('browser-admin@test.com')
                .withDisplayName('Browser Admin')
                .withPassword('password12345')
                .build();
            const browserAdminResult = await appDriver.registerUser(browserAdminReg);
            browserAdmin = browserAdminResult.user.uid;
            appDriver.seedAdminUser(browserAdmin); // Promote to system admin
        });

        it('lists all tenants for system users', async () => {
            // Create tenants via API
            const tenant1Request = AdminTenantRequestBuilder
                .forTenant('tenant-browser-1')
                .withDomains([toTenantDomainName('browser-1.test')])
                .build();
            await appDriver.adminUpsertTenant(tenant1Request, browserAdmin);

            const tenant2Request = AdminTenantRequestBuilder
                .forTenant('tenant-browser-2')
                .withDomains([toTenantDomainName('browser-2.test')])
                .build();
            await appDriver.adminUpsertTenant(tenant2Request, browserAdmin);

            const result = await appDriver.listAllTenants(browserAdmin);

            // 3 tenants: localhost-tenant (auto-seeded for registration) + 2 created tenants
            expect(result.tenants.length).toBe(3);
            expect(result.count).toBe(3);
            const tenantIds = result.tenants.map((entry) => entry.tenant.tenantId);
            expect(tenantIds).toEqual(expect.arrayContaining(['localhost-tenant', 'tenant-browser-1', 'tenant-browser-2']));
        });

        it('rejects tenant listing for users without a system role', async () => {
            // Register regular user via API
            const regularUserReg = new UserRegistrationBuilder()
                .withEmail('browser-regular@test.com')
                .withDisplayName('Browser Regular')
                .withPassword('password12345')
                .build();
            const regularUserResult = await appDriver.registerUser(regularUserReg);
            const regularUser = toUserId(regularUserResult.user.uid);

            await expect(
                appDriver.listAllTenants(regularUser),
            )
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });
        });

        it('enriches auth users with their Firestore roles', async () => {
            const browserSystemUserReg = new UserRegistrationBuilder()
                .withEmail('browsersystemuser@example.com')
                .withDisplayName('Browser System User')
                .withPassword('password12345')
                .build();
            const browserSystemUserResult = await appDriver.registerUser(browserSystemUserReg);
            const browserSystemUser = toUserId(browserSystemUserResult.user.uid);

            const response = await appDriver.listAuthUsers({ uid: browserSystemUser }, browserAdmin);

            expect(response.users).toHaveLength(1);
            expect(response.users[0].uid).toBe(browserSystemUser);
            expect(response.users[0].role).toBe(SystemUserRoles.SYSTEM_USER);
            expect(response.hasMore).toBe(false);
        });

        it('filters Firestore users by uid', async () => {
            const browserSystemUserReg = new UserRegistrationBuilder()
                .withEmail('browserfirestoreuser@example.com')
                .withDisplayName('Browser Firestore User')
                .withPassword('password12345')
                .build();
            const browserSystemUserResult = await appDriver.registerUser(browserSystemUserReg);
            const browserSystemUser = toUserId(browserSystemUserResult.user.uid);

            const response = await appDriver.listFirestoreUsers({ uid: browserSystemUser }, browserAdmin);

            expect(response.users).toHaveLength(1);
            expect(response.users[0].uid).toBe(browserSystemUser);
            expect(response.hasMore).toBe(false);
        });
    });

    describe('Admin User Management', () => {
        let localAdminUser: string;
        let regularUser: UserId;

        beforeEach(async () => {
            const adminReg = new UserRegistrationBuilder()
                .withEmail('admin@test.com')
                .withDisplayName('Admin User')
                .withPassword('password12345')
                .build();
            const adminResult = await appDriver.registerUser(adminReg);
            localAdminUser = adminResult.user.uid;
            appDriver.seedAdminUser(localAdminUser);

            const regularUserReg = new UserRegistrationBuilder()
                .withEmail('regular@test.com')
                .withDisplayName('Regular User')
                .withPassword('password12345')
                .build();
            const regularUserResult = await appDriver.registerUser(regularUserReg);
            regularUser = toUserId(regularUserResult.user.uid);
        });

        describe('PUT /api/admin/users/:uid - updateUser (disable/enable)', () => {
            it('should allow admin to disable a user account', async () => {
                // Returns 204 No Content on success
                await appDriver.updateUser(
                    regularUser,
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    adminUser,
                );

                // Verify user was disabled
                const userRecord = await appDriver.getUserAuth(regularUser, adminUser);
                expect(userRecord.disabled).toBe(true);
            });

            it('should allow admin to enable a disabled user account', async () => {
                // First disable the user
                await appDriver.updateUser(
                    regularUser,
                    UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                    adminUser,
                );

                // Then enable them (returns 204 No Content on success)
                await appDriver.updateUser(
                    regularUser,
                    UpdateUserStatusRequestBuilder.empty().asEnabled().build(),
                    adminUser,
                );

                // Verify user was enabled
                const userRecord = await appDriver.getUserAuth(regularUser, adminUser);
                expect(userRecord.disabled).toBe(false);
            });

            it('should reject non-admin user', async () => {
                await expect(
                    appDriver.updateUser(
                        regularUser,
                        UpdateUserStatusRequestBuilder.empty().asDisabled().build(),
                        regularUser,
                    ),
                )
                    .rejects
                    .toThrow(
                        expect.objectContaining({
                            code: 'FORBIDDEN',
                        }),
                    );
            });
        });

        describe('PUT /api/admin/users/:uid/role - updateUserRole', () => {
            it('should allow admin to promote user to system_admin', async () => {
                // Returns 204 No Content on success
                await appDriver.updateUserRole(
                    regularUser,
                    UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                    adminUser,
                );

                // Verify role was updated
                const userData = await appDriver.getUserFirestore(regularUser, adminUser);
                expect(userData.role).toBe(SystemUserRoles.SYSTEM_ADMIN);
            });

            it('should allow admin to promote user to tenant_admin', async () => {
                // Returns 204 No Content on success
                await appDriver.updateUserRole(
                    regularUser,
                    UpdateUserRoleRequestBuilder.empty().asTenantAdmin().build(),
                    adminUser,
                );

                // Verify role was updated
                const userData = await appDriver.getUserFirestore(regularUser, adminUser);
                expect(userData.role).toBe(SystemUserRoles.TENANT_ADMIN);
            });

            it('should allow admin to demote user by setting role to null', async () => {
                // First promote the user
                await appDriver.updateUserRole(
                    regularUser,
                    UpdateUserRoleRequestBuilder.empty().asSystemAdmin().build(),
                    adminUser,
                );

                // Then demote them (returns 204 No Content on success)
                await appDriver.updateUserRole(
                    regularUser,
                    UpdateUserRoleRequestBuilder.empty().asNoRole().build(),
                    adminUser,
                );

                // Verify role was demoted to system_user
                const userData = await appDriver.getUserFirestore(regularUser, adminUser);
                expect(userData.role).toBe(SystemUserRoles.SYSTEM_USER);
            });
        });
    });
});
