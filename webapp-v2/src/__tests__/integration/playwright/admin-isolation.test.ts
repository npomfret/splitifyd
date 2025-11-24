/**
 * Admin Isolation Tests - Phase 4
 *
 * These tests verify that admin pages are completely isolated from tenant theming:
 * - No tenant theme CSS loaded
 * - Fixed indigo/amber color scheme
 * - No magnetic hover effects
 * - Minimal AdminHeader (logout only)
 */

import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Admin Page Isolation - Theme Independence', () => {
    test('should not load tenant theme CSS on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        // Navigate to admin page
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check that tenant theme link is disabled (href is empty)
        const themeLink = page.locator('link#tenant-theme-stylesheet');
        const themeLinkDisabled = await themeLink.evaluate((el: HTMLLinkElement) => {
            return el.disabled || el.href === '' || el.href === window.location.href;
        });
        expect(themeLinkDisabled).toBe(true);

        // Check that admin.css is loaded instead
        const adminStylesheetExists = await page.locator('link#admin-stylesheet').count();
        expect(adminStylesheetExists).toBe(1);
    });

    test('should use fixed indigo/amber color scheme on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Get computed styles from admin page elements
        const headerBg = await page.locator('header.admin-header').evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });

        // Admin header should have white background (admin scheme)
        // Should be rgb(255, 255, 255) or equivalent
        expect(headerBg).toMatch(/rgb\(255,\s*255,\s*255\)/);
    });

    test('should have admin-layout class on root element', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check for admin-layout class
        const hasAdminLayoutClass = await page.locator('.admin-layout').count();
        expect(hasAdminLayoutClass).toBeGreaterThan(0);
    });

    test('should have CSS variables defined for admin color scheme', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check that admin CSS variables are defined
        const adminPrimaryColor = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--admin-primary').trim();
        });

        // Should have admin-primary defined (indigo-600)
        expect(adminPrimaryColor).toBe('#4f46e5');
    });
});

test.describe('Admin Page Isolation - Header Component', () => {
    test('should display minimal AdminHeader with logout button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check for AdminHeader
        const adminHeader = page.locator('header.admin-header');
        await expect(adminHeader).toBeVisible();

        // Check for logout button
        const logoutButton = page.locator('[data-testid="admin-logout-button"]');
        await expect(logoutButton).toBeVisible();
        await expect(logoutButton).toHaveText(/Logout/i);
    });

    test('should display minimal header with logout button', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check for logout button in header
        const logoutButton = page.locator('header.admin-header button[data-testid="admin-logout-button"]');
        await expect(logoutButton).toBeVisible();
    });

    test('should not display tenant branding in admin header', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Should not have tenant logo or app name (other than "System Admin")
        const tenantLogo = page.locator('header img[alt*="BillSplit"]');
        const tenantLogoCount = await tenantLogo.count();
        expect(tenantLogoCount).toBe(0);
    });
});

test.describe('Admin Page Isolation - Motion Disabling', () => {
    test('should have all transitions disabled on admin buttons', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Get button element
        const button = page.locator('button').first();
        await expect(button).toBeVisible();

        // Check that transition is disabled (should be "none" or "all 0s")
        const transition = await button.evaluate((el) => {
            return window.getComputedStyle(el).transition;
        });

        expect(transition).toMatch(/none|0s/);
    });

    test('should have transform disabled on admin buttons', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Get button element
        const button = page.locator('button').first();

        // Get initial transform
        const initialTransform = await button.evaluate((el) => {
            return window.getComputedStyle(el).transform;
        });

        // Hover over button
        await button.hover();
        await page.waitForTimeout(100);

        // Get transform after hover
        const hoverTransform = await button.evaluate((el) => {
            return window.getComputedStyle(el).transform;
        });

        // Transform should not change (magnetic hover disabled)
        expect(initialTransform).toBe(hoverTransform);
    });

    test('should not have magnetic hover effects on admin pages', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Find a button on the page
        const button = page.locator('button[data-testid*="admin"]').first();
        await expect(button).toBeVisible();

        // Get button position before hover
        const beforeBox = await button.boundingBox();
        expect(beforeBox).toBeTruthy();

        // Move mouse over button (should NOT cause magnetic effect)
        await button.hover();
        await page.waitForTimeout(200); // Wait for any potential animation

        // Get button position after hover
        const afterBox = await button.boundingBox();
        expect(afterBox).toBeTruthy();

        // Button should remain in same position (no magnetic movement)
        expect(afterBox?.x).toBeCloseTo(beforeBox!.x, 1);
        expect(afterBox?.y).toBeCloseTo(beforeBox!.y, 1);
    });
});

test.describe('Admin Page Isolation - Background Styling', () => {
    test('should use admin gradient background', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check for admin gradient class
        const adminGradient = page.locator('.admin-gradient-mixed');
        const count = await adminGradient.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should display admin grid pattern overlay', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Check for admin grid pattern
        const gridPattern = page.locator('.admin-grid-pattern');
        await expect(gridPattern).toBeVisible();
    });
});

test.describe('Admin Page Isolation - AdminLayout Unmounting', () => {
    test('should remove admin stylesheet when navigating away', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        // Navigate to admin page
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Verify admin stylesheet exists
        const adminStylesheetExists = await page.locator('link#admin-stylesheet').count();
        expect(adminStylesheetExists).toBe(1);

        // Verify tenant theme is disabled
        const themeLinkDisabled = await page.locator('link#tenant-theme-stylesheet').evaluate((el: HTMLLinkElement) => {
            return el.disabled || el.href === '' || el.href === window.location.href;
        });
        expect(themeLinkDisabled).toBe(true);

        // Navigate away from admin
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Admin stylesheet should be removed
        const adminStylesheetAfter = await page.locator('link#admin-stylesheet').count();
        expect(adminStylesheetAfter).toBe(0);

        // Tenant theme stylesheet should be restored (enabled with valid href)
        const themeLinkRestored = await page.locator('link#tenant-theme-stylesheet').evaluate((el: HTMLLinkElement) => {
            return !el.disabled && el.href !== '' && el.href.includes('/api/theme.css');
        });
        expect(themeLinkRestored).toBe(true);
    });
});

test.describe('Admin Page Isolation - Consistency Across Admin Routes', () => {
    test('should maintain isolation on /admin route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        const hasAdminLayout = await page.locator('.admin-layout').count();
        const hasAdminStylesheet = await page.locator('link#admin-stylesheet').count();

        expect(hasAdminLayout).toBeGreaterThan(0);
        expect(hasAdminStylesheet).toBe(1);
    });

    test('should maintain isolation on /admin/tenants route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin/tenants');
        await page.waitForLoadState('networkidle');

        const hasAdminLayout = await page.locator('.admin-layout').count();
        const hasAdminStylesheet = await page.locator('link#admin-stylesheet').count();

        expect(hasAdminLayout).toBeGreaterThan(0);
        expect(hasAdminStylesheet).toBe(1);
    });

    test('should maintain isolation on /admin/diagnostics route', async ({ systemAdminPage }) => {
        const { page } = systemAdminPage;

        await page.goto('/admin/diagnostics');
        await page.waitForLoadState('networkidle');

        const hasAdminLayout = await page.locator('.admin-layout').count();
        const hasAdminStylesheet = await page.locator('link#admin-stylesheet').count();

        expect(hasAdminLayout).toBeGreaterThan(0);
        expect(hasAdminStylesheet).toBe(1);
    });
});
