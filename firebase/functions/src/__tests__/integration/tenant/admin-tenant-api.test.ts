import type { PooledTestUser } from '@billsplit-wl/shared';
import { ApiDriver, AdminTenantRequestBuilder } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Admin tenant API - integration', () => {
    const apiDriver = new ApiDriver();
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    it('rejects tenant creation without brandingTokens (no auto-generation)', async () => {
        const tenantId = `tenant-no-tokens-${Date.now()}`;
        const uniqueDomain = `${tenantId}.local`;
        const payload = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withDomains([uniqueDomain])
            .build();

        // Remove brandingTokens to test rejection
        delete (payload as any).brandingTokens;

        // Should reject with validation error
        await expect(apiDriver.adminUpsertTenant(payload, adminUser.token))
            .rejects
            .toThrow(/brandingTokens/i);
    });

    it('accepts tenant creation with full brandingTokens', async () => {
        const tenantId = `tenant-with-tokens-${Date.now()}`;
        const uniqueDomain = `${tenantId}.local`;
        const payload = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withDomains([uniqueDomain])
            .build();

        // Should succeed with brandingTokens included
        const result = await apiDriver.adminUpsertTenant(payload, adminUser.token);

        expect(result).toMatchObject({
            tenantId,
            created: true,
        });

        // Verify tokens were stored correctly via list API
        const listResult = await apiDriver.listAllTenants(adminUser.token);
        const tenant = listResult.tenants.find((t: any) => t.tenant.tenantId === tenantId);
        expect(tenant).toBeDefined();
        expect(tenant?.brandingTokens).toBeDefined();
        expect(tenant?.brandingTokens?.tokens?.palette?.primary).toBe(payload.branding.primaryColor);
    });
});
