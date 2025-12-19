import { toTenantDomainName, type UserId } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, BrandingConfigBuilder, CreatePolicyRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

/**
 * Tests for the public policy text endpoints.
 *
 * These endpoints return plain text policy content for tenant embedding.
 */
describe('public policy text endpoints', () => {
    let appDriver: AppDriver;
    let adminToken: UserId;

    // No longer needed - localhost tenant is auto-seeded by registerUser()
    // Tests that need a tenant will have it available automatically

    beforeEach(async () => {
        appDriver = new AppDriver();

        // Create admin user to seed policies
        const adminResult = await appDriver.registerUser(
            new UserRegistrationBuilder()
                .withEmail('admin@test.com')
                .withPassword('password123456')
                .withDisplayName('Admin User')
                .build(),
        );
        adminToken = adminResult.user.uid as UserId;
        appDriver.seedAdminUser(adminToken);
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('getPrivacyPolicy', () => {
        it('should return privacy policy text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('Privacy policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getPrivacyPolicy();

            expect(typeof result).toBe('string');
            expect(result).toBe('Privacy policy content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getPrivacyPolicy()).rejects.toThrow();
        });
    });

    describe('getTermsOfService', () => {
        it('should return terms of service text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Terms Of Service')
                    .withText('Terms of service content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getTermsOfService();

            expect(typeof result).toBe('string');
            expect(result).toBe('Terms of service content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getTermsOfService()).rejects.toThrow();
        });
    });

    describe('getCookiePolicy', () => {
        it('should return cookie policy text as plain text', async () => {
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Cookie Policy')
                    .withText('Cookie policy content.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getCookiePolicy();

            expect(typeof result).toBe('string');
            expect(result).toBe('Cookie policy content.');
        });

        it('should throw when policy does not exist', async () => {
            await expect(appDriver.getCookiePolicy()).rejects.toThrow();
        });
    });

    describe('template substitution', () => {
        it('should substitute {{appName}} with tenant-specific value', async () => {
            // Create tenant with custom app name
            const tenantData = AdminTenantRequestBuilder
                .forTenant('custom-tenant')
                .withAppName('My Custom App')
                .withBranding(new BrandingConfigBuilder().build())
                .withDomains([toTenantDomainName('custom.example.com')])
                .build();
            await appDriver.adminUpsertTenant(tenantData, adminToken);

            // Create policy with placeholder
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('Welcome to {{appName}}. We value your privacy.')
                    .build(),
                adminToken,
            );

            // Request with tenant host
            const result = await appDriver.getPrivacyPolicy({ host: 'custom.example.com' });

            expect(result).toBe('Welcome to My Custom App. We value your privacy.');
        });

        it('should substitute {{companyName}} with tenant-specific value', async () => {
            const tenantData = AdminTenantRequestBuilder
                .forTenant('custom-tenant')
                .withCompanyName('Acme Corporation')
                .withBranding(new BrandingConfigBuilder().build())
                .withDomains([toTenantDomainName('acme.example.com')])
                .build();
            await appDriver.adminUpsertTenant(tenantData, adminToken);

            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Terms Of Service')
                    .withText('{{companyName}} operates this service.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getTermsOfService({ host: 'acme.example.com' });

            expect(result).toBe('Acme Corporation operates this service.');
        });

        it('should substitute {{supportEmail}} with tenant-specific value', async () => {
            const tenantData = AdminTenantRequestBuilder
                .forTenant('custom-tenant')
                .withSupportEmail('help@custom.example.com')
                .withBranding(new BrandingConfigBuilder().build())
                .withDomains([toTenantDomainName('support.example.com')])
                .build();
            await appDriver.adminUpsertTenant(tenantData, adminToken);

            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Cookie Policy')
                    .withText('Contact us at {{supportEmail}} for questions.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getCookiePolicy({ host: 'support.example.com' });

            expect(result).toBe('Contact us at help@custom.example.com for questions.');
        });

        it('should substitute multiple placeholders in same text', async () => {
            const tenantData = AdminTenantRequestBuilder
                .forTenant('multi-tenant')
                .withAppName('SuperApp')
                .withCompanyName('Super Inc')
                .withSupportEmail('support@super.com')
                .withBranding(new BrandingConfigBuilder().build())
                .withDomains([toTenantDomainName('multi.example.com')])
                .build();
            await appDriver.adminUpsertTenant(tenantData, adminToken);

            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('{{appName}} by {{companyName}}. Email: {{supportEmail}}')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getPrivacyPolicy({ host: 'multi.example.com' });

            expect(result).toBe('SuperApp by Super Inc. Email: support@super.com');
        });

        it('should fallback to default tenant for unknown host', async () => {
            // Create policy with placeholder
            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('Welcome to {{appName}}.')
                    .build(),
                adminToken,
            );

            // Request with unknown host - falls back to default localhost-tenant (auto-seeded by registerUser)
            const result = await appDriver.getPrivacyPolicy({ host: 'unknown.example.com' });

            // Should use the default tenant's appName ("Localhost" from auto-seeded tenant)
            expect(result).toBe('Welcome to Localhost.');
        });

        it('should leave text unchanged when no placeholders present', async () => {
            const tenantData = AdminTenantRequestBuilder
                .forTenant('plain-tenant')
                .withAppName('Changed App Name')
                .withBranding(new BrandingConfigBuilder().build())
                .withDomains([toTenantDomainName('plain.example.com')])
                .build();
            await appDriver.adminUpsertTenant(tenantData, adminToken);

            await appDriver.createPolicy(
                new CreatePolicyRequestBuilder()
                    .withPolicyName('Privacy Policy')
                    .withText('No placeholders here.')
                    .build(),
                adminToken,
            );

            const result = await appDriver.getPrivacyPolicy({ host: 'plain.example.com' });

            expect(result).toBe('No placeholders here.');
        });
    });
});
