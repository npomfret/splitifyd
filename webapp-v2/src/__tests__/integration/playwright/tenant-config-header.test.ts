/**
 * Tenant Config Header Tests
 *
 * Tests that header branding options from tenant configuration are applied correctly.
 */

import { customAppConfigHandler } from '@/test/msw/handlers';
import { TenantConfigBuilder } from '@billsplit-wl/shared';
import { AppConfigurationBuilder, ClientUserBuilder, HeaderPage } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { createMockFirebase, mockFullyAcceptedPoliciesApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Tenant Config Header', () => {
    test('should display app name in header by default', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config with app name (showAppNameInHeader defaults to true/undefined)
        const tenantConfig = new TenantConfigBuilder()
            .withAppName('My Custom App')
            .build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the config handler AFTER mock setup
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where header is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify app name is displayed in header
        const headerPage = new HeaderPage(page);
        await headerPage.verifyHeaderVisible();
        await headerPage.verifyAppNameVisible('My Custom App');

        await mockFirebase.dispose();
    });

    test('should hide app name in header when showAppNameInHeader is false', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config with showAppNameInHeader = false
        const tenantConfig = new TenantConfigBuilder()
            .withAppName('Hidden App Name')
            .withShowAppNameInHeader(false)
            .build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the config handler AFTER mock setup
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where header is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify header is visible but app name is NOT
        const headerPage = new HeaderPage(page);
        await headerPage.verifyHeaderVisible();
        await headerPage.verifyAppNameNotVisible('Hidden App Name');

        await mockFirebase.dispose();
    });

    test('should show app name in header when showAppNameInHeader is explicitly true', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config with showAppNameInHeader = true (explicit)
        const tenantConfig = new TenantConfigBuilder()
            .withAppName('Explicit App Name')
            .withShowAppNameInHeader(true)
            .build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the config handler AFTER mock setup
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where header is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify app name is displayed in header
        const headerPage = new HeaderPage(page);
        await headerPage.verifyHeaderVisible();
        await headerPage.verifyAppNameVisible('Explicit App Name');

        await mockFirebase.dispose();
    });
});
