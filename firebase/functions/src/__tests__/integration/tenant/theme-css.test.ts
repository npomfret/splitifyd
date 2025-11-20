import type { PooledTestUser } from '@billsplit-wl/shared';
import {
    brandingTokenFixtures,
    toTenantAccentColor,
    toTenantAppName,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';
import { AdminTenantRequestBuilder } from '../../unit/AdminTenantRequestBuilder';

const buildTenantPayload = (tenantId: string) => {
    const tokens = brandingTokenFixtures.localhost;
    return AdminTenantRequestBuilder
        .forTenant(tenantId)
        .withBranding({
            appName: toTenantAppName('Theming Fixture Tenant'),
            logoUrl: toTenantLogoUrl(tokens.assets.logoUrl),
            faviconUrl: toTenantFaviconUrl(tokens.assets.faviconUrl || 'https://example.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor(tokens.palette.primary),
            secondaryColor: toTenantSecondaryColor(tokens.palette.secondary),
            accentColor: toTenantAccentColor(tokens.palette.accent),
            themePalette: toTenantThemePaletteName('default'),
        })
        .withBrandingTokens({ tokens })
        .withDomains([`${tenantId}.local.test`])
        .build();
};

describe('Theme CSS delivery', () => {
    const apiDriver = new ApiDriver();
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    it('serves published CSS for a tenant', async () => {
        const tenantId = `tenant_theme_${Date.now()}`;
        const payload = buildTenantPayload(tenantId);

        await apiDriver.adminUpsertTenant(payload, adminUser.token);
        const publishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);

        const tenantDoc = await getFirestore().collection(FirestoreCollections.TENANTS).doc(tenantId).get();
        expect(tenantDoc.data()?.brandingTokens?.artifact?.hash).toBe(publishResult.artifact.hash);

        let response;
        try {
            response = await apiDriver.fetchThemeCss({
                tenantId,
                version: publishResult.artifact.hash,
            });
        } catch (error: any) {
            console.error('theme-css-response-body', error.body);
            throw error;
        }

        expect(response.status).toBe(200);
        expect(response.css).toContain('--palette-primary');
        expect(response.headers.get('cache-control')).toContain('max-age=31536000');
        expect(response.headers.get('etag')).toContain(publishResult.artifact.hash);
    });
});
