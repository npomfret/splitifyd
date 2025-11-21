import type { PooledTestUser } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';
import { AdminTenantRequestBuilder } from '@billsplit-wl/test-support';

describe('Admin tenant API - integration', () => {
    const apiDriver = new ApiDriver();
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    it('auto-generates branding tokens when not provided (UI flow)', async () => {
        const tenantId = `tenant-ui-${Date.now()}`;
        const uniqueDomain = `${tenantId}.local`;
        const payload = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withDomains([uniqueDomain])
            .build();
        delete payload.brandingTokens;

        const result = await apiDriver.adminUpsertTenant(payload, adminUser.token);

        expect(result).toMatchObject({
            tenantId,
            created: true,
        });

        // Verify tokens were auto-generated from branding colors
        const tenantDoc = await getFirestore().collection(FirestoreCollections.TENANTS).doc(tenantId).get();
        expect(tenantDoc.exists).toBe(true);
        expect(tenantDoc.data()?.brandingTokens).toBeDefined();
        expect(tenantDoc.data()?.brandingTokens?.tokens?.palette?.primary).toBe(payload.branding.primaryColor);
    });
});
