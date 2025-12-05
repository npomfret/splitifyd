import type { BrandingTokens, PooledTestUser } from '@billsplit-wl/shared';
import {
    toTenantAccentColor,
    toTenantDomainName,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, ApiDriver, borrowTestUsers } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Admin Tenant Theme Publishing', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    let adminUser: PooledTestUser;

    const mockTokens: BrandingTokens = AdminTenantRequestBuilder.forTenant('tenant-theme-tokens').buildTokens();

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    const createTenantWithTokens = async (tenantId: string) => {
        const tenantData = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withAppName('Test Theme Tenant')
            .withLogoUrl('https://foo/branding/test/logo.svg')
            .withFaviconUrl('https://foo/branding/test/favicon.png')
            .withBranding({
                primaryColor: toTenantPrimaryColor('#2563eb'),
                secondaryColor: toTenantSecondaryColor('#7c3aed'),
                accentColor: toTenantAccentColor('#f97316'),
            })
            .withBrandingTokens({ tokens: mockTokens })
            .withDomains([toTenantDomainName(`${tenantId}.example.com`)])
            .build();

        await apiDriver.adminUpsertTenant(tenantData, adminUser.token);
    };

    it('should reject request without tenant ID', async () => {
        try {
            await apiDriver.publishTenantTheme({} as any, adminUser.token);
            expect.fail('Should have thrown error');
        } catch (error: any) {
            expect(error.status).toBe(400);
            expect(error.response.error.code).toBe('VALIDATION_ERROR');
            expect(error.response.error.detail).toBe('INVALID_TENANT_ID');
        }
    });

    it('should reject request from non-admin user', async () => {
        const tenantId = `tenant_auth_${Date.now()}`;
        await createTenantWithTokens(tenantId);

        // Borrow a regular (non-admin) user from the pool
        const [regularUser] = await borrowTestUsers(1);

        // Attempt to publish tenant theme with non-admin user
        // Should be rejected (not authorized to perform this action)
        try {
            const result = await apiDriver.publishTenantTheme({ tenantId }, regularUser.token);
            expect.fail(`Expected request to be rejected but it succeeded with result: ${JSON.stringify(result)}`);
        } catch (error: any) {
            console.log(error)
            expect(error.status).toBe(403);
            expect(error.response.error.code).toBe('FORBIDDEN');
        }
    });

    it('should update theme hash when brandingTokens change', async () => {
        const tenantId = `tenant_hash_change_${Date.now()}`;

        // Step 1: Create tenant with initial tokens
        await createTenantWithTokens(tenantId);

        // Step 2: Publish theme (generates first hash)
        const publishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);
        expect(publishResult.artifact).toBeDefined();
        expect(publishResult.artifact.cssUrl).toBeDefined();
        expect(publishResult.artifact.hash).toBeDefined();

        const originalHash = publishResult.artifact.hash;

        // Step 3: Upsert tenant with DIFFERENT brandingTokens (this changes the CSS hash)
        const updatedTokens = AdminTenantRequestBuilder.forTenant('different-tokens').buildTokens();
        // Modify the tokens to ensure they're different
        updatedTokens.palette.primary = '#ff0000';
        updatedTokens.palette.secondary = '#00ff00';

        const updatedTenantData = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withAppName('Updated Theme Tenant')
            .withLogoUrl('https://foo/branding/updated/logo.svg')
            .withFaviconUrl('https://foo/branding/updated/favicon.png')
            .withBranding({
                primaryColor: toTenantPrimaryColor('#ff0000'),
                secondaryColor: toTenantSecondaryColor('#00ff00'),
                accentColor: toTenantAccentColor('#0000ff'),
            })
            .withBrandingTokens({ tokens: updatedTokens })
            .withDomains([toTenantDomainName(`${tenantId}.example.com`)])
            .build();

        await apiDriver.adminUpsertTenant(updatedTenantData, adminUser.token);

        // Step 4: Re-publish and verify hash changed
        const rePublishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);
        expect(rePublishResult.artifact).toBeDefined();
        expect(rePublishResult.artifact.cssUrl).toBeDefined();
        expect(rePublishResult.artifact.hash).toBeDefined();
        // The hash should be different since we changed brandingTokens
        expect(rePublishResult.artifact.hash).not.toBe(originalHash);
    });
});
