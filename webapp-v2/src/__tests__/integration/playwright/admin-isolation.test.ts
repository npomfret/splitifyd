/**
 * Admin Isolation Tests - Phase 4
 *
 * These tests verify that admin pages are completely isolated from tenant theming:
 * - No tenant theme CSS loaded
 * - Fixed indigo/amber color scheme
 * - No magnetic hover effects
 * - Minimal AdminHeader (logout only)
 */

import { AdminPage } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Admin Page Isolation - Theme Independence', () => {
    test('should not load tenant theme CSS on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyTenantThemeDisabled();
        await adminPage.verifyAdminStylesheetLoaded();
    });

    test('should use fixed indigo/amber color scheme on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyHeaderBackgroundWhite();
    });

    test('should have admin-layout class on root element', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        const count = await adminPage.verifyAdminLayoutCount();
        expect(count).toBeGreaterThan(0);
    });

    test('should have CSS variables defined for admin color scheme', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyAdminPrimaryColorIndigo();
    });
});

test.describe('Admin Page Isolation - Header Component', () => {
    test('should display minimal AdminHeader with logout button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyAdminHeaderVisible();
        await adminPage.verifyLogoutButtonVisible();
        await adminPage.verifyLogoutButtonText();
    });

    test('should display minimal header with logout button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyLogoutButtonVisible();
    });

    test('should not display tenant branding in admin header', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyNoTenantLogo();
    });
});

test.describe('Admin Page Isolation - Motion Disabling', () => {
    test('should have all transitions disabled on admin buttons', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyFirstButtonVisible();
        await adminPage.verifyTransitionsDisabled();
    });

    test('should have transform disabled on admin buttons', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyNoMagneticHoverEffect();
    });

    test('should not have magnetic hover effects on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyButtonPositionUnchangedAfterHover();
    });
});

test.describe('Admin Page Isolation - Background Styling', () => {
    test('should use admin gradient background', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyAdminGradientBackgroundVisible();
    });

    test('should display admin grid pattern overlay', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyAdminGridPatternVisible();
    });
});

test.describe('Admin Page Isolation - AdminLayout Unmounting', () => {
    test('should remove admin stylesheet when navigating away', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        // Navigate to admin page
        await adminPage.navigate();
        await adminPage.verifyAdminStylesheetLoaded();
        await adminPage.verifyTenantThemeDisabled();

        // Navigate away from admin
        await adminPage.navigateToDashboard();

        // Admin stylesheet should be removed
        await adminPage.verifyAdminStylesheetRemoved();

        // Tenant theme stylesheet should be restored
        await adminPage.verifyTenantThemeEnabled();
    });
});

test.describe('Admin Page Isolation - Consistency Across Admin Routes', () => {
    test('should maintain isolation on /admin route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigate();
        await adminPage.verifyAdminIsolation();
    });

    test('should maintain isolation on /admin/tenants route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigateToTenants();
        await adminPage.verifyAdminIsolation();
    });

    test('should maintain isolation on /admin/diagnostics route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;
        const adminPage = new AdminPage(page);

        await adminPage.navigateToDiagnostics();
        await adminPage.verifyAdminIsolation();
    });
});
