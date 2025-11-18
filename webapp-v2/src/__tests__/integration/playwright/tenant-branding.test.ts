import { SystemUserRoles } from '@billsplit-wl/shared';
import type { TenantSettingsResponse } from '@billsplit-wl/shared';
import { ClientUserBuilder, TenantBrandingPage, TenantConfigBuilder, TenantSettingsResponseBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

/**
 * Tenant Branding Configuration E2E Tests
 *
 * Tests the tenant branding editor page, which allows tenant admins
 * to configure their tenant's branding and marketing flags.
 *
 * Access Control:
 * - Tenant admins (role: tenant_admin) can access
 * - System admins (role: system_admin) can access
 * - Regular users (role: system_user) are denied
 */

const mockTenantSettings: TenantSettingsResponse = new TenantSettingsResponseBuilder()
    .withTenantId('test-tenant')
    .withConfig(new TenantConfigBuilder()
        .withTenantId('test-tenant')
        .withAppName('Test App')
        .withLogoUrl('/logo.svg')
        .withFaviconUrl('/favicon.ico')
        .withPrimaryColor('#1a73e8')
        .withSecondaryColor('#34a853')
        .withCreatedAt('2025-01-01T00:00:00.000Z')
        .withUpdatedAt('2025-01-01T00:00:00.000Z'))
    .withDomains(['localhost'])
    .withPrimaryDomain('localhost')
    .build();

test.describe('Tenant Branding Page - Access Control', () => {
    test('should deny access to regular users', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const regularUser = new ClientUserBuilder()
            .withDisplayName('Regular User')
            .withEmail('regular@test.com')
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await authenticatedMockFirebase(regularUser);
        await setupSuccessfulApiMocks(page);

        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();

        // Should show access denied message
        await brandingPage.verifyAccessDenied();
    });

    test('should allow access to tenant admins', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant settings API
        await page.route('**/api/settings/tenant', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockTenantSettings),
            });
        });

        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();

        // Should load the page successfully
        await brandingPage.waitForPageReady();

        // Verify form is populated with current settings
        await brandingPage.verifyAppName('Test App');
        await brandingPage.verifyLogoUrl('/logo.svg');
        await brandingPage.verifyFaviconUrl('/favicon.ico');
        await brandingPage.verifyPrimaryColor('#1a73e8');
        await brandingPage.verifySecondaryColor('#34a853');
    });

    test('should allow access to system admins', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withDisplayName('System Admin')
            .withEmail('sysadmin@test.com')
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant settings API
        await page.route('**/api/settings/tenant', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockTenantSettings),
            });
        });

        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();

        // Should load the page successfully
        await brandingPage.waitForPageReady();

        // Verify form is populated
        await brandingPage.verifyAppName('Test App');
    });
});

test.describe('Tenant Branding Page - Form Interactions', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant settings GET endpoint
        await page.route('**/api/settings/tenant', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockTenantSettings),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should disable save button initially', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Save button should be disabled when no changes are made
        await brandingPage.verifySaveButtonDisabled();
    });

    test('should enable save button when changes are made', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Verify save button is initially disabled
        await brandingPage.verifySaveButtonDisabled();

        // Make a change
        await brandingPage.fillAppName('Updated App Name');

        // Save button should now be enabled
        await brandingPage.verifySaveButtonEnabled();
    });

    test('should update form fields correctly', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Update all fields
        await brandingPage.fillAppName('New App Name');
        await brandingPage.fillLogoUrl('/new-logo.svg');
        await brandingPage.fillFaviconUrl('/new-favicon.ico');
        await brandingPage.fillPrimaryColor('#ff0000');
        await brandingPage.fillSecondaryColor('#00ff00');

        // Verify changes
        await brandingPage.verifyAppName('New App Name');
        await brandingPage.verifyLogoUrl('/new-logo.svg');
        await brandingPage.verifyFaviconUrl('/new-favicon.ico');
        await brandingPage.verifyPrimaryColor('#ff0000');
        await brandingPage.verifySecondaryColor('#00ff00');
    });

    test('should toggle marketing flags', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Verify initial state
        await brandingPage.verifyShowLandingPageChecked(true);
        await brandingPage.verifyShowMarketingContentChecked(true);
        await brandingPage.verifyShowPricingPageChecked(false);

        // Toggle showPricingPage
        await brandingPage.toggleShowPricingPage();

        // Verify it's now checked
        await brandingPage.verifyShowPricingPageChecked(true);

        // Toggle it back
        await brandingPage.toggleShowPricingPage();

        // Verify it's unchecked again
        await brandingPage.verifyShowPricingPageChecked(false);
    });
});

test.describe('Tenant Branding Page - Form Submission', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant settings GET endpoint
        await page.route('**/api/settings/tenant', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockTenantSettings),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should show not implemented message when saving (501 response)', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Mock the PUT endpoint to return 501
        await page.route('**/api/settings/tenant/branding', async (route) => {
            await route.fulfill({
                status: 501,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: {
                        code: 'NOT_IMPLEMENTED',
                        message: 'Tenant branding update not yet implemented',
                    },
                }),
            });
        });

        // Make a change and save
        await brandingPage.fillAppName('Updated Name');
        await brandingPage.verifySaveButtonEnabled();
        await brandingPage.clickSaveButton();

        // Should show not implemented message
        await brandingPage.verifyNotImplementedMessage();
    });

    test('should call API with correct data when saving', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        let capturedRequestBody: any = null;

        // Mock the PUT endpoint
        await page.route('**/api/settings/tenant/branding', async (route) => {
            if (route.request().method() === 'PUT') {
                capturedRequestBody = await route.request().postDataJSON();
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Branding updated successfully',
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Make changes
        await brandingPage.fillAppName('Updated App Name');
        await brandingPage.fillPrimaryColor('#ff0000');
        await brandingPage.toggleShowPricingPage();

        // Save
        await brandingPage.clickSaveButton();

        // Wait for the request to complete
        await page.waitForResponse((response) => response.url().includes('/api/settings/tenant/branding') && response.request().method() === 'PUT');

        // Verify the request body contains the updated values
        expect(capturedRequestBody).toBeTruthy();
        expect(capturedRequestBody.appName).toBe('Updated App Name');
        expect(capturedRequestBody.primaryColor).toBe('#ff0000');
        expect(capturedRequestBody.marketingFlags.showPricingPage).toBe(true);
    });
});

test.describe('Tenant Branding Page - Marketing Flags', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant settings GET endpoint
        await page.route('**/api/settings/tenant', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockTenantSettings),
            });
        });
    });

    test('should display marketing flags correctly', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Verify all three marketing flags are visible
        await expect(brandingPage.getShowLandingPageCheckboxLocator()).toBeVisible();
        await expect(brandingPage.getShowMarketingContentCheckboxLocator()).toBeVisible();
        await expect(brandingPage.getShowPricingPageCheckboxLocator()).toBeVisible();

        // Verify their initial states match the mock data
        await brandingPage.verifyShowLandingPageChecked(true);
        await brandingPage.verifyShowMarketingContentChecked(true);
        await brandingPage.verifyShowPricingPageChecked(false);
    });

    test('should enable save button when marketing flags are toggled', async ({ pageWithLogging: page }) => {
        const brandingPage = new TenantBrandingPage(page);
        await brandingPage.navigate();
        await brandingPage.waitForPageReady();

        // Save button should be disabled initially
        await brandingPage.verifySaveButtonDisabled();

        // Toggle a marketing flag
        await brandingPage.toggleShowPricingPage();

        // Save button should now be enabled
        await brandingPage.verifySaveButtonEnabled();
    });
});
