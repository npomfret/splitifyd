import { SystemUserRoles, toDisplayName, toEmail, toTenantAccentColor, toTenantAppName, toTenantDomainName, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor, toUserId } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';
import { AdminTenantRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
        if (appDriver) {
            appDriver.dispose();
        }
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
                        code: 'ALREADY_EXISTS',
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
                        code: 'ALREADY_EXISTS',
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
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });

            it('should reject tenant with no domains', async () => {
                const payload = AdminTenantRequestBuilder
                    .forTenant('tenant_no_domains')
                    .withEmptyDomains()
                    .build();

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
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

                // Use builder then override domains with ones that need normalization
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAppName('Normalize Test')
                    .withPrimaryColor('#ff0000')
                    .withSecondaryColor('#00ff00')
                    .build();

                // Override domains with ones that need normalization
                (payload as any).domains = [
                    'example.com:8080', // Should strip port
                    'EXAMPLE.COM', // Should lowercase
                    'example.com', // Duplicate after normalization
                ];

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);
            });
        });

        describe('POST /api/admin/tenants/publish - publishTenantTheme', () => {
            it('should reject when tenant does not exist', async () => {
                await expect(appDriver.publishTenantTheme({ tenantId: 'unknown-tenant' }, adminUser))
                    .rejects
                    .toMatchObject({ code: 'NOT_FOUND' });
            });
        });

        describe('POST /api/admin/tenants/:tenantId/assets/:assetType - uploadTenantImage', () => {
            let tenantId: string;

            // Helper to create valid image buffers with magic numbers
            const createValidImageBuffer = (type: 'png' | 'jpeg' | 'gif' | 'webp' | 'ico'): Buffer => {
                const magicNumbers: Record<string, number[]> = {
                    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
                    jpeg: [0xff, 0xd8, 0xff, 0xe0],
                    gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
                    webp: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], // RIFF....WEBP
                    ico: [0x00, 0x00, 0x01, 0x00],
                };
                return Buffer.from([...magicNumbers[type], ...Array(20).fill(0)]);
            };

            beforeEach(async () => {
                // Create a tenant first
                tenantId = `test-upload-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();
                await appDriver.adminUpsertTenant(payload, localAdminUser);
            });

            it('should upload logo and return storage URL', async () => {
                const imageBuffer = createValidImageBuffer('png');
                const contentType = 'image/png';

                const result = await appDriver.uploadTenantImage(tenantId, 'logo', imageBuffer, contentType, localAdminUser);

                expect(result.url).toBeDefined();
                expect(result.url).toContain(tenantId);
                expect(result.url).toMatch(/logo-[0-9a-f]{16}\.png/); // Content-hash format
            });

            it('should upload favicon and return storage URL', async () => {
                const imageBuffer = createValidImageBuffer('ico');
                const contentType = 'image/x-icon';

                const result = await appDriver.uploadTenantImage(tenantId, 'favicon', imageBuffer, contentType, localAdminUser);

                expect(result.url).toBeDefined();
                expect(result.url).toContain(tenantId);
                expect(result.url).toMatch(/favicon-[0-9a-f]{16}\.ico/);
            });

            it('should reject upload with invalid content type', async () => {
                const imageBuffer = Buffer.from('fake-data');
                const invalidContentType = 'application/json'; // Not an image

                await expect(
                    appDriver.uploadTenantImage(tenantId, 'logo', imageBuffer, invalidContentType, localAdminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject upload with missing content type', async () => {
                const imageBuffer = Buffer.from('fake-data');
                const contentType = ''; // Empty content type

                await expect(
                    appDriver.uploadTenantImage(tenantId, 'logo', imageBuffer, contentType, localAdminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject upload for non-existent tenant', async () => {
                const imageBuffer = Buffer.from('fake-png-data');
                const contentType = 'image/png';

                await expect(
                    appDriver.uploadTenantImage('non-existent-tenant', 'logo', imageBuffer, contentType, localAdminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject upload with empty buffer', async () => {
                const emptyBuffer = Buffer.alloc(0);
                const contentType = 'image/png';

                await expect(
                    appDriver.uploadTenantImage(tenantId, 'logo', emptyBuffer, contentType, localAdminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should handle different image formats correctly', async () => {
                const formats: Array<{ type: 'png' | 'jpeg' | 'gif' | 'webp'; contentType: string; expectedExt: string; }> = [
                    { type: 'jpeg', contentType: 'image/jpeg', expectedExt: 'jpg' },
                    { type: 'png', contentType: 'image/png', expectedExt: 'png' },
                    { type: 'gif', contentType: 'image/gif', expectedExt: 'gif' },
                    { type: 'webp', contentType: 'image/webp', expectedExt: 'webp' },
                ];

                for (const { type, contentType, expectedExt } of formats) {
                    const result = await appDriver.uploadTenantImage(
                        tenantId,
                        'logo',
                        createValidImageBuffer(type),
                        contentType,
                        localAdminUser,
                    );
                    expect(result.url).toContain(`.${expectedExt}`);
                }
            });

            it('should replace old logo with new one (cleanup)', async () => {
                // First upload
                const firstBuffer = createValidImageBuffer('png');
                const firstResult = await appDriver.uploadTenantImage(tenantId, 'logo', firstBuffer, 'image/png', localAdminUser);
                const firstUrl = firstResult.url;

                // Second upload with different content (should cleanup first)
                const secondBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(30).fill(1)]); // Different PNG
                const secondResult = await appDriver.uploadTenantImage(tenantId, 'logo', secondBuffer, 'image/png', localAdminUser);
                const secondUrl = secondResult.url;

                // URLs should be different (different content hashes)
                expect(firstUrl).not.toBe(secondUrl);
                expect(secondUrl).toBeDefined();
            });
        });

        describe('Motion Features - brandingTokens preservation', () => {
            it('should enable motion features when brandingTokens provided with flags', async () => {
                const tenantId = `test-motion-enabled-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme() // Enables all motion features
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Fetch the tenant and verify motion flags
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant).toBeDefined();
                expect(createdTenant?.brandingTokens).toBeDefined();
                expect(createdTenant?.brandingTokens?.tokens).toBeDefined();
                expect(createdTenant?.brandingTokens?.tokens.motion).toBeDefined();
                expect(createdTenant?.brandingTokens?.tokens.motion?.enableParallax).toBe(true);
                expect(createdTenant?.brandingTokens?.tokens.motion?.enableMagneticHover).toBe(true);
                expect(createdTenant?.brandingTokens?.tokens.motion?.enableScrollReveal).toBe(true);
                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glass).toBe('rgba(25, 30, 50, 0.45)');
                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glassBorder).toBe('rgba(255, 255, 255, 0.12)');
            });

            it('should preserve motion features when updating tenant with new brandingTokens', async () => {
                const tenantId = `test-motion-update-${Date.now()}`;

                // Create tenant with Aurora theme (motion enabled)
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme()
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Update tenant with modified brandingTokens (change color but keep motion)
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme()
                    .withPrimaryColor('#ff0000') // Change color
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult.created).toBe(false);

                // Verify motion features still enabled
                const response = await appDriver.listAllTenants(localAdminUser);
                const updatedTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(updatedTenant!.brandingTokens?.tokens.motion?.enableParallax).toBe(true);
                expect(updatedTenant!.brandingTokens?.tokens.motion?.enableMagneticHover).toBe(true);
                expect(updatedTenant!.brandingTokens?.tokens.semantics.colors.surface.glass).toBe('rgba(25, 30, 50, 0.45)');
                expect(updatedTenant!.brandingTokens?.tokens.palette.primary).toBe('#ff0000'); // Color changed
            });

            it('should disable motion features when brandingTokens provided with flags set to false', async () => {
                const tenantId = `test-motion-disabled-${Date.now()}`;

                // Create with motion enabled
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme()
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Update to disable motion features
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                // Manually set motion flags to false
                updatePayload.brandingTokens!.tokens.motion!.enableParallax = false;
                updatePayload.brandingTokens!.tokens.motion!.enableMagneticHover = false;
                updatePayload.brandingTokens!.tokens.motion!.enableScrollReveal = false;
                // Remove glass properties
                delete (updatePayload.brandingTokens!.tokens.semantics.colors.surface as any).glass;
                delete (updatePayload.brandingTokens!.tokens.semantics.colors.surface as any).glassBorder;

                await appDriver.adminUpsertTenant(updatePayload, localAdminUser);

                // Verify motion features now disabled
                const response = await appDriver.listAllTenants(localAdminUser);
                const updatedTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(updatedTenant!.brandingTokens?.tokens.motion?.enableParallax).toBe(false);
                expect(updatedTenant!.brandingTokens?.tokens.motion?.enableMagneticHover).toBe(false);
                // Note: Glass properties may still exist in Firestore due to merge:true behavior.
                // The motion flags control whether they're actually used by the UI.
            });

            it('should reject tenant creation when brandingTokens is missing', async () => {
                const tenantId = `test-motion-vanilla-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                // Remove brandingTokens - should be rejected (no longer auto-generated)
                delete (payload as any).brandingTokens;

                await expect(appDriver.adminUpsertTenant(payload, localAdminUser))
                    .rejects
                    .toMatchObject({ code: 'VALIDATION_ERROR' });
            });
        });

        describe('Typography Settings', () => {
            it('should persist custom font families when creating tenant with typography', async () => {
                const tenantId = `test-typography-${Date.now()}`;
                const expectedSans = 'Roboto, Arial, sans-serif';
                const expectedSerif = 'Merriweather, Georgia, serif';
                const expectedMono = 'Fira Code, Consolas, monospace';

                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withFontFamily({
                        sans: expectedSans,
                        serif: expectedSerif,
                        mono: expectedMono,
                    })
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify typography persisted
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.sans).toBe(expectedSans);
                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.serif).toBe(expectedSerif);
                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.mono).toBe(expectedMono);
            });

            it('should preserve existing typography when updating other branding fields', async () => {
                const tenantId = `test-typography-preserve-${Date.now()}`;
                const expectedSans = 'Montserrat, Helvetica, sans-serif';
                const expectedSerif = 'Playfair Display, Times New Roman, serif';
                const expectedMono = 'Source Code Pro, Courier, monospace';

                // Create tenant with custom typography
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withFontFamily({
                        sans: expectedSans,
                        serif: expectedSerif,
                        mono: expectedMono,
                    })
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Fetch existing tenant to get current brandingTokens
                const existingResponse = await appDriver.listAllTenants(localAdminUser);
                const existingTenant = existingResponse.tenants.find(t => t.tenant.tenantId === tenantId);

                // Update tenant with different color, but preserve existing typography
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withPrimaryColor('#00ff00')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                // Manually preserve the custom typography from existing tenant
                if (existingTenant?.brandingTokens?.tokens.typography) {
                    updatePayload.brandingTokens!.tokens.typography.fontFamily = existingTenant.brandingTokens.tokens.typography.fontFamily;
                }

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult.created).toBe(false);

                // Verify typography still intact
                const response = await appDriver.listAllTenants(localAdminUser);
                const updatedTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(updatedTenant?.brandingTokens?.tokens.typography.fontFamily.sans).toBe(expectedSans);
                expect(updatedTenant?.brandingTokens?.tokens.typography.fontFamily.serif).toBe(expectedSerif);
                expect(updatedTenant?.brandingTokens?.tokens.typography.fontFamily.mono).toBe(expectedMono);
                expect(updatedTenant?.brandingTokens?.tokens.palette.primary).toBe('#00ff00');
            });

            it('should use default typography when not explicitly provided', async () => {
                const tenantId = `test-typography-default-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify default typography applied
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.sans).toBe('Space Grotesk, Inter, system-ui, -apple-system, BlinkMacSystemFont');
                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.serif).toBe('Fraunces, Georgia, serif');
                expect(createdTenant?.brandingTokens?.tokens.typography.fontFamily.mono).toBe('JetBrains Mono, SFMono-Regular, Menlo, monospace');
            });
        });

        describe('Aurora Gradient Settings', () => {
            it('should persist custom aurora gradient colors when creating tenant', async () => {
                const tenantId = `test-gradient-${Date.now()}`;
                const customGradient = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withGradient({ aurora: customGradient })
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify gradient persisted
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.gradient?.aurora).toEqual(customGradient);
            });

            it('should preserve existing gradient when updating other branding fields', async () => {
                const tenantId = `test-gradient-preserve-${Date.now()}`;
                const customGradient = ['#aa0000', '#00aa00', '#0000aa', '#aaaa00'];

                // Create tenant with custom gradient
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withGradient({ aurora: customGradient })
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Fetch existing tenant to get current brandingTokens
                const existingResponse = await appDriver.listAllTenants(localAdminUser);
                const existingTenant = existingResponse.tenants.find(t => t.tenant.tenantId === tenantId);

                // Update tenant with different color, but preserve existing gradient
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withPrimaryColor('#ff00ff')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                // Manually preserve the custom gradient from existing tenant
                if (existingTenant?.brandingTokens?.tokens.semantics.colors.gradient) {
                    if (!updatePayload.brandingTokens!.tokens.semantics.colors.gradient) {
                        updatePayload.brandingTokens!.tokens.semantics.colors.gradient = {};
                    }
                    updatePayload.brandingTokens!.tokens.semantics.colors.gradient.aurora = existingTenant.brandingTokens.tokens.semantics.colors.gradient.aurora;
                }

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult.created).toBe(false);

                // Verify gradient still intact
                const response = await appDriver.listAllTenants(localAdminUser);
                const updatedTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(updatedTenant?.brandingTokens?.tokens.semantics.colors.gradient?.aurora).toEqual(customGradient);
                expect(updatedTenant?.brandingTokens?.tokens.palette.primary).toBe('#ff00ff');
            });

            it('should handle gradient correctly when not explicitly provided', async () => {
                const tenantId = `test-gradient-default-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify branding tokens were created
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                // Gradient is optional in the schema, may or may not be present
                expect(createdTenant?.brandingTokens?.tokens).toBeDefined();
                expect(createdTenant?.brandingTokens?.tokens.semantics.colors).toBeDefined();
            });
        });

        describe('Glassmorphism Settings', () => {
            it('should persist custom glassmorphism colors when creating tenant', async () => {
                const tenantId = `test-glass-${Date.now()}`;
                const expectedGlass = 'rgba(10, 20, 30, 0.6)';
                const expectedGlassBorder = 'rgba(200, 210, 220, 0.2)';

                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme() // Enables glassmorphism
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withGlassColors(expectedGlass, expectedGlassBorder)
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify glass colors persisted
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glass).toBe(expectedGlass);
                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glassBorder).toBe(expectedGlassBorder);
            });

            it('should preserve existing glassmorphism when updating other fields', async () => {
                const tenantId = `test-glass-preserve-${Date.now()}`;
                const expectedGlass = 'rgba(50, 60, 70, 0.5)';
                const expectedGlassBorder = 'rgba(100, 150, 200, 0.15)';

                // Create tenant with custom glass colors
                const createPayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withAuroraTheme()
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .withGlassColors(expectedGlass, expectedGlassBorder)
                    .build();

                await appDriver.adminUpsertTenant(createPayload, localAdminUser);

                // Fetch existing tenant
                const existingResponse = await appDriver.listAllTenants(localAdminUser);
                const existingTenant = existingResponse.tenants.find(t => t.tenant.tenantId === tenantId);

                // Update tenant with different color, but preserve glassmorphism
                const updatePayload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withPrimaryColor('#aa00aa')
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                // Manually preserve glass colors
                if (existingTenant?.brandingTokens?.tokens.semantics.colors.surface) {
                    updatePayload.brandingTokens!.tokens.semantics.colors.surface.glass = existingTenant.brandingTokens.tokens.semantics.colors.surface.glass;
                    updatePayload.brandingTokens!.tokens.semantics.colors.surface.glassBorder = existingTenant.brandingTokens.tokens.semantics.colors.surface.glassBorder;
                }

                const updateResult = await appDriver.adminUpsertTenant(updatePayload, localAdminUser);
                expect(updateResult.created).toBe(false);

                // Verify glass colors still intact
                const response = await appDriver.listAllTenants(localAdminUser);
                const updatedTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(updatedTenant?.brandingTokens?.tokens.semantics.colors.surface.glass).toBe(expectedGlass);
                expect(updatedTenant?.brandingTokens?.tokens.semantics.colors.surface.glassBorder).toBe(expectedGlassBorder);
                expect(updatedTenant?.brandingTokens?.tokens.palette.primary).toBe('#aa00aa');
            });

            it('should not have glassmorphism when not enabled', async () => {
                const tenantId = `test-glass-disabled-${Date.now()}`;
                const payload = AdminTenantRequestBuilder
                    .forTenant(tenantId)
                    .withDomains([toTenantDomainName(`${tenantId}.test.local`)])
                    .build();

                const result = await appDriver.adminUpsertTenant(payload, localAdminUser);
                expect(result.created).toBe(true);

                // Verify no glass properties
                const response = await appDriver.listAllTenants(localAdminUser);
                const createdTenant = response.tenants.find(t => t.tenant.tenantId === tenantId);

                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glass).toBeUndefined();
                expect(createdTenant?.brandingTokens?.tokens.semantics.colors.surface.glassBorder).toBeUndefined();
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

        describe('PUT /api/admin/users/:uid/profile - updateUserProfileAdmin', () => {
            it('should update user displayName', async () => {
                // Get original user data
                const originalAuth = await appDriver.getUserAuth(regularUser, adminUser);
                const originalDisplayName = originalAuth.displayName;

                // Update displayName
                const newDisplayName = toDisplayName('Updated Test Name');
                await appDriver.updateUserProfileAdmin(regularUser, { displayName: newDisplayName }, adminUser);

                // Verify the change
                const updatedAuth = await appDriver.getUserAuth(regularUser, adminUser);
                expect(updatedAuth.displayName).toBe(newDisplayName);
                expect(updatedAuth.displayName).not.toBe(originalDisplayName);
            });

            it('should update user email', async () => {
                // Get original user data
                const originalAuth = await appDriver.getUserAuth(regularUser, adminUser);
                const originalEmail = originalAuth.email;

                // Update email
                const newEmail = toEmail('updated-test-email@example.com');
                await appDriver.updateUserProfileAdmin(regularUser, { email: newEmail }, adminUser);

                // Verify the change
                const updatedAuth = await appDriver.getUserAuth(regularUser, adminUser);
                expect(updatedAuth.email).toBe(newEmail);
                expect(updatedAuth.email).not.toBe(originalEmail);
            });

            it('should update both displayName and email', async () => {
                const newDisplayName = toDisplayName('Both Updated Name');
                const newEmail = toEmail('both-updated@example.com');

                await appDriver.updateUserProfileAdmin(regularUser, {
                    displayName: newDisplayName,
                    email: newEmail,
                }, adminUser);

                const updatedAuth = await appDriver.getUserAuth(regularUser, adminUser);
                expect(updatedAuth.displayName).toBe(newDisplayName);
                expect(updatedAuth.email).toBe(newEmail);
            });

            it('should reject when no fields provided', async () => {
                await expect(
                    appDriver.updateUserProfileAdmin(regularUser, {}, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject invalid displayName (empty string)', async () => {
                await expect(
                    appDriver.updateUserProfileAdmin(regularUser, { displayName: toDisplayName('') }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject invalid email (no @)', async () => {
                await expect(
                    appDriver.updateUserProfileAdmin(regularUser, { email: toEmail('invalid-email') }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject non-existent user', async () => {
                await expect(
                    appDriver.updateUserProfileAdmin(toUserId('nonexistent-user'), { displayName: toDisplayName('Test') }, adminUser),
                )
                    .rejects
                    .toThrow();
            });

            it('should reject invalid UID', async () => {
                await expect(
                    appDriver.updateUserProfileAdmin(toUserId(''), { displayName: toDisplayName('Test') }, adminUser),
                )
                    .rejects
                    .toThrow();
            });
        });
    });
});
