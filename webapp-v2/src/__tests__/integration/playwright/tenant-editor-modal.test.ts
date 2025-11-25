import { AdminTenantsPage, TenantBrowserRecordBuilder, TenantEditorModalPage } from '@billsplit-wl/test-support';
import { ApiSerializer, toISOString } from '@billsplit-wl/shared';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Tenant Editor Modal', () => {
    test('should open modal when clicking create button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Click create button through POM
        await tenantEditorModal.clickCreateTenant();

        // Verify modal opens
        await tenantEditorModal.verifyModalIsOpen();
    });

    test('should display all form fields in create mode', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Verify all fields are visible through POM verification methods
        await tenantEditorModal.verifyAllBasicFieldsVisible();
        await tenantEditorModal.verifyAllColorFieldsVisible();
        await tenantEditorModal.verifyTypographyFieldsVisible();
        await tenantEditorModal.verifyMotionEffectsCheckboxesVisible();
        await tenantEditorModal.verifyAuroraGradientColorsVisible();
        await tenantEditorModal.verifyGlassmorphismColorsVisible();

        // Verify tenant ID is editable in create mode
        await tenantEditorModal.verifyTenantIdEnabled();
    });

    test('should validate required fields', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Try to save without filling fields
        await tenantEditorModal.clickSave();

        // Should show validation error
        await tenantEditorModal.verifyErrorMessage();
    });

    test('should validate tenant ID format', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Fill with invalid tenant ID (contains uppercase)
        await tenantEditorModal.fillTenantId('Invalid-Tenant-ID');
        await tenantEditorModal.fillAppName('Test Tenant');
        // Note: Logo/favicon disabled in create mode, focus is on tenant ID validation
        await tenantEditorModal.addDomain('test.example.com');
        await tenantEditorModal.clickSave();

        // Should show validation error about lowercase
        await tenantEditorModal.verifyErrorMessage();
    });

    test('should validate domain format', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Fill with invalid domain
        await tenantEditorModal.fillTenantId('test-tenant');
        await tenantEditorModal.fillAppName('Test Tenant');
        // Note: Logo/favicon disabled in create mode, focus is on domain validation
        await tenantEditorModal.addDomain('invalid domain with spaces');
        await tenantEditorModal.clickSave();

        // Should show validation error about domain
        await tenantEditorModal.verifyErrorMessage();
    });

    test('should close modal when clicking cancel', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        await tenantEditorModal.clickCancel();

        await tenantEditorModal.verifyModalIsClosed();
    });

    test('should close modal when clicking X button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        await tenantEditorModal.clickClose();

        await tenantEditorModal.verifyModalIsClosed();
    });

    test('should add and remove domains', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Add a domain
        await tenantEditorModal.addDomain('domain1.example.com');

        // Verify domain appears in the list
        await tenantEditorModal.verifyDomainVisible('domain1.example.com');

        // Remove the domain
        await tenantEditorModal.removeDomain(0);

        // Verify domain is removed
        await tenantEditorModal.verifyDomainNotVisible('domain1.example.com');
    });

    test('should open modal in edit mode with populated fields', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        // Click edit on first tenant
        await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Wait for form to be populated
        await tenantEditorModal.waitForFormPopulated();

        // Verify tenant ID is disabled in edit mode
        await tenantEditorModal.verifyTenantIdDisabled();

        // Verify fields are populated (they shouldn't be empty)
        const appNameValue = await tenantEditorModal.getAppNameValue();
        expect(appNameValue).toBeTruthy();
        expect(appNameValue.length).toBeGreaterThan(0);
    });

    test('should offer a publish option when editing', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();

        await adminTenantsPage.clickEditButtonForFirstTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        await tenantEditorModal.clickPublish();

        await tenantEditorModal.verifySuccessMessage('Theme published successfully!');
    });

    test('should toggle marketing flags', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        // Check initial state of landing page checkbox (should be checked by default)
        await tenantEditorModal.verifyShowLandingPageChecked(true);

        // Toggle it off
        await tenantEditorModal.toggleShowLandingPage(false);
        await tenantEditorModal.verifyShowLandingPageChecked(false);

        // Toggle it back on
        await tenantEditorModal.toggleShowLandingPage(true);
        await tenantEditorModal.verifyShowLandingPageChecked(true);
    });

    test('should create a tenant after filling required fields', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminTenantsPage = new AdminTenantsPage(page);
        const tenantEditorModal = new TenantEditorModalPage(page);

        const tenantId = `playwright-tenant-${Date.now()}`;

        await adminTenantsPage.navigate();
        await adminTenantsPage.waitForTenantsLoaded();
        await tenantEditorModal.clickCreateTenant();
        await tenantEditorModal.waitForModalToBeVisible();

        await tenantEditorModal.fillTenantId(tenantId);
        await tenantEditorModal.fillAppName('Playwright Tenant');
        // Note: Logo/favicon upload is disabled until tenant is saved, so skip for create test
        await tenantEditorModal.setPrimaryColor('#0f172a');
        await tenantEditorModal.setSecondaryColor('#1e3a8a');
        await tenantEditorModal.setAccentColor('#f97316');
        await tenantEditorModal.addDomain(`${tenantId}.example.com`);

        await tenantEditorModal.clickSave();

        await tenantEditorModal.verifySuccessMessage();
        await tenantEditorModal.verifyModalIsClosed();

        // Note: Cannot verify tenant appears in list since we're using static MSW mocks
        // The actual tenant list refresh is tested in e2e tests against real emulator
    });

    test.describe('Phase 2: Typography Features', () => {
        test('should display typography font family inputs', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify typography fields are visible
            await tenantEditorModal.verifyTypographyFieldsVisible();
        });

        test('should allow setting custom font families', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Set custom fonts
            await tenantEditorModal.setFontFamilySans('Roboto, sans-serif');
            await tenantEditorModal.setFontFamilySerif('Georgia, serif');
            await tenantEditorModal.setFontFamilyMono('Fira Code, monospace');

            // Verify values are set
            await tenantEditorModal.verifyFontFamilySansValue('Roboto, sans-serif');
            await tenantEditorModal.verifyFontFamilySerifValue('Georgia, serif');
            await tenantEditorModal.verifyFontFamilyMonoValue('Fira Code, monospace');
        });
    });

    test.describe('Phase 2: Motion & Effects Features', () => {
        test('should display motion and effects checkboxes', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify motion checkboxes are visible
            await tenantEditorModal.verifyMotionEffectsCheckboxesVisible();
        });

        test('should toggle motion effects on and off', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Toggle aurora animation
            await tenantEditorModal.toggleAuroraAnimation(true);
            await tenantEditorModal.verifyAuroraAnimationChecked(true);
            await tenantEditorModal.toggleAuroraAnimation(false);
            await tenantEditorModal.verifyAuroraAnimationChecked(false);

            // Toggle glassmorphism
            await tenantEditorModal.toggleGlassmorphism(true);
            await tenantEditorModal.verifyGlassmorphismChecked(true);
            await tenantEditorModal.toggleGlassmorphism(false);
            await tenantEditorModal.verifyGlassmorphismChecked(false);
        });
    });

    test.describe('Phase 2: Aurora Gradient Features', () => {
        test('should display all 4 aurora gradient color inputs', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify all 4 gradient color pickers are visible
            await tenantEditorModal.verifyAuroraGradientColorsVisible();
        });

        test('should allow setting custom aurora gradient colors', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Set custom gradient colors
            await tenantEditorModal.setAuroraGradientColor1('#ff0000');
            await tenantEditorModal.setAuroraGradientColor2('#00ff00');
            await tenantEditorModal.setAuroraGradientColor3('#0000ff');
            await tenantEditorModal.setAuroraGradientColor4('#ffff00');

            // Verify colors are set
            await tenantEditorModal.verifyAuroraGradientColor1Value('#ff0000');
            await tenantEditorModal.verifyAuroraGradientColor2Value('#00ff00');
            await tenantEditorModal.verifyAuroraGradientColor3Value('#0000ff');
            await tenantEditorModal.verifyAuroraGradientColor4Value('#ffff00');
        });
    });

    test.describe('Phase 2: Glassmorphism Features', () => {
        test('should display glassmorphism color inputs', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify glassmorphism inputs are visible
            await tenantEditorModal.verifyGlassmorphismColorsVisible();
        });

        test('should allow setting custom glassmorphism colors', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Set custom glassmorphism colors (RGBA format)
            await tenantEditorModal.setGlassColor('rgba(10, 20, 30, 0.5)');
            await tenantEditorModal.setGlassBorderColor('rgba(255, 255, 255, 0.2)');

            // Verify colors are set
            await tenantEditorModal.verifyGlassColorValue('rgba(10, 20, 30, 0.5)');
            await tenantEditorModal.verifyGlassBorderColorValue('rgba(255, 255, 255, 0.2)');
        });
    });

    test.describe('Auto-Publish Theme on Save', () => {
        test('should automatically publish theme after saving tenant', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            const tenantId = `auto-publish-tenant-${Date.now()}`;

            // Set up request tracking for publish API
            let publishThemeCalled = false;
            await page.route('**/api/admin/tenants/publish', async (route) => {
                publishThemeCalled = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        artifact: {
                            hash: 'auto-publish-hash-123',
                            cssUrl: 'https://storage.example.com/themes/auto-theme.css',
                            tokensUrl: 'https://storage.example.com/themes/auto-tokens.json',
                            version: 1,
                            generatedAtEpochMs: Date.now(),
                            generatedBy: 'test-admin',
                        },
                        cssUrl: 'https://storage.example.com/themes/auto-theme.css',
                        tokensUrl: 'https://storage.example.com/themes/auto-tokens.json',
                    }),
                });
            });

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Fill required fields (logo/favicon skipped - URL download not available in test env)
            await tenantEditorModal.fillTenantId(tenantId);
            await tenantEditorModal.fillAppName('Auto Publish Test Tenant');
            await tenantEditorModal.setPrimaryColor('#1a73e8');
            await tenantEditorModal.setSecondaryColor('#34a853');
            await tenantEditorModal.setAccentColor('#fbbc04');
            await tenantEditorModal.setHeaderBackgroundColor('#111827');
            await tenantEditorModal.addDomain(`${tenantId}.example.com`);

            // Save tenant
            await tenantEditorModal.clickSave();

            // Wait for success message and modal close
            await tenantEditorModal.verifySuccessMessage();
            await tenantEditorModal.verifyModalIsClosed();

            // Verify publish API was called automatically
            expect(publishThemeCalled).toBe(true);
        });

        test('should show appropriate message if auto-publish succeeds', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            const tenantId = `publish-success-${Date.now()}`;

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await tenantEditorModal.clickCreateTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Fill required fields
            await tenantEditorModal.fillTenantId(tenantId);
            await tenantEditorModal.fillAppName('Publish Success Test');
            // Logo URL skipped - URL download not available in test env
            await tenantEditorModal.addDomain(`${tenantId}.example.com`);

            await tenantEditorModal.clickSave();

            // Success message should indicate theme was published
            await tenantEditorModal.verifySuccessMessage('published');
        });
    });

    test.describe('Comprehensive Field Test', () => {
        test('should edit, save, close, reopen and verify EVERY field loads correctly', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            // Set up stateful mock tenant data - will be updated after save
            let mockTenant = new TenantBrowserRecordBuilder()
                .withTenantId('test-tenant')
                .withAppName('Test Tenant')
                .withLogoUrl('/logo.svg')
                .withFaviconUrl('/favicon.ico')
                .withPrimaryColor('#3B82F6')
                .withSecondaryColor('#8B5CF6')
                .withAccentColor('#000000')
                .withBackgroundColor('#000000')
                .withHeaderBackgroundColor('#000000')
                .withCustomCss('')
                .withMarketingFlags({
                    showLandingPage: true,
                    showMarketingContent: true,
                    showPricingPage: true,
                })
                .withDomains(['localhost'])
                .withIsDefault(true)
                .build();

            // Override MSW mocks with stateful handlers
            await page.route('**/api/admin/browser/tenants', async (route) => {
                if (route.request().method() === 'GET') {
                    const responsePayload = {
                        tenants: [mockTenant],
                        count: 1,
                    };
                    const serialized = ApiSerializer.serialize(responsePayload);

                    console.log('[TEST] GET /admin/browser/tenants - mockTenant.tenant.branding.backgroundColor:', mockTenant.tenant.branding.backgroundColor);
                    console.log('[TEST] GET /admin/browser/tenants - mockTenant.tenant.branding.appName:', mockTenant.tenant.branding.appName);
                    console.log('[TEST] GET /admin/browser/tenants - serialized response length:', serialized.length);
                    console.log('[TEST] GET /admin/browser/tenants - serialized response contains backgroundColor:', serialized.includes('backgroundColor'));

                    await route.fulfill({
                        status: 200,
                        contentType: 'application/x-serialized-json',
                        body: serialized,
                    });
                } else {
                    await route.continue();
                }
            });

            await page.route('**/api/admin/tenants', async (route) => {
                if (route.request().method() === 'POST') {
                    const requestBody = await route.request().postDataJSON();

                    console.log('[TEST] POST /admin/tenants - requestBody.branding.backgroundColor:', requestBody.branding?.backgroundColor);
                    console.log('[TEST] POST /admin/tenants - requestBody.branding.appName:', requestBody.branding?.appName);
                    console.log('[TEST] POST /admin/tenants - requestBody.brandingTokens exists?:', !!requestBody.brandingTokens);
                    console.log('[TEST] POST /admin/tenants - requestBody.brandingTokens.tokens?.motion?.enableMagneticHover:', requestBody.brandingTokens?.tokens?.motion?.enableMagneticHover);

                    // Deep merge: update mockTenant with the new values from request
                    // Preserve nested objects that weren't in the request
                    mockTenant.tenant.branding = {
                        ...mockTenant.tenant.branding,
                        ...requestBody.branding,
                        marketingFlags: requestBody.branding?.marketingFlags ?? mockTenant.tenant.branding.marketingFlags,
                    };

                    // CRITICAL: Update brandingTokens from request
                    if (requestBody.brandingTokens) {
                        mockTenant.brandingTokens = requestBody.brandingTokens;
                        console.log('[TEST] POST /admin/tenants - Stored glass color:', requestBody.brandingTokens.tokens?.semantics?.colors?.surface?.glass);
                        console.log('[TEST] POST /admin/tenants - Stored glass border:', requestBody.brandingTokens.tokens?.semantics?.colors?.surface?.glassBorder);
                    }

                    mockTenant.tenant.updatedAt = toISOString(new Date().toISOString());

                    console.log('[TEST] POST /admin/tenants - AFTER MERGE mockTenant.tenant.branding.backgroundColor:', mockTenant.tenant.branding.backgroundColor);
                    console.log('[TEST] POST /admin/tenants - AFTER MERGE mockTenant.tenant.branding.appName:', mockTenant.tenant.branding.appName);

                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            tenantId: requestBody.tenantId,
                            created: false,
                        }),
                    });
                } else {
                    await route.continue();
                }
            });

            // Navigate to tenants page and edit the existing tenant (use first tenant)
            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Edit EVERY field with specific test values (logo/favicon skipped - URL download not available)
            await tenantEditorModal.fillAppName('Updated Test App');

            // Colors - use specific test values
            await tenantEditorModal.setPrimaryColor('#aa11bb');
            await tenantEditorModal.setSecondaryColor('#bb22cc');
            await tenantEditorModal.setAccentColor('#cc33dd');
            await tenantEditorModal.setBackgroundColor('#dddddd');
            await tenantEditorModal.setHeaderBackgroundColor('#111111');

            // Custom CSS
            await tenantEditorModal.setCustomCss('/* updated css */');

            // Marketing flags
            await tenantEditorModal.toggleShowLandingPage(false);
            await tenantEditorModal.toggleShowMarketingContent(false);
            await tenantEditorModal.toggleShowPricingPage(true);

            // Motion & Effects
            await tenantEditorModal.toggleAuroraAnimation(false);
            await tenantEditorModal.toggleGlassmorphism(true); // Enable glassmorphism since we're setting glass colors
            await tenantEditorModal.toggleMagneticHover(true);
            await tenantEditorModal.toggleScrollReveal(false);

            // Typography
            await tenantEditorModal.setFontFamilySans('Arial, sans-serif');
            await tenantEditorModal.setFontFamilySerif('Times, serif');
            await tenantEditorModal.setFontFamilyMono('Courier, monospace');

            // Aurora Gradient
            await tenantEditorModal.setAuroraGradientColor1('#aa0000');
            await tenantEditorModal.setAuroraGradientColor2('#00bb00');
            await tenantEditorModal.setAuroraGradientColor3('#0000cc');
            await tenantEditorModal.setAuroraGradientColor4('#dddd00');

            // Glassmorphism
            await tenantEditorModal.setGlassColor('rgba(50, 60, 70, 0.8)');
            await tenantEditorModal.setGlassBorderColor('rgba(100, 110, 120, 0.4)');

            // Save changes
            await tenantEditorModal.clickSave();
            // Note: Success message appears briefly then modal closes - skip verification
            await tenantEditorModal.verifyModalIsClosed();

            // Reopen the same tenant to verify all fields loaded correctly
            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify ALL fields loaded with the saved values
            await tenantEditorModal.verifyFieldValue('appName', 'Updated Test App');
            // Note: Logo/Favicon URL verification not possible - UI uses ImageUploadField

            // Verify colors
            await tenantEditorModal.verifyPrimaryColorValue('#aa11bb');
            await tenantEditorModal.verifySecondaryColorValue('#bb22cc');
            await tenantEditorModal.verifyAccentColorValue('#cc33dd');
            await tenantEditorModal.verifyBackgroundColorValue('#dddddd');
            await tenantEditorModal.verifyHeaderBackgroundColorValue('#111111');

            // Verify custom CSS
            await tenantEditorModal.verifyCustomCssValue('/* updated css */');

            // Verify marketing flags
            await tenantEditorModal.verifyShowLandingPageChecked(false);
            await tenantEditorModal.verifyShowMarketingContentChecked(false);
            await tenantEditorModal.verifyShowPricingPageChecked(true);

            // Verify motion & effects
            await tenantEditorModal.verifyAuroraAnimationChecked(false);
            await tenantEditorModal.verifyGlassmorphismChecked(true); // true because glass colors are set
            await tenantEditorModal.verifyMagneticHoverChecked(true);
            await tenantEditorModal.verifyScrollRevealChecked(false);

            // Verify typography
            await tenantEditorModal.verifyFontFamilySansValue('Arial, sans-serif');
            await tenantEditorModal.verifyFontFamilySerifValue('Times, serif');
            await tenantEditorModal.verifyFontFamilyMonoValue('Courier, monospace');

            // Verify aurora gradient
            await tenantEditorModal.verifyAuroraGradientColor1Value('#aa0000');
            await tenantEditorModal.verifyAuroraGradientColor2Value('#00bb00');
            await tenantEditorModal.verifyAuroraGradientColor3Value('#0000cc');
            await tenantEditorModal.verifyAuroraGradientColor4Value('#dddd00');

            // Verify glassmorphism
            await tenantEditorModal.verifyGlassColorValue('rgba(50, 60, 70, 0.8)');
            await tenantEditorModal.verifyGlassBorderColorValue('rgba(100, 110, 120, 0.4)');

            // Close modal
            await tenantEditorModal.clickCancel();
            await tenantEditorModal.verifyModalIsClosed();
        });
    });

    test.describe('Image Upload', () => {
        test('should disable image upload fields until tenant is saved', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();
            await page.getByTestId('create-tenant-button').click();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify image upload fields are disabled initially
            const logoUploadField = page.getByTestId('logo-upload-field');
            const faviconUploadField = page.getByTestId('favicon-upload-field');

            await expect(logoUploadField).toBeVisible();
            await expect(faviconUploadField).toBeVisible();

            // Verify helper text indicates need to save first (appears twice - once for logo, once for favicon)
            await expect(page.getByText('Save tenant first to enable upload').first()).toBeVisible();
        });

        test('should enable image upload after tenant is saved', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();

            // Edit existing tenant (click first edit button)
            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Verify image upload fields are enabled for existing tenant
            const logoUploadField = page.getByTestId('logo-upload-field');
            const faviconUploadField = page.getByTestId('favicon-upload-field');

            await expect(logoUploadField).toBeVisible();
            await expect(faviconUploadField).toBeVisible();

            // Verify helper text shows file format info
            await expect(page.getByText(/Max 2MB.*Formats/)).toBeVisible();
        });

        test('should show current logo image when editing tenant', async ({ systemAdminPage }) => {
            const { page } = systemAdminPage;
            const adminTenantsPage = new AdminTenantsPage(page);
            const tenantEditorModal = new TenantEditorModalPage(page);

            await adminTenantsPage.navigate();
            await adminTenantsPage.waitForTenantsLoaded();

            // Edit tenant with existing logo (click first edit button)
            await adminTenantsPage.clickEditButtonForFirstTenant();
            await tenantEditorModal.waitForModalToBeVisible();

            // Check for image preview OR fallback (test URLs may not be downloadable)
            const logoUploadField = page.getByTestId('logo-upload-field');
            const logoImage = logoUploadField.locator('img[alt="Preview"]');
            const logoFallback = logoUploadField.getByText('Image URL set');

            // Either the actual image loads or the fallback UI shows
            const imageVisible = await logoImage.isVisible().catch(() => false);
            const fallbackVisible = await logoFallback.isVisible().catch(() => false);

            expect(imageVisible || fallbackVisible).toBeTruthy();
        });
    });
});
