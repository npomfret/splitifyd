/**
 * Tenant Config Footer Tests
 *
 * Tests that footer links from tenant configuration are rendered correctly.
 */

import { customAppConfigHandler } from '@/test/msw/handlers';
import { TenantConfigBuilder } from '@billsplit-wl/shared';
import { AppConfigurationBuilder, ClientUserBuilder, FooterComponent } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { createMockFirebase, mockFullyAcceptedPoliciesApi, setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

test.describe('Tenant Config Footer Links', () => {
    test('should display footer links when configured in tenant config', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config with footer links
        const tenantConfig = new TenantConfigBuilder()
            .withFooterLinks([
                { id: 'terms', label: 'Terms of Service', url: 'https://example.com/terms' },
                { id: 'privacy', label: 'Privacy Policy', url: 'https://example.com/privacy' },
            ])
            .build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first (this registers default handlers)
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the default config handler with our custom config AFTER mock setup
        // (Later handlers take priority in MSW)
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where footer is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify footer links are visible with correct attributes
        const footerComponent = new FooterComponent(page);
        await footerComponent.verifyFooterVisible();
        await footerComponent.verifyFooterLinkIsExternal('Terms of Service', 'https://example.com/terms');
        await footerComponent.verifyFooterLinkIsExternal('Privacy Policy', 'https://example.com/privacy');

        await mockFirebase.dispose();
    });

    test('should not display footer links section when no links configured', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config without footer links (default has no links)
        const tenantConfig = new TenantConfigBuilder().build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first (this registers default handlers)
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the default config handler with our custom config AFTER mock setup
        // (Later handlers take priority in MSW)
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where footer is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify footer is visible but links section is not
        const footerComponent = new FooterComponent(page);
        await footerComponent.verifyFooterVisible();
        await footerComponent.verifyLinksSectionNotVisible();

        await mockFirebase.dispose();
    });

    test('should display app name in footer from tenant config', async ({ pageWithLogging: page, msw }) => {
        // Build tenant config with custom app name
        const tenantConfig = new TenantConfigBuilder()
            .withAppName('Custom App Name')
            .build();

        const appConfig = new AppConfigurationBuilder()
            .withTenantConfig(tenantConfig)
            .build();

        // Set up authenticated user first (this registers default handlers)
        const testUser = ClientUserBuilder.validUser().build();
        const mockFirebase = await createMockFirebase(page, testUser);
        await mockFullyAcceptedPoliciesApi(page);
        await setupSuccessfulApiMocks(page, testUser);

        // Override the default config handler with our custom config AFTER mock setup
        // (Later handlers take priority in MSW)
        await msw.use(customAppConfigHandler(appConfig));

        // Navigate to dashboard where footer is visible
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/dashboard/);

        // Verify app name is displayed in footer
        const footerComponent = new FooterComponent(page);
        await footerComponent.verifyFooterVisible();
        await footerComponent.verifyAppName('Custom App Name');

        await mockFirebase.dispose();
    });
});
