import { SystemUserRoles } from '@billsplit-wl/shared';
import type { TenantDomainsResponse } from '@billsplit-wl/shared';
import { ClientUserBuilder, DomainManagementPage } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { setupSuccessfulApiMocks } from '../../utils/mock-firebase-service';

/**
 * Domain Management E2E Tests
 *
 * Tests the domain management page, which allows tenant admins
 * to manage their tenant's custom domains and view DNS configuration.
 *
 * Access Control:
 * - Tenant admins (role: tenant_admin) can access
 * - System admins (role: system_admin) can access
 * - Regular users (role: system_user) are denied
 */

const mockDomainsResponse: TenantDomainsResponse = {
    domains: ['localhost' as any, 'example.com' as any, 'app.example.com' as any],
    primaryDomain: 'localhost' as any,
};

test.describe('Domain Management Page - Access Control', () => {
    test('should deny access to regular users', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const regularUser = new ClientUserBuilder()
            .withDisplayName('Regular User')
            .withEmail('regular@test.com')
            .withRole(SystemUserRoles.SYSTEM_USER)
            .build();

        await authenticatedMockFirebase(regularUser);
        await setupSuccessfulApiMocks(page);

        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();

        // Should show access denied message
        await domainPage.verifyAccessDenied();
    });

    test('should allow access to tenant admins', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains API
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockDomainsResponse),
                });
            } else {
                await route.continue();
            }
        });

        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();

        // Should load the page successfully
        await domainPage.waitForPageReady();

        // Verify domain list is visible
        await domainPage.verifyDomainListVisible();
    });

    test('should allow access to system admins', async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const systemAdmin = new ClientUserBuilder()
            .withDisplayName('System Admin')
            .withEmail('sysadmin@test.com')
            .withRole(SystemUserRoles.SYSTEM_ADMIN)
            .build();

        await authenticatedMockFirebase(systemAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains API
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockDomainsResponse),
                });
            } else {
                await route.continue();
            }
        });

        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();

        // Should load the page successfully
        await domainPage.waitForPageReady();

        // Verify domain list is visible
        await domainPage.verifyDomainListVisible();
    });
});

test.describe('Domain Management Page - Domain List', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains GET endpoint
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockDomainsResponse),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should display all configured domains', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Verify all domains are displayed
        await domainPage.verifyDomainExists('localhost');
        await domainPage.verifyDomainExists('example.com');
        await domainPage.verifyDomainExists('app.example.com');

        // Verify correct count
        await domainPage.verifyDomainCount(3);
    });

    test('should mark primary domain with badge', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Primary domain should have badge
        await domainPage.verifyPrimaryDomain('localhost');
    });

    test('should show DNS instructions', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // DNS instructions should be visible
        await domainPage.verifyDnsInstructionsVisible();
    });
});

test.describe('Domain Management Page - Add Domain Form', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains GET endpoint
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockDomainsResponse),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should show add domain form when button clicked', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Form should not be visible initially
        await domainPage.verifyAddDomainFormHidden();

        // Click add domain button
        await domainPage.clickAddDomain();

        // Form should now be visible
        await domainPage.verifyAddDomainFormVisible();
    });

    test('should hide form when cancel clicked', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Show form
        await domainPage.clickAddDomain();
        await domainPage.verifyAddDomainFormVisible();

        // Click cancel
        await domainPage.cancelAddDomain();

        // Form should be hidden
        await domainPage.verifyAddDomainFormHidden();
    });

    test('should allow entering new domain', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Show form
        await domainPage.clickAddDomain();
        await domainPage.verifyAddDomainFormVisible();

        // Enter domain
        await domainPage.fillNewDomain('newdomain.com');

        // Verify input value
        await domainPage.verifyNewDomainInputValue('newdomain.com');
    });
});

test.describe('Domain Management Page - Add Domain Submission', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains GET endpoint
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockDomainsResponse),
                });
            } else {
                await route.continue();
            }
        });
    });

    test('should show not implemented message when adding domain (501 response)', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Mock the POST endpoint to return 501
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 501,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 'NOT_IMPLEMENTED',
                            message: 'Tenant domain addition not yet implemented',
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Show form and enter domain
        await domainPage.clickAddDomain();
        await domainPage.fillNewDomain('newdomain.com');
        await domainPage.submitNewDomain();

        // Should show not implemented message
        await domainPage.verifyNotImplementedMessage();
    });

    test('should call API with correct data when adding domain', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        let capturedRequestBody: any = null;

        // Mock the POST endpoint
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'POST') {
                capturedRequestBody = await route.request().postDataJSON();
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Domain added successfully',
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Show form and add domain
        await domainPage.clickAddDomain();
        await domainPage.fillNewDomain('newdomain.com');
        await domainPage.submitNewDomain();

        // Wait for the request to complete
        await page.waitForResponse((response) => response.url().includes('/api/settings/tenant/domains') && response.request().method() === 'POST');

        // Verify the request body contains the domain
        expect(capturedRequestBody).toBeTruthy();
        expect(capturedRequestBody.domain).toBe('newdomain.com');
    });

    test('should show success message after adding domain', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Mock successful POST
        await page.route('**/api/settings/tenant/domains', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Domain added successfully',
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Add domain
        await domainPage.clickAddDomain();
        await domainPage.fillNewDomain('newdomain.com');
        await domainPage.submitNewDomain();

        // Should show success message
        await domainPage.verifySuccessMessage();
    });
});

test.describe('Domain Management Page - DNS Instructions', () => {
    test.beforeEach(async ({ pageWithLogging: page, authenticatedMockFirebase }) => {
        const tenantAdmin = new ClientUserBuilder()
            .withDisplayName('Tenant Admin')
            .withEmail('admin@test.com')
            .withRole(SystemUserRoles.TENANT_ADMIN)
            .build();

        await authenticatedMockFirebase(tenantAdmin);
        await setupSuccessfulApiMocks(page);

        // Mock tenant domains endpoint
        await page.route('**/api/settings/tenant/domains', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockDomainsResponse),
            });
        });
    });

    test('should display DNS configuration instructions', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // DNS instructions should be visible
        await domainPage.verifyDnsInstructionsVisible();

        // Should show CNAME details within DNS instructions
        await domainPage.verifyDnsInstructionsShowsCname();
        await domainPage.verifyDnsInstructionsShowsPrimaryDomain();
    });

    test('should have copy DNS button', async ({ pageWithLogging: page }) => {
        const domainPage = new DomainManagementPage(page);
        await domainPage.navigate();
        await domainPage.waitForPageReady();

        // Copy button should be visible
        await domainPage.verifyCopyDnsButtonVisible();
    });
});
