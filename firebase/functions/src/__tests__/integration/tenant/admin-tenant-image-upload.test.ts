import type { PooledTestUser } from '@billsplit-wl/shared';
import { toTenantAppName, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Admin tenant image upload', () => {
    const apiDriver = new ApiDriver();
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    it('should upload a logo image and return a storage URL', async () => {
        const tenantId = `tenant-upload-${Date.now()}`;
        const domain = `${tenantId}.local`;

        // Create tenant first
        await apiDriver.adminUpsertTenant(
            AdminTenantRequestBuilder
                .forTenant(tenantId)
                .withAppName('Upload Test Tenant')
                .withBranding({
                    appName: toTenantAppName('Upload Test Tenant'),
                    logoUrl: toTenantLogoUrl('/placeholder-logo.svg'),
                    primaryColor: toTenantPrimaryColor('#1a73e8'),
                    secondaryColor: toTenantSecondaryColor('#34a853'),
                })
                .withDomains([domain])
                .build(),
            adminUser.token,
        );

        // Create a minimal valid PNG (1x1 transparent pixel)
        const pngBuffer = Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a, // PNG signature
            0x00,
            0x00,
            0x00,
            0x0d,
            0x49,
            0x48,
            0x44,
            0x52, // IHDR chunk
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x01, // 1x1 dimensions
            0x08,
            0x06,
            0x00,
            0x00,
            0x00,
            0x1f,
            0x15,
            0xc4, // bit depth, color type, etc
            0x89,
            0x00,
            0x00,
            0x00,
            0x0a,
            0x49,
            0x44,
            0x41, // IDAT chunk
            0x54,
            0x78,
            0x9c,
            0x63,
            0x00,
            0x01,
            0x00,
            0x00,
            0x05,
            0x00,
            0x01,
            0x0d,
            0x0a,
            0x2d,
            0xb4,
            0x00,
            0x00,
            0x00,
            0x00,
            0x49,
            0x45,
            0x4e,
            0x44,
            0xae, // IEND chunk
            0x42,
            0x60,
            0x82,
        ]);

        // Upload logo
        const result = await apiDriver.uploadTenantImage(
            tenantId,
            'logo',
            pngBuffer,
            'image/png',
            adminUser.token,
        );

        // Verify response
        expect(result).toBeDefined();
        expect(result.url).toBeDefined();
        expect(typeof result.url).toBe('string');
        expect(result.url).toContain('tenant-assets');
        expect(result.url).toContain(tenantId);
        expect(result.url).toContain('logo-');
        expect(result.url).toContain('.png');
    });
});
